import { CurrentUser } from '@app/core/decorators/current-user.decorator';
import { Authenticated } from '@app/core/guards/roles-auth.guard';
import { User } from '@app/modules/users/entities/user.entity';
import { Body, Controller, Get, HttpCode, HttpStatus, Post, Put } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';

import { CreateCheckoutSessionDto, UpdateSubscriptionDto } from '../dto';
import { Subscription } from '../entities/subscription.entity';
import { SubscriptionService } from '../services/subscription.service';

@ApiTags('Subscription')
@Controller('subscriptions')
@Authenticated()
@ApiBearerAuth()
export class SubscriptionController {
  constructor(private readonly subscriptionService: SubscriptionService) {}

  @Get()
  @ApiOperation({ summary: 'Get current subscription' })
  @ApiResponse({
    status: 200,
    description: 'Returns the current subscription for the authenticated user',
  })
  getSubscription(@CurrentUser() user: User): Promise<Subscription> {
    return this.subscriptionService.getSubscription(user.id);
  }

  @Get('plans')
  @ApiOperation({ summary: 'Get available subscription plans' })
  @ApiResponse({
    status: 200,
    description: 'Returns all available subscription plans',
  })
  getAvailablePlans() {
    return this.subscriptionService.getAvailablePlans();
  }

  @Post('checkout')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Create a checkout session to upgrade subscription' })
  @ApiResponse({
    status: 200,
    description: 'Returns the Stripe checkout URL',
  })
  createCheckoutSession(
    @CurrentUser() user: User,
    @Body() dto: CreateCheckoutSessionDto,
  ): Promise<{ url: string }> {
    return this.subscriptionService.createCheckoutSession(user.id, dto);
  }

  @Post('portal')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Create a billing portal session' })
  @ApiResponse({
    status: 200,
    description: 'Returns the Stripe billing portal URL',
  })
  createPortalSession(@CurrentUser() user: User): Promise<{ url: string }> {
    return this.subscriptionService.createPortalSession(user.id);
  }

  @Put()
  @ApiOperation({ summary: 'Update subscription' })
  @ApiResponse({
    status: 200,
    description: 'Returns the updated subscription',
  })
  updateSubscription(
    @CurrentUser() user: User,
    @Body() dto: UpdateSubscriptionDto,
  ): Promise<Subscription> {
    return this.subscriptionService.updateSubscription(user.id, dto);
  }

  @Post('cancel')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Cancel subscription at period end' })
  @ApiResponse({
    status: 200,
    description: 'Subscription scheduled for cancellation',
  })
  cancelSubscription(@CurrentUser() user: User): Promise<Subscription> {
    return this.subscriptionService.cancelSubscription(user.id);
  }
}
