import { IsOptional, IsString } from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';

export class FindBeatsQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsString()
  collectionId?: string;
}
