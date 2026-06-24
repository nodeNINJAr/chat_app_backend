import { ApiProperty } from '@nestjs/swagger';
import { ArrayMinSize, IsMongoId } from 'class-validator';

export class ForwardMessageDto {
  @ApiProperty()
  @IsMongoId()
  messageId: string;

  @ApiProperty({ type: [String] })
  @IsMongoId({ each: true })
  @ArrayMinSize(1)
  targetConversationIds: string[];
}
