import { ApiProperty } from '@nestjs/swagger';
import { IsMongoId, IsString, MaxLength } from 'class-validator';

export class ReactMessageDto {
  @ApiProperty()
  @IsMongoId()
  messageId: string;

  @ApiProperty({ example: '👍' })
  @IsString()
  @MaxLength(8)
  emoji: string;
}
