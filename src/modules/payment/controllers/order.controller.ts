import { CurrentUser } from '@app/core/decorators/current-user.decorator';
import { Admin } from '@app/core/guards/roles-auth.guard';
import { User } from '@app/modules/users/entities/user.entity';
import { OrderStatus } from '@app/shared/enums';
import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UnauthorizedException,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';

import { CreateOrderDto } from '../dto/create-order.dto';
import { FilterOrdersDto } from '../dto/filter-orders.dto';
import { OrderService } from '../services/order.service';

@ApiTags('orders')
@ApiBearerAuth()
@Controller('orders')
@Admin()
export class OrderController {
  constructor(private readonly orderService: OrderService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new order' })
  @ApiResponse({ status: 201, description: 'Order created successfully' })
  @ApiResponse({ status: 400, description: 'Invalid input data' })
  @ApiResponse({ status: 404, description: 'License option not found' })
  create(@CurrentUser() user: User, @Body() createOrderDto: CreateOrderDto) {
    if (!user || !user.id) {
      throw new UnauthorizedException('User not authenticated or missing ID');
    }
    return this.orderService.create(user.id, createOrderDto);
  }

  @Get()
  @ApiOperation({ summary: 'Get all orders for the current user' })
  @ApiResponse({ status: 200, description: 'Returns paginated list of orders' })
  findAll(@CurrentUser() user: User, @Query() filter: FilterOrdersDto) {
    if (!user || !user.id) {
      throw new UnauthorizedException('User not authenticated or missing ID');
    }
    const { page = 1, limit = 10 } = filter;
    return this.orderService.findAll(user.id, filter, { page, limit });
  }

  @Get('admin')
  @Admin()
  @ApiOperation({ summary: 'Admin - Get all orders with filtering' })
  @ApiResponse({ status: 200, description: 'Returns paginated list of orders' })
  findAllAdmin(@Query() filter: FilterOrdersDto) {
    const { page = 1, limit = 10 } = filter;
    return this.orderService.findAllAdmin(filter, { page, limit });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get an order by ID' })
  @ApiResponse({ status: 200, description: 'Returns the order details' })
  @ApiResponse({ status: 404, description: 'Order not found' })
  @ApiParam({ name: 'id', description: 'Order ID' })
  findOne(@CurrentUser() user: User, @Param('id') id: string) {
    if (!user || !user.id) {
      throw new UnauthorizedException('User not authenticated or missing ID');
    }
    return this.orderService.findOne(id, user.id);
  }

  @Get('admin/:id')
  @Admin()
  @ApiOperation({ summary: 'Admin - Get an order by ID' })
  @ApiResponse({ status: 200, description: 'Returns the order details' })
  @ApiResponse({ status: 404, description: 'Order not found' })
  @ApiParam({ name: 'id', description: 'Order ID' })
  findOneAdmin(@Param('id') id: string) {
    return this.orderService.findOne(id);
  }

  @Patch(':id/status')
  @Admin()
  @ApiOperation({ summary: 'Admin - Update order status' })
  @ApiResponse({ status: 200, description: 'Order status updated' })
  @ApiResponse({ status: 400, description: 'Invalid status transition' })
  @ApiResponse({ status: 404, description: 'Order not found' })
  @ApiParam({ name: 'id', description: 'Order ID' })
  updateStatus(@Param('id') id: string, @Body('status') status: OrderStatus) {
    return this.orderService.updateStatus(id, status);
  }
}
