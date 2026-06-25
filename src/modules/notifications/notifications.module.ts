import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { UsersModule } from '../users/users.module';
import { NotificationsService } from './notifications.service';
import { PUSH_SENDER } from './push-sender.interface';
import { ConsolePushSender } from './senders/console-push.sender';
import { FcmPushSender } from './senders/fcm-push.sender';

@Module({
  imports: [ConfigModule, UsersModule],
  providers: [
    NotificationsService,
    {
      provide: PUSH_SENDER,
      inject: [ConfigService],
      // Constructed manually (not via the providers array) so the FCM SDK is
      // only initialized when PUSH_DRIVER=fcm — it requires a service account
      // and must not run during local dev or tests.
      useFactory: (configService: ConfigService) => {
        if (configService.get<string>('PUSH_DRIVER') === 'fcm') {
          const sender = new FcmPushSender(configService);
          sender.onModuleInit();
          return sender;
        }
        return new ConsolePushSender();
      },
    },
  ],
  exports: [NotificationsService],
})
export class NotificationsModule {}
