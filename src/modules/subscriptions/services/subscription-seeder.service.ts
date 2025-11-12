import { Currency } from '@app/shared/enums';
import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import {
  SubscriptionPlan,
  SubscriptionPlanType,
  SubscriptionPlanStatus,
  SubscriptionFeature,
} from '../entities/subscription-plan.entity';

@Injectable()
export class SubscriptionSeederService {
  private readonly logger = new Logger(SubscriptionSeederService.name);

  constructor(
    @InjectRepository(SubscriptionPlan)
    private subscriptionPlanRepository: Repository<SubscriptionPlan>,
  ) {}

  async seedInitialPlans(): Promise<void> {
    // Check if plans already exist
    const existingPlans = await this.subscriptionPlanRepository.count();
    if (existingPlans > 0) {
      this.logger.log('Subscription plans already exist, skipping seed');
      return;
    }

    const plans = [
      {
        name: 'Free Tier',
        description: 'Perfect for getting started with basic project deployment',
        price: 0,
        currency: Currency.USD,
        type: SubscriptionPlanType.MONTHLY,
        status: SubscriptionPlanStatus.ACTIVE,
        maxProjects: 1,
        maxDeployments: 3,
        maxTeamMembers: 1,
        features: [
          SubscriptionFeature.PRIORITY_SUPPORT, // Basic support
        ],
        popular: false,
        sortOrder: 0,
      },
      {
        name: 'Pro Monthly',
        description: 'Professional plan with unlimited projects and deployments',
        price: 20,
        currency: Currency.USD,
        type: SubscriptionPlanType.MONTHLY,
        status: SubscriptionPlanStatus.ACTIVE,
        maxProjects: 0, // unlimited
        maxDeployments: 0, // unlimited
        maxTeamMembers: 5,
        features: [
          SubscriptionFeature.UNLIMITED_PROJECTS,
          SubscriptionFeature.UNLIMITED_DEPLOYMENTS,
          SubscriptionFeature.CUSTOM_DOMAINS,
          SubscriptionFeature.PRIORITY_SUPPORT,
        ],
        popular: true,
        sortOrder: 1,
      },
      {
        name: 'Pro Annual',
        description: 'Professional plan with annual discount - 17% savings!',
        price: 199,
        currency: Currency.USD,
        type: SubscriptionPlanType.ANNUAL,
        status: SubscriptionPlanStatus.ACTIVE,
        maxProjects: 0, // unlimited
        maxDeployments: 0, // unlimited
        maxTeamMembers: 5,
        features: [
          SubscriptionFeature.UNLIMITED_PROJECTS,
          SubscriptionFeature.UNLIMITED_DEPLOYMENTS,
          SubscriptionFeature.CUSTOM_DOMAINS,
          SubscriptionFeature.PRIORITY_SUPPORT,
          SubscriptionFeature.ADVANCED_ANALYTICS,
        ],
        popular: false,
        sortOrder: 2,
      },
      {
        name: 'Enterprise Monthly',
        description: 'Enterprise plan with unlimited everything and premium support',
        price: 99,
        currency: Currency.USD,
        type: SubscriptionPlanType.MONTHLY,
        status: SubscriptionPlanStatus.ACTIVE,
        maxProjects: 0, // unlimited
        maxDeployments: 0, // unlimited
        maxTeamMembers: 0, // unlimited
        features: [
          SubscriptionFeature.UNLIMITED_PROJECTS,
          SubscriptionFeature.UNLIMITED_DEPLOYMENTS,
          SubscriptionFeature.CUSTOM_DOMAINS,
          SubscriptionFeature.PRIORITY_SUPPORT,
          SubscriptionFeature.ADVANCED_ANALYTICS,
          SubscriptionFeature.API_ACCESS,
          SubscriptionFeature.TEAM_COLLABORATION,
          SubscriptionFeature.WHITE_LABEL,
        ],
        popular: false,
        sortOrder: 3,
      },
      {
        name: 'Enterprise Annual',
        description: 'Enterprise plan with annual discount',
        price: 999,
        currency: Currency.USD,
        type: SubscriptionPlanType.ANNUAL,
        status: SubscriptionPlanStatus.ACTIVE,
        maxProjects: 0, // unlimited
        maxDeployments: 0, // unlimited
        maxTeamMembers: 0, // unlimited
        features: [
          SubscriptionFeature.UNLIMITED_PROJECTS,
          SubscriptionFeature.UNLIMITED_DEPLOYMENTS,
          SubscriptionFeature.CUSTOM_DOMAINS,
          SubscriptionFeature.PRIORITY_SUPPORT,
          SubscriptionFeature.ADVANCED_ANALYTICS,
          SubscriptionFeature.API_ACCESS,
          SubscriptionFeature.TEAM_COLLABORATION,
          SubscriptionFeature.WHITE_LABEL,
        ],
        popular: false,
        sortOrder: 4,
      },
    ];

    for (const planData of plans) {
      const plan = this.subscriptionPlanRepository.create(planData);
      await this.subscriptionPlanRepository.save(plan);
      this.logger.log(`Created subscription plan: ${plan.name}`);
    }

    this.logger.log('Successfully seeded subscription plans');
  }

  /**
   * Get the free tier plan for automatic assignment to new users
   */
  getFreeTierPlan(): Promise<SubscriptionPlan | null> {
    return this.subscriptionPlanRepository.findOne({
      where: {
        name: 'Free Tier',
        status: SubscriptionPlanStatus.ACTIVE,
      },
    });
  }
}
