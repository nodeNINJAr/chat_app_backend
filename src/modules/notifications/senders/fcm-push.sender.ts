import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  App,
  cert,
  deleteApp,
  initializeApp,
  ServiceAccount,
} from 'firebase-admin/app';
import { getMessaging, Messaging } from 'firebase-admin/messaging';
import { PushPayload, PushSender } from '../push-sender.interface';

// NotificationsService already catches and logs per-user/device send
// failures, so failures here are left to propagate rather than swallowed.
@Injectable()
export class FcmPushSender implements PushSender, OnModuleInit {
  private app: App | undefined;
  private messaging: Messaging | undefined;

  constructor(private readonly configService: ConfigService) {}

  onModuleInit(): void {
    const serviceAccountJson = this.configService.getOrThrow<string>(
      'FCM_SERVICE_ACCOUNT_JSON',
    );
    const serviceAccount = JSON.parse(serviceAccountJson) as ServiceAccount;
    this.app = initializeApp(
      { credential: cert(serviceAccount) },
      'chat-app-push',
    );
    this.messaging = getMessaging(this.app);
  }

  async onModuleDestroy(): Promise<void> {
    if (this.app) await deleteApp(this.app);
  }

  async send(
    pushToken: string,
    _platform: 'ios' | 'android' | 'web',
    payload: PushPayload,
  ): Promise<void> {
    await this.messaging?.send({
      token: pushToken,
      notification: { title: payload.title, body: payload.body },
      data: payload.data,
    });
  }
}
