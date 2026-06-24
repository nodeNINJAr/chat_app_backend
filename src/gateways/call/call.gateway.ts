import { UsePipes, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import type { Server, Socket } from 'socket.io';
import { userRoom } from '../../common/helpers/rooms';
import { authenticateSocket } from '../../common/helpers/ws-auth';
import { CallsService } from '../../modules/calls/calls.service';
import { CallIdDto } from '../../modules/calls/dto/call-id.dto';
import { IceCandidateDto } from '../../modules/calls/dto/ice-candidate.dto';
import { InitiateCallDto } from '../../modules/calls/dto/initiate-call.dto';
import { SdpDto } from '../../modules/calls/dto/sdp.dto';
import { NotificationsService } from '../../modules/notifications/notifications.service';
import { UsersService } from '../../modules/users/users.service';

interface AuthedSocket extends Socket {
  data: { userId: string };
}

interface RingingEntry {
  callerId: string;
  calleeId: string;
  timeout: NodeJS.Timeout;
}

const RINGING_TIMEOUT_MS = 45_000;

/**
 * Single-instance in-memory state. Fine for one pod; horizontally scaling this
 * gateway would need the ringing/active-call state moved to Redis so any pod
 * can service any signaling event for a given call.
 */
@UsePipes(
  new ValidationPipe({
    whitelist: true,
    transform: true,
    forbidNonWhitelisted: true,
  }),
)
@WebSocketGateway({
  namespace: '/calls',
  cors: { origin: process.env.CORS_ORIGIN, credentials: true },
})
export class CallGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly ringing = new Map<string, RingingEntry>();

  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly callsService: CallsService,
    private readonly usersService: UsersService,
    private readonly notificationsService: NotificationsService,
  ) {}

  async handleConnection(socket: AuthedSocket): Promise<void> {
    const userId = await authenticateSocket(
      socket,
      this.jwtService,
      this.configService,
    );
    if (!userId) {
      socket.disconnect(true);
      return;
    }
    socket.data.userId = userId;
    await socket.join(userRoom(userId));
  }

  handleDisconnect(): void {
    // Ringing/active calls are left to caller-side timeout or explicit call:end;
    // a disconnect mid-call doesn't by itself end the call (other tabs/devices may still hold it).
  }

  @SubscribeMessage('call:initiate')
  async handleInitiate(
    @ConnectedSocket() socket: AuthedSocket,
    @MessageBody() dto: InitiateCallDto,
  ) {
    const callerId = socket.data.userId;

    const blocked = await this.usersService.isBlocked(callerId, dto.calleeId);
    if (blocked) {
      socket.emit('call:error', { message: 'cannot call this user' });
      return;
    }

    if (await this.callsService.isBusy(dto.calleeId)) {
      socket.emit('call:busy', { calleeId: dto.calleeId });
      return;
    }

    const call = await this.callsService.initiate(
      callerId,
      dto.calleeId,
      dto.type,
    );
    const callId = call.id;

    const timeout = setTimeout(() => {
      void this.handleRingTimeout(callId);
    }, RINGING_TIMEOUT_MS);
    this.ringing.set(callId, { callerId, calleeId: dto.calleeId, timeout });

    this.server
      .to(userRoom(dto.calleeId))
      .emit('call:incoming', { callId, callerId, type: dto.type });
    socket.emit('call:ringing', { callId });

    void this.notificationsService.notifyOfflineUsers([dto.calleeId], {
      title: 'Incoming call',
      body: `Incoming ${dto.type} call`,
      data: { callId },
    });
  }

  @SubscribeMessage('call:accept')
  async handleAccept(
    @ConnectedSocket() socket: AuthedSocket,
    @MessageBody() dto: CallIdDto,
  ) {
    const entry = this.ringing.get(dto.callId);
    if (!entry || entry.calleeId !== socket.data.userId) return;

    clearTimeout(entry.timeout);
    this.ringing.delete(dto.callId);

    await this.callsService.markActive(dto.callId);
    await this.callsService.setBusy(entry.callerId, dto.callId);
    await this.callsService.setBusy(entry.calleeId, dto.callId);

    socket.to(userRoom(entry.calleeId)).emit('call:cancelled', {
      callId: dto.callId,
      reason: 'accepted_elsewhere',
    });
    this.server
      .to(userRoom(entry.callerId))
      .emit('call:accepted', { callId: dto.callId });
  }

  @SubscribeMessage('call:reject')
  async handleReject(
    @ConnectedSocket() socket: AuthedSocket,
    @MessageBody() dto: CallIdDto,
  ) {
    const entry = this.ringing.get(dto.callId);
    if (!entry || entry.calleeId !== socket.data.userId) return;

    clearTimeout(entry.timeout);
    this.ringing.delete(dto.callId);

    await this.callsService.markEnded(dto.callId, 'rejected');
    this.server
      .to(userRoom(entry.callerId))
      .emit('call:reject', { callId: dto.callId });
  }

  @SubscribeMessage('call:cancel')
  async handleCancel(
    @ConnectedSocket() socket: AuthedSocket,
    @MessageBody() dto: CallIdDto,
  ) {
    const entry = this.ringing.get(dto.callId);
    if (!entry || entry.callerId !== socket.data.userId) return;

    clearTimeout(entry.timeout);
    this.ringing.delete(dto.callId);

    await this.callsService.markEnded(dto.callId, 'cancelled');
    this.server.to(userRoom(entry.calleeId)).emit('call:cancelled', {
      callId: dto.callId,
      reason: 'caller_cancelled',
    });
  }

  @SubscribeMessage('call:offer')
  async handleOffer(
    @ConnectedSocket() socket: AuthedSocket,
    @MessageBody() dto: SdpDto,
  ) {
    const otherPartyId = await this.getOtherPartyId(
      dto.callId,
      socket.data.userId,
    );
    if (!otherPartyId) return;
    this.server
      .to(userRoom(otherPartyId))
      .emit('call:offer', { callId: dto.callId, sdp: dto.sdp });
  }

  @SubscribeMessage('call:answer')
  async handleAnswer(
    @ConnectedSocket() socket: AuthedSocket,
    @MessageBody() dto: SdpDto,
  ) {
    const otherPartyId = await this.getOtherPartyId(
      dto.callId,
      socket.data.userId,
    );
    if (!otherPartyId) return;
    this.server
      .to(userRoom(otherPartyId))
      .emit('call:answer', { callId: dto.callId, sdp: dto.sdp });
  }

  @SubscribeMessage('call:ice-candidate')
  async handleIceCandidate(
    @ConnectedSocket() socket: AuthedSocket,
    @MessageBody() dto: IceCandidateDto,
  ) {
    const otherPartyId = await this.getOtherPartyId(
      dto.callId,
      socket.data.userId,
    );
    if (!otherPartyId) return;
    this.server.to(userRoom(otherPartyId)).emit('call:ice-candidate', {
      callId: dto.callId,
      candidate: dto.candidate,
    });
  }

  @SubscribeMessage('call:end')
  async handleEnd(
    @ConnectedSocket() socket: AuthedSocket,
    @MessageBody() dto: CallIdDto,
  ) {
    const entry = this.ringing.get(dto.callId);
    if (entry) {
      clearTimeout(entry.timeout);
      this.ringing.delete(dto.callId);
    }

    const call = await this.callsService.findById(dto.callId);
    if (!call) return;

    const wasActive = call.status === 'active';
    await this.callsService.markEnded(
      dto.callId,
      wasActive ? 'completed' : 'cancelled',
    );
    await this.callsService.clearBusy(call.callerId.toString());
    await this.callsService.clearBusy(call.calleeId.toString());

    const otherPartyId =
      socket.data.userId === call.callerId.toString()
        ? call.calleeId.toString()
        : call.callerId.toString();
    this.server
      .to(userRoom(otherPartyId))
      .emit('call:end', { callId: dto.callId });
  }

  private async handleRingTimeout(callId: string): Promise<void> {
    const entry = this.ringing.get(callId);
    if (!entry) return;
    this.ringing.delete(callId);

    await this.callsService.markEnded(callId, 'missed');
    this.server.to(userRoom(entry.callerId)).emit('call:timeout', { callId });
    this.server.to(userRoom(entry.calleeId)).emit('call:timeout', { callId });

    void this.notificationsService.notifyOfflineUsers([entry.calleeId], {
      title: 'Missed call',
      body: 'You missed a call',
      data: { callId },
    });
  }

  private async getOtherPartyId(
    callId: string,
    myUserId: string,
  ): Promise<string | null> {
    const entry = this.ringing.get(callId);
    if (entry) {
      return entry.callerId === myUserId ? entry.calleeId : entry.callerId;
    }
    const call = await this.callsService.findById(callId);
    if (!call) return null;
    return call.callerId.toString() === myUserId
      ? call.calleeId.toString()
      : call.callerId.toString();
  }
}
