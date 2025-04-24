import { CurrentUser } from '@app/core/decorators/current-user.decorator';
import { Admin } from '@app/core/guards/roles-auth.guard';
import { User } from '@app/modules/users/entities/user.entity';
import { Controller, Get, Param, Query } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';

import { UserLicenseService } from '../services/user-license.service';

@ApiTags('user-licenses')
@ApiBearerAuth()
@Controller('user-licenses')
@Admin()
export class UserLicenseController {
  constructor(private readonly userLicenseService: UserLicenseService) {}

  @Get('active')
  @ApiOperation({ summary: 'Get all active licenses for the current user' })
  @ApiResponse({ status: 200, description: 'Returns list of active licenses' })
  getUserActiveLicenses(@CurrentUser() user: User) {
    return this.userLicenseService.getUserActiveLicenses(user.id);
  }

  @Get('has-active')
  @ApiOperation({ summary: 'Check if the user has an active license for a project' })
  @ApiResponse({ status: 200, description: 'Returns true if user has an active license' })
  @ApiQuery({ name: 'projectId', required: false, description: 'Filter by project ID' })
  async hasActiveLicense(@CurrentUser() user: User, @Query('projectId') projectId?: string) {
    const hasLicense = await this.userLicenseService.hasActiveLicense(user.id, projectId);
    return { hasActiveLicense: hasLicense };
  }

  @Get('active/:licenseId')
  @ApiOperation({ summary: 'Get a specific active license for the current user' })
  @ApiResponse({ status: 200, description: 'Returns the active license if found' })
  @ApiParam({ name: 'licenseId', description: 'License ID to check' })
  getUserActiveLicense(@CurrentUser() user: User, @Param('licenseId') licenseId: string) {
    return this.userLicenseService.getUserActiveLicense(user.id, licenseId);
  }

  @Get('admin/active')
  @Admin()
  @ApiOperation({ summary: 'Admin - Get all active licenses for a user' })
  @ApiResponse({ status: 200, description: 'Returns list of active licenses for the user' })
  @ApiQuery({ name: 'userId', required: true, description: 'User ID to check' })
  getAdminUserActiveLicenses(@Query('userId') userId: string) {
    return this.userLicenseService.getUserActiveLicenses(userId);
  }

  @Get('admin/has-active')
  @Admin()
  @ApiOperation({ summary: 'Admin - Check if a user has an active license for a project' })
  @ApiResponse({ status: 200, description: 'Returns true if user has an active license' })
  @ApiQuery({ name: 'userId', required: true, description: 'User ID to check' })
  @ApiQuery({ name: 'projectId', required: false, description: 'Filter by project ID' })
  async adminHasActiveLicense(
    @Query('userId') userId: string,
    @Query('projectId') projectId?: string,
  ) {
    const hasLicense = await this.userLicenseService.hasActiveLicense(userId, projectId);
    return { hasActiveLicense: hasLicense };
  }
}
