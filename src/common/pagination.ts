import { FindManyOptions, ObjectLiteral, Repository } from 'typeorm';
import { PaginationQueryDto } from './dto/pagination-query.dto';

export interface PageMeta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

export interface Paginated<T> {
  items: T[];
  meta: PageMeta;
}

export function buildMeta(
  total: number,
  page: number,
  limit: number,
): PageMeta {
  const totalPages = total === 0 ? 0 : Math.ceil(total / limit);

  return {
    total,
    page,
    limit,
    totalPages,
    hasNext: page < totalPages,
    hasPrev: page > 1 && total > 0,
  };
}

export async function paginate<T extends ObjectLiteral>(
  repo: Repository<T>,
  query: PaginationQueryDto,
  options: FindManyOptions<T> = {},
): Promise<Paginated<T>> {
  const { page, limit } = query;

  const [items, total] = await repo.findAndCount({
    ...options,
    skip: (page - 1) * limit,
    take: limit,
  });

  return { items, meta: buildMeta(total, page, limit) };
}
