import { IsObject, IsOptional, IsString, Length } from 'class-validator';
import type { BeatData } from '../entities/beat.entity';

export class CreateBeatDto {
  @IsString()
  @Length(1, 100)
  title!: string;

  @IsOptional()
  @IsString()
  collectionId?: string;

  @IsObject()
  data!: BeatData;
}
