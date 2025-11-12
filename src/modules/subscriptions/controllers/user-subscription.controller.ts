import { CurrentUser } from '@app/core/decorators/current-user.decorator';
import { Admin, Authenticated } from '@app/core/guards/roles-auth.guard';
import { User } from '@app/modules/users/entities/user.entity';
import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Delete,
  Query,
  ParseUUIDPipe,
  Put,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import { IPaginationOptions } from 'nestjs-typeorm-paginate';

import { CreateSubscriptionDto } from '../dto/create-subscription.dto';
import { UpgradeSubscriptionDto } from '../dto/upgrade-subscription.dto';
import { SubscriptionStatus } from '../entities/user-subscription.entity';
import { UserSubscriptionService } from '../services/user-subscription.service';
import { UpgradePricingInfo, SubscriptionAnalytics } from '../types/subscription.types';

@ApiTags('user-subscriptions')
@ApiBearerAuth()
@Controller('user-subscriptions')
@Authenticated()
export class UserSubscriptionController {
  constructor(private readonly userSubscriptionService: UserSubscriptionService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new subscription for the current user' })
  @ApiResponse({ status: 201, description: 'Subscription successfully created' })
  @ApiResponse({
    status: 400,
    description: 'Invalid input data or user already has active subscription',
  })
  @ApiResponse({ status: 404, description: 'Subscription plan not found' })
  createSubscription(@CurrentUser() user: User, @Body() createDto: CreateSubscriptionDto) {
    return this.userSubscriptionService.createSubscription(user, createDto);
  }

  @Get('current')
  @ApiOperation({ summary: 'Get current active subscription for the user' })
  @ApiResponse({ status: 200, description: 'Returns the current subscription' })
  @ApiResponse({ status: 404, description: 'No active subscription found' })
  async getCurrentSubscription(@CurrentUser() user: User) {
    const subscription = await this.userSubscriptionService.getCurrentSubscription(user.id);
    if (user.roles.includes('admin') && !subscription) {
      await this.userSubscriptionService.assignFreeTierToUser(user);
      return this.userSubscriptionService.getCurrentSubscription(user.id);
    }
    return subscription;
  }

  @Get('limits')
  @ApiOperation({ summary: 'Get subscription limits and features for the user' })
  @ApiResponse({ status: 200, description: 'Returns subscription limits and features' })
  getSubscriptionLimits(@CurrentUser() user: User) {
    return this.userSubscriptionService.getSubscriptionLimits(user.id);
  }

  @Get('upgrade-options')
  @ApiOperation({ summary: 'Get available upgrade options for the current user' })
  @ApiResponse({ status: 200, description: 'Returns available upgrade plans' })
  getUpgradeOptions(@CurrentUser() user: User) {
    return this.userSubscriptionService.getUpgradeOptions(user.id);
  }

  @Put('upgrade/:planId')
  @ApiOperation({ summary: 'Upgrade current subscription to a new plan' })
  @ApiResponse({ status: 200, description: 'Subscription successfully upgraded' })
  @ApiResponse({ status: 400, description: 'Invalid upgrade or no active subscription' })
  @ApiResponse({ status: 404, description: 'Plan not found' })
  @ApiParam({ name: 'planId', description: 'ID of the plan to upgrade to' })
  upgradePlan(
    @CurrentUser() user: User,
    @Param('planId', new ParseUUIDPipe()) planId: string,
    @Body() upgradeDto: UpgradeSubscriptionDto,
  ) {
    return this.userSubscriptionService.upgradePlan(user.id, planId, upgradeDto);
  }

  @Get('history')
  @ApiOperation({ summary: 'Get subscription history for the current user' })
  @ApiResponse({ status: 200, description: 'Returns a paginated list of user subscriptions' })
  @ApiQuery({ name: 'page', required: false, description: 'Page number (1-based)' })
  @ApiQuery({ name: 'limit', required: false, description: 'Items per page' })
  getSubscriptionHistory(
    @CurrentUser() user: User,
    @Query('page') page = 1,
    @Query('limit') limit = 10,
  ) {
    const paginationOptions: IPaginationOptions = {
      page,
      limit,
      route: '/user-subscriptions/history',
    };

    return this.userSubscriptionService.getUserSubscriptions(user.id, paginationOptions);
  }

  @Delete(':subscriptionId/cancel')
  @ApiOperation({ summary: 'Cancel a subscription' })
  @ApiResponse({ status: 200, description: 'Subscription successfully cancelled' })
  @ApiResponse({ status: 404, description: 'Active subscription not found' })
  @ApiParam({ name: 'subscriptionId', description: 'Subscription ID to cancel' })
  cancelSubscription(
    @CurrentUser() user: User,
    @Param('subscriptionId', new ParseUUIDPipe()) subscriptionId: string,
  ) {
    return this.userSubscriptionService.cancelSubscription(user.id, subscriptionId);
  }

  @Get('upgrade-pricing/:planId')
  @ApiOperation({ summary: 'Calculate upgrade pricing for a specific plan' })
  @ApiResponse({ status: 200, description: 'Returns upgrade pricing information' })
  @ApiResponse({ status: 404, description: 'Plan not found or no active subscription' })
  @ApiParam({ name: 'planId', description: 'ID of the plan to calculate upgrade pricing for' })
  getUpgradePricing(
    @CurrentUser() user: User,
    @Param('planId', new ParseUUIDPipe()) planId: string,
  ): Promise<UpgradePricingInfo> {
    return this.userSubscriptionService.calculateUpgradePricing(user.id, planId);
  }

  @Post('schedule-upgrade/:planId')
  @ApiOperation({ summary: 'Schedule an upgrade for the next billing cycle' })
  @ApiResponse({ status: 200, description: 'Upgrade successfully scheduled' })
  @ApiResponse({ status: 404, description: 'Plan not found or no active subscription' })
  @ApiParam({ name: 'planId', description: 'ID of the plan to schedule upgrade to' })
  scheduleUpgrade(
    @CurrentUser() user: User,
    @Param('planId', new ParseUUIDPipe()) planId: string,
    @Body() upgradeDto: UpgradeSubscriptionDto,
  ) {
    return this.userSubscriptionService.scheduleUpgrade(user.id, planId, upgradeDto);
  }

  @Get('analytics')
  @ApiOperation({ summary: 'Get subscription analytics for the current user' })
  @ApiResponse({ status: 200, description: 'Returns subscription analytics' })
  getSubscriptionAnalytics(@CurrentUser() user: User): Promise<SubscriptionAnalytics> {
    return this.userSubscriptionService.getSubscriptionAnalytics(user.id);
  }

  @Get('can-downgrade/:planId')
  @ApiOperation({ summary: 'Check if user can downgrade to a specific plan' })
  @ApiResponse({ status: 200, description: 'Returns whether downgrade is possible' })
  @ApiParam({ name: 'planId', description: 'ID of the plan to check downgrade to' })
  canDowngrade(@CurrentUser() user: User, @Param('planId', new ParseUUIDPipe()) planId: string) {
    return this.userSubscriptionService.canDowngrade(user.id, planId);
  }

  // Admin endpoints
  @Get('admin/all')
  @Admin()
  @ApiOperation({ summary: 'Get all user subscriptions with filtering (Admin only)' })
  @ApiResponse({ status: 200, description: 'Returns a paginated list of all user subscriptions' })
  @ApiQuery({ name: 'userId', required: false, description: 'Filter by user ID' })
  @ApiQuery({ name: 'status', required: false, description: 'Filter by subscription status' })
  @ApiQuery({ name: 'planId', required: false, description: 'Filter by plan ID' })
  @ApiQuery({ name: 'page', required: false, description: 'Page number (1-based)' })
  @ApiQuery({ name: 'limit', required: false, description: 'Items per page' })
  getAllSubscriptions(
    @Query('userId') userId?: string,
    @Query('status') status?: SubscriptionStatus,
    @Query('planId') planId?: string,
    @Query('page') page = 1,
    @Query('limit') limit = 10,
  ) {
    const paginationOptions: IPaginationOptions = {
      page,
      limit,
      route: '/user-subscriptions/admin/all',
    };

    const filters = { userId, status, planId };

    return this.userSubscriptionService.getAllSubscriptions(paginationOptions, filters);
  }

  // Admin endpoint to process scheduled upgrades
  @Post('admin/process-scheduled-upgrades')
  @Admin()
  @ApiOperation({ summary: 'Process all scheduled upgrades (Admin only)' })
  @ApiResponse({ status: 200, description: 'Scheduled upgrades processed successfully' })
  processScheduledUpgrades() {
    return this.userSubscriptionService.processScheduledUpgrades();
  }
}
