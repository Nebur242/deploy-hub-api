import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IPaginationOptions, Pagination } from 'nestjs-typeorm-paginate';
import { In, Repository } from 'typeorm';

import { CreateProjectDto } from './dto/create-project.dto';
import { ProjectSearchDto } from './dto/project-search.dto';
import { UpdateProjectDto } from './dto/update-project.dto';
import { Project } from './entities/project.entity';
import { ProjectRepository } from './repositories/project.repository';
import { Category } from '../categories/entities/category.entity';

@Injectable()
export class ProjectService {
  constructor(
    private projectRepository: ProjectRepository,
    @InjectRepository(Category)
    private categoryRepository: Repository<Category>,
  ) {}

  findAll(
    ownerId: string,
    searchDto: ProjectSearchDto,
    paginationOptions: IPaginationOptions,
  ): Promise<Pagination<Project>> {
    return this.projectRepository.findAll(
      {
        ownerId,
        visibility: searchDto.visibility,
        techStack: searchDto.techStack,
        categoryIds: searchDto.categoryIds,
        search: searchDto.search,
      },
      paginationOptions,
    );
  }

  async findOne(id: string): Promise<Project> {
    const project = await this.projectRepository.findOne(id);
    if (!project) {
      throw new NotFoundException(`Project with ID ${id} not found`);
    }
    return project;
  }

  async create(ownerId: string, createProjectDto: CreateProjectDto): Promise<Project> {
    // Validate categories if they exist
    let categories: Category[] = [];
    if (createProjectDto.categories && createProjectDto.categories.length > 0) {
      const categoryIds = createProjectDto.categories.map(c => c.id);
      const foundCategories = await this.categoryRepository.find({
        where: { id: In(categoryIds) },
      });

      if (foundCategories.length !== categoryIds.length) {
        throw new BadRequestException('One or more categories do not exist');
      }

      categories = foundCategories;
    }

    const { categories: _, ...projectData } = createProjectDto;

    return this.projectRepository.create({
      ...projectData,
      categories,
      ownerId,
    });
  }

  async update(id: string, ownerId: string, updateProjectDto: UpdateProjectDto): Promise<Project> {
    const project = await this.findOne(id);

    // Verify ownership
    if (project.ownerId !== ownerId) {
      throw new BadRequestException('You do not have permission to update this project');
    }

    // Validate categories if they exist
    const categoryIds = await Promise.all(
      (updateProjectDto?.categories || []).map(async c => {
        const category = await this.categoryRepository.findOne({
          where: { id: c.id },
        });
        if (!category) {
          throw new BadRequestException(`Category with ID ${c.id} does not exist`);
        }
        return category;
      }),
    );

    const { categories: _, ...projectData } = updateProjectDto;
    const updatedProject = await this.projectRepository.update(id, {
      ...projectData,
      ...(categoryIds.length > 0 ? { categories: categoryIds } : {}),
    });

    if (!updatedProject) {
      throw new NotFoundException(`Project with ID ${id} not found after update`);
    }

    return updatedProject;
  }

  async remove(id: string, ownerId: string): Promise<void> {
    const project = await this.findOne(id);

    // Verify ownership
    if (project.ownerId !== ownerId) {
      throw new BadRequestException('You do not have permission to delete this project');
    }

    await this.projectRepository.remove(id);
  }

  findPublic(
    searchDto: ProjectSearchDto,
    paginationOptions: IPaginationOptions,
  ): Promise<Pagination<Project>> {
    return this.projectRepository.findPublic(
      {
        techStack: searchDto.techStack,
        categoryIds: searchDto.categoryIds,
        search: searchDto.search,
      },
      paginationOptions,
    );
  }

  findFeatured(paginationOptions: IPaginationOptions): Promise<Pagination<Project>> {
    return this.projectRepository.findFeatured(paginationOptions);
  }
}
