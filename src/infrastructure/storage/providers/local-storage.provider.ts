import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';
import { StorageProvider, UploadTarget } from '../storage-provider.interface';
import { encodeKey, signLocalStorageUrl } from './local-storage.signing';

/**
 * Default storage backend — saves files to local disk and serves them through
 * this same NestJS process. No external dependency, so the app boots and uploads
 * work out of the box with zero configuration. Not suitable for multi-instance
 * deployments (each pod would have its own disk) — switch STORAGE_DRIVER=s3 for that.
 */
@Injectable()
export class LocalStorageProvider implements StorageProvider {
  private readonly secret: string;
  private readonly publicApiUrl: string;

  constructor(private readonly configService: ConfigService) {
    this.secret = this.configService.getOrThrow<string>('JWT_ACCESS_SECRET');
    this.publicApiUrl = this.configService
      .get<string>('PUBLIC_API_URL', 'http://localhost:3000')
      .replace(/\/$/, '');
  }

  buildKey(userId: string, fileName: string): string {
    const safeName = fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
    return `uploads/${userId}/${randomUUID()}-${safeName}`;
  }

  getUploadTarget(
    key: string,
    _mimeType: string,
    expiresInSeconds: number,
  ): Promise<UploadTarget> {
    return Promise.resolve({
      method: 'PUT',
      url: this.signedUrl(key, expiresInSeconds),
    });
  }

  getDownloadUrl(key: string, expiresInSeconds: number): Promise<string> {
    return Promise.resolve(this.signedUrl(key, expiresInSeconds));
  }

  private signedUrl(key: string, expiresInSeconds: number): string {
    const expiry = Math.floor(Date.now() / 1000) + expiresInSeconds;
    const signature = signLocalStorageUrl(key, expiry, this.secret);
    return `${this.publicApiUrl}/uploads/local-store/${encodeKey(key)}?exp=${expiry}&sig=${signature}`;
  }
}
