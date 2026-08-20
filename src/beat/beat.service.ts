import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Beat, BeatData } from './entities/beat.entity';
import { CreateBeatDto } from './dto/create-beat.dto';
import { UpdateBeatDto } from './dto/update-beat.dto';
import { CollectionService } from '../collection/collection.service';

const MAX_DATA_BYTES = 256 * 1024;

@Injectable()
export class BeatService {
  constructor(
    @InjectRepository(Beat)
    private readonly beatRepo: Repository<Beat>,
    private readonly collectionService: CollectionService,
  ) {}

  findAllForUser(userId: string, collectionId?: string) {
    return this.beatRepo.find({
      where: collectionId ? { userId, collectionId } : { userId },
      order: { updatedAt: 'DESC' },
    });
  }

  async findOneForUser(userId: string, id: string): Promise<Beat> {
    const beat = await this.beatRepo.findOneBy({ id });
    if (!beat) throw new NotFoundException(`Beat ${id} not found`);
    if (beat.userId !== userId) throw new ForbiddenException();

    return beat;
  }

  async create(userId: string, dto: CreateBeatDto): Promise<Beat> {
    this.assertValidData(dto.data);
    const collectionId = await this.resolveCollection(userId, dto.collectionId);

    const beat = this.beatRepo.create({
      userId,
      collectionId,
      title: dto.title,
      data: dto.data,
    });

    return this.beatRepo.save(beat);
  }

  async update(userId: string, id: string, dto: UpdateBeatDto): Promise<Beat> {
    const beat = await this.findOneForUser(userId, id);

    if (dto.title !== undefined) beat.title = dto.title;

    if (dto.data !== undefined) {
      this.assertValidData(dto.data);
      beat.data = dto.data;
    }

    if (dto.collectionId !== undefined) {
      beat.collectionId = await this.resolveCollection(
        userId,
        dto.collectionId,
      );
    }

    return this.beatRepo.save(beat);
  }

  async remove(userId: string, id: string): Promise<void> {
    const beat = await this.findOneForUser(userId, id);
    await this.beatRepo.delete(beat.id);
  }

  private async resolveCollection(
    userId: string,
    collectionId?: string | null,
  ): Promise<string | null> {
    if (!collectionId) return null;

    const collection = await this.collectionService.findOneForUser(
      userId,
      collectionId,
    );

    return collection.id;
  }

  private assertValidData(data: BeatData): void {
    if (!Number.isInteger(data?.version) || data.version < 1) {
      throw new BadRequestException('data.version must be a positive integer');
    }

    if (Buffer.byteLength(JSON.stringify(data), 'utf8') > MAX_DATA_BYTES) {
      throw new BadRequestException('data exceeds the maximum size');
    }
  }
}
