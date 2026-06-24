import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../common/types/authenticated-user.type';
import { CallsService } from './calls.service';

@ApiTags('calls')
@ApiBearerAuth('access-token')
@Controller('calls')
export class CallsController {
  constructor(private readonly callsService: CallsService) {}

  @ApiOperation({ summary: 'Call history (mine, either side), newest first' })
  @Get('history')
  getHistory(
    @CurrentUser() user: AuthenticatedUser,
    @Query('limit') limit?: string,
    @Query('before') before?: string,
  ) {
    return this.callsService.getHistory(
      user.userId,
      limit ? Number(limit) : undefined,
      before,
    );
  }

  @ApiOperation({
    summary:
      'Ephemeral TURN/STUN credentials (HMAC, short-lived) for WebRTC ICE',
  })
  @Get('turn-credentials')
  getTurnCredentials(@CurrentUser() user: AuthenticatedUser) {
    return this.callsService.getTurnCredentials(user.userId);
  }
}
