import { CurrentUser } from '@app/core/decorators/current-user.decorator';
import { Admin } from '@app/core/guards/roles-auth.guard';
import { SubscriptionService } from '@app/modules/subscription/services/subscription.service';
import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  ForbiddenException,
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

import { User } from '../../users/entities/user.entity';
import { CreateProjectDto } from '../dto/create-project.dto';
import { SubmitForReviewDto } from '../dto/moderation.dto';
import { ProjectSearchDto } from '../dto/project-search.dto';
import { UpdateProjectDto } from '../dto/update-project.dto';
import { ModerationHistoryService } from '../services/moderation-history.service';
import { ProjectService } from '../services/project.service';

@ApiTags('projects')
@Admin()
@ApiBearerAuth()
@Controller('projects')
export class ProjectController {
  constructor(
    private readonly projectService: ProjectService,
    private readonly subscriptionService: SubscriptionService,
    private readonly moderationHistoryService: ModerationHistoryService,
  ) {}

  @Post()
  @ApiOperation({ summary: 'Create a new project' })
  async create(@CurrentUser() user: User, @Body() createProjectDto: CreateProjectDto) {
    // Check subscription limits before creating project
    await this.subscriptionService.validateProjectCreation(user.id);
    return this.projectService.create(user.id, createProjectDto);
  }

  @Get()
  @ApiOperation({ summary: 'Get all projects for current user' })
  findAll(@CurrentUser() user: User, @Query() searchDto: ProjectSearchDto) {
    const { page = 1, limit = 10 } = searchDto || {};
    const paginationOptions: IPaginationOptions = {
      page,
      limit,
      route: '/projects',
    };

    return this.projectService.findAll(user.id, searchDto, paginationOptions);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a project by ID' })
  @ApiParam({ name: 'id', description: 'Project ID' })
  async findOne(@Param('id') id: string, @CurrentUser() user: User) {
    const project = await this.projectService.findOne(id);
    if (project.owner_id !== user.id) {
      throw new ForbiddenException('You do not have permission to access this project');
    }
    return project;
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a project' })
  @ApiParam({ name: 'id', description: 'Project ID' })
  update(
    @CurrentUser() user: User,
    @Param('id') id: string,
    @Body() updateProjectDto: UpdateProjectDto,
  ) {
    return this.projectService.update(id, user.id, updateProjectDto);
  }

  @Post(':id/submit-for-review')
  @ApiOperation({ summary: 'Submit project for moderation review' })
  @ApiResponse({ status: 200, description: 'Project submitted for review' })
  @ApiResponse({ status: 400, description: 'Project cannot be submitted for review' })
  @ApiParam({ name: 'id', description: 'Project ID' })
  submitForReview(
    @CurrentUser() user: User,
    @Param('id') id: string,
    @Body() dto: SubmitForReviewDto,
  ) {
    return this.projectService.submitForReview(id, user.id, dto);
  }

  @Get(':id/moderation-history')
  @ApiOperation({ summary: 'Get moderation history for a project' })
  @ApiResponse({ status: 200, description: 'Returns moderation history' })
  @ApiParam({ name: 'id', description: 'Project ID' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  async getModerationHistory(
    @CurrentUser() user: User,
    @Param('id') id: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    // Verify ownership first
    const project = await this.projectService.findOne(id);
    if (project.owner_id !== user.id) {
      throw new ForbiddenException('You do not have permission to view this project history');
    }

    return this.moderationHistoryService.findByProject(id, {
      page: page || 1,
      limit: limit || 20,
    });
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a project' })
  @ApiParam({ name: 'id', description: 'Project ID' })
  remove(@CurrentUser() user: User, @Param('id') id: string) {
    return this.projectService.remove(id, user.id);
  }
}
