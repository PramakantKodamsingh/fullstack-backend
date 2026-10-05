import { ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { LoginDto } from './dto/login.dto.js';
import { RegisterDto } from './dto/register.dto.js';
import { JwtPayload } from './auth.types.js';
import { hashPassword, verifyPassword } from './password.js';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  async register({ email, password, name }: RegisterDto) {
    try {
      const user = await this.prisma.user.create({
        data: { email, name, passwordHash: await hashPassword(password) },
      });
      return { accessToken: await this.signToken(user), user };
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException(`Email ${email} is already in use`);
      }
      throw error;
    }
  }

  async login({ email, password }: LoginDto) {
    const found = await this.prisma.user.findUnique({
      where: { email },
      omit: { passwordHash: false },
    });

    // Same message for every failure so callers can't tell which emails are registered
    if (!found?.passwordHash || !(await verifyPassword(password, found.passwordHash))) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const { passwordHash: _passwordHash, ...user } = found;
    return { accessToken: await this.signToken(user), user };
  }

  async me(userId: number) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      // The token is valid but the account has since been deleted
      throw new UnauthorizedException('User no longer exists');
    }
    return user;
  }

  private signToken(user: { id: number; email: string }) {
    const payload: JwtPayload = { sub: user.id, email: user.email };
    return this.jwtService.signAsync(payload);
  }
}
