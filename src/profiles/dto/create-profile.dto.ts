import { IsString, MaxLength, MinLength } from 'class-validator';

export class CreateProfileDto {
  @IsString()
  @MinLength(1)
  name!: string;

  @IsString()
  @MaxLength(280)
  description!: string;
}
