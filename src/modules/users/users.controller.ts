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

/**
 * Controller handling user operations.
 *
 * This controller provides endpoints for managing users, including:
 * - Creating new users
 * - Retrieving user information
 * - Updating user details
 * - Updating user preferences
 *
 * All endpoints require authentication as enforced by the @Authenticated decorator.
 */
@Controller('users')
@Authenticated()
export class UserController {
  constructor(private readonly userService: UsersService) {}

  /**
   * Creates a new user using the provided DTO and the current Firebase user.
   *
   * @param createUserDto - The data transfer object containing user information for creation
   * @param currentUser - The decoded Firebase ID token of the authenticated user
   * @returns A promise that resolves to the user response DTO
   * @throws {UnauthorizedException} If the current user is not authenticated
   * @throws {BadRequestException} If the user data is invalid
   */
  @Post()
  async create(
    @Body() createUserDto: CreateUserDto,
    @CurrentFirebaseUser() currentUser: DecodedIdToken,
  ): Promise<UserResponseDto> {
    const user = await this.userService.createUser({
      ...createUserDto,
      uid: currentUser.uid,
    });
    return this.userService.mapToResponseDto(user);
  }

  /**
   * Retrieves a user by their uid.
   *
   * @param uid - The unique identifier of the user to retrieve
   * @param currentUser - The currently authenticated user
   * @returns A promise that resolves to a UserResponseDto containing the user's information
   * @throws ForbiddenException - When the current user tries to access another user's data
   */
  @Get(':uid')
  async findOne(
    @Param('uid') uid: string,
    @CurrentUser() currentUser: User,
  ): Promise<UserResponseDto> {
    if (currentUser.uid !== uid) {
      throw new ForbiddenException('Access denied');
    }

    const requestedUser = await this.userService.findOne(currentUser.id);
    return this.userService.mapToResponseDto(requestedUser);
  }

  /**
   * Updates an existing user by ID with the provided data.
   *
   * @param {string} id - The UUID of the user to update
   * @param {UpdateUserDto} updateUserDto - The data to update the user with
   * @returns {Promise<UserResponseDto>} The updated user mapped to response DTO
   * @throws {NotFoundException} If the user with the given ID is not found
   */
  @Patch(':id')
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateUserDto: UpdateUserDto,
  ): Promise<UserResponseDto> {
    const user = await this.userService.update(id, updateUserDto);
    return this.userService.mapToResponseDto(user);
  }

  /**
   * Updates the preferences of a user identified by its UUID.
   *
   * @param id - The UUID of the user to update
   * @param preferencesDto - The DTO containing user preferences to be updated
   * @returns A promise that resolves to the updated user data in the response DTO format
   *
   * @throws NotFoundException - If the user with the specified ID is not found
   * @throws UnauthorizedException - If the requester doesn't have permission to update the user's preferences
   * @throws BadRequestException - If the preferences data is invalid
   */
  @Patch(':id/preferences')
  async updatePreferences(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() preferencesDto: UserPreferencesDto,
  ): Promise<UserResponseDto> {
    const user = await this.userService.updatePreferences(id, preferencesDto);
    return this.userService.mapToResponseDto(user);
  }
}
