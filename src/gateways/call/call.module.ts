import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { CallsModule } from '../../modules/calls/calls.module';
import { NotificationsModule } from '../../modules/notifications/notifications.module';
import { UsersModule } from '../../modules/users/users.module';
import { CallGateway } from './call.gateway';

@Module({
  imports: [
    JwtModule.register({}),
    CallsModule,
    UsersModule,
    NotificationsModule,
  ],
  providers: [CallGateway],
})
export class CallModule {}
