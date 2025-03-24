import { CurrentUser } from '@app/core/decorators/current-user.decorator';
import { CurrentFirebaseUser } from '@app/core/decorators/firebase-user.decorator';
import { Authenticated } from '@app/core/guards/roles-auth.guard';
import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
} from '@nestjs/common';
import { DecodedIdToken } from 'firebase-admin/auth';

import { UserPreferencesDto } from './dto/user-preferences.dto';
import { CreateUserDto, UpdateUserDto, UserResponseDto } from './dto/user.dto';
import { User } from './entities/user.entity';
import { UsersService } from './users.service';

@Controller('users')
@Authenticated()
export class UserController {
  constructor(private readonly userService: UsersService) {}

  @Post()
  async create(
    @Body() createUserDto: CreateUserDto,
    @CurrentFirebaseUser() currentUser: DecodedIdToken,
  ): Promise<UserResponseDto> {
    const user = await this.userService.createUser({
      ...createUserDto,
      firebaseUid: currentUser.uid,
    });
    return this.userService.mapToResponseDto(user);
  }

  @Get(':id')
  async findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() currentUser: User,
  ): Promise<UserResponseDto> {
    if (currentUser.id !== id) {
      throw new ForbiddenException('Access denied');
    }

    const requestedUser = await this.userService.findOne(id);
    return this.userService.mapToResponseDto(requestedUser);
  }

  @Patch(':id')
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateUserDto: UpdateUserDto,
  ): Promise<UserResponseDto> {
    const user = await this.userService.update(id, updateUserDto);
    return this.userService.mapToResponseDto(user);
  }

  @Patch(':id/preferences')
  async updatePreferences(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() preferencesDto: UserPreferencesDto,
  ): Promise<UserResponseDto> {
    const user = await this.userService.updatePreferences(id, preferencesDto);
    return this.userService.mapToResponseDto(user);
  }
}
