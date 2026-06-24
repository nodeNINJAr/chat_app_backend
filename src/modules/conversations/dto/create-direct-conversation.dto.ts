import { ApiProperty } from '@nestjs/swagger';
import { IsMongoId } from 'class-validator';

export class CreateDirectConversationDto {
  @ApiProperty({ description: "the other participant's user id" })
  @IsMongoId()
  userId: string;
}
