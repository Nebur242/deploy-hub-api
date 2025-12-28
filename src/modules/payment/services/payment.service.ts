import { UserLicense } from '@app/modules/license/entities/user-license.entity';
import { OrderService } from '@app/modules/order/services/order.service';
import { OrderStatus, PaymentStatus } from '@app/shared/enums';
import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { CreatePaymentDto } from '../dto/create-payment.dto';
import { Payment } from '../entities/payment.entity';

@Injectable()
export class PaymentService {
  constructor(
    @InjectRepository(Payment)
    private readonly paymentRepository: Repository<Payment>,
    @InjectRepository(UserLicense)
    private readonly userLicenseRepository: Repository<UserLicense>,
    private readonly orderService: OrderService,
  ) {}

  /**
   * Process a payment for an order
   */
  async processPayment(userId: string, createPaymentDto: CreatePaymentDto): Promise<Payment> {
    const { order_id, amount, currency, payment_method, transaction_id, payment_gateway_response } =
      createPaymentDto;

    // Verify the order exists and belongs to the user
    const order = await this.orderService.findOne(order_id, userId);
    if (!order) {
      throw new NotFoundException(`Order with ID ${order_id} not found`);
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
      order_id,
      order,
      amount,
      currency: currency || order.currency,
      payment_method,
      transaction_id,
      payment_gateway_response,
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
    payment.processed_at = new Date();

    await this.paymentRepository.save(payment);

    // Update order status based on payment result
    if (isSuccessful) {
      await this.orderService.updateStatus(payment.order_id, OrderStatus.COMPLETED);
      await this.createUserLicense(payment, false);
    } else {
      await this.orderService.updateStatus(payment.order_id, OrderStatus.FAILED);
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
      .where('payment.order_id = :orderId', { orderId });

    // If userId is provided, ensure the order belongs to this user
    if (userId) {
      queryBuilder.andWhere('order.user_id = :userId', { userId });
    }

    return queryBuilder.getMany();
  }

  /**
   * Create a user license from a completed order
   */
  private async createUserLicense(
    payment: Payment,
    isAdminManaged: boolean = false,
  ): Promise<void> {
    // Fetch the complete order with license information
    const order = await this.orderService.findOne(payment.order_id);

    // Create a new UserLicense instance
    const userLicense = this.userLicenseRepository.create({
      owner_id: order.user_id,
      license_id: order.license_id,
      expires_at: order.expires_at,
      active: true,
      count: 0,
      max_deployments: order.license.deployment_limit,
      deployments: [],
      trial: false,
      metadata: {
        orderReference: order.reference_number,
        paymentId: payment.id,
        paymentDate: payment.processed_at,
        adminAssigned: isAdminManaged,
      },
    });

    // Save the user license
    await this.userLicenseRepository.save(userLicense);
  }

  /**
   * Update payment status manually (admin only)
   */
  async updatePaymentStatus(id: string, status: PaymentStatus): Promise<Payment> {
    const payment = await this.findOne(id);

    payment.status = status;
    payment.processed_at = new Date();

    const savedPayment = await this.paymentRepository.save(payment);

    // If payment is completed, update the order and create a user license
    if (status === PaymentStatus.COMPLETED) {
      await this.orderService.updateStatus(payment.order_id, OrderStatus.COMPLETED);
      await this.createUserLicense(savedPayment, true);
    } else if (status === PaymentStatus.FAILED) {
      await this.orderService.updateStatus(payment.order_id, OrderStatus.FAILED);
    }

    return savedPayment;
  }
}
