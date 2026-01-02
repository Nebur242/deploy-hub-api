import { ModerationStatus } from '@app/shared/enums';
import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { IPaginationOptions, Pagination } from 'nestjs-typeorm-paginate';

import { CategoryService } from '../../categories/categories.service';
import { Category } from '../../categories/entities/category.entity';
import { UsersService } from '../../users/users.service';
import { CreateProjectDto } from '../dto/create-project.dto';
import { ModerationActionDto, SubmitForReviewDto } from '../dto/moderation.dto';
import { ProjectSearchDto } from '../dto/project-search.dto';
import { UpdateProjectDto } from '../dto/update-project.dto';
import { ModerationAction } from '../entities/moderation-history.entity';
import { Project, Visibility } from '../entities/project.entity';
import { MODERATION_EVENTS, ModerationEventPayload } from '../events/moderation.events';
import { ProjectRepository } from '../repositories/project.repository';

@Injectable()
export class ProjectService {
  constructor(
    private projectRepository: ProjectRepository,
    private categoryService: CategoryService,
    private usersService: UsersService,
    private eventEmitter: EventEmitter2,
  ) {}

  /**
   * Helper method to get owner info for event notifications
   */
  private async getOwnerInfo(ownerId: string): Promise<{ email: string; name: string }> {
    try {
      const owner = await this.usersService.findOne(ownerId);
      const name = `${owner.first_name || ''} ${owner.last_name || ''}`.trim() || owner.email;
      return {
        email: owner.email,
        name,
      };
    } catch {
      return { email: '', name: '' };
    }
  }

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
        sortBy: searchDto.sortBy,
        sortDirection: searchDto.sortDirection,
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
      const foundCategories = await this.categoryService.findByIds(categoryIds);

      if (foundCategories.length !== categoryIds.length) {
        throw new BadRequestException('One or more categories do not exist');
      }

      categories = foundCategories;
    }

    const { categories: _, ...projectData } = createProjectDto;

    return this.projectRepository.create({
      ...projectData,
      categories,
      owner_id: ownerId,
    });
  }

  async update(id: string, ownerId: string, updateProjectDto: UpdateProjectDto): Promise<Project> {
    const project = await this.findOne(id);

    // Verify ownership
    if (project.owner_id !== ownerId) {
      throw new BadRequestException('You do not have permission to update this project');
    }

    // Validate categories if they exist
    let categories: Category[] = [];
    if (updateProjectDto?.categories && updateProjectDto.categories.length > 0) {
      const categoryIds = updateProjectDto.categories.map(c => c.id);
      categories = await this.categoryService.findByIds(categoryIds);

      if (categories.length !== categoryIds.length) {
        throw new BadRequestException('One or more categories do not exist');
      }
    }

    const { categories: _, ...projectData } = updateProjectDto;

    // If project is APPROVED or CHANGES_PENDING, store changes as pending instead of applying directly
    // This keeps the project live with original data while changes await review
    if (
      project.moderation_status === ModerationStatus.APPROVED ||
      project.moderation_status === ModerationStatus.CHANGES_PENDING
    ) {
      // Store changes as pending
      const pendingChanges: Record<string, unknown> = {
        ...projectData,
        ...(categories.length > 0 ? { categoryIds: categories.map(c => c.id) } : {}),
      };

      const wasAlreadyPending = project.moderation_status === ModerationStatus.CHANGES_PENDING;

      const updatedProject = await this.projectRepository.update(id, {
        pending_changes: pendingChanges,
        has_pending_changes: true,
        pending_changes_submitted_at: wasAlreadyPending
          ? project.pending_changes_submitted_at
          : new Date(),
        moderation_status: ModerationStatus.CHANGES_PENDING,
      });

      if (!updatedProject) {
        throw new NotFoundException(`Project with ID ${id} not found after update`);
      }

      // Only emit event if this is the first time submitting changes
      if (!wasAlreadyPending) {
        // Get owner info for notification
        const ownerInfo = await this.getOwnerInfo(ownerId);

        const eventPayload: ModerationEventPayload = {
          projectId: id,
          projectName: project.name,
          action: ModerationAction.CHANGES_SUBMITTED,
          fromStatus: ModerationStatus.APPROVED,
          toStatus: ModerationStatus.CHANGES_PENDING,
          performedBy: ownerId,
          performedByRole: 'owner',
          pendingChanges,
          ownerId,
          ownerEmail: ownerInfo.email,
          ownerName: ownerInfo.name,
        };

        this.eventEmitter.emit(MODERATION_EVENTS.CHANGES_SUBMITTED, eventPayload);
      }

      return updatedProject;
    }

    // For non-approved projects, apply changes directly
    const updatedProject = await this.projectRepository.update(id, {
      ...projectData,
      ...(categories.length > 0 ? { categories } : {}),
    });

    if (!updatedProject) {
      throw new NotFoundException(`Project with ID ${id} not found after update`);
    }

    return updatedProject;
  }

  async remove(id: string, ownerId: string): Promise<void> {
    const project = await this.findOne(id);

    // Verify ownership
    if (project.owner_id !== ownerId) {
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

  findFeatured(
    paginationOptions: IPaginationOptions,
    searchDto?: ProjectSearchDto,
  ): Promise<Pagination<Project>> {
    return this.projectRepository.findFeatured(paginationOptions, {
      sortBy: searchDto?.sortBy,
      sortDirection: searchDto?.sortDirection,
    });
  }

  /**
   * Count total projects for a specific owner
   */
  countByOwner(ownerId: string): Promise<number> {
    return this.projectRepository.countByOwner(ownerId);
  }

  // ==================== MODERATION METHODS ====================

  /**
   * Submit a project for review (owner action)
   * Project must be public/featured and in draft/rejected state
   */
  async submitForReview(id: string, ownerId: string, dto?: SubmitForReviewDto): Promise<Project> {
    const project = await this.findOne(id);

    // Verify ownership
    if (project.owner_id !== ownerId) {
      throw new BadRequestException('You do not have permission to submit this project for review');
    }

    // Check if project is public or featured (private projects don't need moderation)
    if (project.visibility === Visibility.PRIVATE) {
      throw new BadRequestException('Private projects do not need moderation approval');
    }

    // Check if project can be submitted (must be in draft or rejected state)
    if (
      project.moderation_status !== ModerationStatus.DRAFT &&
      project.moderation_status !== ModerationStatus.REJECTED
    ) {
      throw new BadRequestException(
        `Project cannot be submitted for review. Current status: ${project.moderation_status}`,
      );
    }

    const previousStatus = project.moderation_status;
    const isResubmission = previousStatus === ModerationStatus.REJECTED;

    // Update to pending status
    const updatedProject = await this.projectRepository.update(id, {
      moderation_status: ModerationStatus.PENDING,
      submitted_for_review_at: new Date(),
      moderation_note: dto?.message || undefined,
    });

    if (!updatedProject) {
      throw new NotFoundException(`Project with ID ${id} not found after update`);
    }

    // Get owner info for notification
    const ownerInfo = await this.getOwnerInfo(ownerId);

    // Emit event for history tracking (async, non-blocking)
    const eventPayload: ModerationEventPayload = {
      projectId: id,
      projectName: project.name,
      action: isResubmission ? ModerationAction.RESUBMITTED : ModerationAction.SUBMITTED,
      fromStatus: previousStatus,
      toStatus: ModerationStatus.PENDING,
      note: dto?.message,
      performedBy: ownerId,
      performedByRole: 'owner',
      ownerId,
      ownerEmail: ownerInfo.email,
      ownerName: ownerInfo.name,
    };

    this.eventEmitter.emit(
      isResubmission ? MODERATION_EVENTS.RESUBMITTED : MODERATION_EVENTS.SUBMITTED_FOR_REVIEW,
      eventPayload,
    );

    return updatedProject;
  }

  /**
   * Moderate a project (admin action)
   */
  async moderateProject(id: string, adminId: string, dto: ModerationActionDto): Promise<Project> {
    const project = await this.findOne(id);

    // Check if project is pending moderation
    if (project.moderation_status !== ModerationStatus.PENDING) {
      throw new BadRequestException(
        `Project is not pending moderation. Current status: ${project.moderation_status}`,
      );
    }

    const previousStatus = project.moderation_status;
    const newStatus =
      dto.status === ModerationStatus.APPROVED
        ? ModerationStatus.APPROVED
        : ModerationStatus.REJECTED;

    // Update moderation status
    const updatedProject = await this.projectRepository.update(id, {
      moderation_status: newStatus,
      moderation_note: dto.note || undefined,
      moderated_by: adminId,
      moderated_at: new Date(),
    });

    if (!updatedProject) {
      throw new NotFoundException(`Project with ID ${id} not found after update`);
    }

    // Get owner info for notification
    const ownerInfo = await this.getOwnerInfo(project.owner_id);

    // Emit event for history tracking (async, non-blocking)
    const eventPayload: ModerationEventPayload = {
      projectId: id,
      projectName: project.name,
      action:
        dto.status === ModerationStatus.APPROVED
          ? ModerationAction.APPROVED
          : ModerationAction.REJECTED,
      fromStatus: previousStatus,
      toStatus: newStatus,
      note: dto.note,
      performedBy: adminId,
      performedByRole: 'admin',
      ownerId: project.owner_id,
      ownerEmail: ownerInfo.email,
      ownerName: ownerInfo.name,
    };

    this.eventEmitter.emit(
      dto.status === ModerationStatus.APPROVED
        ? MODERATION_EVENTS.APPROVED
        : MODERATION_EVENTS.REJECTED,
      eventPayload,
    );

    return updatedProject;
  }

  /**
   * Get projects pending moderation (admin)
   */
  findPendingModeration(paginationOptions: IPaginationOptions): Promise<Pagination<Project>> {
    return this.projectRepository.findPendingModeration(paginationOptions);
  }

  /**
   * Get all projects with moderation filtering (admin)
   */
  findAllForAdmin(
    searchDto: ProjectSearchDto & { moderationStatus?: ModerationStatus },
    paginationOptions: IPaginationOptions,
  ): Promise<Pagination<Project>> {
    return this.projectRepository.findAll(
      {
        visibility: searchDto.visibility,
        moderationStatus: searchDto.moderationStatus,
        techStack: searchDto.techStack,
        categoryIds: searchDto.categoryIds,
        search: searchDto.search,
        sortBy: searchDto.sortBy,
        sortDirection: searchDto.sortDirection,
      },
      paginationOptions,
    );
  }

  /**
   * Get moderation statistics (admin)
   */
  async getModerationStats(): Promise<{
    pending: number;
    approved: number;
    rejected: number;
    draft: number;
    changes_pending: number;
  }> {
    const counts = await this.projectRepository.countByModerationStatus();

    return {
      pending: counts.find(c => c.status === ModerationStatus.PENDING)?.count || 0,
      approved: counts.find(c => c.status === ModerationStatus.APPROVED)?.count || 0,
      rejected: counts.find(c => c.status === ModerationStatus.REJECTED)?.count || 0,
      draft: counts.find(c => c.status === ModerationStatus.DRAFT)?.count || 0,
      changes_pending: counts.find(c => c.status === ModerationStatus.CHANGES_PENDING)?.count || 0,
    };
  }

  /**
   * Get projects with pending changes (admin)
   */
  findPendingChanges(paginationOptions: IPaginationOptions): Promise<Pagination<Project>> {
    return this.projectRepository.findPendingChanges(paginationOptions);
  }

  /**
   * Moderate pending changes for an approved project (admin action)
   * If approved: Apply pending changes to project and clear pending_changes
   * If rejected: Clear pending changes and keep original data
   */
  async moderatePendingChanges(
    id: string,
    adminId: string,
    dto: ModerationActionDto,
  ): Promise<Project> {
    const project = await this.findOne(id);

    // Check if project has pending changes
    if (
      project.moderation_status !== ModerationStatus.CHANGES_PENDING ||
      !project.has_pending_changes
    ) {
      throw new BadRequestException(
        `Project does not have pending changes. Current status: ${project.moderation_status}`,
      );
    }

    const previousStatus = project.moderation_status;
    const isApproved = dto.status === ModerationStatus.APPROVED;

    if (isApproved && project.pending_changes) {
      // Apply pending changes to the project
      const { categoryIds, ...pendingData } = project.pending_changes;

      // Resolve categories if they were changed
      let categories: Category[] = [];
      if (categoryIds && Array.isArray(categoryIds) && categoryIds.length > 0) {
        categories = await this.categoryService.findByIds(categoryIds as string[]);
      }

      // Apply changes and clear pending
      const updatedProject = await this.projectRepository.update(id, {
        ...pendingData,
        ...(categories.length > 0 ? { categories } : {}),
        pending_changes: null,
        has_pending_changes: false,
        pending_changes_submitted_at: null,
        moderation_status: ModerationStatus.APPROVED,
        moderation_note: dto.note || undefined,
        moderated_by: adminId,
        moderated_at: new Date(),
      });

      if (!updatedProject) {
        throw new NotFoundException(`Project with ID ${id} not found after update`);
      }

      // Get owner info for notification
      const ownerInfo = await this.getOwnerInfo(project.owner_id);

      // Emit event
      const eventPayload: ModerationEventPayload = {
        projectId: id,
        projectName: project.name,
        action: ModerationAction.CHANGES_APPROVED,
        fromStatus: previousStatus,
        toStatus: ModerationStatus.APPROVED,
        note: dto.note,
        performedBy: adminId,
        performedByRole: 'admin',
        ownerId: project.owner_id,
        ownerEmail: ownerInfo.email,
        ownerName: ownerInfo.name,
      };

      this.eventEmitter.emit(MODERATION_EVENTS.CHANGES_APPROVED, eventPayload);

      return updatedProject;
    } else {
      // Reject changes - clear pending changes, keep original data
      const updatedProject = await this.projectRepository.update(id, {
        pending_changes: null,
        has_pending_changes: false,
        pending_changes_submitted_at: null,
        moderation_status: ModerationStatus.APPROVED, // Back to approved with original data
        moderation_note: dto.note || undefined,
        moderated_by: adminId,
        moderated_at: new Date(),
      });

      if (!updatedProject) {
        throw new NotFoundException(`Project with ID ${id} not found after update`);
      }

      // Get owner info for notification
      const ownerInfo = await this.getOwnerInfo(project.owner_id);

      // Emit event
      const eventPayload: ModerationEventPayload = {
        projectId: id,
        projectName: project.name,
        action: ModerationAction.CHANGES_REJECTED,
        fromStatus: previousStatus,
        toStatus: ModerationStatus.APPROVED,
        note: dto.note,
        performedBy: adminId,
        performedByRole: 'admin',
        ownerId: project.owner_id,
        ownerEmail: ownerInfo.email,
        ownerName: ownerInfo.name,
      };

      this.eventEmitter.emit(MODERATION_EVENTS.CHANGES_REJECTED, eventPayload);

      return updatedProject;
    }
  }
}
