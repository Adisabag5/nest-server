import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ProfilesModule } from './profiles/profiles.module';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserModule } from './user/user.module';
import { ConfigModule, ConfigService } from '@nestjs/config';

@Module({
  imports: [
    ProfilesModule,
    ConfigModule.forRoot({ isGlobal: true }),

    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'mysql', 
        host: config.get<string>('HOST'), 
        port: config.get<number>('DB_PORT'),
        username: config.get<string>('USERNAME'),
        password: config.get<string>('PASSWORD'),
        database: config.get<string>('DATABASE_NAME'),
        synchronize: true,
        autoLoadEntities: true
      })
    }),

    UserModule
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
