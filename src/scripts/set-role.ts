import { NestFactory } from '@nestjs/core';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AppModule } from '../app.module';
import { User } from '../user/entities/user.entity';
import { Role } from '../auth/enums/roles.enum';

async function main() {
  const [email, roleArg] = process.argv.slice(2);

  if (!email || !roleArg) {
    console.error('Usage: pnpm set-role <email> <ADMIN|USER>');
    process.exit(1);
  }

  const role = roleArg.toUpperCase() as Role;
  if (!Object.values(Role).includes(role)) {
    console.error(
      `Unknown role "${roleArg}". Expected one of: ${Object.values(Role).join(', ')}`,
    );
    process.exit(1);
  }

  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn'],
  });

  try {
    const userRepo = app.get<Repository<User>>(getRepositoryToken(User));
    const user = await userRepo.findOneBy({ email });

    if (!user) {
      console.error(`No user with email ${email}`);
      process.exitCode = 1;
      return;
    }

    if (user.role === role) {
      console.log(`${email} is already ${role} — nothing to do.`);
      return;
    }

    const previous = user.role;
    user.role = role;
    await userRepo.save(user);

    console.log(`${email}: ${previous} -> ${role}`);
    console.log(
      'They must sign in again — the role is baked into the JWT payload, so ' +
        'their current token still carries the old one until it expires.',
    );
  } finally {
    await app.close();
  }
}

void main();
