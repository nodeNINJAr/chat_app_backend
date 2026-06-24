import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import type { Socket } from 'socket.io';
import type { JwtAccessPayload } from '../types/authenticated-user.type';

const logger = new Logger('WsAuth');

/** Verifies the JWT passed in the Socket.IO handshake (`auth: { token }`); returns null on any failure. */
export async function authenticateSocket(
  socket: Socket,
  jwtService: JwtService,
  configService: ConfigService,
): Promise<string | null> {
  const token = socket.handshake.auth?.token as string | undefined;
  if (!token) return null;
  try {
    const payload = await jwtService.verifyAsync<JwtAccessPayload>(token, {
      secret: configService.getOrThrow<string>('JWT_ACCESS_SECRET'),
    });
    return payload.sub;
  } catch (err) {
    logger.debug(`socket auth failed: ${(err as Error).message}`);
    return null;
  }
}
