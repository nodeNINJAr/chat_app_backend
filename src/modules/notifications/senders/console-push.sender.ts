import { Injectable, Logger } from '@nestjs/common';
import { PushPayload, PushSender } from '../push-sender.interface';

/**
 * Default dev/test sender — logs instead of calling a real push provider.
 * Swap in an FCM/APNs-backed implementation of PushSender (e.g. via firebase-admin)
 * behind the PUSH_SENDER token in NotificationsModule for production.
 */
@Injectable()
export class ConsolePushSender implements PushSender {
  private readonly logger = new Logger(ConsolePushSender.name);

  send(
    pushToken: string,
    platform: 'ios' | 'android' | 'web',
    payload: PushPayload,
  ): Promise<void> {
    this.logger.log(
      `[push:${platform}] token=${pushToken.slice(0, 12)}... "${payload.title}" — ${payload.body}`,
    );
    return Promise.resolve();
  }
}
