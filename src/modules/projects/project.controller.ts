import { CurrentUser } from '@app/core/decorators/current-user.decorator';
import { Admin } from '@app/core/guards/roles-auth.guard';
import { Controller, Get, Post, Body, Patch, Param, Delete, Query } from '@nestjs/common';
import { IPaginationOptions } from 'nestjs-typeorm-paginate';

import { CreateProjectDto } from './dto/create-project.dto';
import { ProjectSearchDto } from './dto/project-search.dto';
import { UpdateProjectDto } from './dto/update-project.dto';
import { ProjectService } from './project.service';
import { User } from '../users/entities/user.entity';

@Admin()
@Controller('projects')
export class ProjectController {
  constructor(private readonly projectService: ProjectService) {}

  @Post()
  create(@CurrentUser() user: User, @Body() createProjectDto: CreateProjectDto) {
    return this.projectService.create(user.id, createProjectDto);
  }

  @Get()
  findAll(@CurrentUser() user: User, @Query() searchDto: ProjectSearchDto) {
    const { page = 1, limit = 10 } = searchDto;
    const paginationOptions: IPaginationOptions = {
      page,
      limit,
      route: '/projects',
    };

    return this.projectService.findAll(user.id, searchDto, paginationOptions);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.projectService.findOne(id);
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
