import { Currency } from '@app/shared/enums';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsString,
  IsNumber,
  IsEnum,
  IsOptional,
  IsArray,
  IsBoolean,
  Min,
  MaxLength,
} from 'class-validator';

import { SubscriptionPlanType, SubscriptionFeature } from '../entities/subscription-plan.entity';

export class CreateSubscriptionPlanDto {
  @ApiProperty({
    description: 'Name of the subscription plan',
    example: 'Pro Monthly',
  })
  @IsString()
  @MaxLength(100)
  name: string;

  @ApiPropertyOptional({
    description: 'Description of the subscription plan',
    example: 'Professional plan with unlimited projects and deployments',
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @ApiProperty({
    description: 'Price of the subscription',
    example: 20,
    minimum: 0,
  })
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Type(() => Number)
  price: number;

  @ApiProperty({
    description: 'Currency of the subscription',
    enum: Currency,
    example: Currency.USD,
  })
  @IsEnum(Currency)
  currency: Currency;

  @ApiProperty({
    description: 'Type of the subscription plan',
    enum: SubscriptionPlanType,
    example: SubscriptionPlanType.MONTHLY,
  })
  @IsEnum(SubscriptionPlanType)
  type: SubscriptionPlanType;

  @ApiPropertyOptional({
    description: 'Maximum number of projects (0 = unlimited)',
    example: 10,
    minimum: 0,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  maxProjects?: number = 0;

  @ApiPropertyOptional({
    description: 'Maximum number of deployments (0 = unlimited)',
    example: 100,
    minimum: 0,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  maxDeployments?: number = 0;

  @ApiPropertyOptional({
    description: 'Maximum number of team members (0 = unlimited)',
    example: 5,
    minimum: 0,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  maxTeamMembers?: number = 0;

  @ApiPropertyOptional({
    description: 'Features included in this plan',
    enum: SubscriptionFeature,
    isArray: true,
    example: [SubscriptionFeature.UNLIMITED_PROJECTS, SubscriptionFeature.API_ACCESS],
  })
  @IsOptional()
  @IsArray()
  @IsEnum(SubscriptionFeature, { each: true })
  features?: SubscriptionFeature[] = [];

  @ApiPropertyOptional({
    description: 'Whether this plan is marked as popular',
    example: false,
  })
  @IsOptional()
  @IsBoolean()
  popular?: boolean = false;

  @ApiPropertyOptional({
    description: 'Stripe product ID for payment integration',
    example: 'prod_stripe_product_id',
  })
  @IsOptional()
  @IsString()
  stripeProductId?: string;

  @ApiPropertyOptional({
    description: 'Stripe price ID for payment integration',
    example: 'price_stripe_price_id',
  })
  @IsOptional()
  @IsString()
  stripePriceId?: string;

  @ApiPropertyOptional({
    description: 'Sort order for displaying plans',
    example: 1,
    minimum: 0,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  sortOrder?: number = 0;
}
