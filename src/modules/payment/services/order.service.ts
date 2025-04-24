import { LicenseOptionService } from '@app/modules/licenses/services/license-option.service';
import { OrderStatus } from '@app/shared/enums';
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IPaginationOptions, paginate, Pagination } from 'nestjs-typeorm-paginate';
import { Repository } from 'typeorm';

import { CreateOrderDto } from '../dto/create-order.dto';
import { FilterOrdersDto } from '../dto/filter-orders.dto';
import { Order } from '../entities/order.entity';

@Injectable()
export class OrderService {
  constructor(
    @InjectRepository(Order)
    private readonly orderRepository: Repository<Order>,
    private readonly licenseService: LicenseOptionService,
  ) {}

  /**
   * Create a new order for a license purchase
   */
  async create(userId: string, createOrderDto: CreateOrderDto): Promise<Order> {
    const { licenseId, currency, notes } = createOrderDto;

    // Verify the license option exists
    const licenseOption = await this.licenseService.findOne(licenseId);
    if (!licenseOption) {
      throw new NotFoundException(`License option with ID ${licenseId} not found`);
    }

    // Create a new order
    const order = this.orderRepository.create({
      userId,
      licenseId,
      amount: licenseOption.price,
      currency: currency || licenseOption.currency,
      notes,
      status: OrderStatus.PENDING,
    });

    return this.orderRepository.save(order);
  }

  /**
   * Find all orders with filtering and pagination
   */
  findAll(
    userId: string,
    filter: FilterOrdersDto,
    paginationOptions: IPaginationOptions,
  ): Promise<Pagination<Order>> {
    const { status, licenseId, currency, isActive, search } = filter;

    const queryBuilder = this.orderRepository
      .createQueryBuilder('order')
      .leftJoinAndSelect('order.license', 'license')
      .where('order.userId = :userId', { userId });

    // Apply filters if provided
    if (status) {
      queryBuilder.andWhere('order.status = :status', { status });
    }

    if (licenseId) {
      queryBuilder.andWhere('order.licenseId = :licenseId', { licenseId });
    }

    if (currency) {
      queryBuilder.andWhere('order.currency = :currency', { currency });
    }

    if (isActive !== undefined) {
      queryBuilder.andWhere('order.isActive = :isActive', { isActive });
    }

    // Apply search if provided
    if (search) {
      queryBuilder.andWhere('(license.name ILIKE :search OR order.referenceNumber ILIKE :search)', {
        search: `%${search}%`,
      });
    }

    queryBuilder.orderBy('order.createdAt', 'DESC');

    return paginate<Order>(queryBuilder, paginationOptions);
  }

  /**
   * Find all orders (admin only)
   */
  findAllAdmin(
    filter: FilterOrdersDto,
    paginationOptions: IPaginationOptions,
  ): Promise<Pagination<Order>> {
    const { status, licenseId, currency, isActive, search } = filter;

    const queryBuilder = this.orderRepository
      .createQueryBuilder('order')
      .leftJoinAndSelect('order.license', 'license')
      .leftJoinAndSelect('order.user', 'user');

    // Apply filters if provided
    if (status) {
      queryBuilder.andWhere('order.status = :status', { status });
    }

    if (licenseId) {
      queryBuilder.andWhere('order.licenseId = :licenseId', { licenseId });
    }

    if (currency) {
      queryBuilder.andWhere('order.currency = :currency', { currency });
    }

    if (isActive !== undefined) {
      queryBuilder.andWhere('order.isActive = :isActive', { isActive });
    }

    // Apply search if provided
    if (search) {
      queryBuilder.andWhere(
        '(license.name ILIKE :search OR order.referenceNumber ILIKE :search OR user.email ILIKE :search)',
        { search: `%${search}%` },
      );
    }

    queryBuilder.orderBy('order.createdAt', 'DESC');

    return paginate<Order>(queryBuilder, paginationOptions);
  }

  /**
   * Find one order by ID
   */
  async findOne(id: string, userId?: string): Promise<Order> {
    const queryBuilder = this.orderRepository
      .createQueryBuilder('order')
      .leftJoinAndSelect('order.license', 'license')
      .leftJoinAndSelect('order.payments', 'payment')
      .where('order.id = :id', { id });

    // If userId is provided, only return the user's orders
    if (userId) {
      queryBuilder.andWhere('order.userId = :userId', { userId });
    }

    const order = await queryBuilder.getOne();

    if (!order) {
      throw new NotFoundException(`Order with ID ${id} not found`);
    }

    return order;
  }

  /**
   * Update order status
   */
  async updateStatus(id: string, status: OrderStatus): Promise<Order> {
    const order = await this.findOne(id);

    // Check if the status transition is valid
    if (order.status === OrderStatus.COMPLETED && status !== OrderStatus.REFUNDED) {
      throw new BadRequestException('Cannot change status of a completed order');
    }

    // Update order status
    order.status = status;

    // If completing the order, set the completion date and activate the license
    if (status === OrderStatus.COMPLETED) {
      order.completedAt = new Date();
      order.isActive = true;

      // Calculate the expiration date based on the license duration
      if (order.license?.duration) {
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + order.license.duration);
        order.expiresAt = expiresAt;
      }
    }

    // If cancelling or refunding, deactivate the license
    if (status === OrderStatus.CANCELLED || status === OrderStatus.REFUNDED) {
      order.isActive = false;
    }

    return this.orderRepository.save(order);
  }
}
