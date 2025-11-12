import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';

import { AppModule } from '../app.module';
import { DatabaseSeederService } from '../modules/database/database-seeder.service';

async function runSeeder() {
  const logger = new Logger('DatabaseSeeder');
  const app = await NestFactory.createApplicationContext(AppModule);
  const seeder = app.get(DatabaseSeederService);

  try {
    logger.log('🌱 Running database seeder...');
    await seeder.seedDatabase();
    logger.log('✅ Database seeding completed successfully');
  } catch (error) {
    logger.error('❌ Database seeding failed:', error);
    process.exit(1);
  } finally {
    await app.close();
  }
}

void runSeeder();
