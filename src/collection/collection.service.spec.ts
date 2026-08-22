import { Test, TestingModule } from '@nestjs/testing';
import {
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { CollectionService } from './collection.service';
import { Collection } from './entities/collection.entity';

describe('CollectionService', () => {
  let service: CollectionService;
  let rows: Collection[];
  let repo: Record<string, jest.Mock>;

  const OWNER = '1';
  const STRANGER = '2';

  const match = (row: Collection, where: Partial<Collection>) =>
    Object.entries(where).every(
      ([key, value]) => row[key as keyof Collection] === value,
    );

  beforeEach(async () => {
    rows = [];
    let nextId = 1;

    repo = {
      findAndCount: jest.fn(
        ({
          where,
          skip = 0,
          take = 20,
        }: {
          where: Partial<Collection>;
          skip?: number;
          take?: number;
        }) => {
          const all = rows.filter((r) => match(r, where));
          return Promise.resolve([all.slice(skip, skip + take), all.length]);
        },
      ),
      findOneBy: jest.fn((where: Partial<Collection>) =>
        Promise.resolve(rows.find((r) => match(r, where)) ?? null),
      ),
      create: jest.fn((dto: Partial<Collection>) =>
        Object.assign(new Collection(), dto),
      ),
      save: jest.fn((row: Collection) => {
        if (!row.id) {
          row.id = String(nextId++);
          rows.push(row);
        }
        return Promise.resolve(row);
      }),
      delete: jest.fn((id: string) => {
        rows = rows.filter((r) => r.id !== id);
        return Promise.resolve({ affected: 1 });
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CollectionService,
        { provide: getRepositoryToken(Collection), useValue: repo },
      ],
    }).compile();

    service = module.get<CollectionService>(CollectionService);
  });

  it('creates a collection owned by the caller', async () => {
    const created = await service.create(OWNER, { name: 'Lo-fi ideas' });

    expect(created.userId).toBe(OWNER);
    expect(created.description).toBeNull();
  });

  it('rejects a duplicate name for the same user with 409', async () => {
    await service.create(OWNER, { name: 'Lo-fi ideas' });

    await expect(
      service.create(OWNER, { name: 'Lo-fi ideas' }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('allows two users to use the same collection name', async () => {
    await service.create(OWNER, { name: 'Lo-fi ideas' });

    await expect(
      service.create(STRANGER, { name: 'Lo-fi ideas' }),
    ).resolves.toBeDefined();
  });

  it('404s for a collection that does not exist', async () => {
    await expect(service.findOneForUser(OWNER, '999')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('403s when reading someone else collection', async () => {
    const mine = await service.create(OWNER, { name: 'Private' });

    await expect(
      service.findOneForUser(STRANGER, mine.id),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('403s when updating or deleting someone else collection', async () => {
    const mine = await service.create(OWNER, { name: 'Private' });

    await expect(
      service.update(STRANGER, mine.id, { name: 'Hijacked' }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    await expect(service.remove(STRANGER, mine.id)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('lists only the caller collections', async () => {
    await service.create(OWNER, { name: 'Mine' });
    await service.create(STRANGER, { name: 'Theirs' });

    const listed = await service.findAllForUser(OWNER, { page: 1, limit: 20 });

    expect(listed.items).toHaveLength(1);
    expect(listed.items[0].name).toBe('Mine');
    expect(listed.meta.total).toBe(1);
  });

  it('paginates: page 2 of 3 collections at limit 2', async () => {
    for (const name of ['A', 'B', 'C']) await service.create(OWNER, { name });

    const first = await service.findAllForUser(OWNER, { page: 1, limit: 2 });
    const second = await service.findAllForUser(OWNER, { page: 2, limit: 2 });

    expect(first.items).toHaveLength(2);
    expect(first.meta).toMatchObject({
      total: 3,
      totalPages: 2,
      hasNext: true,
      hasPrev: false,
    });
    expect(second.items).toHaveLength(1);
    expect(second.meta).toMatchObject({ hasNext: false, hasPrev: true });
    // no row appears on both pages
    const ids = [...first.items, ...second.items].map((c) => c.id);
    expect(new Set(ids).size).toBe(3);
  });

  it('reports zero pages for an empty list', async () => {
    const empty = await service.findAllForUser(OWNER, { page: 1, limit: 20 });

    expect(empty.items).toEqual([]);
    expect(empty.meta).toMatchObject({
      total: 0,
      totalPages: 0,
      hasNext: false,
      hasPrev: false,
    });
  });
});
