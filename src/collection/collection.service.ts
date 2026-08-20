import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Collection } from './entities/collection.entity';
import { CreateCollectionDto } from './dto/create-collection.dto';
import { UpdateCollectionDto } from './dto/update-collection.dto';

@Injectable()
export class CollectionService {
  constructor(
    @InjectRepository(Collection)
    private readonly collectionRepo: Repository<Collection>,
  ) {}

  findAllForUser(userId: string) {
    return this.collectionRepo.find({
      where: { userId },
      order: { createdAt: 'ASC' },
    });
  }

  async findOneForUser(userId: string, id: string): Promise<Collection> {
    const collection = await this.collectionRepo.findOneBy({ id });
    if (!collection) throw new NotFoundException(`Collection ${id} not found`);
    if (collection.userId !== userId) throw new ForbiddenException();

    return collection;
  }

  async create(userId: string, dto: CreateCollectionDto): Promise<Collection> {
    await this.assertNameFree(userId, dto.name);

    const collection = this.collectionRepo.create({
      userId,
      name: dto.name,
      description: dto.description ?? null,
    });

    return this.collectionRepo.save(collection);
  }

  async update(
    userId: string,
    id: string,
    dto: UpdateCollectionDto,
  ): Promise<Collection> {
    const collection = await this.findOneForUser(userId, id);

    if (dto.name !== undefined && dto.name !== collection.name) {
      await this.assertNameFree(userId, dto.name);
      collection.name = dto.name;
    }

    if (dto.description !== undefined) {
      collection.description = dto.description;
    }

    return this.collectionRepo.save(collection);
  }

  async remove(userId: string, id: string): Promise<void> {
    const collection = await this.findOneForUser(userId, id);
    await this.collectionRepo.delete(collection.id);
  }

  private async assertNameFree(userId: string, name: string): Promise<void> {
    const taken = await this.collectionRepo.findOneBy({ userId, name });
    if (taken)
      throw new ConflictException(
        `You already have a collection named "${name}"`,
      );
  }
}
