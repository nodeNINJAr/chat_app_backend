import { existsSync, mkdirSync, statSync, unlinkSync } from 'fs';
import { createReadStream, createWriteStream } from 'fs';
import { dirname, join, resolve, sep } from 'path';
import { pipeline } from 'stream/promises';
import {
  BadRequestException,
  Controller,
  Get,
  NotFoundException,
  Param,
  Put,
  Query,
  Req,
  Res,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiExcludeController } from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { Public } from '../../../common/decorators/public.decorator';
import { decodeKey, verifyLocalStorageUrl } from './local-storage.signing';

/** Backs LocalStorageProvider's signed URLs — not part of the public API surface, hence excluded from Swagger. */
@ApiExcludeController()
@Controller('uploads/local-store')
export class LocalStorageController {
  private readonly rootDir: string;
  private readonly secret: string;

  constructor(private readonly configService: ConfigService) {
    this.rootDir = resolve(
      this.configService.get<string>('LOCAL_STORAGE_DIR', './uploads-data'),
    );
    this.secret = this.configService.getOrThrow<string>('JWT_ACCESS_SECRET');
    mkdirSync(this.rootDir, { recursive: true });
  }

  @Public()
  @Put(':encodedKey')
  async upload(
    @Param('encodedKey') encodedKey: string,
    @Query('exp') exp: string,
    @Query('sig') sig: string,
    @Req() req: Request,
  ): Promise<{ success: true }> {
    const key = this.verifyAndDecode(encodedKey, exp, sig);
    const filePath = this.resolveSafePath(key);

    mkdirSync(dirname(filePath), { recursive: true });
    await pipeline(req, createWriteStream(filePath));

    // Express's global body-parser only reads the stream for content types it recognizes
    // (json/urlencoded); if a client mislabels the body that way, pipeline() above writes
    // a 0-byte file but completes "successfully". Catch that here instead of lying to the caller.
    const expectedBytes = Number(req.headers['content-length']);
    const writtenBytes = statSync(filePath).size;
    if (
      Number.isFinite(expectedBytes) &&
      expectedBytes > 0 &&
      writtenBytes !== expectedBytes
    ) {
      unlinkSync(filePath);
      throw new BadRequestException(
        'upload body was not received as raw bytes — check the request Content-Type',
      );
    }
    return { success: true };
  }

  @Public()
  @Get(':encodedKey')
  download(
    @Param('encodedKey') encodedKey: string,
    @Query('exp') exp: string,
    @Query('sig') sig: string,
    @Res() res: Response,
  ): void {
    const key = this.verifyAndDecode(encodedKey, exp, sig);
    const filePath = this.resolveSafePath(key);

    if (!existsSync(filePath)) {
      throw new NotFoundException('file not found');
    }
    createReadStream(filePath).pipe(res);
  }

  // Avatars need a URL that stays valid forever (persisted on User/Group
  // documents and rendered directly, with no re-fetch of a fresh signed
  // URL), unlike chat media which is intentionally access-controlled via
  // short-lived signatures. Scoped to the `avatars/` prefix only — every
  // other key still requires a valid signature via the route above, and
  // this is a distinct two-segment path so it can't collide with that
  // single-segment `:encodedKey` route.
  @Public()
  @Get('public/:encodedKey')
  servePublic(
    @Param('encodedKey') encodedKey: string,
    @Res() res: Response,
  ): void {
    const key = decodeKey(encodedKey);
    if (!key.startsWith('avatars/')) {
      throw new UnauthorizedException('this key is not publicly accessible');
    }
    const filePath = this.resolveSafePath(key);
    if (!existsSync(filePath)) {
      throw new NotFoundException('file not found');
    }
    createReadStream(filePath).pipe(res);
  }

  private verifyAndDecode(
    encodedKey: string,
    exp: string,
    sig: string,
  ): string {
    const key = decodeKey(encodedKey);
    const expiry = Number(exp);
    if (
      !Number.isFinite(expiry) ||
      !verifyLocalStorageUrl(key, expiry, sig, this.secret)
    ) {
      throw new UnauthorizedException('invalid or expired storage url');
    }
    return key;
  }

  /** Defense in depth on top of signature verification — keeps resolved paths inside rootDir. */
  private resolveSafePath(key: string): string {
    const filePath = resolve(join(this.rootDir, key));
    if (!filePath.startsWith(this.rootDir + sep)) {
      throw new UnauthorizedException('invalid storage key');
    }
    return filePath;
  }
}
