import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConflictException, NotFoundException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { UserService } from './user.service';
import { User } from './entities/user.entity';
import { Role } from '../auth/enums/roles.enum';
import { DataSource } from 'typeorm';
import { ProfileService } from '../profile/profile.service';

describe('UserService', () => {
  let service: UserService;
  let repo: {
    find: jest.Mock;
    findOneBy: jest.Mock;
    create: jest.Mock;
    save: jest.Mock;
    delete: jest.Mock;
  };

  let manager: { create: jest.Mock; save: jest.Mock };
  let profileService: { createForUser: jest.Mock };

  const existingUser = (): User =>
    Object.assign(new User(), {
      id: '1',
      email: 'taken@example.com',
      passwordHash: 'stored-hash',
      role: Role.USER,
      createdAt: new Date(),
    });

  beforeEach(async () => {
    repo = {
      find: jest.fn(),
      findOneBy: jest.fn(),
      create: jest.fn((dto: Partial<User>): User =>
        Object.assign(new User(), dto),
      ),
      save: jest.fn((user: User): Promise<User> => Promise.resolve(user)),
      delete: jest.fn(),
    };

    manager = {
      create: jest.fn((_entity: unknown, dto: Partial<User>): User =>
        Object.assign(new User(), dto),
      ),
      save: jest.fn((entity: User): Promise<User> => {
        entity.id ||= '1';
        return Promise.resolve(entity);
      }),
    };
    profileService = { createForUser: jest.fn().mockResolvedValue({}) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UserService,
        { provide: getRepositoryToken(User), useValue: repo },
        {
          provide: DataSource,
          useValue: {
            transaction: (cb: (m: unknown) => unknown) => cb(manager),
          },
        },
        { provide: ProfileService, useValue: profileService },
      ],
    }).compile();

    service = module.get<UserService>(UserService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('rejects a duplicate email with 409', async () => {
      repo.findOneBy.mockResolvedValue(existingUser());

      await expect(
        service.create({ email: 'taken@example.com', password: 'password123' }),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(manager.save).not.toHaveBeenCalled();
    });

    it('stores a hash, never the plain password', async () => {
      repo.findOneBy.mockResolvedValue(null);

      const created = await service.create({
        email: 'new@example.com',
        password: 'password123',
      });

      expect(created.passwordHash).not.toBe('password123');
      expect(await bcrypt.compare('password123', created.passwordHash)).toBe(
        true,
      );
      expect(created).toBeInstanceOf(User);
      expect(created.role).toBe(Role.USER);
    });

    it('creates the profile in the same transaction', async () => {
      repo.findOneBy.mockResolvedValue(null);

      const created = await service.create({
        email: 'new@example.com',
        password: 'password123',
      });

      expect(profileService.createForUser).toHaveBeenCalledWith(
        manager,
        created.id,
        created.email,
      );
    });
  });

  describe('findOne', () => {
    it('throws 404 when the user is missing', async () => {
      repo.findOneBy.mockResolvedValue(null);

      await expect(service.findOne('999')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('returns the user when it exists', async () => {
      const user = existingUser();
      repo.findOneBy.mockResolvedValue(user);

      await expect(service.findOne('1')).resolves.toBe(user);
    });
  });

  describe('update', () => {
    it('throws 404 when the user is missing', async () => {
      repo.findOneBy.mockResolvedValue(null);

      await expect(
        service.update('999', { email: 'whatever@example.com' }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('throws 409 when the new email belongs to someone else', async () => {
      repo.findOneBy
        .mockResolvedValueOnce(existingUser())
        .mockResolvedValueOnce(Object.assign(new User(), { id: '2' }));

      await expect(
        service.update('1', { email: 'someone-else@example.com' }),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(repo.save).not.toHaveBeenCalled();
    });

    it('re-hashes a new password', async () => {
      repo.findOneBy.mockResolvedValue(existingUser());

      const updated = await service.update('1', { password: 'brand-new-pass' });

      expect(updated.passwordHash).not.toBe('brand-new-pass');
      expect(await bcrypt.compare('brand-new-pass', updated.passwordHash)).toBe(
        true,
      );
    });
  });

  describe('remove', () => {
    it('throws 404 when nothing was deleted', async () => {
      repo.delete.mockResolvedValue({ affected: 0 });

      await expect(service.remove('999')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('resolves when a row was deleted', async () => {
      repo.delete.mockResolvedValue({ affected: 1 });

      await expect(service.remove('1')).resolves.toBeUndefined();
    });
  });
});
