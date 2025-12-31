import { CurrentUser } from '@app/core/decorators/current-user.decorator';
import { Admin, Authenticated } from '@app/core/guards/roles-auth.guard';
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
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';

import { CreateOrderDto } from '../dto/create-order.dto';
import { FilterOrdersDto } from '../dto/filter-orders.dto';
import { OrderService } from '../services/order.service';

@ApiTags('orders')
@ApiBearerAuth()
@Controller('orders')
@Authenticated()
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

  // ===== Owner/Seller Endpoints =====

  @Get('owner/sales')
  @ApiOperation({ summary: 'Get orders for licenses owned by the current user' })
  @ApiResponse({ status: 200, description: 'Returns paginated list of sales' })
  findOwnerSales(@CurrentUser() user: User, @Query() filter: FilterOrdersDto) {
    if (!user || !user.id) {
      throw new UnauthorizedException('User not authenticated or missing ID');
    }
    const { page = 1, limit = 10 } = filter;
    return this.orderService.findOrdersByOwner(user.id, filter, { page, limit });
  }

  @Get('owner/analytics')
  @ApiOperation({ summary: 'Get sales analytics for the current owner' })
  @ApiResponse({ status: 200, description: 'Returns sales analytics' })
  @ApiQuery({ name: 'startDate', required: false, type: String })
  @ApiQuery({ name: 'endDate', required: false, type: String })
  getOwnerAnalytics(
    @CurrentUser() user: User,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    if (!user || !user.id) {
      throw new UnauthorizedException('User not authenticated or missing ID');
    }
    const start = startDate ? new Date(startDate) : undefined;
    const end = endDate ? new Date(endDate) : undefined;
    return this.orderService.getSalesAnalytics(user.id, start, end);
  }

  @Get('owner/trends')
  @ApiOperation({ summary: 'Get sales trends over time' })
  @ApiResponse({ status: 200, description: 'Returns sales trends' })
  @ApiQuery({ name: 'startDate', required: true, type: String })
  @ApiQuery({ name: 'endDate', required: true, type: String })
  @ApiQuery({ name: 'groupBy', required: false, enum: ['day', 'week', 'month'] })
  getSalesTrends(
    @CurrentUser() user: User,
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
    @Query('groupBy') groupBy?: 'day' | 'week' | 'month',
  ) {
    if (!user || !user.id) {
      throw new UnauthorizedException('User not authenticated or missing ID');
    }
    return this.orderService.getSalesTrends(
      user.id,
      new Date(startDate),
      new Date(endDate),
      groupBy || 'day',
    );
  }

  @Get('owner/top-licenses')
  @ApiOperation({ summary: 'Get top selling licenses' })
  @ApiResponse({ status: 200, description: 'Returns top selling licenses' })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'startDate', required: false, type: String })
  @ApiQuery({ name: 'endDate', required: false, type: String })
  getTopSellingLicenses(
    @CurrentUser() user: User,
    @Query('limit') limit?: number,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    if (!user || !user.id) {
      throw new UnauthorizedException('User not authenticated or missing ID');
    }
    const start = startDate ? new Date(startDate) : undefined;
    const end = endDate ? new Date(endDate) : undefined;
    return this.orderService.getTopSellingLicenses(user.id, limit || 5, start, end);
  }

  @Get('owner/recent')
  @ApiOperation({ summary: 'Get recent orders for owner licenses' })
  @ApiResponse({ status: 200, description: 'Returns recent orders' })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  getRecentOrders(@CurrentUser() user: User, @Query('limit') limit?: number) {
    if (!user || !user.id) {
      throw new UnauthorizedException('User not authenticated or missing ID');
    }
    return this.orderService.getRecentOrdersByOwner(user.id, limit || 10);
  }

  @Get('owner/customers')
  @ApiOperation({ summary: 'Get customers who purchased owner licenses' })
  @ApiResponse({ status: 200, description: 'Returns paginated list of customers' })
  @ApiQuery({ name: 'search', required: false, type: String })
  @ApiQuery({ name: 'status', required: false, enum: OrderStatus })
  @ApiQuery({ name: 'sortBy', required: false, type: String })
  @ApiQuery({ name: 'sortDirection', required: false, enum: ['ASC', 'DESC'] })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  getCustomers(
    @CurrentUser() user: User,
    @Query('search') search?: string,
    @Query('status') status?: OrderStatus,
    @Query('sortBy') sortBy?: string,
    @Query('sortDirection') sortDirection?: 'ASC' | 'DESC',
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    if (!user || !user.id) {
      throw new UnauthorizedException('User not authenticated or missing ID');
    }
    return this.orderService.getCustomersByOwner(
      user.id,
      { search, status, sortBy, sortDirection },
      { page: page || 1, limit: limit || 10 },
    );
  }

  @Get('owner/customers/:customerId')
  @ApiOperation({ summary: 'Get customer details with order history' })
  @ApiResponse({ status: 200, description: 'Returns customer details' })
  @ApiResponse({ status: 404, description: 'Customer not found' })
  @ApiParam({ name: 'customerId', description: 'Customer User ID' })
  getCustomerDetails(@CurrentUser() user: User, @Param('customerId') customerId: string) {
    if (!user || !user.id) {
      throw new UnauthorizedException('User not authenticated or missing ID');
    }
    return this.orderService.getCustomerDetailsByOwner(user.id, customerId);
  }

  @Get('owner/:id')
  @ApiOperation({ summary: 'Get a specific order for owner licenses' })
  @ApiResponse({ status: 200, description: 'Returns order details' })
  @ApiResponse({ status: 404, description: 'Order not found' })
  @ApiParam({ name: 'id', description: 'Order ID' })
  findOneOwnerOrder(@CurrentUser() user: User, @Param('id') id: string) {
    if (!user || !user.id) {
      throw new UnauthorizedException('User not authenticated or missing ID');
    }
    return this.orderService.findOneByOwner(id, user.id);
  }

  // ===== Admin Endpoints =====

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
