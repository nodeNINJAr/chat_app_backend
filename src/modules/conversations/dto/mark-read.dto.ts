import { ApiProperty } from '@nestjs/swagger';
import { IsMongoId } from 'class-validator';

export class MarkReadDto {
  @ApiProperty()
  @IsMongoId()
  upToMessageId: string;
}
