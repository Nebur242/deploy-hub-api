import { Controller, Get, Param, Query, NotFoundException } from '@nestjs/common';

import { ProjectSearchDto } from '../dto/project-search.dto';
import { PublicProjectService } from '../services/public-project.service';

@Controller('public/projects')
export class PublicProjectController {
  constructor(private readonly publicProjectService: PublicProjectService) {}

  @Get()
  findAll(@Query() searchDto: ProjectSearchDto) {
    return this.publicProjectService.findAll(searchDto);
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    const project = await this.publicProjectService.findOne(id);

    if (!project) {
      throw new NotFoundException(`Project with ID ${id} not found or is not public`);
    }

    return project;
  }
}
