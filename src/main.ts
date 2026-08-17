import { NestFactory, Reflector } from '@nestjs/core';
import { ClassSerializerInterceptor, ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  // validates every @Body()/@Param() against its DTO's decorators, at runtime
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true, // drop properties with no validation decorator
      forbidNonWhitelisted: true, // ...and 400 instead, if any were sent
      transform: true, // hand the handler a real DTO instance, not a plain object
    }),
  );

  // strips @Exclude()d fields (e.g. User.passwordHash) from every response
  app.useGlobalInterceptors(new ClassSerializerInterceptor(app.get(Reflector)));
  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
