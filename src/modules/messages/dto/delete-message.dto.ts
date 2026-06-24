import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsMongoId } from 'class-validator';

export class DeleteMessageDto {
  @ApiProperty()
  @IsMongoId()
  messageId: string;

  @ApiProperty({ enum: ['me', 'everyone'] })
  @IsEnum(['me', 'everyone'])
  mode: 'me' | 'everyone';
}
