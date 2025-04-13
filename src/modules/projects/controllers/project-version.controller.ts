import { CurrentUser } from '@app/core/decorators/current-user.decorator';
import { Admin } from '@app/core/guards/roles-auth.guard';
import { User } from '@app/modules/users/entities/user.entity';
import { Controller, Get, Post, Body, Param, Delete, Patch } from '@nestjs/common';

import { CreateVersionDto } from '../dto/create-version.dto';
import { UpdateVersionDto } from '../dto/update-version.dto';
import { ProjectVersionService } from '../services/project-version.service';

@Admin()
@Controller('projects/:projectId/versions')
export class ProjectVersionController {
  constructor(private readonly projectVersionService: ProjectVersionService) {}

  @Post()
  create(
    @CurrentUser() user: User,
    @Param('projectId') projectId: string,
    @Body()
    createVersionDto: CreateVersionDto,
  ) {
    return this.projectVersionService.create(projectId, user.id, createVersionDto);
  }

  @Get()
  findAll(@Param('projectId') projectId: string) {
    return this.projectVersionService.findAll(projectId);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.projectVersionService.findOne(id);
  }

  @Patch(':id')
  updateVersion(
    @Param('id') id: string,
    @Body() updateVersionDto: UpdateVersionDto,
    @CurrentUser() user: User,
  ) {
    return this.projectVersionService.updateVersion(id, user.id, updateVersionDto);
  }

  @Post(':id/set-stable')
  setAsStable(@CurrentUser() user: User, @Param('id') id: string) {
    return this.projectVersionService.setAsStable(id, user.id);
  }

  @Delete(':id')
  remove(@CurrentUser() user: User, @Param('id') id: string) {
    return this.projectVersionService.remove(id, user.id);
  }
}
