export interface UploadTarget {
  method: 'PUT';
  url: string;
}

export interface StorageProvider {
  buildKey(userId: string, fileName: string): string;
  getUploadTarget(
    key: string,
    mimeType: string,
    expiresInSeconds: number,
  ): Promise<UploadTarget>;
  getDownloadUrl(key: string, expiresInSeconds: number): Promise<string>;
}

export const STORAGE_PROVIDER = 'STORAGE_PROVIDER';
