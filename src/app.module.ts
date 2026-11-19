import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ProfileModule } from './profile/profile.module';
import { CollectionModule } from './collection/collection.module';
import { BeatModule } from './beat/beat.module';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserModule } from './user/user.module';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { NodeEnv, validateEnv } from './config/env.validation';
import { AuthModule } from './auth/auth.module';

@Module({
  imports: [
    ProfileModule,
    CollectionModule,
    BeatModule,
    ConfigModule.forRoot({ isGlobal: true, validate: validateEnv }),

    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const isProduction =
          config.get<NodeEnv>('NODE_ENV') === NodeEnv.Production;

        return {
          type: 'mysql' as const,
          host: config.get<string>('DB_HOST'),
          port: Number(config.get('DB_PORT')),
          username: config.get<string>('DB_USER'),
          password: config.get<string>('DB_PASSWORD'),
          database: config.get<string>('DB_NAME'),
          autoLoadEntities: true,

          // synchronize rewrites the schema to match the entities on every
          // boot. That is a convenience on a throwaway dev database and data
          // loss on a real one: a renamed or removed property drops the column,
          // and the rows in it go too. Production gets reviewed SQL instead.
          synchronize: !isProduction,

          // Applied on boot in production, so a deploy cannot start serving
          // against a schema older than the code. Safe for one instance, which
          // is what a single VPS runs; revisit before scaling out.
          migrations: [__dirname + '/migrations/*{.ts,.js}'],
          migrationsRun: isProduction,
        };
      },
    }),

    UserModule,

    AuthModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
