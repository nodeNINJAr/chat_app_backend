import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

// Web clients rely on the httpOnly cookie. React Native's fetch has no
// automatic cookie jar, so mobile sends the refresh token explicitly here
// as a fallback — see AuthController.extractRefreshToken.
export class RefreshTokenDto {
  @ApiPropertyOptional({
    description: 'Mobile-only fallback when no cookie is sent',
  })
  @IsOptional()
  @IsString()
  refreshToken?: string;
}
