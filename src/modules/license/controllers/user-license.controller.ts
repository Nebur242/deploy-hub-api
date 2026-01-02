import { CurrentUser } from '@app/core/decorators/current-user.decorator';
import { Admin, Authenticated } from '@app/core/guards/roles-auth.guard';
import { Project } from '@app/modules/projects/entities/project.entity';
import { User } from '@app/modules/users/entities/user.entity';
import { Controller, Get, Param, Query, NotFoundException, ParseUUIDPipe } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import { IPaginationMeta, IPaginationOptions, Pagination } from 'nestjs-typeorm-paginate';

import { UserLicense } from '../entities/user-license.entity';
import { LicensedProjectsQueryDto, UserLicenseService } from '../services/user-license.service';

/**
 * Controller handling user license operations.
 *
 * This controller provides endpoints for managing user licenses, including:
 * - Getting all licenses for the current user
 * - Getting specific license by ID
 * - Getting active licenses for a user
 * - Admin access to all user licenses
 *
 * All endpoints require authentication as enforced by the @Authenticated decorator.
 */
@ApiTags('user-licenses')
@ApiBearerAuth()
@Controller('user-licenses')
@Authenticated()
export class UserLicenseController {
  constructor(private readonly userLicenseService: UserLicenseService) {}

  /**
   * Get all user licenses for the current authenticated user with pagination
   *
   * @param user - The currently authenticated user
   * @param page - Page number for pagination (default: 1)
   * @param limit - Number of items per page (default: 10)
   * @returns A paginated list of user licenses
   */
  @Get()
  @ApiOperation({ summary: 'Get all user licenses for the current user' })
  @ApiResponse({
    status: 200,
    description: 'Returns a paginated list of user licenses',
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
  getUserLicenses(
    @CurrentUser() user: User,
    @Query('page') page = 1,
    @Query('limit') limit = 10,
  ): Promise<Pagination<UserLicense>> {
    const options: IPaginationOptions = {
      page,
      limit,
      route: 'user-licenses',
    };
    return this.userLicenseService.getUserLicenses(user.id, options);
  }

  /**
   * Get all active licenses for the current authenticated user
   *
   * @param user - The currently authenticated user
   * @returns An array of active user licenses
   */
  @Get('active-licenses')
  @ApiOperation({ summary: 'Get all active user licenses for the current user' })
  @ApiResponse({
    status: 200,
    description: 'Returns an array of active user licenses',
  })
  getActiveUserLicenses(@CurrentUser() user: User): Promise<UserLicense[]> {
    return this.userLicenseService.getActiveUserLicenses(user.id);
  }

  /**
   * Get all projects that the current user has access to via active licenses
   *
   * @param user - The currently authenticated user
   * @param page - Page number for pagination (default: 1)
   * @param limit - Number of items per page (default: 10)
   * @param visibility - Optional filter by project visibility
   * @param search - Optional search term for project name or description
   * @param licenseId - Optional filter by specific license ID
   * @returns A paginated list of projects the user has access to through licenses
   */
  @Get('licensed-projects')
  @ApiOperation({ summary: 'Get all projects accessible via active licenses' })
  @ApiResponse({
    status: 200,
    description: 'Returns a paginated list of projects the user has access to through licenses',
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
    type: String,
    required: false,
    description: 'Filter by project visibility',
  })
  @ApiQuery({
    name: 'search',
    type: String,
    required: false,
    description: 'Search term for project name or description',
  })
  @ApiQuery({
    name: 'licenseId',
    type: String,
    required: false,
    description: 'Filter by specific license ID',
  })
  getLicensedProjects(
    @CurrentUser() user: User,
    @Query('page') page = 1,
    @Query('limit') limit = 10,
    @Query('visibility') visibility?: string,
    @Query('search') search?: string,
    @Query('licenseId') licenseId?: string,
  ): Promise<Pagination<Project, IPaginationMeta>> {
    const query: LicensedProjectsQueryDto = {
      page: Number(page),
      limit: Number(limit),
      visibility,
      search,
      licenseId,
    };
    return this.userLicenseService.getLicensedProjects(user.id, query);
  }

  /**
   * Get a specific user license by ID
   *
   * @param id - The UUID of the user license to retrieve
   * @returns The user license with the specified ID
   * @throws NotFoundException if the user license is not found
   */
  @Get(':id')
  @ApiOperation({ summary: 'Get a specific user license by ID' })
  @ApiResponse({
    status: 200,
    description: 'Returns the user license with the specified ID',
  })
  @ApiResponse({
    status: 404,
    description: 'User license not found',
  })
  @ApiParam({
    name: 'id',
    description: 'User license ID (UUID)',
    type: String,
  })
  getUserLicenseById(@Param('id', new ParseUUIDPipe()) id: string): Promise<UserLicense> {
    return this.userLicenseService.getUserLicenseById(id);
  }

  /**
   * Get all user licenses (admin only) with filtering and pagination
   *
   * @param page - Page number for pagination (default: 1)
   * @param limit - Number of items per page (default: 10)
   * @param ownerId - Optional filter by owner ID
   * @param active - Optional filter by active status
   * @param licenseId - Optional filter by license ID
   * @returns A paginated list of all user licenses
   */
  @Get('admin/all')
  @Admin()
  @ApiOperation({ summary: 'Get all user licenses (admin only)' })
  @ApiResponse({
    status: 200,
    description: 'Returns a paginated list of all user licenses',
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
    name: 'owner_id',
    type: String,
    required: false,
    description: 'Filter by owner ID',
  })
  @ApiQuery({
    name: 'active',
    type: Boolean,
    required: false,
    description: 'Filter by active status',
  })
  @ApiQuery({
    name: 'license_id',
    type: String,
    required: false,
    description: 'Filter by license ID',
  })
  getAllUserLicenses(
    @Query('page') page = 1,
    @Query('limit') limit = 10,
    @Query('owner_id') owner_id?: string,
    @Query('active') active?: boolean,
    @Query('license_id') license_id?: string,
  ): Promise<Pagination<UserLicense>> {
    const options: IPaginationOptions = {
      page,
      limit,
      route: 'user-licenses/admin/all',
    };
    return this.userLicenseService.getAllUserLicenses(options, {
      owner_id,
      active,
      license_id,
    });
  }

  /**
   * Get all active user licenses for a specific user (admin only)
   *
   * @param userId - The ID of the user to retrieve licenses for
   * @returns An array of active user licenses
   */
  @Get('admin/active')
  @Admin()
  @ApiOperation({ summary: 'Get all active licenses for any user (admin only)' })
  @ApiResponse({
    status: 200,
    description: 'Returns an array of active user licenses',
  })
  @ApiQuery({
    name: 'userId',
    type: String,
    required: true,
    description: 'User ID to get active licenses for',
  })
  getAdminActiveUserLicenses(@Query('userId') userId: string): Promise<UserLicense[]> {
    if (!userId) {
      throw new NotFoundException('User ID is required');
    }
    return this.userLicenseService.getActiveUserLicenses(userId);
  }
}
