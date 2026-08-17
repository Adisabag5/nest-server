import { PartialType } from '@nestjs/mapped-types';
import { CreateProfileDto } from './CreateProfileDto';

// inherits CreateProfileDto's fields *and* their validation metadata,
// with every field marked optional — which is exactly PATCH/PUT semantics
export class UpdateProfileDto extends PartialType(CreateProfileDto) {}
