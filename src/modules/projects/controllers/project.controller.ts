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
import { IPaginationOptions } from 'nestjs-typeorm-paginate';

import { User } from '../../users/entities/user.entity';
import { CreateProjectDto } from '../dto/create-project.dto';
import { ProjectSearchDto } from '../dto/project-search.dto';
import { UpdateProjectDto } from '../dto/update-project.dto';
import { ProjectService } from '../services/project.service';

@Admin()
@Controller('projects')
export class ProjectController {
  constructor(
    private readonly projectService: ProjectService,
    private readonly subscriptionService: SubscriptionService,
  ) {}

  @Post()
  async create(@CurrentUser() user: User, @Body() createProjectDto: CreateProjectDto) {
    // Check subscription limits before creating project
    await this.subscriptionService.validateProjectCreation(user.id);
    return this.projectService.create(user.id, createProjectDto);
  }

  @Get()
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
  async findOne(@Param('id') id: string, @CurrentUser() user: User) {
    const project = await this.projectService.findOne(id);
    if (project.owner_id !== user.id) {
      throw new ForbiddenException('You do not have permission to access this project');
    }
    return project;
  }

  @Patch(':id')
  update(
    @CurrentUser() user: User,
    @Param('id') id: string,
    @Body() updateProjectDto: UpdateProjectDto,
  ) {
    return this.projectService.update(id, user.id, updateProjectDto);
  }

  @Delete(':id')
  remove(@CurrentUser() user: User, @Param('id') id: string) {
    return this.projectService.remove(id, user.id);
  }
}
