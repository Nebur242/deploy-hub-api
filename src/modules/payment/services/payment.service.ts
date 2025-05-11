import { OrderStatus, PaymentStatus } from '@app/shared/enums';
import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { OrderService } from './order.service';
import { CreatePaymentDto } from '../dto/create-payment.dto';
import { Order } from '../entities/order.entity';
import { Payment } from '../entities/payment.entity';

@Injectable()
export class PaymentService {
  constructor(
    @InjectRepository(Payment)
    private readonly paymentRepository: Repository<Payment>,
    @InjectRepository(Order)
    private readonly orderRepository: Repository<Order>,
    private readonly orderService: OrderService,
  ) {}

  /**
   * Process a payment for an order
   */
  async processPayment(userId: string, createPaymentDto: CreatePaymentDto): Promise<Payment> {
    const { orderId, amount, currency, paymentMethod, transactionId, paymentGatewayResponse } =
      createPaymentDto;

    // Verify the order exists and belongs to the user
    const order = await this.orderService.findOne(orderId, userId);
    if (!order) {
      throw new NotFoundException(`Order with ID ${orderId} not found`);
    }

    // Check if order is pending
    if (order.status !== OrderStatus.PENDING) {
      throw new BadRequestException(
        `Cannot process payment for an order with status: ${order.status}`,
      );
    }

    // Validate payment amount
    if (amount !== order.amount) {
      throw new BadRequestException(
        `Payment amount (${amount}) does not match order amount (${order.amount})`,
      );
    }

    // Create a new payment record
    const payment = this.paymentRepository.create({
      orderId,
      order,
      amount,
      currency: currency || order.currency,
      paymentMethod,
      transactionId,
      paymentGatewayResponse,
      status: PaymentStatus.PENDING,
    });

    // Save the payment
    const savedPayment = await this.paymentRepository.save(payment);

    // In a real application, this would integrate with a payment gateway
    // For now, we'll simulate a successful payment
    await this.simulatePaymentProcessing(savedPayment);

    return savedPayment;
  }

  /**
   * Simulate payment processing (in a real app, this would interact with a payment gateway)
   */
  private async simulatePaymentProcessing(payment: Payment) {
    // Simulate payment processing
    // add delay to simulate payment processing
    const isSuccessful = true;

    // Update payment status
    payment.status = isSuccessful ? PaymentStatus.COMPLETED : PaymentStatus.FAILED;
    payment.processedAt = new Date();

    await this.paymentRepository.save(payment);

    // Update order status based on payment result
    if (isSuccessful) {
      await this.orderService.updateStatus(payment.orderId, OrderStatus.COMPLETED);
    } else {
      await this.orderService.updateStatus(payment.orderId, OrderStatus.FAILED);
    }
  }

  /**
   * Find payment by ID
   */
  async findOne(id: string): Promise<Payment> {
    const payment = await this.paymentRepository.findOne({
      where: { id },
      relations: ['order'],
    });

    if (!payment) {
      throw new NotFoundException(`Payment with ID ${id} not found`);
    }

    return payment;
  }

  /**
   * Find payments by order ID
   */
  findByOrderId(orderId: string, userId?: string): Promise<Payment[]> {
    const queryBuilder = this.paymentRepository
      .createQueryBuilder('payment')
      .leftJoinAndSelect('payment.order', 'order')
      .where('payment.orderId = :orderId', { orderId });

    // If userId is provided, ensure the order belongs to this user
    if (userId) {
      queryBuilder.andWhere('order.userId = :userId', { userId });
    }

    return queryBuilder.getMany();
  }

  /**
   * Update payment status manually (admin only)
   */
  async updatePaymentStatus(id: string, status: PaymentStatus): Promise<Payment> {
    const payment = await this.findOne(id);

    payment.status = status;
    payment.processedAt = new Date();

    const savedPayment = await this.paymentRepository.save(payment);

    // If payment is completed, update the order
    if (status === PaymentStatus.COMPLETED) {
      await this.orderService.updateStatus(payment.orderId, OrderStatus.COMPLETED);
    } else if (status === PaymentStatus.FAILED) {
      await this.orderService.updateStatus(payment.orderId, OrderStatus.FAILED);
    }

    return savedPayment;
  }
}
