import { ApiProperty } from '@nestjs/swagger';
import {
  IsEmail,
  IsOptional,
  IsString,
  Matches,
  MinLength,
} from 'class-validator';

export class CreateUserDto {
  @ApiProperty({ example: 'jane_doe', minLength: 3 })
  @IsString()
  @MinLength(3)
  @Matches(/^[a-zA-Z0-9_.]+$/, {
    message: 'username may only contain letters, numbers, underscores and dots',
  })
  username: string;

  @ApiProperty({ example: 'jane@example.com', required: false })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiProperty({ example: 'S3curePassw0rd', minLength: 8 })
  @IsString()
  @MinLength(8)
  password: string;

  @ApiProperty({ example: 'Jane Doe' })
  @IsString()
  @MinLength(1)
  displayName: string;
}
