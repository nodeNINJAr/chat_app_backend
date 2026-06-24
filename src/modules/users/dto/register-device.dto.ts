import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsString } from 'class-validator';

export class RegisterDeviceDto {
  @ApiProperty({ example: 'a1b2c3-device-uuid' })
  @IsString()
  deviceId: string;

  @ApiProperty({ example: 'fcm-or-apns-push-token' })
  @IsString()
  pushToken: string;

  @ApiProperty({ enum: ['ios', 'android', 'web'] })
  @IsEnum(['ios', 'android', 'web'])
  platform: 'ios' | 'android' | 'web';
}
