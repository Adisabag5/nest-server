import { PartialType } from '@nestjs/mapped-types';
import { CreateBeatDto } from './create-beat.dto';

export class UpdateBeatDto extends PartialType(CreateBeatDto) {}
