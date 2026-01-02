import { Currency } from '@app/shared/enums';
import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty, IsNumber, IsOptional, IsString, IsUUID, Min } from 'class-validator';

/**
 * DTO for creating a Stripe payment intent
 * This is sent from the frontend to create a payment intent before payment confirmation
 */
export class CreatePaymentIntentDto {
  @ApiProperty({
    description: 'Order ID to associate with this payment intent',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @IsUUID()
  @IsNotEmpty()
  orderId: string;

  @ApiProperty({
    description: 'Amount to charge (in dollars, not cents)',
    example: 99.99,
  })
  @IsNumber()
  @Min(0.01)
  amount: number;

  @ApiProperty({
    description: 'Currency code (ISO 4217)',
    enum: Currency,
    default: Currency.USD,
  })
  @IsEnum(Currency)
  currency: Currency;

  @ApiProperty({
    description: 'User ID making the purchase',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @IsUUID()
  @IsNotEmpty()
  userId: string;

  @ApiProperty({
    description: 'Customer email for receipt and communication',
    example: 'customer@example.com',
    required: false,
  })
  @IsString()
  @IsOptional()
  customerEmail?: string;

  @ApiProperty({
    description: 'License ID being purchased (optional)',
    example: '550e8400-e29b-41d4-a716-446655440000',
    required: false,
  })
  @IsUUID()
  @IsOptional()
  licenseId?: string;
}

/**
 * DTO for confirming a Stripe payment
 * Sent after frontend has confirmed the payment with the card element
 */
export class ConfirmPaymentDto {
  @ApiProperty({
    description: 'Stripe payment intent ID returned from create-intent endpoint',
    example: 'pi_1234567890_secret_987654321',
  })
  @IsString()
  @IsNotEmpty()
  paymentIntentId: string;
}

/**
 * DTO for getting payment status
 * Response object from payment endpoints
 */
export class PaymentStatusDto {
  @ApiProperty({ description: 'Stripe payment intent ID' })
  paymentIntentId: string;

  @ApiProperty({
    description: 'Payment status (requires_payment_method, processing, succeeded, etc)',
  })
  status: string;

  @ApiProperty({ description: 'Amount charged' })
  amount: string;

  @ApiProperty({ description: 'Currency code' })
  currency: string;

  @ApiProperty({ description: 'Associated charge ID if succeeded', required: false })
  chargeId?: string | null;

  @ApiProperty({ description: 'When payment was created (Unix timestamp)' })
  created: number;

  @ApiProperty({
    description: 'Metadata associated with the payment intent',
  })
  metadata: Record<string, string>;
}

/**
 * DTO for creating a payment intent response
 * Sent to frontend with client secret for card confirmation
 */
export class CreatePaymentIntentResponseDto {
  @ApiProperty({
    description: 'Client secret used to confirm payment on frontend',
    example: 'pi_1234567890_secret_987654321',
  })
  clientSecret: string;

  @ApiProperty({
    description: 'Stripe payment intent ID',
    example: 'pi_1234567890',
  })
  paymentIntentId: string;

  @ApiProperty({
    description: 'Current payment status',
    example: 'requires_payment_method',
  })
  status: string;

  @ApiProperty({
    description: 'Amount to be charged',
    example: 99.99,
  })
  amount: number;

  @ApiProperty({
    description: 'Currency code',
    example: 'usd',
  })
  currency: string;
}

/**
 * DTO for confirming payment response
 * Sent after confirmation, indicating payment success/failure
 */
export class ConfirmPaymentResponseDto {
  @ApiProperty({
    description: 'Stripe payment intent ID',
  })
  paymentIntentId: string;

  @ApiProperty({
    description: 'Final payment status (succeeded, failed, etc)',
  })
  status: string;

  @ApiProperty({
    description: 'Amount that was charged',
  })
  amount: string;

  @ApiProperty({
    description: 'Currency code',
  })
  currency: string;

  @ApiProperty({
    description: 'Charge ID if payment succeeded',
    required: false,
  })
  chargeId?: string | null;

  @ApiProperty({
    description: 'When payment was created',
  })
  created: number;

  @ApiProperty({
    description: 'Metadata from the payment intent',
  })
  metadata: Record<string, string>;
}

/**
 * DTO for stripe publishable key response
 */
export class StripePublishableKeyDto {
  @ApiProperty({
    description: 'Stripe publishable key for frontend initialization',
    example: 'pk_test_xxxxxxxxxxxx',
  })
  publishableKey: string;
}
