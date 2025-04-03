import {
  Controller,
  Get,
  Param,
  Query,
  DefaultValuePipe,
  ParseIntPipe,
  NotFoundException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam, ApiQuery } from '@nestjs/swagger';
import { IPaginationOptions } from 'nestjs-typeorm-paginate';

import { LicenseOptionService } from '../services/license-option.service';

@ApiTags('public-licenses')
@Controller('public/projects/:projectId/licenses')
export class PublicLicenseOptionController {
  constructor(private readonly licenseService: LicenseOptionService) {}

  @Get()
  @ApiOperation({ summary: 'Get public license options for a project' })
  @ApiResponse({ status: 200, description: 'Returns a list of license options' })
  @ApiResponse({ status: 404, description: 'Project not found' })
  @ApiParam({ name: 'projectId', description: 'Project ID' })
  @ApiQuery({ name: 'page', required: false, description: 'Page number (1-based)' })
  @ApiQuery({ name: 'limit', required: false, description: 'Items per page' })
  async findPublicLicenses(
    @Param('projectId') projectId: string,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number = 1,
    @Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit: number = 10,
  ) {
    const paginationOptions: IPaginationOptions = {
      page,
      limit,
      route: `/public/projects/${projectId}/licenses`,
    };

    try {
      return await this.licenseService.findPublicByProject(projectId, paginationOptions);
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw new NotFoundException(`Project with ID ${projectId} not found or is not public`);
      }
      throw error;
    }
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a public license option by ID' })
  @ApiResponse({ status: 200, description: 'Returns the license option' })
  @ApiResponse({ status: 404, description: 'License option not found' })
  @ApiParam({ name: 'projectId', description: 'Project ID' })
  @ApiParam({ name: 'id', description: 'License option ID' })
  async findPublicLicense(@Param('projectId') projectId: string, @Param('id') id: string) {
    try {
      const license = await this.licenseService.findOne(id);

      // Verify the license belongs to the specified project
      if (license.projectId !== projectId) {
        throw new NotFoundException('License option not found for this project');
      }

      return license;
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw new NotFoundException(`License option with ID ${id} not found`);
      }
      throw error;
    }
  }
}
