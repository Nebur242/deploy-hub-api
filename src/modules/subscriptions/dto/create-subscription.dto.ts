import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, IsBoolean } from 'class-validator';

export class CreateSubscriptionDto {
  @ApiProperty({
    description: 'ID of the subscription plan to subscribe to',
    example: 'plan-uuid-here',
  })
  @IsString()
  planId: string;

  @ApiPropertyOptional({
    description: 'Stripe payment method ID',
    example: 'pm_stripe_payment_method_id',
  })
  @IsOptional()
  @IsString()
  paymentMethodId?: string;

  @ApiPropertyOptional({
    description: 'Whether to enable auto-renewal',
    example: true,
  })
  @IsOptional()
  @IsBoolean()
  autoRenew?: boolean = true;

  @ApiPropertyOptional({
    description: 'Custom metadata for the subscription',
    example: { source: 'web', campaign: 'spring2024' },
  })
  @IsOptional()
  metadata?: Record<string, unknown>;
}
