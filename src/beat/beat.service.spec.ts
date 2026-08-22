import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { BeatService } from './beat.service';
import { Beat } from './entities/beat.entity';
import { CollectionService } from '../collection/collection.service';

const OWNER = '1';
const STRANGER = '2';

/** A minimal but realistic Pulse SavedState v2 payload. */
const savedState = () => ({
  version: 2,
  bpm: 118,
  activeKit: 'lofi',
  tracks: [
    {
      voice: 'kick',
      steps: [{ on: true, pitch: 0 }],
      vol: 0.8,
      muted: false,
      soloed: false,
    },
  ],
});

describe('BeatService', () => {
  let service: BeatService;
  let rows: Beat[];
  let collectionService: { findOneForUser: jest.Mock };

  const match = (row: Beat, where: Partial<Beat>) =>
    Object.entries(where).every(
      ([key, value]) => row[key as keyof Beat] === value,
    );

  beforeEach(async () => {
    rows = [];
    let nextId = 1;

    const repo = {
      findAndCount: jest.fn(
        ({
          where,
          skip = 0,
          take = 20,
        }: {
          where: Partial<Beat>;
          skip?: number;
          take?: number;
        }) => {
          const all = rows.filter((r) => match(r, where));
          return Promise.resolve([all.slice(skip, skip + take), all.length]);
        },
      ),
      findOneBy: jest.fn((where: Partial<Beat>) =>
        Promise.resolve(rows.find((r) => match(r, where)) ?? null),
      ),
      create: jest.fn((dto: Partial<Beat>) => Object.assign(new Beat(), dto)),
      save: jest.fn((row: Beat) => {
        if (!row.id) {
          row.id = String(nextId++);
          rows.push(row);
        }
        return Promise.resolve(row);
      }),
      delete: jest.fn(() => Promise.resolve({ affected: 1 })),
    };

    collectionService = {
      findOneForUser: jest.fn((userId: string, id: string) => {
        if (userId !== OWNER) throw new ForbiddenException();
        return Promise.resolve({ id, userId });
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BeatService,
        { provide: getRepositoryToken(Beat), useValue: repo },
        { provide: CollectionService, useValue: collectionService },
      ],
    }).compile();

    service = module.get<BeatService>(BeatService);
  });

  it('stores the pattern payload verbatim', async () => {
    const data = savedState();

    const beat = await service.create(OWNER, { title: 'First loop', data });

    // the frontend owns this schema and its migrations; the server must not
    // reshape or strip it
    expect(beat.data).toEqual(data);
    expect(beat.userId).toBe(OWNER);
    expect(beat.collectionId).toBeNull();
  });

  it('rejects data without a version', async () => {
    await expect(
      service.create(OWNER, {
        title: 'No version',
        data: { bpm: 118 } as unknown as { version: number },
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects an oversized payload', async () => {
    const data = { version: 2, blob: 'x'.repeat(300 * 1024) };

    await expect(
      service.create(OWNER, { title: 'Huge', data }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('files a beat into a collection the caller owns', async () => {
    const beat = await service.create(OWNER, {
      title: 'Filed',
      data: savedState(),
      collectionId: '7',
    });

    expect(beat.collectionId).toBe('7');
  });

  it('refuses to file a beat into someone else collection', async () => {
    await expect(
      service.create(STRANGER, {
        title: 'Sneaky',
        data: savedState(),
        collectionId: '7',
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('404s for a missing beat and 403s for another user beat', async () => {
    const mine = await service.create(OWNER, {
      title: 'Mine',
      data: savedState(),
    });

    await expect(service.findOneForUser(OWNER, '999')).rejects.toBeInstanceOf(
      NotFoundException,
    );
    await expect(
      service.findOneForUser(STRANGER, mine.id),
    ).rejects.toBeInstanceOf(ForbiddenException);
    await expect(
      service.update(STRANGER, mine.id, { title: 'Hijacked' }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    await expect(service.remove(STRANGER, mine.id)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('lists only the caller beats, optionally scoped to a collection', async () => {
    await service.create(OWNER, { title: 'A', data: savedState() });
    await service.create(OWNER, {
      title: 'B',
      data: savedState(),
      collectionId: '7',
    });
    await service.create(STRANGER, { title: 'C', data: savedState() });

    const mine = await service.findAllForUser(OWNER, { page: 1, limit: 20 });
    expect(mine.items).toHaveLength(2);
    expect(mine.meta.total).toBe(2);

    const filed = await service.findAllForUser(OWNER, {
      page: 1,
      limit: 20,
      collectionId: '7',
    });
    expect(filed.items).toHaveLength(1);
    expect(filed.items[0].title).toBe('B');
    expect(filed.meta.total).toBe(1);
  });
});
