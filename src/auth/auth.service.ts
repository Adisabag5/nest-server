import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService, JwtSignOptions } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, LessThan, Repository } from 'typeorm';
import { createHash, randomUUID } from 'crypto';
import * as bcrypt from 'bcrypt';
import { UserService } from '../user/user.service';
import { CreateUserDto } from '../user/dto/create-user.dto';
import { User } from '../user/entities/user.entity';
import { RefreshToken, RevokeReason } from './entities/refresh-token';

export interface AuthResponse {
  access_token: string;
  user: User;
}

export interface AuthSession extends AuthResponse {
  refresh_token: string;
  refresh_expires_at: Date;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly userService: UserService,
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
    @InjectRepository(RefreshToken)
    private readonly refreshRepo: Repository<RefreshToken>,
  ) {}

  async signIn(email: string, password: string): Promise<AuthSession> {
    const user = await this.userService.findByEmail(email);
    const passwordMatches =
      user !== null && (await bcrypt.compare(password, user.passwordHash));

    if (!passwordMatches)
      throw new UnauthorizedException('Invalid credentials');

    return this.startSession(user);
  }

  async signup(createUserDto: CreateUserDto): Promise<AuthSession> {
    const user = await this.userService.create(createUserDto);

    return this.startSession(user);
  }

  async refresh(presentedToken: string): Promise<AuthSession> {
    const stored = await this.refreshRepo.findOne({
      where: { tokenHash: this.hash(presentedToken) },
      relations: { user: true },
    });

    if (!stored) throw new UnauthorizedException('Invalid refresh token');

    if (stored.revokedAt !== null) {
      if (stored.revokedReason === RevokeReason.ROTATED) {
        await this.revokeAllForUser(stored.userId);
        throw new UnauthorizedException('Refresh token reuse detected');
      }

      throw new UnauthorizedException('Refresh token revoked');
    }

    if (stored.expiresAt.getTime() <= Date.now()) {
      throw new UnauthorizedException('Refresh token expired');
    }

    await this.revoke(stored, RevokeReason.ROTATED);

    return this.startSession(stored.user);
  }

  async signOut(presentedToken: string): Promise<{ message: string }> {
    const stored = await this.refreshRepo.findOneBy({
      tokenHash: this.hash(presentedToken),
    });

    if (stored && stored.revokedAt === null)
      await this.revoke(stored, RevokeReason.SIGNED_OUT);

    return { message: 'Signed out.' };
  }

  async revokeAllForUser(userId: string): Promise<void> {
    await this.refreshRepo.update(
      { userId, revokedAt: IsNull() },
      { revokedAt: new Date(), revokedReason: RevokeReason.SIGNED_OUT },
    );
  }

  async purgeExpired(): Promise<number> {
    const result = await this.refreshRepo.delete({
      expiresAt: LessThan(new Date()),
    });

    return result.affected ?? 0;
  }

  private async startSession(user: User): Promise<AuthSession> {
    const payload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      jti: randomUUID(),
    };
    const access_token = await this.jwtService.signAsync(payload);

    const refresh_token = await this.jwtService.signAsync(
      { sub: user.id, jti: randomUUID() },
      {
        secret: this.config.get<string>('JWT_REFRESH_SECRET')!,
        expiresIn: this.config.get<string>(
          'JWT_REFRESH_EXPIRES_IN',
        ) as JwtSignOptions['expiresIn'],
      },
    );

    const refresh_expires_at = this.expiryOf(refresh_token);

    await this.refreshRepo.save(
      this.refreshRepo.create({
        userId: user.id,
        tokenHash: this.hash(refresh_token),
        expiresAt: refresh_expires_at,
        revokedAt: null,
        revokedReason: null,
      }),
    );

    return { access_token, refresh_token, refresh_expires_at, user };
  }

  private async revoke(
    token: RefreshToken,
    reason: RevokeReason,
  ): Promise<void> {
    token.revokedAt = new Date();
    token.revokedReason = reason;
    await this.refreshRepo.save(token);
  }

  private hash(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  private expiryOf(token: string): Date {
    const { exp } = this.jwtService.decode<{ exp: number }>(token);

    return new Date(exp * 1000);
  }
}
