import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn } from 'typeorm';

@Entity('users')
export class User {
    @PrimaryGeneratedColumn({ type: 'bigint' })
    id!: string;

    @Column({
        unique: true,
        length: 100
    })
    email!: string;

    @Column({ name: 'password_hash' })
    passwordHash!: string;

    @CreateDateColumn({ name: 'created_at' })
    createdAt!: Date;

}


