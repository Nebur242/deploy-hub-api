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
  Query,
} from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiQuery } from '@nestjs/swagger';
import { DecodedIdToken } from 'firebase-admin/auth';
import { IPaginationMeta, Pagination } from 'nestjs-typeorm-paginate';

import { LicensedProjectsQueryDto, LicensedProjectsResponseDto } from './dto/licensed-projects.dto';
import { UserNotificationDto } from './dto/user-notification.dto';
import { UserPreferencesDto } from './dto/user-preferences.dto';
import { CreateUserDto, UpdateUserDto, UserResponseDto } from './dto/user.dto';
import { User } from './entities/user.entity';
import { UsersService } from './users.service';
import { Project, Visibility } from '../projects/entities/project.entity';

/**
 * Controller handling user operations.
 *
 * This controller provides endpoints for managing users, including:
 * - Creating new users
 * - Retrieving user information
 * - Updating user details
 * - Updating user preferences
 * - Updating notification settings
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
    if (currentUser.email) {
      await this.userService.sendWelcomeEmailNotification({
        ...user,
        email: currentUser.email,
      });
    }
    return this.userService.mapToResponseDto(user);
  }

  /**
   * Retrieves projects that the currently authenticated user can access through purchased licenses
   *
   * @param query - Query parameters for filtering and pagination
   * @param currentUser - The currently authenticated user
   * @returns A paginated list of projects the user has access to through purchased licenses
   */
  @Get('licensed-projects')
  @ApiOperation({
    summary: 'Get user licensed projects',
    description: 'Returns projects the authenticated user has access to through purchased licenses',
  })
  @ApiResponse({
    status: 200,
    description: 'List of licensed projects with pagination',
    type: LicensedProjectsResponseDto,
    isArray: true,
  })
  @ApiQuery({
    name: 'page',
    type: Number,
    required: false,
    description: 'Page number for pagination',
  })
  @ApiQuery({
    name: 'limit',
    type: Number,
    required: false,
    description: 'Number of items per page',
  })
  @ApiQuery({
    name: 'visibility',
    enum: Visibility,
    required: false,
    description: 'Filter by project visibility',
  })
  @ApiQuery({
    name: 'search',
    type: String,
    required: false,
    description: 'Search term to filter projects',
  })
  @ApiQuery({
    name: 'licenseId',
    type: String,
    required: false,
    description: 'Filter by license ID',
  })
  getLicensedProjects(
    @Query() query: LicensedProjectsQueryDto,
    @CurrentUser() currentUser: User,
  ): Promise<Pagination<Project, IPaginationMeta>> {
    return this.userService.getLicensedProjects(currentUser.id, query);
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
    console.log('findOne', uid, currentUser.uid);
    if (currentUser.uid !== uid) {
      throw new ForbiddenException('Access denied');
    }

    const requestedUser = await this.userService.findByFirebaseUid(currentUser.uid);
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

  /**
   * Updates the notification settings of a user identified by its UUID.
   *
   * @param id - The UUID of the user to update
   * @param notificationDto - The DTO containing notification settings to be updated
   * @returns A promise that resolves to the updated user data in the response DTO format
   *
   * @throws NotFoundException - If the user with the specified ID is not found
   * @throws UnauthorizedException - If the requester doesn't have permission to update the user's notifications
   * @throws BadRequestException - If the notification data is invalid
   */
  @Patch(':id/notifications')
  async updateNotifications(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() notificationDto: UserNotificationDto,
  ): Promise<UserResponseDto> {
    const user = await this.userService.updateNotifications(id, notificationDto);
    return this.userService.mapToResponseDto(user);
  }
}
