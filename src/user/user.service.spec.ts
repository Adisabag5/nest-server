import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConflictException, NotFoundException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { UserService } from './user.service';
import { User } from './entities/user.entity';

describe('UserService', () => {
  let service: UserService;
  let repo: {
    find: jest.Mock;
    findOneBy: jest.Mock;
    create: jest.Mock;
    save: jest.Mock;
    delete: jest.Mock;
  };

  const existingUser = (): User =>
    Object.assign(new User(), {
      id: '1',
      email: 'taken@example.com',
      passwordHash: 'stored-hash',
      createdAt: new Date(),
    });

  beforeEach(async () => {
    repo = {
      find: jest.fn(),
      findOneBy: jest.fn(),
      // create() mirrors TypeORM: build a real User instance from a partial
      create: jest.fn((dto: Partial<User>): User =>
        Object.assign(new User(), dto),
      ),
      save: jest.fn((user: User): Promise<User> => Promise.resolve(user)),
      delete: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UserService,
        // UserService asks the container for Repository<User>; in a test we
        // register a fake under the same token and the service never notices
        { provide: getRepositoryToken(User), useValue: repo },
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
      expect(repo.save).not.toHaveBeenCalled();
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
      // it must be a real User instance, or @Exclude() cannot hide the hash
      expect(created).toBeInstanceOf(User);
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
        .mockResolvedValueOnce(existingUser()) // lookup by id
        .mockResolvedValueOnce(Object.assign(new User(), { id: '2' })); // email is taken

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
