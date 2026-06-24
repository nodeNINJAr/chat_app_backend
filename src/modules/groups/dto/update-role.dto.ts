import { ApiProperty } from '@nestjs/swagger';
import { IsEnum } from 'class-validator';

export class UpdateRoleDto {
  @ApiProperty({ enum: ['admin', 'member'] })
  @IsEnum(['admin', 'member'])
  role: 'admin' | 'member';
}
