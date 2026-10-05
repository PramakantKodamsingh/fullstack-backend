import type { Request } from 'express';

export interface JwtPayload {
  sub: number;
  email: string;
}

export interface AuthenticatedRequest extends Request {
  user: JwtPayload;
}
