import { ApiProperty } from '@nestjs/swagger';
import { IsMongoId, IsObject } from 'class-validator';

export class SdpDto {
  @ApiProperty()
  @IsMongoId()
  callId: string;

  @ApiProperty({ description: 'RTCSessionDescriptionInit' })
  @IsObject()
  sdp: Record<string, unknown>;
}
