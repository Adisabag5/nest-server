import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  UseGuards,
} from '@nestjs/common';
import { UserService } from './user.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';
import { Roles } from '../auth/decorators/roles.decorator';
import { Role } from '../auth/enums/roles.enum';
import { RolesGuard } from '../auth/guards/roles.guard';

/**
 * Administrative CRUD over accounts. Pulse itself never calls these — it signs
 * people in through /auth and reads their details through /profiles — so the
 * whole controller is ADMIN-only.
 *
 * Before this, every route except DELETE was open to any signed-in user:
 * `GET /user` listed every account's email, and `PATCH /user/:id` took the id
 * straight from the URL without comparing it to the caller. Since update()
 * re-hashes `password`, that was account takeover, not just tampering.
 *
 * Self-service (change my own email or password) is deliberately NOT restored
 * here. It belongs on a `/user/me`-shaped route that derives the id from the
 * token, the way /profiles/me already does — never from a path parameter.
 */
@Roles(Role.ADMIN)
@UseGuards(RolesGuard)
@Controller('user')
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Post()
  create(@Body() createUserDto: CreateUserDto) {
    return this.userService.create(createUserDto);
  }

  @Get()
  findAll(@Query() query: PaginationQueryDto) {
    return this.userService.findAll(query);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.userService.findOne(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateUserDto: UpdateUserDto) {
    return this.userService.update(id, updateUserDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.userService.remove(id);
  }
}
