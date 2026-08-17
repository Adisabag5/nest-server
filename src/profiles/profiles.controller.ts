import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
} from '@nestjs/common';
import { CreateProfileDto } from './dto/create-profile.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { ProfilesService } from './profiles.service';

@Controller('profiles')
export class ProfilesController {
  constructor(private profilesService: ProfilesService) {}

  //GET /profiles
  @Get()
  findAll() {
    return this.profilesService.findAll();
  }

  //GET /profiles/:id
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.profilesService.findOne(id);
  }

  //POST /profiles
  @Post()
  create(@Body() createProfileDto: CreateProfileDto) {
    return this.profilesService.createProfile(createProfileDto);
  }

  //PUT /profiles/:id
  @Put(':id')
  update(@Param('id') id: string, @Body() updateProfilteDto: UpdateProfileDto) {
    return this.profilesService.updateProfile(id, updateProfilteDto);
  }

  //DELETE /profiles/:id
  @Delete(':id')
  delete(@Param('id') id: string) {
    return this.profilesService.deleteProfile(id);
  }
}
