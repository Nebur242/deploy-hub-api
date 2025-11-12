import { Injectable, Logger, OnModuleInit } from '@nestjs/common';

import { SubscriptionSeederService } from '../subscriptions/services/subscription-seeder.service';

@Injectable()
export class DatabaseSeederService implements OnModuleInit {
  private readonly logger = new Logger(DatabaseSeederService.name);

  constructor(private readonly subscriptionSeederService: SubscriptionSeederService) {}

  async onModuleInit(): Promise<void> {
    try {
      this.logger.log('🌱 Starting database seeding...');

      // Seed subscription plans
      await this.subscriptionSeederService.seedInitialPlans();
      this.logger.log('✅ Subscription plans seeded successfully');

      this.logger.log('🎉 Database seeding completed successfully');
    } catch (error) {
      this.logger.error('❌ Database seeding failed:', error);
      // Don't throw the error to prevent app startup failure
      // In production, you might want to handle this differently
    }
  }

  /**
   * Manual method to trigger seeding (useful for CLI commands or admin endpoints)
   */
  async seedDatabase(): Promise<void> {
    this.logger.log('🌱 Manual database seeding triggered...');

    try {
      await this.subscriptionSeederService.seedInitialPlans();
      this.logger.log('✅ Manual seeding completed successfully');
    } catch (error) {
      this.logger.error('❌ Manual seeding failed:', error);
      throw error;
    }
  }
}
