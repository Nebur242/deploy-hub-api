import { CurrentUser } from '@app/core/decorators/current-user.decorator';
import { Admin } from '@app/core/guards/roles-auth.guard';
import { ModerationStatus } from '@app/shared/enums';
import { Controller, Get, Param, Delete, Query, ParseUUIDPipe, Post, Body } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import { IPaginationOptions, Pagination } from 'nestjs-typeorm-paginate';

import { User } from '../../users/entities/user.entity';
import { ModerationActionDto, ModerationSearchDto } from '../dto/moderation.dto';
import { ProjectSearchDto } from '../dto/project-search.dto';
import { ModerationHistory } from '../entities/moderation-history.entity';
import { Project } from '../entities/project.entity';
import { ProjectRepository } from '../repositories/project.repository';
import { ModerationHistoryService } from '../services/moderation-history.service';
import { ProjectService } from '../services/project.service';

@ApiTags('admin/projects')
@Controller('admin/projects')
@Admin()
@ApiBearerAuth()
export class AdminProjectController {
  constructor(
    private readonly projectRepository: ProjectRepository,
    private readonly projectService: ProjectService,
    private readonly moderationHistoryService: ModerationHistoryService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Admin - Get all projects with filtering' })
  @ApiResponse({ status: 200, description: 'Returns paginated list of all projects' })
  @ApiQuery({ name: 'moderationStatus', required: false, enum: ModerationStatus })
  findAll(
    @Query() searchDto: ProjectSearchDto & { moderationStatus?: ModerationStatus },
  ): Promise<Pagination<Project>> {
    const { page = 1, limit = 10 } = searchDto || {};
    const paginationOptions: IPaginationOptions = {
      page,
      limit,
      route: '/admin/projects',
    };

    return this.projectService.findAllForAdmin(searchDto, paginationOptions);
  }

  @Get('moderation/stats')
  @ApiOperation({ summary: 'Admin - Get moderation statistics' })
  @ApiResponse({ status: 200, description: 'Returns moderation statistics' })
  getModerationStats() {
    return this.projectService.getModerationStats();
  }

  @Get('moderation/pending')
  @ApiOperation({ summary: 'Admin - Get projects pending moderation' })
  @ApiResponse({ status: 200, description: 'Returns projects pending moderation' })
  findPendingModeration(@Query() searchDto: ModerationSearchDto): Promise<Pagination<Project>> {
    const { page = 1, limit = 10 } = searchDto || {};
    return this.projectService.findPendingModeration({ page, limit });
  }

  @Get('moderation/pending-changes')
  @ApiOperation({ summary: 'Admin - Get projects with pending changes' })
  @ApiResponse({
    status: 200,
    description: 'Returns projects with pending changes awaiting review',
  })
  findPendingChanges(@Query() searchDto: ModerationSearchDto): Promise<Pagination<Project>> {
    const { page = 1, limit = 10 } = searchDto || {};
    return this.projectService.findPendingChanges({ page, limit });
  }

  @Get('moderation/activity')
  @ApiOperation({ summary: 'Admin - Get recent moderation activity' })
  @ApiResponse({ status: 200, description: 'Returns recent moderation activity' })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  getRecentActivity(@Query('limit') limit?: number): Promise<ModerationHistory[]> {
    return this.moderationHistoryService.getRecentActivity(limit || 20);
  }

  @Get(':id/moderation-history')
  @ApiOperation({ summary: 'Admin - Get moderation history for a project' })
  @ApiResponse({ status: 200, description: 'Returns moderation history' })
  @ApiParam({ name: 'id', description: 'Project ID' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  getModerationHistory(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ): Promise<{ items: ModerationHistory[]; total: number }> {
    return this.moderationHistoryService.findByProject(id, {
      page: page || 1,
      limit: limit || 20,
    });
  }

  @Post(':id/moderate')
  @ApiOperation({ summary: 'Admin - Moderate a project (approve/reject)' })
  @ApiResponse({ status: 200, description: 'Project moderated successfully' })
  @ApiResponse({ status: 400, description: 'Project not pending moderation' })
  @ApiParam({ name: 'id', description: 'Project ID' })
  moderateProject(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ModerationActionDto,
    @CurrentUser() user: User,
  ): Promise<Project> {
    return this.projectService.moderateProject(id, user.id, dto);
  }

  @Post(':id/moderate-changes')
  @ApiOperation({ summary: 'Admin - Moderate pending changes for an approved project' })
  @ApiResponse({ status: 200, description: 'Pending changes moderated successfully' })
  @ApiResponse({ status: 400, description: 'Project does not have pending changes' })
  @ApiParam({ name: 'id', description: 'Project ID' })
  moderatePendingChanges(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ModerationActionDto,
    @CurrentUser() user: User,
  ): Promise<Project> {
    return this.projectService.moderatePendingChanges(id, user.id, dto);
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
