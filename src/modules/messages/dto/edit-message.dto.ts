import { ApiProperty } from '@nestjs/swagger';
import { IsMongoId, IsString, MinLength } from 'class-validator';

export class EditMessageDto {
  @ApiProperty()
  @IsMongoId()
  messageId: string;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  text: string;
}
