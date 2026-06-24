import { Inject, Injectable, Logger } from '@nestjs/common';
import { PresenceService } from '../../infrastructure/redis/presence.service';
import { UsersService } from '../users/users.service';
import { PUSH_SENDER } from './push-sender.interface';
import type { PushPayload, PushSender } from './push-sender.interface';

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    @Inject(PUSH_SENDER) private readonly pushSender: PushSender,
    private readonly usersService: UsersService,
    private readonly presenceService: PresenceService,
  ) {}

  /** Sends to every device of every user in userIds who has no active socket right now. */
  async notifyOfflineUsers(
    userIds: string[],
    payload: PushPayload,
  ): Promise<void> {
    await Promise.all(
      userIds.map((userId) => this.notifyUserIfOffline(userId, payload)),
    );
  }

  private async notifyUserIfOffline(
    userId: string,
    payload: PushPayload,
  ): Promise<void> {
    const online = await this.presenceService.isOnline(userId);
    if (online) return;

    const user = await this.usersService.findByIdOrThrow(userId);
    await Promise.all(
      user.devices.map((device) =>
        this.pushSender
          .send(device.pushToken, device.platform, payload)
          .catch((err) => {
            this.logger.warn(
              `push delivery failed for user=${userId} device=${device.deviceId}: ${(err as Error).message}`,
            );
          }),
      ),
    );
  }
}
