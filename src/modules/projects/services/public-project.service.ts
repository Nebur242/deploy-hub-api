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
        visibility: Visibility.PUBLIC,
        techStack: searchDto.techStack,
        categoryIds: searchDto.categoryIds,
        search: searchDto.search,
        sortBy: searchDto.sortBy,
        sortDirection: searchDto.sortDirection,
      },
      {
        page: searchDto.page || 1,
        limit: searchDto.limit || 10,
      },
    );
  }

  findFeatured(searchDto: ProjectSearchDto) {
    return this.projectRepository.findFeatured(
      {
        page: searchDto.page || 1,
        limit: searchDto.limit || 10,
      },
      {
        sortBy: searchDto.sortBy,
        sortDirection: searchDto.sortDirection,
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

  async getStats() {
    return {
      techStacks: await this.projectRepository.countByTechStack(),
    };
  }
}
