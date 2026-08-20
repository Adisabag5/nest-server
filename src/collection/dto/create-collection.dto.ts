import { IsOptional, IsString, Length, MaxLength } from 'class-validator';

export class CreateCollectionDto {
  @IsString()
  @Length(1, 60)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(280)
  description?: string;
}
