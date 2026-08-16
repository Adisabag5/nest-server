import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { CreateProfileDto } from './dto/CreateProfileDto';

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
        { id: randomUUID(), name: 'Yakov Goldshtein', description: 'Sugar daddy' }
    ]

    findAll(){
        return this.profiles;
    }

    findOne(id: string){
        return this.profiles.find(p => p.id === id);
    }

    createProfile(profile: CreateProfileDto){
        const newProfile: Profile = { ...profile, id: randomUUID() }
        this.profiles = [
            ...this.profiles, 
            newProfile
        ]

        return this.findOne(newProfile.id)
    }

    updateProfile(id: string ,profile: Profile){
        const profileIndex = this.profiles.findIndex(p => p.id === id)

        if (profileIndex === -1) return 'Not fount'

        this.profiles[profileIndex] = profile
        return this.profiles[profileIndex];
    }

    deleteProfile(id: string){
        const profileIndex = this.profiles.findIndex(p => p.id === id)

        if (profileIndex === -1) return 'Not fount'
        this.profiles.splice(profileIndex, 1)
        return "User deleted"
    }
}
