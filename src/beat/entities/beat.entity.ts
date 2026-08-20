import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { User } from '../../user/entities/user.entity';
import { Collection } from '../../collection/entities/collection.entity';

export interface BeatData {
  version: number;
  [key: string]: unknown;
}

@Entity('beats')
export class Beat {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id!: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user!: User;

  @Column({ name: 'user_id', type: 'bigint' })
  userId!: string;

  @ManyToOne(() => Collection, (collection) => collection.beats, {
    onDelete: 'SET NULL',
    nullable: true,
  })
  @JoinColumn({ name: 'collection_id' })
  collection!: Collection | null;

  @Column({ name: 'collection_id', type: 'bigint', nullable: true })
  collectionId!: string | null;

  @Column({ length: 100 })
  title!: string;

  @Column({ type: 'json' })
  data!: BeatData;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
