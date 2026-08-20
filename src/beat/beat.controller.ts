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
import { BeatService } from './beat.service';
import { CreateBeatDto } from './dto/create-beat.dto';
import { UpdateBeatDto } from './dto/update-beat.dto';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/decorators/current-user.decorator';

@Controller('beats')
export class BeatController {
  constructor(private readonly beatService: BeatService) {}

  @Post()
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() createBeatDto: CreateBeatDto,
  ) {
    return this.beatService.create(user.id, createBeatDto);
  }

  @Get()
  findAll(
    @CurrentUser() user: AuthenticatedUser,
    @Query('collectionId') collectionId?: string,
  ) {
    return this.beatService.findAllForUser(user.id, collectionId);
  }

  @Get(':id')
  findOne(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.beatService.findOneForUser(user.id, id);
  }

  @Patch(':id')
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() updateBeatDto: UpdateBeatDto,
  ) {
    return this.beatService.update(user.id, id, updateBeatDto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.beatService.remove(user.id, id);
  }
}
