import { CurrentUser } from '@app/core/decorators/current-user.decorator';
import { Admin, Authenticated } from '@app/core/guards/roles-auth.guard';
import { User } from '@app/modules/users/entities/user.entity';
import { PaymentStatus } from '@app/shared/enums';
import { Body, Controller, Get, Param, Patch, Post, UnauthorizedException } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';

import { CreatePaymentDto } from '../dto/create-payment.dto';
import { PaymentService } from '../services/payment.service';

@ApiTags('payments')
@ApiBearerAuth()
@Controller('payments')
export class PaymentController {
  constructor(private readonly paymentService: PaymentService) {}

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
}
