import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsUrl, MaxLength } from 'class-validator';

export class UpdateProfileDto {
  @ApiPropertyOptional({ example: 'Jane Doe', maxLength: 60 })
  @IsOptional()
  @IsString()
  @MaxLength(60)
  displayName?: string;

  @ApiPropertyOptional({ example: 'Coffee and code.', maxLength: 160 })
  @IsOptional()
  @IsString()
  @MaxLength(160)
  bio?: string;

  @ApiPropertyOptional({ example: 'https://cdn.example.com/avatars/jane.png' })
  @IsOptional()
  @IsUrl()
  avatarUrl?: string;
}
