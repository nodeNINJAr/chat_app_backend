import { Module } from '@nestjs/common';
import { UsersModule } from '../users/users.module';
import { NotificationsService } from './notifications.service';
import { PUSH_SENDER } from './push-sender.interface';
import { ConsolePushSender } from './senders/console-push.sender';

@Module({
  imports: [UsersModule],
  providers: [
    NotificationsService,
    { provide: PUSH_SENDER, useClass: ConsolePushSender },
  ],
  exports: [NotificationsService],
})
export class NotificationsModule {}
