import { LicenseService } from '@app/modules/license/services/license.service';
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
    private readonly licenseService: LicenseService,
  ) {}

  /**
   * Create a new order for a license purchase
   */
  async create(userId: string, createOrderDto: CreateOrderDto): Promise<Order> {
    const { currency, license_id, ...rest } = createOrderDto;

    // Verify the license option exists
    const license = await this.licenseService.findOne(license_id);
    if (!license) {
      throw new NotFoundException(`License with ID ${license_id} not found`);
    }

    // Create a new order
    const order = this.orderRepository.create({
      ...rest,
      license_id,
      user_id: userId,
      amount: license.price,
      currency: currency || license.currency,
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
    const { status, license_id, currency, is_active, search } = filter;

    const queryBuilder = this.orderRepository
      .createQueryBuilder('order')
      .leftJoinAndSelect('order.license', 'license')
      .where('order.user_id = :userId', { userId });

    // Apply filters if provided
    if (status) {
      queryBuilder.andWhere('order.status = :status', { status });
    }

    if (license_id) {
      queryBuilder.andWhere('order.license_id = :licenseId', { licenseId: license_id });
    }

    if (currency) {
      queryBuilder.andWhere('order.currency = :currency', { currency });
    }

    if (is_active !== undefined) {
      queryBuilder.andWhere('order.is_active = :isActive', { isActive: is_active });
    }

    // Apply search if provided
    if (search) {
      queryBuilder.andWhere(
        '(license.name ILIKE :search OR order.reference_number ILIKE :search)',
        {
          search: `%${search}%`,
        },
      );
    }

    queryBuilder.orderBy('order.created_at', 'DESC');

    return paginate<Order>(queryBuilder, paginationOptions);
  }

  /**
   * Find all orders (admin only)
   */
  findAllAdmin(
    filter: FilterOrdersDto,
    paginationOptions: IPaginationOptions,
  ): Promise<Pagination<Order>> {
    const { status, license_id, currency, is_active, search } = filter;

    const queryBuilder = this.orderRepository
      .createQueryBuilder('order')
      .leftJoinAndSelect('order.license', 'license')
      .leftJoinAndSelect('order.user', 'user');

    // Apply filters if provided
    if (status) {
      queryBuilder.andWhere('order.status = :status', { status });
    }

    if (license_id) {
      queryBuilder.andWhere('order.license_id = :licenseId', { licenseId: license_id });
    }

    if (currency) {
      queryBuilder.andWhere('order.currency = :currency', { currency });
    }

    if (is_active !== undefined) {
      queryBuilder.andWhere('order.is_active = :isActive', { isActive: is_active });
    }

    // Apply search if provided
    if (search) {
      queryBuilder.andWhere(
        '(license.name ILIKE :search OR order.reference_number ILIKE :search OR user.email ILIKE :search)',
        { search: `%${search}%` },
      );
    }

    queryBuilder.orderBy('order.created_at', 'DESC');

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
      queryBuilder.andWhere('order.user_id = :userId', { userId });
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
      order.completed_at = new Date();
      order.is_active = true;

      // Calculate the expiration date based on the license duration
      if (order.license?.duration) {
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + order.license.duration);
        order.expires_at = expiresAt;
      }
    }

    // If cancelling or refunding, deactivate the license
    if (status === OrderStatus.CANCELLED || status === OrderStatus.REFUNDED) {
      order.is_active = false;
    }

    return this.orderRepository.save(order);
  }
}
