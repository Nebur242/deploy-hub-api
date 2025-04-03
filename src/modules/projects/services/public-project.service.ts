import { Injectable } from '@nestjs/common';

import { ProjectSearchDto } from '../dto/project-search.dto';
import { Project, Visibility } from '../entities/project.entity';
import { ProjectRepository } from '../repositories/project.repository';

@Injectable()
export class PublicProjectService {
  constructor(private projectRepository: ProjectRepository) {}

  findAll(searchDto: ProjectSearchDto) {
    return this.projectRepository.findAll(
      {
        visibility: searchDto.visibility,
        techStack: searchDto.techStack,
        categoryIds: searchDto.categoryIds,
        search: searchDto.search,
      },
      {
        page: searchDto.page || 1,
        limit: searchDto.limit || 10,
      },
    );
  }

  async findOne(id: string): Promise<Project | null> {
    const project = await this.projectRepository.findOne(id);

    // Only return the project if it's public
    if (
      project &&
      (project.visibility === Visibility.PUBLIC || project.visibility === Visibility.FEATURED)
    ) {
      return project;
    }

    return null;
  }
}
