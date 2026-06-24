export interface AuthenticatedUser {
  userId: string;
  username: string;
}

export interface JwtAccessPayload {
  sub: string;
  username: string;
}
