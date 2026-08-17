import { IsEmail, IsString, MaxLength, MinLength } from 'class-validator';

export class CreateUserDto {
  @IsEmail()
  @MaxLength(100) // matches the column length
  email!: string;

  @IsString()
  @MinLength(8)
  password!: string;
}
