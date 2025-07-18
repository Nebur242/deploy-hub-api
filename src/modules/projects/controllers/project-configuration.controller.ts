import { CurrentUser } from '@app/core/decorators/current-user.decorator';
import { Admin } from '@app/core/guards/roles-auth.guard';
import { User } from '@app/modules/users/entities/user.entity';
import { Controller, Get, Post, Body, Patch, Param, Delete } from '@nestjs/common';

import { CreateProjectConfigurationDto } from '../dto/create-project-configuration.dto';
import { UpdateProjectConfigurationDto } from '../dto/update-project-configuration.dto';
import { ProjectConfigurationService } from '../services/project-configuration.service';

@Controller('projects/:projectId/configurations')
export class ProjectConfigurationController {
  constructor(private readonly configService: ProjectConfigurationService) {}

  @Post()
  @Admin()
  create(
    @CurrentUser() user: User,
    @Param('projectId') projectId: string,
    @Body() createConfigDto: CreateProjectConfigurationDto,
  ) {
    return this.configService.create(projectId, user.id, createConfigDto);
  }

  @Get()
  findAll(@Param('projectId') projectId: string) {
    return this.configService.findByProject(projectId);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.configService.findOne(id);
  }

  @Patch(':id')
  @Admin()
  update(
    @CurrentUser() user: User,
    @Param('id') id: string,
    @Body() updateConfigDto: UpdateProjectConfigurationDto,
  ) {
    return this.configService.update(id, user.id, updateConfigDto);
  }

  @Delete(':id')
  @Admin()
  remove(@CurrentUser() user: User, @Param('id') id: string) {
    return this.configService.remove(id, user.id);
  }
}
