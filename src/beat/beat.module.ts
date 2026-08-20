import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Beat } from './entities/beat.entity';
import { BeatService } from './beat.service';
import { BeatController } from './beat.controller';
import { CollectionModule } from '../collection/collection.module';

@Module({
  imports: [TypeOrmModule.forFeature([Beat]), CollectionModule],
  controllers: [BeatController],
  providers: [BeatService],
  exports: [BeatService],
})
export class BeatModule {}
