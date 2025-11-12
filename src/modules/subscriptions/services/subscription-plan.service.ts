import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IPaginationOptions, paginate, Pagination } from 'nestjs-typeorm-paginate';
import { Repository, FindOptionsOrder } from 'typeorm';

import { CreateSubscriptionPlanDto } from '../dto/create-subscription-plan.dto';
import { FilterSubscriptionPlanDto } from '../dto/filter-subscription-plan.dto';
import { UpdateSubscriptionPlanDto } from '../dto/update-subscription-plan.dto';
import {
  SubscriptionPlan,
  SubscriptionPlanStatus,
  SubscriptionPlanType,
} from '../entities/subscription-plan.entity';

@Injectable()
export class SubscriptionPlanService {
  constructor(
    @InjectRepository(SubscriptionPlan)
    private subscriptionPlanRepository: Repository<SubscriptionPlan>,
  ) {}

  /**
   * Create a new subscription plan
   */
  async create(createDto: CreateSubscriptionPlanDto): Promise<SubscriptionPlan> {
    // Check if plan with same name already exists
    const existingPlan = await this.subscriptionPlanRepository.findOne({
      where: { name: createDto.name },
    });

    if (existingPlan) {
      throw new BadRequestException(
        `Subscription plan with name "${createDto.name}" already exists`,
      );
    }

    const plan = this.subscriptionPlanRepository.create(createDto);
    return this.subscriptionPlanRepository.save(plan);
  }

  /**
   * Find all subscription plans with filtering, sorting and pagination
   */
  findAll(
    filter: FilterSubscriptionPlanDto,
    paginationOptions: IPaginationOptions,
  ): Promise<Pagination<SubscriptionPlan>> {
    const { search, type, status, popular, isActive, interval, feature, sortBy, sortDirection } =
      filter;

    // If we need complex filtering, use query builder
    if (search || feature) {
      const queryBuilder = this.subscriptionPlanRepository.createQueryBuilder('plan');

      // Add search condition
      if (search) {
        queryBuilder.where('plan.name ILIKE :search OR plan.description ILIKE :search', {
          search: `%${search}%`,
        });
      }

      // Add feature filter
      if (feature) {
        const whereClause = search ? 'andWhere' : 'where';
        queryBuilder[whereClause]('plan.features @> :features', {
          features: JSON.stringify([feature]),
        });
      }

      // Add other filters
      if (type) {
        queryBuilder.andWhere('plan.type = :type', { type });
      }

      if (status) {
        queryBuilder.andWhere('plan.status = :status', { status });
      }

      if (popular !== undefined) {
        queryBuilder.andWhere('plan.popular = :popular', { popular });
      }

      if (isActive !== undefined) {
        const statusValue = isActive
          ? SubscriptionPlanStatus.ACTIVE
          : SubscriptionPlanStatus.INACTIVE;
        queryBuilder.andWhere('plan.status = :statusFromActive', { statusFromActive: statusValue });
      }

      if (interval) {
        const typeValue =
          interval === 'month' ? SubscriptionPlanType.MONTHLY : SubscriptionPlanType.ANNUAL;
        queryBuilder.andWhere('plan.type = :typeFromInterval', { typeFromInterval: typeValue });
      }

      // Add sorting
      if (sortBy) {
        queryBuilder.orderBy(`plan.${sortBy}`, sortDirection || 'ASC');
      } else {
        queryBuilder.orderBy('plan.sortOrder', 'ASC').addOrderBy('plan.name', 'ASC');
      }

      return paginate<SubscriptionPlan>(queryBuilder, paginationOptions);
    }

    // Simple filtering without query builder
    const whereConditions: Record<string, unknown> = {};

    if (type) {
      whereConditions.type = type;
    }

    if (status) {
      whereConditions.status = status;
    }

    if (popular !== undefined) {
      whereConditions.popular = popular;
    }

    if (isActive !== undefined) {
      const statusValue = isActive
        ? SubscriptionPlanStatus.ACTIVE
        : SubscriptionPlanStatus.INACTIVE;
      whereConditions.status = statusValue;
    }

    if (interval) {
      const typeValue =
        interval === 'month' ? SubscriptionPlanType.MONTHLY : SubscriptionPlanType.ANNUAL;
      whereConditions.type = typeValue;
    }

    // Build order condition
    let orderCondition: FindOptionsOrder<SubscriptionPlan> = {};
    if (sortBy) {
      orderCondition[sortBy] = sortDirection || 'ASC';
    } else {
      orderCondition = { sortOrder: 'ASC', name: 'ASC' };
    }

    return paginate<SubscriptionPlan>(this.subscriptionPlanRepository, paginationOptions, {
      where: whereConditions,
      order: orderCondition,
    });
  }

  /**
   * Find active subscription plans (public endpoint)
   */
  findActivePublic(): Promise<SubscriptionPlan[]> {
    return this.subscriptionPlanRepository.find({
      where: { status: SubscriptionPlanStatus.ACTIVE },
      order: { sortOrder: 'ASC', name: 'ASC' },
    });
  }

  /**
   * Find a subscription plan by ID
   */
  async findOne(id: string): Promise<SubscriptionPlan> {
    const plan = await this.subscriptionPlanRepository.findOne({
      where: { id },
    });

    if (!plan) {
      throw new NotFoundException(`Subscription plan with ID ${id} not found`);
    }

    return plan;
  }

  /**
   * Update a subscription plan
   */
  async update(id: string, updateDto: UpdateSubscriptionPlanDto): Promise<SubscriptionPlan> {
    const plan = await this.findOne(id);

    // Check if name is being updated and already exists
    if (updateDto.name && updateDto.name !== plan.name) {
      const existingPlan = await this.subscriptionPlanRepository.findOne({
        where: { name: updateDto.name },
      });

      if (existingPlan) {
        throw new BadRequestException(
          `Subscription plan with name "${updateDto.name}" already exists`,
        );
      }
    }

    // Apply updates
    Object.assign(plan, updateDto);

    return this.subscriptionPlanRepository.save(plan);
  }

  /**
   * Delete a subscription plan
   */
  async remove(id: string): Promise<void> {
    const plan = await this.findOne(id);

    // Check if there are active subscriptions for this plan
    // This would require checking UserSubscription entity
    // For now, we'll just mark it as deprecated instead of deleting
    plan.status = SubscriptionPlanStatus.DEPRECATED;
    await this.subscriptionPlanRepository.save(plan);
  }

  /**
   * Get subscription plan statistics
   */
  async getStatistics() {
    const [total, active, monthly, annual] = await Promise.all([
      this.subscriptionPlanRepository.count(),
      this.subscriptionPlanRepository.count({ where: { status: SubscriptionPlanStatus.ACTIVE } }),
      this.subscriptionPlanRepository.count({ where: { type: SubscriptionPlanType.MONTHLY } }),
      this.subscriptionPlanRepository.count({ where: { type: SubscriptionPlanType.ANNUAL } }),
    ]);

    return {
      total,
      active,
      monthly,
      annual,
      inactive: total - active,
    };
  }
}
