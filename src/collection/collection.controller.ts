import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { CollectionService } from './collection.service';
import { CreateCollectionDto } from './dto/create-collection.dto';
import { UpdateCollectionDto } from './dto/update-collection.dto';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/decorators/current-user.decorator';

@Controller('collections')
export class CollectionController {
  constructor(private readonly collectionService: CollectionService) {}

  @Post()
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() createCollectionDto: CreateCollectionDto,
  ) {
    return this.collectionService.create(user.id, createCollectionDto);
  }

  @Get()
  findAll(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: PaginationQueryDto,
  ) {
    return this.collectionService.findAllForUser(user.id, query);
  }

  @Get(':id')
  findOne(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.collectionService.findOneForUser(user.id, id);
  }

  @Patch(':id')
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() updateCollectionDto: UpdateCollectionDto,
  ) {
    return this.collectionService.update(user.id, id, updateCollectionDto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.collectionService.remove(user.id, id);
  }
}
