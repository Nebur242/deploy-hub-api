import { BillingInterval, SubscriptionPlan } from '@app/shared/enums';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsEnum, IsOptional } from 'class-validator';

export class UpdateSubscriptionDto {
  @ApiPropertyOptional({
    description: 'The new subscription plan',
    enum: SubscriptionPlan,
    example: SubscriptionPlan.PRO,
  })
  @IsOptional()
  @IsEnum(SubscriptionPlan)
  plan?: SubscriptionPlan;

  @ApiPropertyOptional({
    description: 'The new billing interval',
    enum: BillingInterval,
    example: BillingInterval.YEARLY,
  })
  @IsOptional()
  @IsEnum(BillingInterval)
  billing_interval?: BillingInterval;

  @ApiPropertyOptional({
    description: 'Whether to cancel at the end of the billing period',
    example: true,
  })
  @IsOptional()
  @IsBoolean()
  cancel_at_period_end?: boolean;
}
