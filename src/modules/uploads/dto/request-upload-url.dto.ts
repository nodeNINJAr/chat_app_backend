import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsInt, IsString, Max, Min } from 'class-validator';

export const UPLOAD_KINDS = ['image', 'video', 'audio', 'document'] as const;
export type UploadKind = (typeof UPLOAD_KINDS)[number];

export class RequestUploadUrlDto {
  @ApiProperty({ example: 'vacation.jpg' })
  @IsString()
  fileName: string;

  @ApiProperty({ example: 'image/jpeg' })
  @IsString()
  mimeType: string;

  @ApiProperty({ description: 'bytes' })
  @IsInt()
  @Min(1)
  @Max(200 * 1024 * 1024)
  fileSize: number;

  @ApiProperty({ enum: UPLOAD_KINDS })
  @IsEnum(UPLOAD_KINDS)
  kind: UploadKind;
}
