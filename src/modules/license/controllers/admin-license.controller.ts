import { Admin } from '@app/core/guards/roles-auth.guard';
import { FilterOrdersDto } from '@app/modules/order/dto';
import { OrderService } from '@app/modules/order/services/order.service';
import { OrderStatus } from '@app/shared/enums';
import {
  Controller,
  Get,
  Patch,
  Param,
  Delete,
  Query,
  Inject,
  forwardRef,
  ParseUUIDPipe,
  Body,
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

import { FilterLicenseDto } from '../dto/filter.dto';
import { UpdateLicenseDto } from '../dto/update-license.dto';
import { LicenseService } from '../services/license.service';

@ApiTags('admin/licenses')
@Controller('admin/licenses')
@Admin()
@ApiBearerAuth()
export class AdminLicenseController {
  constructor(
    private readonly licenseService: LicenseService,
    @Inject(forwardRef(() => OrderService))
    private readonly orderService: OrderService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Admin - Get all licenses with filtering' })
  @ApiResponse({ status: 200, description: 'Returns paginated list of all licenses' })
  @ApiQuery({ name: 'search', required: false, description: 'Search term for name or description' })
  @ApiQuery({ name: 'currency', required: false, description: 'Filter by currency' })
  @ApiQuery({ name: 'owner_id', required: false, description: 'Filter by owner ID' })
  @ApiQuery({ name: 'sortBy', required: false, description: 'Field to sort by' })
  @ApiQuery({
    name: 'sortDirection',
    required: false,
    enum: ['ASC', 'DESC'],
    description: 'Sort direction',
  })
  @ApiQuery({ name: 'page', required: false, description: 'Page number (1-based)' })
  @ApiQuery({ name: 'limit', required: false, description: 'Items per page' })
  findAll(@Query() filter: FilterLicenseDto) {
    const { page = 1, limit = 10, ...rest } = filter;
    const paginationOptions: IPaginationOptions = {
      page,
      limit,
      route: '/admin/licenses',
    };

    return this.licenseService.findAll(rest, paginationOptions);
  }

  @Get('orders')
  @ApiOperation({ summary: 'Admin - Get all license orders' })
  @ApiResponse({ status: 200, description: 'Returns paginated list of all orders' })
  getOrders(@Query() filter: FilterOrdersDto) {
    const { page = 1, limit = 10 } = filter;
    return this.orderService.findAllAdmin(filter, { page, limit });
  }

  @Get('orders/:id')
  @ApiOperation({ summary: 'Admin - Get an order by ID' })
  @ApiResponse({ status: 200, description: 'Returns the order details' })
  @ApiResponse({ status: 404, description: 'Order not found' })
  @ApiParam({ name: 'id', description: 'Order ID' })
  getOrderById(@Param('id', ParseUUIDPipe) id: string) {
    return this.orderService.findOne(id);
  }

  @Patch('orders/:id/status')
  @ApiOperation({ summary: 'Admin - Update order status' })
  @ApiResponse({ status: 200, description: 'Order status updated' })
  @ApiResponse({ status: 400, description: 'Invalid status transition' })
  @ApiResponse({ status: 404, description: 'Order not found' })
  @ApiParam({ name: 'id', description: 'Order ID' })
  updateOrderStatus(@Param('id', ParseUUIDPipe) id: string, @Body('status') status: OrderStatus) {
    return this.orderService.updateStatus(id, status);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Admin - Get a license by ID' })
  @ApiResponse({ status: 200, description: 'Returns the license' })
  @ApiResponse({ status: 404, description: 'License not found' })
  @ApiParam({ name: 'id', description: 'License ID' })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.licenseService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Admin - Update a license' })
  @ApiResponse({ status: 200, description: 'License updated successfully' })
  @ApiResponse({ status: 400, description: 'Invalid input data' })
  @ApiResponse({ status: 404, description: 'License not found' })
  @ApiParam({ name: 'id', description: 'License ID' })
  update(@Param('id', ParseUUIDPipe) id: string, @Body() updateLicenseDto: UpdateLicenseDto) {
    return this.licenseService.adminUpdate(id, updateLicenseDto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Admin - Delete a license' })
  @ApiResponse({ status: 200, description: 'License deleted successfully' })
  @ApiResponse({ status: 404, description: 'License not found' })
  @ApiParam({ name: 'id', description: 'License ID' })
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.licenseService.adminRemove(id);
  }
}
