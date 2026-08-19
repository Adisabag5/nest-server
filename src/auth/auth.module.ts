import { Module } from '@nestjs/common';
import { JwtModule, JwtSignOptions } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { UserModule } from '../user/user.module';
import { JwtStrategy } from './strategies/jwt.strategy';
import { JwtAuthGuard } from './guards/jwt-auth.guard';

@Module({
  imports: [
    // imports takes MODULES, not providers — UserModule exports UserService,
    // which is what makes it injectable here
    UserModule,

    // registerAsync because the secret comes from validated config, which
    // isn't available at class-definition time
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        // validateEnv() already guaranteed both keys exist at boot
        secret: config.get<string>('JWT_SECRET')!,
        signOptions: {
          // @nestjs/jwt types this as a literal duration union ('1h', '7d'…),
          // which a config lookup can't prove — env validation did that already
          expiresIn: config.get<string>(
            'JWT_EXPIRES_IN',
          ) as JwtSignOptions['expiresIn'],
        },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    JwtStrategy,
    // APP_GUARD registers the guard for EVERY route in the app, so protection
    // is the default and @Public() is the exception
    { provide: APP_GUARD, useClass: JwtAuthGuard },
  ],
  exports: [AuthService],
})
export class AuthModule {}
