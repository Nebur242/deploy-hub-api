import { BillingInterval, SubscriptionPlan } from '@app/shared/enums';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString } from 'class-validator';

export class CreateCheckoutSessionDto {
  @ApiProperty({
    description: 'The subscription plan to subscribe to',
    enum: SubscriptionPlan,
    example: SubscriptionPlan.PRO,
  })
  @IsEnum(SubscriptionPlan)
  plan: SubscriptionPlan;

  @ApiProperty({
    description: 'The billing interval',
    enum: BillingInterval,
    example: BillingInterval.MONTHLY,
  })
  @IsEnum(BillingInterval)
  billing_interval: BillingInterval;

  @ApiPropertyOptional({
    description: 'URL to redirect to on success',
    example: 'https://app.example.com/dashboard/billing?success=true',
  })
  @IsOptional()
  @IsString()
  success_url?: string;

  @ApiPropertyOptional({
    description: 'URL to redirect to on cancel',
    example: 'https://app.example.com/dashboard/billing?canceled=true',
  })
  @IsOptional()
  @IsString()
  cancel_url?: string;
}
