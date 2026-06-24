import { ApiProperty } from '@nestjs/swagger';
import {
  ArrayMinSize,
  IsMongoId,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CreateGroupDto {
  @ApiProperty({ example: 'Weekend Trip' })
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name: string;

  @ApiProperty({
    type: [String],
    description: 'initial members, excluding yourself',
  })
  @IsMongoId({ each: true })
  @ArrayMinSize(1)
  memberIds: string[];
}
