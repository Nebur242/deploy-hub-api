import { ProjectRepository } from '@app/modules/projects/repositories/project.repository';
import { StripeService } from '@app/modules/subscription/services/stripe.service';
import { SubscriptionService } from '@app/modules/subscription/services/subscription.service';
import { User } from '@app/modules/users/entities/user.entity';
import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  forwardRef,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IPaginationOptions, paginate, Pagination } from 'nestjs-typeorm-paginate';
import { Repository, ILike, FindOptionsOrder } from 'typeorm';

import { CreateLicenseDto } from '../dto/create-license.dto';
import { FilterLicenseDto } from '../dto/filter.dto';
import { UpdateLicenseDto } from '../dto/update-license.dto';
import { License } from '../entities/license.entity';

// Minimum deployments per license to ensure value for customers
const MIN_DEPLOYMENT_LIMIT = 5;

@Injectable()
export class LicenseService {
  private readonly logger = new Logger(LicenseService.name);

  constructor(
    @InjectRepository(License)
    private licenseRepository: Repository<License>,
    private readonly projectRepository: ProjectRepository,
    @Inject(forwardRef(() => SubscriptionService))
    private readonly subscriptionService: SubscriptionService,
    private readonly stripeService: StripeService,
  ) {}

  /**
   * Calculate the total deployments allocated across all licenses owned by a user
   */
  async calculateAllocatedDeployments(ownerId: string): Promise<number> {
    const result = await this.licenseRepository
      .createQueryBuilder('license')
      .select('COALESCE(SUM(license.deployment_limit), 0)', 'total')
      .where('license.owner_id = :ownerId', { ownerId })
      .getRawOne<{ total: string }>();

    return parseInt(result?.total || '0', 10);
  }

  /**
   * Get deployment pool info for an owner
   */
  async getDeploymentPoolInfo(ownerId: string): Promise<{
    total: number;
    allocated: number;
    available: number;
  }> {
    const subscription = await this.subscriptionService.getSubscription(ownerId);
    const allocated = await this.calculateAllocatedDeployments(ownerId);
    const total = subscription.max_deployments_per_month;

    return {
      total,
      allocated,
      available: total === -1 ? -1 : Math.max(0, total - allocated),
    };
  }

  /**
   * Validate deployment limit against owner's available pool
   */
  private async validateDeploymentLimit(
    ownerId: string,
    requestedLimit: number,
    excludeLicenseId?: string,
  ): Promise<void> {
    // Validate minimum deployment limit
    if (requestedLimit < MIN_DEPLOYMENT_LIMIT) {
      throw new BadRequestException(
        `Minimum deployment limit per license is ${MIN_DEPLOYMENT_LIMIT}`,
      );
    }

    // Get owner's subscription
    const subscription = await this.subscriptionService.getSubscription(ownerId);

    // Unlimited pool (-1) means no validation needed
    if (subscription.max_deployments_per_month === -1) {
      return;
    }

    // Calculate currently allocated deployments
    let allocated = await this.calculateAllocatedDeployments(ownerId);

    // If updating, exclude the current license's allocation
    if (excludeLicenseId) {
      const currentLicense = await this.licenseRepository.findOne({
        where: { id: excludeLicenseId },
      });
      if (currentLicense) {
        allocated -= currentLicense.deployment_limit;
      }
    }

    const availablePool = subscription.max_deployments_per_month - allocated;

    if (requestedLimit > availablePool) {
      throw new BadRequestException(
        `Insufficient deployment pool. Available: ${availablePool}, Requested: ${requestedLimit}. ` +
          `Upgrade your subscription to get more deployments.`,
      );
    }
  }

  /**
   * Create a new license option for a project
   */
  async create(user: User, createLicenseDto: CreateLicenseDto): Promise<License> {
    // Validate deployment limit against owner's pool
    await this.validateDeploymentLimit(user.id, createLicenseDto.deployment_limit);

    // Check if all projects exist and user is the owner of each
    const projects = await Promise.all(
      createLicenseDto.project_ids.map(async projectId => {
        const project = await this.projectRepository.findOne(projectId);

        if (!project) {
          throw new NotFoundException(`Project with ID ${projectId} not found`);
        }

        if (project.owner_id !== user.id) {
          throw new BadRequestException(
            `You do not have permission to add license to project: ${project.name}`,
          );
        }

        return project;
      }),
    );

    // Create license without projects first
    const { project_ids: _, ...licenseData } = createLicenseDto;
    const newLicense = this.licenseRepository.create(licenseData);
    const savedLicense = await this.licenseRepository.save(newLicense);

    // Create Stripe product and price for this license
    try {
      const stripeProduct = await this.stripeService.createLicenseProduct(
        savedLicense.id,
        savedLicense.name,
        savedLicense.description,
        {
          owner_id: user.id,
          deployment_limit: String(savedLicense.deployment_limit),
          period: savedLicense.period,
        },
      );

      const stripePrice = await this.stripeService.createLicensePrice(
        stripeProduct.id,
        savedLicense.price,
        savedLicense.currency,
        savedLicense.id,
        savedLicense.period,
      );

      savedLicense.stripe_product_id = stripeProduct.id;
      savedLicense.stripe_price_id = stripePrice.id;
      this.logger.log(
        `Created Stripe product ${stripeProduct.id} and price ${stripePrice.id} for license ${savedLicense.id}`,
      );
    } catch (error) {
      this.logger.error(`Failed to create Stripe product for license ${savedLicense.id}:`, error);
      // Continue without Stripe - can be synced later
    }

    savedLicense.projects = projects;
    savedLicense.owner_id = user.id;
    savedLicense.owner = user;
    await this.licenseRepository.save(savedLicense);

    return savedLicense;
  }

  /**
   * Find a license option by ID
   */
  async findOne(id: string): Promise<License> {
    const license = await this.licenseRepository.findOne({
      where: { id },
      relations: ['projects'],
    });

    if (!license) {
      throw new NotFoundException(`License option with ID ${id} not found`);
    }

    return license;
  }

  /**
   * Find all license options with filtering, sorting and pagination
   */
  findAll(
    filter: FilterLicenseDto,
    paginationOptions: IPaginationOptions,
  ): Promise<Pagination<License>> {
    const {
      search,
      currency,
      sort_by: sortBy,
      sort_direction: sortDirection,
      owner_id: ownerId,
      status,
      project_id: projectId,
    } = filter;

    // Build the where conditions
    const whereConditions: Record<string, unknown> = {};

    // Add search condition if provided
    if (search) {
      whereConditions.name = ILike(`%${search}%`);
      // If you want to search in description as well, you'd need a more complex query
      // This will be implemented below using queryBuilder
    }

    // Add currency filter if provided
    if (currency) {
      whereConditions.currency = currency;
    }

    // Add owner filter if provided
    if (ownerId) {
      whereConditions.owner_id = ownerId;
    }

    // Add status filter if provided
    if (status) {
      whereConditions.status = status;
    }

    // Build the order condition
    let orderCondition: FindOptionsOrder<License> = {};
    if (sortBy) {
      orderCondition[sortBy] = sortDirection || 'ASC';
    } else {
      // Default sort by createdAt desc
      orderCondition = { created_at: 'DESC' };
    }

    // If we need to search in multiple columns or filter by projectId, we need to use queryBuilder
    if (search || projectId) {
      const queryBuilder = this.licenseRepository
        .createQueryBuilder('license')
        .leftJoinAndSelect('license.projects', 'projects');

      // Add search condition if provided
      if (search) {
        queryBuilder.where('license.name ILIKE :search OR license.description ILIKE :search', {
          search: `%${search}%`,
        });
      }

      // Add projectId filter if provided
      if (projectId) {
        if (search) {
          queryBuilder.andWhere('projects.id = :projectId', { projectId });
        } else {
          queryBuilder.where('projects.id = :projectId', { projectId });
        }
      }

      // Add currency filter if provided
      if (currency) {
        queryBuilder.andWhere('license.currency = :currency', { currency });
      }

      // Add owner filter if provided
      if (ownerId) {
        queryBuilder.andWhere('license.owner_id = :ownerId', { ownerId });
      }

      // Add status filter if provided
      if (status) {
        queryBuilder.andWhere('license.status = :status', { status });
      }

      // Add sorting
      if (sortBy) {
        queryBuilder.orderBy(`license.${sortBy}`, sortDirection || 'ASC');
      } else {
        queryBuilder.orderBy('license.created_at', 'DESC');
      }

      return paginate<License>(queryBuilder, paginationOptions);
    }

    // If no search is needed, use the simpler approach
    return paginate<License>(this.licenseRepository, paginationOptions, {
      where: whereConditions,
      order: orderCondition,
      relations: ['projects'],
    });
  }

  /**
   * Delete a license option
   */
  async remove(id: string, ownerId: string): Promise<void> {
    // Get license with its associated projects
    const license = await this.licenseRepository.findOne({
      where: { id },
      relations: ['projects'],
    });

    if (!license) {
      throw new NotFoundException(`License option with ID ${id} not found`);
    }

    // Check if user is the owner of all associated projects
    for (const project of license.projects) {
      if (project.owner_id !== ownerId) {
        throw new BadRequestException('You do not have permission to delete this license option');
      }
    }

    // Check if there are any active purchases for this license
    // This should be implemented if you have a purchases repository
    // to prevent deleting licenses that are in use

    // Archive Stripe product if exists
    if (license.stripe_product_id) {
      try {
        await this.stripeService.archiveLicenseProduct(license.stripe_product_id);
        this.logger.log(`Archived Stripe product ${license.stripe_product_id} for license ${id}`);
      } catch (error) {
        this.logger.error(`Failed to archive Stripe product for license ${id}:`, error);
        // Continue with deletion even if Stripe fails
      }
    }

    await this.licenseRepository.remove(license);
  }

  /**
   * Update an existing license option
   */
  async update(id: string, owner_id: string, updateLicenseDto: UpdateLicenseDto): Promise<License> {
    // Get license with its associated projects
    const license = await this.licenseRepository.findOne({
      where: { id },
      relations: ['projects'],
    });

    if (!license) {
      throw new NotFoundException(`License option with ID ${id} not found`);
    }

    // Check if user is the owner of all associated projects
    for (const project of license.projects) {
      if (project.owner_id !== owner_id) {
        throw new BadRequestException('You do not have permission to update this license option');
      }
    }

    // Validate pricing updates if provided
    if (updateLicenseDto.price !== undefined && updateLicenseDto.price < 0) {
      throw new BadRequestException('Price cannot be negative');
    }

    // Validate deployment limit against pool if being updated
    if (updateLicenseDto.deployment_limit !== undefined) {
      await this.validateDeploymentLimit(owner_id, updateLicenseDto.deployment_limit, id);
    }

    // Handle project updates if provided
    if (updateLicenseDto.project_ids) {
      // Fetch all projects to be associated with this license
      const projects = await Promise.all(
        updateLicenseDto.project_ids.map(async projectId => {
          const project = await this.projectRepository.findOne(projectId);

          if (!project) {
            throw new NotFoundException(`Project with ID ${projectId} not found`);
          }

          if (project.owner_id !== owner_id) {
            throw new BadRequestException(
              `You do not have permission to add project "${project.name}" to this license`,
            );
          }

          return project;
        }),
      );

      license.projects = projects;
    }

    // Update license option fields by applying all defined properties from DTO
    const { project_ids: _projectIds, ...licenseUpdates } = updateLicenseDto;

    // Store original price and period before update for Stripe sync
    const originalPrice = license.price;
    const originalPeriod = license.period;

    // Directly apply all updates from the DTO to the license object
    Object.assign(license, licenseUpdates);

    // Update Stripe product/price if needed
    if (license.stripe_product_id) {
      try {
        // Update product metadata if name or description changed
        if (updateLicenseDto.name || updateLicenseDto.description) {
          await this.stripeService.updateLicenseProduct(license.stripe_product_id, {
            description: license.description,
            metadata: {
              license_name: license.name,
              deployment_limit: String(license.deployment_limit),
              period: license.period,
            },
          });
        }

        // Create new price if price or period changed (Stripe prices are immutable)
        const priceChanged =
          updateLicenseDto.price !== undefined && updateLicenseDto.price !== originalPrice;
        const periodChanged =
          updateLicenseDto.period !== undefined && updateLicenseDto.period !== originalPeriod;

        if (priceChanged || periodChanged) {
          const newPrice = await this.stripeService.updateLicensePrice(
            license.stripe_product_id,
            license.price,
            license.currency,
            license.id,
            license.stripe_price_id,
            license.period,
          );
          license.stripe_price_id = newPrice.id;
          this.logger.log(`Updated Stripe price to ${newPrice.id} for license ${id}`);
        }
      } catch (error) {
        this.logger.error(`Failed to update Stripe for license ${id}:`, error);
        // Continue with update even if Stripe fails
      }
    }

    // Save the changes
    return this.licenseRepository.save(license);
  }

  /**
   * Get all licenses for projects owned by a specific user
   * Used for statistics calculations
   */
  getLicensesByOwnerProjects(ownerId: string): Promise<License[]> {
    return this.licenseRepository
      .createQueryBuilder('license')
      .leftJoin('license.projects', 'project')
      .where('project.owner_id = :ownerId', { ownerId })
      .getMany();
  }

  /**
   * Admin - Update a license without ownership check
   */
  async adminUpdate(id: string, updateLicenseDto: UpdateLicenseDto): Promise<License> {
    const license = await this.licenseRepository.findOne({
      where: { id },
      relations: ['projects'],
    });

    if (!license) {
      throw new NotFoundException(`License option with ID ${id} not found`);
    }

    // Validate pricing updates if provided
    if (updateLicenseDto.price !== undefined && updateLicenseDto.price < 0) {
      throw new BadRequestException('Price cannot be negative');
    }

    // Handle project updates if provided
    if (updateLicenseDto.project_ids) {
      const projects = await Promise.all(
        updateLicenseDto.project_ids.map(async projectId => {
          const project = await this.projectRepository.findOne(projectId);
          if (!project) {
            throw new NotFoundException(`Project with ID ${projectId} not found`);
          }
          return project;
        }),
      );
      license.projects = projects;
    }

    // Update license option fields
    const { project_ids: _projectIds, ...licenseUpdates } = updateLicenseDto;
    Object.assign(license, licenseUpdates);

    return this.licenseRepository.save(license);
  }

  /**
   * Admin - Delete a license without ownership check
   */
  async adminRemove(id: string): Promise<void> {
    const license = await this.licenseRepository.findOne({
      where: { id },
      relations: ['projects'],
    });

    if (!license) {
      throw new NotFoundException(`License option with ID ${id} not found`);
    }

    // Archive Stripe product if exists
    if (license.stripe_product_id) {
      try {
        await this.stripeService.archiveLicenseProduct(license.stripe_product_id);
        this.logger.log(`Archived Stripe product ${license.stripe_product_id} for license ${id}`);
      } catch (error) {
        this.logger.error(`Failed to archive Stripe product for license ${id}:`, error);
      }
    }

    await this.licenseRepository.remove(license);
  }
}
