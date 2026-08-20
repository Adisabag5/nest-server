import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { EntityManager } from 'typeorm';
import { ProfileService } from './profile.service';
import { Profile } from './entities/profile.entity';

describe('ProfileService', () => {
  let service: ProfileService;
  let rows: Profile[];
  let manager: EntityManager;

  const match = (row: Profile, where: Partial<Profile>) =>
    Object.entries(where).every(([key, value]) => {
      const actual = row[key as keyof Profile];
      // crude stand-in for Not(userId)
      if (value && typeof value === 'object' && '_type' in value) {
        return actual !== (value as unknown as { value: unknown }).value;
      }
      return actual === value;
    });

  beforeEach(async () => {
    rows = [];
    let nextId = 1;

    const save = (row: Profile) => {
      if (!row.id) {
        row.id = String(nextId++);
        rows.push(row);
      }
      return Promise.resolve(row);
    };

    const repo = {
      findOneBy: jest.fn((where: Partial<Profile>) =>
        Promise.resolve(rows.find((r) => match(r, where)) ?? null),
      ),
      create: jest.fn((dto: Partial<Profile>) =>
        Object.assign(new Profile(), dto),
      ),
      save: jest.fn(save),
    };

    manager = {
      findOneBy: jest.fn((_entity: unknown, where: Partial<Profile>) =>
        Promise.resolve(rows.find((r) => match(r, where)) ?? null),
      ),
      create: jest.fn((_entity: unknown, dto: Partial<Profile>) =>
        Object.assign(new Profile(), dto),
      ),
      save: jest.fn(save),
    } as unknown as EntityManager;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProfileService,
        { provide: getRepositoryToken(Profile), useValue: repo },
      ],
    }).compile();

    service = module.get<ProfileService>(ProfileService);
  });

  describe('createForUser', () => {
    it('derives a username from the email local part', async () => {
      const profile = await service.createForUser(
        manager,
        '1',
        'adi@example.com',
      );

      expect(profile.username).toBe('adi');
      expect(profile.displayName).toBe('adi');
      expect(profile.userId).toBe('1');
    });

    it('strips characters that are not URL-safe', async () => {
      const profile = await service.createForUser(
        manager,
        '1',
        'Adi.Sabag+beats@example.com',
      );

      expect(profile.username).toMatch(/^[a-z0-9_]+$/);
    });

    it('suffixes a username that is already taken', async () => {
      await service.createForUser(manager, '1', 'adi@example.com');

      const second = await service.createForUser(manager, '2', 'adi@other.com');

      expect(second.username).toBe('adi1');
    });

    it('falls back to "user" when the local part has nothing usable', async () => {
      const profile = await service.createForUser(
        manager,
        '1',
        '!!!@example.com',
      );

      expect(profile.username).toBe('user');
    });
  });

  describe('lookup and update', () => {
    it('404s for an unknown user or username', async () => {
      await expect(service.findByUserId('999')).rejects.toBeInstanceOf(
        NotFoundException,
      );
      await expect(service.findByUsername('nobody')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('updates only the fields provided', async () => {
      await service.createForUser(manager, '1', 'adi@example.com');

      const updated = await service.update('1', { bio: 'Makes beats' });

      expect(updated.bio).toBe('Makes beats');
      expect(updated.username).toBe('adi'); // untouched
    });

    it('409s when taking a username someone else holds', async () => {
      await service.createForUser(manager, '1', 'adi@example.com');
      await service.createForUser(manager, '2', 'dean@example.com');

      await expect(
        service.update('2', { username: 'adi' }),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('allows re-saving your own username', async () => {
      await service.createForUser(manager, '1', 'adi@example.com');

      await expect(
        service.update('1', { username: 'adi', bio: 'hi' }),
      ).resolves.toMatchObject({ username: 'adi', bio: 'hi' });
    });
  });
});
