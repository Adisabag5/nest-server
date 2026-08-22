import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { User } from './entities/user.entity';
import { ProfileService } from '../profile/profile.service';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';
import { paginate, Paginated } from '../common/pagination';
import { DataSource, Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';

@Injectable()
export class UserService {
  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    private readonly dataSource: DataSource,
    private readonly profileService: ProfileService,
  ) {}

  async create(createUserDto: CreateUserDto) {
    const { email, password } = createUserDto;
    const existing = await this.userRepo.findOneBy({ email });

    if (existing) throw new ConflictException('Email already registered');

    const passwordHash = await bcrypt.hash(password, 10);

    return this.dataSource.transaction(async (manager) => {
      const user = await manager.save(
        manager.create(User, { email, passwordHash }),
      );
      await this.profileService.createForUser(manager, user.id, user.email);

      return user;
    });
  }

  findAll(query: PaginationQueryDto): Promise<Paginated<User>> {
    return paginate(this.userRepo, query, { order: { id: 'ASC' } });
  }

  findByEmail(email: string) {
    return this.userRepo.findOneBy({ email });
  }

  async findOne(id: string) {
    const user = await this.userRepo.findOneBy({ id });
    if (!user) throw new NotFoundException(`User ${id} not found`);

    return user;
  }

  async update(id: string, updateUserDto: UpdateUserDto) {
    const user = await this.findOne(id);
    const { email, password } = updateUserDto;

    if (email && email !== user.email) {
      const existing = await this.userRepo.findOneBy({ email });
      if (existing) throw new ConflictException('Email already registered');
      user.email = email;
    }

    if (password) user.passwordHash = await bcrypt.hash(password, 10);

    return this.userRepo.save(user);
  }

  async remove(id: string) {
    const result = await this.userRepo.delete(id);
    if (result.affected === 0)
      throw new NotFoundException(`User ${id} not found`);
  }
}
