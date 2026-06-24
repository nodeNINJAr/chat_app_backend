import { ApiProperty } from '@nestjs/swagger';
import { IsMongoId, IsObject } from 'class-validator';

export class IceCandidateDto {
  @ApiProperty()
  @IsMongoId()
  callId: string;

  @ApiProperty({ description: 'RTCIceCandidateInit' })
  @IsObject()
  candidate: Record<string, unknown>;
}
