import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../common/types/authenticated-user.type';
import { RequestUploadUrlDto } from './dto/request-upload-url.dto';
import { UploadsService } from './uploads.service';

@ApiTags('uploads')
@ApiBearerAuth('access-token')
@Controller('uploads')
export class UploadsController {
  constructor(private readonly uploadsService: UploadsService) {}

  @ApiOperation({
    summary: 'Get a pre-signed PUT URL to upload directly to object storage',
  })
  @Post('presign')
  presign(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: RequestUploadUrlDto,
  ) {
    return this.uploadsService.createPresignedUpload(user.userId, dto);
  }

  // NOTE: relies on the key being an unguessable UUID + a short-lived signed URL rather than
  // verifying the requester is a participant of the conversation the key's message belongs to.
  // Production hardening: resolve the owning message and check conversation membership first.
  @ApiOperation({
    summary: 'Get a short-lived signed GET URL for a stored object',
  })
  @Get('download-url')
  getDownloadUrl(@Query('key') key: string) {
    return this.uploadsService.getDownloadUrl(key);
  }
}
