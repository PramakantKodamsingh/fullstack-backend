import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { AuthGuard } from './auth.guard.js';

describe('AuthGuard', () => {
  const jwtService = new JwtService({ secret: 'test-secret' });
  const guard = new AuthGuard(jwtService);
  const payload = { sub: 1, email: 'john@gmail.com' };

  function contextWith(authorization?: string) {
    const request: any = { headers: authorization ? { authorization } : {} };
    const context = {
      switchToHttp: () => ({ getRequest: () => request }),
    } as unknown as ExecutionContext;
    return { context, request };
  }

  it('should allow a valid token and put its payload on request.user', async () => {
    const token = await jwtService.signAsync(payload);
    const { context, request } = contextWith(`Bearer ${token}`);

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(request.user).toMatchObject(payload);
  });

  it('should reject a request without an Authorization header', async () => {
    const { context } = contextWith();

    await expect(guard.canActivate(context)).rejects.toThrow(
      new UnauthorizedException('Missing bearer token'),
    );
  });

  it('should reject a header that is not a Bearer token', async () => {
    const token = await jwtService.signAsync(payload);
    const { context } = contextWith(`Basic ${token}`);

    await expect(guard.canActivate(context)).rejects.toThrow(
      new UnauthorizedException('Missing bearer token'),
    );
  });

  it('should reject a malformed token', async () => {
    const { context } = contextWith('Bearer not-a-real-token');

    await expect(guard.canActivate(context)).rejects.toThrow(
      new UnauthorizedException('Invalid or expired token'),
    );
  });

  it('should reject a token signed with a different secret', async () => {
    const otherService = new JwtService({ secret: 'some-other-secret' });
    const token = await otherService.signAsync(payload);
    const { context } = contextWith(`Bearer ${token}`);

    await expect(guard.canActivate(context)).rejects.toThrow(
      new UnauthorizedException('Invalid or expired token'),
    );
  });

  it('should reject an expired token', async () => {
    const expiredAt = Math.floor(Date.now() / 1000) - 60;
    const token = await jwtService.signAsync({ ...payload, exp: expiredAt });
    const { context } = contextWith(`Bearer ${token}`);

    await expect(guard.canActivate(context)).rejects.toThrow(
      new UnauthorizedException('Invalid or expired token'),
    );
  });
});
