import { Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { CreateProfileDto } from './dto/create-profile.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';

export interface Profile {
  id: string;
  name: string;
  description: string;
}

@Injectable()
export class ProfilesService {
  profiles: Profile[] = [
    { id: randomUUID(), name: 'Adi Sabag', description: 'Fullstack' },
    { id: randomUUID(), name: 'Dean Bar-Lev', description: 'Importer' },
    { id: randomUUID(), name: 'Yakov Goldshtein', description: 'Sugar daddy' },
  ];

  findAll() {
    return this.profiles;
  }

  findOne(id: string) {
    const profile = this.profiles.find((p) => p.id === id);
    if (!profile) throw new NotFoundException(`Profile ${id} not found`);

    return profile;
  }

  createProfile(profile: CreateProfileDto) {
    const newProfile: Profile = { ...profile, id: randomUUID() };
    this.profiles = [...this.profiles, newProfile];

    return this.findOne(newProfile.id);
  }

  updateProfile(id: string, profile: UpdateProfileDto) {
    const profileIndex = this.profiles.findIndex((p) => p.id === id);

    if (profileIndex === -1)
      throw new NotFoundException(`Profile ${id} not found`);

    this.profiles[profileIndex] = {
      ...this.profiles[profileIndex],
      ...profile,
      id,
    };
    return this.profiles[profileIndex];
  }

  deleteProfile(id: string) {
    const profileIndex = this.profiles.findIndex((p) => p.id === id);

    if (profileIndex === -1)
      throw new NotFoundException(`Profile ${id} not found`);

    this.profiles.splice(profileIndex, 1);
  }
}
