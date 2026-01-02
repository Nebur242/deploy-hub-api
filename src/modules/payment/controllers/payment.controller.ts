import { CurrentUser } from '@app/core/decorators/current-user.decorator';
import { Admin, Authenticated } from '@app/core/guards/roles-auth.guard';
import { User } from '@app/modules/users/entities/user.entity';
import { PaymentStatus } from '@app/shared/enums';
import { Body, Controller, Get, Param, Patch, Post, UnauthorizedException } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';

import {
  CreatePaymentDto,
  CreatePaymentIntentDto,
  ConfirmPaymentDto,
  CreatePaymentIntentResponseDto,
  ConfirmPaymentResponseDto,
  StripePublishableKeyDto,
} from '../dto';
import { PaymentService } from '../services/payment.service';
import { StripeService } from '../services/stripe.service';

@ApiTags('payments')
@ApiBearerAuth()
@Controller('payments')
export class PaymentController {
  constructor(
    private readonly paymentService: PaymentService,
    private readonly stripeService: StripeService,
  ) {}

  @Post()
  @ApiOperation({ summary: 'Process a payment for an order' })
  @ApiResponse({ status: 201, description: 'Payment processed successfully' })
  @ApiResponse({ status: 400, description: 'Invalid input data or payment amount mismatch' })
  @ApiResponse({ status: 404, description: 'Order not found' })
  @Authenticated()
  create(@CurrentUser() user: User, @Body() createPaymentDto: CreatePaymentDto) {
    if (!user || !user.id) {
      throw new UnauthorizedException('User not authenticated or missing ID');
    }
    return this.paymentService.processPayment(user.id, createPaymentDto);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get payment by ID' })
  @ApiResponse({ status: 200, description: 'Returns the payment details' })
  @ApiResponse({ status: 404, description: 'Payment not found' })
  @ApiParam({ name: 'id', description: 'Payment ID' })
  findOne(@Param('id') id: string) {
    return this.paymentService.findOne(id);
  }

  @Get('order/:order_id')
  @ApiOperation({ summary: 'Get payments by order ID' })
  @ApiResponse({ status: 200, description: 'Returns the list of payments for the order' })
  @ApiParam({ name: 'order_id', description: 'Order ID' })
  @Authenticated()
  findByOrderId(@CurrentUser() user: User, @Param('order_id') orderId: string) {
    if (!user || !user.id) {
      throw new UnauthorizedException('User not authenticated or missing ID');
    }
    return this.paymentService.findByOrderId(orderId, user.id);
  }

  @Get('admin/order/:order_id')
  @Admin()
  @ApiOperation({ summary: 'Admin - Get payments by order ID' })
  @ApiResponse({ status: 200, description: 'Returns the list of payments for the order' })
  @ApiParam({ name: 'order_id', description: 'Order ID' })
  findByOrderIdAdmin(@Param('order_id') orderId: string) {
    return this.paymentService.findByOrderId(orderId);
  }

  @Patch(':id/status')
  @Admin()
  @ApiOperation({ summary: 'Admin - Update payment status' })
  @ApiResponse({ status: 200, description: 'Payment status updated' })
  @ApiResponse({ status: 404, description: 'Payment not found' })
  @ApiParam({ name: 'id', description: 'Payment ID' })
  updateStatus(@Param('id') id: string, @Body('status') status: PaymentStatus) {
    return this.paymentService.updatePaymentStatus(id, status);
  }

  // ==================== Stripe Payment Intent Endpoints ====================

  /**
   * Create a Stripe payment intent
   * Frontend calls this first to initialize a payment
   *
   * @see https://stripe.com/docs/payments/payment-intents
   */
  @Post('stripe/create-intent')
  @Authenticated()
  @ApiOperation({
    summary: 'Create a Stripe payment intent',
    description:
      'Initialize a payment intent for Stripe card payments. ' +
      'Frontend will use the returned client secret to confirm the payment.',
  })
  @ApiResponse({
    status: 201,
    description: 'Payment intent created successfully',
    type: CreatePaymentIntentResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Invalid amount or missing required fields' })
  @ApiResponse({ status: 401, description: 'Unauthorized - user not authenticated' })
  createStripePaymentIntent(@CurrentUser() user: User, @Body() dto: CreatePaymentIntentDto) {
    if (!user || !user.id) {
      throw new UnauthorizedException('User not authenticated');
    }

    // Add user ID to DTO if not already present
    const enrichedDto = {
      ...dto,
      userId: user.id,
      customerEmail: dto.customerEmail || user.email,
    };

    return this.stripeService.createPaymentIntent(enrichedDto);
  }

  /**
   * Confirm a Stripe payment intent
   * Frontend calls this after CardElement has confirmed the payment
   *
   * @see https://stripe.com/docs/payments/accept-a-payment?platform=web&ui=elements
   */
  @Post('stripe/confirm')
  @Authenticated()
  @ApiOperation({
    summary: 'Confirm a Stripe payment intent',
    description:
      'Verify payment confirmation. ' +
      'Frontend has already confirmed the payment using Stripe Elements, ' +
      'this endpoint confirms the status on the backend.',
  })
  @ApiResponse({
    status: 201,
    description: 'Payment confirmed successfully',
    type: ConfirmPaymentResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Invalid payment intent ID' })
  @ApiResponse({ status: 401, description: 'Unauthorized - user not authenticated' })
  confirmStripePayment(@Body() dto: ConfirmPaymentDto) {
    return this.stripeService.confirmPayment(dto);
  }

  /**
   * Get Stripe payment intent status
   * Check payment status at any time
   */
  @Get('stripe/:paymentIntentId')
  @Authenticated()
  @ApiOperation({
    summary: 'Get Stripe payment intent status',
    description: 'Retrieve the current status of a payment intent',
  })
  @ApiResponse({
    status: 200,
    description: 'Payment intent status retrieved',
  })
  @ApiResponse({ status: 400, description: 'Invalid payment intent ID' })
  @ApiResponse({ status: 401, description: 'Unauthorized - user not authenticated' })
  @ApiParam({ name: 'paymentIntentId', description: 'Stripe payment intent ID' })
  getStripePaymentStatus(@Param('paymentIntentId') paymentIntentId: string) {
    return this.stripeService.getPaymentIntent(paymentIntentId);
  }

  /**
   * Get Stripe publishable key
   * Public endpoint - needed by frontend to initialize Stripe
   */
  @Get('stripe/config/publishable-key')
  @ApiOperation({
    summary: 'Get Stripe publishable key',
    description:
      'Returns the Stripe publishable key needed for frontend Stripe Elements initialization. ' +
      'This endpoint does not require authentication.',
  })
  @ApiResponse({
    status: 200,
    description: 'Publishable key returned',
    type: StripePublishableKeyDto,
  })
  @ApiResponse({ status: 500, description: 'Stripe not configured' })
  getStripePublishableKey() {
    return {
      publishableKey: this.stripeService.getPublishableKey(),
    };
  }
}
