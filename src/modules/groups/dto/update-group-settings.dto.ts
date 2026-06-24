import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsEnum,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
  ValidateNested,
} from 'class-validator';

class GroupSettingsDto {
  @ApiPropertyOptional({ enum: ['everyone', 'admins'] })
  @IsOptional()
  @IsEnum(['everyone', 'admins'])
  whoCanSendMessages?: 'everyone' | 'admins';

  @ApiPropertyOptional({ enum: ['everyone', 'admins'] })
  @IsOptional()
  @IsEnum(['everyone', 'admins'])
  whoCanAddMembers?: 'everyone' | 'admins';
}

export class UpdateGroupSettingsDto {
  @ApiPropertyOptional({ maxLength: 100 })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  name?: string;

  @ApiPropertyOptional({ maxLength: 500 })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUrl()
  avatarUrl?: string;

  @ApiPropertyOptional({ type: GroupSettingsDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => GroupSettingsDto)
  settings?: GroupSettingsDto;
}
