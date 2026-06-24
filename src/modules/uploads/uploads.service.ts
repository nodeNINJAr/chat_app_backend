import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { STORAGE_PROVIDER } from '../../infrastructure/storage/storage-provider.interface';
import type { StorageProvider } from '../../infrastructure/storage/storage-provider.interface';
import { RequestUploadUrlDto, UploadKind } from './dto/request-upload-url.dto';

const LIMITS: Record<UploadKind, { maxBytes: number; mimeTypes: string[] }> = {
  image: {
    maxBytes: 15 * 1024 * 1024,
    mimeTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/gif'],
  },
  video: {
    maxBytes: 200 * 1024 * 1024,
    mimeTypes: ['video/mp4', 'video/quicktime', 'video/webm'],
  },
  audio: {
    maxBytes: 50 * 1024 * 1024,
    mimeTypes: [
      'audio/mpeg',
      'audio/ogg',
      'audio/webm',
      'audio/mp4',
      'audio/wav',
    ],
  },
  document: {
    maxBytes: 50 * 1024 * 1024,
    mimeTypes: [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'text/plain',
    ],
  },
};

@Injectable()
export class UploadsService {
  constructor(
    @Inject(STORAGE_PROVIDER) private readonly storageProvider: StorageProvider,
  ) {}

  async createPresignedUpload(
    userId: string,
    dto: RequestUploadUrlDto,
  ): Promise<{
    key: string;
    uploadMethod: string;
    uploadUrl: string;
    expiresIn: number;
  }> {
    const limit = LIMITS[dto.kind];
    if (!limit.mimeTypes.includes(dto.mimeType)) {
      throw new BadRequestException(
        `mimeType ${dto.mimeType} is not allowed for kind ${dto.kind}`,
      );
    }
    if (dto.fileSize > limit.maxBytes) {
      throw new BadRequestException(
        `file exceeds the ${limit.maxBytes} byte limit for kind ${dto.kind}`,
      );
    }

    const key = this.storageProvider.buildKey(userId, dto.fileName);
    const expiresIn = 300;
    const target = await this.storageProvider.getUploadTarget(
      key,
      dto.mimeType,
      expiresIn,
    );
    return {
      key,
      uploadMethod: target.method,
      uploadUrl: target.url,
      expiresIn,
    };
  }

  async getDownloadUrl(
    key: string,
  ): Promise<{ url: string; expiresIn: number }> {
    const expiresIn = 300;
    const url = await this.storageProvider.getDownloadUrl(key, expiresIn);
    return { url, expiresIn };
  }
}
