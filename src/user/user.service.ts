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

    // create() builds a real User instance — save() on a plain object literal
    // returns a plain object, and @Exclude() metadata only applies to instances
    const user = this.userRepo.create({ email, passwordHash });
    return this.userRepo.save(user);
  }

  findAll() {
    return this.userRepo.find();
  }

  async findOne(id: string) {
    const user = await this.userRepo.findOneBy({ id });
    if (!user) throw new NotFoundException(`User ${id} not found`);

    return user;
  }

  async update(id: string, updateUserDto: UpdateUserDto) {
    const user = await this.findOne(id);
    const { email, password } = updateUserDto;

    // changing the email has to respect the same uniqueness rule as create()
    if (email && email !== user.email) {
      const existing = await this.userRepo.findOneBy({ email });
      if (existing) throw new ConflictException('Email already registered');
      user.email = email;
    }

    // the DTO carries a plain password; the column stores a hash
    if (password) user.passwordHash = await bcrypt.hash(password, 10);

    return this.userRepo.save(user);
  }

  async remove(id: string) {
    const result = await this.userRepo.delete(id);
    if (result.affected === 0) throw new NotFoundException(`User ${id} not found`);
  }
}
