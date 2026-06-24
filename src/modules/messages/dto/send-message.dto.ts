import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsEnum,
  IsMongoId,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { MessageContentDto } from './message-content.dto';

export const MESSAGE_TYPES = [
  'text',
  'image',
  'video',
  'audio',
  'file',
] as const;
export type SendableMessageType = (typeof MESSAGE_TYPES)[number];

export class SendMessageDto {
  @ApiProperty()
  @IsMongoId()
  conversationId: string;

  @ApiProperty({ enum: MESSAGE_TYPES })
  @IsEnum(MESSAGE_TYPES)
  type: SendableMessageType;

  @ApiProperty({ type: MessageContentDto })
  @ValidateNested()
  @Type(() => MessageContentDto)
  content: MessageContentDto;

  @ApiPropertyOptional()
  @IsOptional()
  @IsMongoId()
  replyToMessageId?: string;

  /** Lets the client reconcile its optimistic UI message with the server-confirmed one. */
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  clientTempId?: string;
}
