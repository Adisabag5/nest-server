import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { ProfilesService } from './profiles.service';
import { UpdateProfileDto } from './dto/update-profile.dto';

describe('ProfilesService', () => {
  let service: ProfilesService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ProfilesService],
    }).compile();

    service = module.get<ProfilesService>(ProfilesService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('throws 404 for an unknown id', () => {
    expect(() => service.findOne('nope')).toThrow(NotFoundException);
    expect(() => service.updateProfile('nope', { name: 'x' })).toThrow(
      NotFoundException,
    );
    expect(() => service.deleteProfile('nope')).toThrow(NotFoundException);
  });

  it('creates a profile with a generated id', () => {
    const created = service.createProfile({
      name: 'Ada',
      description: 'Engineer',
    });

    expect(created.id).toEqual(expect.any(String));
    expect(service.findOne(created.id)).toEqual(created);
  });

  it('merges an update instead of replacing the record', () => {
    const created = service.createProfile({
      name: 'Ada',
      description: 'Engineer',
    });

    const updated = service.updateProfile(created.id, { name: 'Ada Lovelace' });

    expect(updated.name).toBe('Ada Lovelace');
    expect(updated.description).toBe('Engineer'); // untouched field survives
  });

  it('keeps the URL id even if the body carries another one', () => {
    const created = service.createProfile({
      name: 'Ada',
      description: 'Engineer',
    });

    // a client trying to rewrite identity through the payload
    const updated = service.updateProfile(created.id, {
      id: 'hijacked',
    } as unknown as UpdateProfileDto);

    expect(updated.id).toBe(created.id);
    expect(() => service.findOne('hijacked')).toThrow(NotFoundException);
  });

  it('removes a profile', () => {
    const created = service.createProfile({
      name: 'Ada',
      description: 'Engineer',
    });

    service.deleteProfile(created.id);

    expect(() => service.findOne(created.id)).toThrow(NotFoundException);
  });
});
