import { Admin } from '@app/core/guards/roles-auth.guard';
import { Controller, Get, Param, Delete, Query, ParseUUIDPipe } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiParam } from '@nestjs/swagger';
import { IPaginationOptions, Pagination } from 'nestjs-typeorm-paginate';

import { ProjectSearchDto } from '../dto/project-search.dto';
import { Project } from '../entities/project.entity';
import { ProjectRepository } from '../repositories/project.repository';

@ApiTags('admin/projects')
@Controller('admin/projects')
@Admin()
@ApiBearerAuth()
export class AdminProjectController {
  constructor(private readonly projectRepository: ProjectRepository) {}

  @Get()
  @ApiOperation({ summary: 'Admin - Get all projects with filtering' })
  @ApiResponse({ status: 200, description: 'Returns paginated list of all projects' })
  findAll(@Query() searchDto: ProjectSearchDto): Promise<Pagination<Project>> {
    const { page = 1, limit = 10 } = searchDto || {};
    const paginationOptions: IPaginationOptions = {
      page,
      limit,
      route: '/admin/projects',
    };

    return this.projectRepository.findAllAdmin(
      {
        visibility: searchDto.visibility,
        techStack: searchDto.techStack,
        categoryIds: searchDto.categoryIds,
        search: searchDto.search,
        sortBy: searchDto.sortBy,
        sortDirection: searchDto.sortDirection,
      },
      paginationOptions,
    );
  }

  @Get(':id')
  @ApiOperation({ summary: 'Admin - Get a project by ID' })
  @ApiResponse({ status: 200, description: 'Returns the project' })
  @ApiResponse({ status: 404, description: 'Project not found' })
  @ApiParam({ name: 'id', description: 'Project ID' })
  findOne(@Param('id', ParseUUIDPipe) id: string): Promise<Project | null> {
    return this.projectRepository.findOne(id);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Admin - Delete a project' })
  @ApiResponse({ status: 200, description: 'Project deleted successfully' })
  @ApiResponse({ status: 404, description: 'Project not found' })
  @ApiParam({ name: 'id', description: 'Project ID' })
  remove(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    return this.projectRepository.remove(id);
  }
}
