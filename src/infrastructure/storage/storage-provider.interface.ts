export interface UploadTarget {
  method: 'PUT';
  url: string;
}

export interface StorageProvider {
  buildKey(userId: string, fileName: string, prefix?: string): string;
  getUploadTarget(
    key: string,
    mimeType: string,
    expiresInSeconds: number,
  ): Promise<UploadTarget>;
  getDownloadUrl(key: string, expiresInSeconds: number): Promise<string>;
  /** Permanent, unsigned URL — only ever called for keys under the `avatars/` prefix. */
  getPublicUrl(key: string): string;
}

export const STORAGE_PROVIDER = 'STORAGE_PROVIDER';
