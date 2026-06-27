import {
  HeadBucketCommand,
  CreateBucketCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';
import { StorageProvider, UploadTarget } from '../storage-provider.interface';

@Injectable()
export class S3StorageProvider implements StorageProvider, OnModuleInit {
  private readonly logger = new Logger(S3StorageProvider.name);
  private readonly client: S3Client;
  private readonly bucket: string;
  private readonly publicEndpoint: string | undefined;

  constructor(private readonly configService: ConfigService) {
    this.bucket = this.configService.getOrThrow<string>('S3_BUCKET');
    this.publicEndpoint = this.configService
      .get<string>('S3_PUBLIC_ENDPOINT')
      ?.replace(/\/$/, '');
    this.client = new S3Client({
      endpoint: this.configService.getOrThrow<string>('S3_ENDPOINT'),
      region: this.configService.getOrThrow<string>('S3_REGION'),
      forcePathStyle:
        this.configService.get<boolean>('S3_FORCE_PATH_STYLE') ?? true,
      credentials: {
        accessKeyId: this.configService.getOrThrow<string>('S3_ACCESS_KEY_ID'),
        secretAccessKey: this.configService.getOrThrow<string>(
          'S3_SECRET_ACCESS_KEY',
        ),
      },
    });
  }

  async onModuleInit(): Promise<void> {
    try {
      await this.client.send(new HeadBucketCommand({ Bucket: this.bucket }));
    } catch {
      this.logger.log(`bucket "${this.bucket}" not found, creating it`);
      await this.client.send(new CreateBucketCommand({ Bucket: this.bucket }));
    }
  }

  buildKey(userId: string, fileName: string, prefix = 'uploads'): string {
    const safeName = fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
    return `${prefix}/${userId}/${randomUUID()}-${safeName}`;
  }

  async getUploadTarget(
    key: string,
    mimeType: string,
    expiresInSeconds: number,
  ): Promise<UploadTarget> {
    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      ContentType: mimeType,
      // Avatars are meant to be permanently, publicly readable (see
      // getPublicUrl) — everything else stays private behind signed GETs.
      // Requires the bucket to actually allow public ACLs; on providers
      // that block them by default (e.g. AWS's account-level Block Public
      // Access), this needs the bucket/account configured to permit it.
      ...(key.startsWith('avatars/') ? { ACL: 'public-read' as const } : {}),
    });
    const url = await getSignedUrl(this.client, command, {
      expiresIn: expiresInSeconds,
    });
    return { method: 'PUT', url };
  }

  async getDownloadUrl(key: string, expiresInSeconds: number): Promise<string> {
    const command = new GetObjectCommand({ Bucket: this.bucket, Key: key });
    return getSignedUrl(this.client, command, { expiresIn: expiresInSeconds });
  }

  // Direct, unsigned bucket URL — only correct if the bucket/prefix is
  // actually configured for public reads (see the ACL note above). Falls
  // back to the raw S3 endpoint if no CDN/public endpoint is configured.
  getPublicUrl(key: string): string {
    const base =
      this.publicEndpoint ??
      this.configService.getOrThrow<string>('S3_ENDPOINT');
    return `${base.replace(/\/$/, '')}/${this.bucket}/${key}`;
  }
}
