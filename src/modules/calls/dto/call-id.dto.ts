import { ApiProperty } from '@nestjs/swagger';
import { IsMongoId } from 'class-validator';

export class CallIdDto {
  @ApiProperty()
  @IsMongoId()
  callId: string;
}
