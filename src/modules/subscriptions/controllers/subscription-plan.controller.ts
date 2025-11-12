import { Admin, Authenticated } from '@app/core/guards/roles-auth.guard';
import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  ParseUUIDPipe,
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

import { CreateSubscriptionPlanDto } from '../dto/create-subscription-plan.dto';
import { FilterSubscriptionPlanDto } from '../dto/filter-subscription-plan.dto';
import { UpdateSubscriptionPlanDto } from '../dto/update-subscription-plan.dto';
import { SubscriptionPlanService } from '../services/subscription-plan.service';

@ApiTags('subscription-plans')
@ApiBearerAuth()
@Controller('subscription-plans')
export class SubscriptionPlanController {
  constructor(private readonly subscriptionPlanService: SubscriptionPlanService) {}

  @Post()
  @Admin()
  @ApiOperation({ summary: 'Create a new subscription plan (Admin only)' })
  @ApiResponse({ status: 201, description: 'Subscription plan successfully created' })
  @ApiResponse({ status: 400, description: 'Invalid input data' })
  @ApiResponse({ status: 409, description: 'Plan with same name already exists' })
  create(@Body() createDto: CreateSubscriptionPlanDto) {
    return this.subscriptionPlanService.create(createDto);
  }

  @Get()
  @Admin()
  @ApiOperation({ summary: 'Get all subscription plans with filtering (Admin only)' })
  @ApiResponse({ status: 200, description: 'Returns a paginated list of subscription plans' })
  @ApiQuery({ name: 'search', required: false, description: 'Search term for name or description' })
  @ApiQuery({ name: 'type', required: false, description: 'Filter by plan type' })
  @ApiQuery({ name: 'status', required: false, description: 'Filter by plan status' })
  @ApiQuery({ name: 'popular', required: false, description: 'Filter by popularity' })
  @ApiQuery({ name: 'isActive', required: false, description: 'Filter by active status' })
  @ApiQuery({
    name: 'interval',
    required: false,
    description: 'Filter by billing interval (month/year)',
  })
  @ApiQuery({ name: 'feature', required: false, description: 'Filter by feature' })
  @ApiQuery({ name: 'sortBy', required: false, description: 'Field to sort by' })
  @ApiQuery({ name: 'sortDirection', required: false, description: 'Sort direction' })
  @ApiQuery({ name: 'page', required: false, description: 'Page number (1-based)' })
  @ApiQuery({ name: 'limit', required: false, description: 'Items per page' })
  findAll(@Query() filter: FilterSubscriptionPlanDto) {
    const { page = 1, limit = 10, ...rest } = filter;
    const paginationOptions: IPaginationOptions = {
      page,
      limit,
      route: '/subscription-plans',
    };

    return this.subscriptionPlanService.findAll(rest, paginationOptions);
  }

  @Get('public')
  @ApiOperation({ summary: 'Get active subscription plans (Public endpoint)' })
  @ApiResponse({ status: 200, description: 'Returns a list of active subscription plans' })
  findActivePublic() {
    return this.subscriptionPlanService.findActivePublic();
  }

  @Get('statistics')
  @Admin()
  @ApiOperation({ summary: 'Get subscription plan statistics (Admin only)' })
  @ApiResponse({ status: 200, description: 'Returns subscription plan statistics' })
  getStatistics() {
    return this.subscriptionPlanService.getStatistics();
  }

  @Get(':id')
  @Authenticated()
  @ApiOperation({ summary: 'Get a subscription plan by ID' })
  @ApiResponse({ status: 200, description: 'Returns the subscription plan' })
  @ApiResponse({ status: 404, description: 'Subscription plan not found' })
  @ApiParam({ name: 'id', description: 'Subscription plan ID' })
  findOne(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.subscriptionPlanService.findOne(id);
  }

  @Patch(':id')
  @Admin()
  @ApiOperation({ summary: 'Update a subscription plan (Admin only)' })
  @ApiResponse({ status: 200, description: 'Subscription plan successfully updated' })
  @ApiResponse({ status: 400, description: 'Invalid input data' })
  @ApiResponse({ status: 404, description: 'Subscription plan not found' })
  @ApiParam({ name: 'id', description: 'Subscription plan ID' })
  update(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() updateDto: UpdateSubscriptionPlanDto,
  ) {
    return this.subscriptionPlanService.update(id, updateDto);
  }

  @Delete(':id')
  @Admin()
  @ApiOperation({ summary: 'Delete a subscription plan (Admin only)' })
  @ApiResponse({ status: 200, description: 'Subscription plan successfully deleted' })
  @ApiResponse({ status: 404, description: 'Subscription plan not found' })
  @ApiParam({ name: 'id', description: 'Subscription plan ID' })
  remove(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.subscriptionPlanService.remove(id);
  }
}
