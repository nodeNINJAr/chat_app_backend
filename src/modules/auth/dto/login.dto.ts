import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';

export class LoginDto {
  @ApiProperty({ example: 'jane_doe', description: 'username or email' })
  @IsString()
  identifier: string;

  @ApiProperty({ example: 'S3curePassw0rd', minLength: 8 })
  @IsString()
  @MinLength(8)
  password: string;
}
