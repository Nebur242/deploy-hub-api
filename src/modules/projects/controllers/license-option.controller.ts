import { CurrentUser } from '@app/core/decorators/current-user.decorator';
import { Admin } from '@app/core/guards/roles-auth.guard';
import { User } from '@app/modules/users/entities/user.entity';
import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  DefaultValuePipe,
  ParseIntPipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import { IPaginationOptions } from 'nestjs-typeorm-paginate';

import { CreateLicenseOptionDto } from '../dto/create-license-option.dto';
import { UpdateLicenseOptionDto } from '../dto/update-license-option.dto';
import { LicenseOptionService } from '../services/license-option.service';

@ApiTags('project-licenses')
@ApiBearerAuth()
@Controller('projects/:projectId/licenses')
export class LicenseOptionController {
  constructor(private readonly licenseService: LicenseOptionService) {}

  @Post()
  @Admin()
  @ApiOperation({ summary: 'Create a new license option for a project' })
  @ApiResponse({ status: 201, description: 'License option successfully created' })
  @ApiResponse({ status: 400, description: 'Invalid input data' })
  @ApiResponse({ status: 404, description: 'Project not found' })
  @ApiParam({ name: 'projectId', description: 'Project ID' })
  create(@CurrentUser() user: User, @Body() createLicenseDto: CreateLicenseOptionDto) {
    return this.licenseService.create(user.id, createLicenseDto);
  }

  @Get()
  @ApiOperation({ summary: 'Get all license options for a project' })
  @ApiResponse({ status: 200, description: 'Returns a list of license options' })
  @ApiResponse({ status: 404, description: 'Project not found' })
  @ApiParam({ name: 'projectId', description: 'Project ID' })
  @ApiQuery({ name: 'page', required: false, description: 'Page number (1-based)' })
  @ApiQuery({ name: 'limit', required: false, description: 'Items per page' })
  findAll(
    @Param('projectId') projectId: string,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number = 1,
    @Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit: number = 10,
  ) {
    const paginationOptions: IPaginationOptions = {
      page,
      limit,
      route: `/projects/${projectId}/licenses`,
    };

    return this.licenseService.findByProject(projectId, paginationOptions);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a license option by ID' })
  @ApiResponse({ status: 200, description: 'Returns the license option' })
  @ApiResponse({ status: 404, description: 'License option not found' })
  @ApiParam({ name: 'projectId', description: 'Project ID' })
  @ApiParam({ name: 'id', description: 'License option ID' })
  findOne(@Param('id') id: string) {
    return this.licenseService.findOne(id);
  }

  @Patch(':id')
  @Admin()
  @ApiOperation({ summary: 'Update a license option' })
  @ApiResponse({ status: 200, description: 'License option successfully updated' })
  @ApiResponse({ status: 400, description: 'Invalid input data' })
  @ApiResponse({ status: 404, description: 'License option not found' })
  @ApiParam({ name: 'projectId', description: 'Project ID' })
  @ApiParam({ name: 'id', description: 'License option ID' })
  update(
    @CurrentUser() user: User,
    @Param('id') id: string,
    @Body() updateLicenseDto: UpdateLicenseOptionDto,
  ) {
    return this.licenseService.update(id, user.id, updateLicenseDto);
  }

  @Delete(':id')
  @Admin()
  @ApiOperation({ summary: 'Delete a license option' })
  @ApiResponse({ status: 200, description: 'License option successfully deleted' })
  @ApiResponse({ status: 404, description: 'License option not found' })
  @ApiParam({ name: 'projectId', description: 'Project ID' })
  @ApiParam({ name: 'id', description: 'License option ID' })
  remove(@CurrentUser() user: User, @Param('id') id: string) {
    return this.licenseService.remove(id, user.id);
  }

  @Get('tiers/available')
  @ApiOperation({ summary: 'Get available license tiers' })
  @ApiResponse({ status: 200, description: 'Returns available license tiers' })
  getLicenseTiers() {
    return this.licenseService.getLicenseTiers();
  }
}

// src/projects/controllers/public-license-option.controller.ts
