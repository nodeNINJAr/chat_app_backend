import { ApiProperty } from '@nestjs/swagger';
import { IsMongoId } from 'class-validator';

export class MarkReadDto {
  @ApiProperty()
  @IsMongoId()
  conversationId: string;

  @ApiProperty()
  @IsMongoId()
  upToMessageId: string;
}
