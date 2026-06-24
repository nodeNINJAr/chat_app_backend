import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsMongoId } from 'class-validator';

export class InitiateCallDto {
  @ApiProperty()
  @IsMongoId()
  calleeId: string;

  @ApiProperty({ enum: ['audio', 'video'] })
  @IsEnum(['audio', 'video'])
  type: 'audio' | 'video';
}
