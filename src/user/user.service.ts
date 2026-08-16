import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { User } from './entities/user.entity';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';

@Injectable()
export class UserService {

  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
  ) {}
  
  async create(createUserDto: CreateUserDto) {
    const { email, password } = createUserDto

    // user email exist?
    const existing = await this.userRepo.findOneBy({ email })
    if (existing) throw new ConflictException('Email already registered');

    // hash password
    const passwordHash = await bcrypt.hash(password, 10)

    // insert to table
    const saved = await this.userRepo.save({ email, passwordHash });
    const { passwordHash: _, ...result } = saved;
    return result;
  }

  findAll() {
    return this.userRepo.find();
  }

  findOne(id: number) {
    return this.userRepo.findOneBy({ id: `${id}` });
  }

  async update(id: number, updateUserDto: UpdateUserDto) {
    const existing = await this.userRepo.findOneBy({ id: `${id}` })
    if (!existing) throw new NotFoundException('User not found');

    const updatedUser = await this.userRepo.update({ id: `${id}` }, { ...updateUserDto });

    return updatedUser;
  }

  async remove(id: number) {
    const existing = await this.userRepo.findOneBy({ id: `${id}` })
    if (!existing) throw new NotFoundException('User not found');

    const deletedUser = await this.userRepo.delete({ id: `${id}`  });

    return deletedUser;
  }
}
