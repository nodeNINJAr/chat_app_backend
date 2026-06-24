import { ApiProperty } from '@nestjs/swagger';
import { ArrayMinSize, IsMongoId } from 'class-validator';

export class AddMembersDto {
  @ApiProperty({ type: [String] })
  @IsMongoId({ each: true })
  @ArrayMinSize(1)
  memberIds: string[];
}
