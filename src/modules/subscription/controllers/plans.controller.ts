import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';

import { PlanConfig, StripeService } from '../services/stripe.service';

@ApiTags('Plans')
@Controller('plans')
export class PlansController {
  constructor(private readonly stripeService: StripeService) {}

  @Get()
  @ApiOperation({ summary: 'Get all available subscription plans (public)' })
  @ApiResponse({
    status: 200,
    description: 'Returns all available subscription plans with pricing',
  })
  getPlans(): PlanConfig[] {
    return this.stripeService.getAllPlans();
  }
}
