import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Not, Repository } from 'typeorm';
import { Profile } from './entities/profile.entity';
import { UpdateProfileDto } from './dto/update-profile.dto';

const USERNAME_MAX = 30;

@Injectable()
export class ProfileService {
  constructor(
    @InjectRepository(Profile)
    private readonly profileRepo: Repository<Profile>,
  ) {}

  async findByUserId(userId: string): Promise<Profile> {
    const profile = await this.profileRepo.findOneBy({ userId });
    if (!profile)
      throw new NotFoundException(`Profile for user ${userId} not found`);

    return profile;
  }

  async findByUsername(username: string): Promise<Profile> {
    const profile = await this.profileRepo.findOneBy({ username });
    if (!profile) throw new NotFoundException(`Profile ${username} not found`);

    return profile;
  }

  async update(userId: string, dto: UpdateProfileDto): Promise<Profile> {
    const profile = await this.findByUserId(userId);

    if (dto.username && dto.username !== profile.username) {
      const taken = await this.profileRepo.findOneBy({
        username: dto.username,
        userId: Not(userId),
      });
      if (taken) throw new ConflictException('Username already taken');
      profile.username = dto.username;
    }

    if (dto.displayName !== undefined) profile.displayName = dto.displayName;
    if (dto.bio !== undefined) profile.bio = dto.bio;
    if (dto.avatarUrl !== undefined) profile.avatarUrl = dto.avatarUrl;

    return this.profileRepo.save(profile);
  }

  async createForUser(
    manager: EntityManager,
    userId: string,
    email: string,
  ): Promise<Profile> {
    const username = await this.allocateUsername(manager, email);
    const profile = manager.create(Profile, {
      userId,
      username,
      displayName: username,
      bio: null,
      avatarUrl: null,
    });

    return manager.save(profile);
  }

  private async allocateUsername(
    manager: EntityManager,
    email: string,
  ): Promise<string> {
    const base =
      email
        .split('@')[0]
        .toLowerCase()
        .replace(/[^a-z0-9_]/g, '')
        .slice(0, USERNAME_MAX - 5) || 'user';

    for (let attempt = 0; attempt < 50; attempt++) {
      const candidate = attempt === 0 ? base : `${base}${attempt}`;
      const taken = await manager.findOneBy(Profile, { username: candidate });
      if (!taken) return candidate;
    }

    return `${base}${Date.now().toString(36)}`.slice(0, USERNAME_MAX);
  }
}
