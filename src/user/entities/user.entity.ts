import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
} from 'typeorm';
import { Exclude } from 'class-transformer';
import { Role } from '../../auth/enums/roles.enum';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id!: string;

  @Column({
    unique: true,
    length: 100,
  })
  email!: string;

  @Exclude()
  @Column({ name: 'password_hash' })
  passwordHash!: string;

  @Column({ type: 'enum', enum: Role, default: Role.USER })
  role: Role = Role.USER;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;
}
