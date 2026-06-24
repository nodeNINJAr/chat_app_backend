import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { LocalStorageController } from './providers/local-storage.controller';
import { LocalStorageProvider } from './providers/local-storage.provider';
import { S3StorageProvider } from './providers/s3-storage.provider';
import { STORAGE_PROVIDER } from './storage-provider.interface';

@Module({
  imports: [ConfigModule],
  controllers: [LocalStorageController],
  providers: [
    {
      provide: STORAGE_PROVIDER,
      inject: [ConfigService],
      // Constructed manually (not via the providers array) so only the selected
      // driver is ever instantiated — the S3 client/bucket-check must not run
      // when STORAGE_DRIVER=local and S3_* env vars are absent.
      useFactory: async (configService: ConfigService) => {
        if (configService.get<string>('STORAGE_DRIVER') === 's3') {
          const provider = new S3StorageProvider(configService);
          await provider.onModuleInit();
          return provider;
        }
        return new LocalStorageProvider(configService);
      },
    },
  ],
  exports: [STORAGE_PROVIDER],
})
export class StorageModule {}
