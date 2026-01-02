import { LicenseService } from '@app/modules/license/services/license.service';
import { OrderStatus } from '@app/shared/enums';
import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectRepository } from '@nestjs/typeorm';
import { IPaginationOptions, paginate, Pagination } from 'nestjs-typeorm-paginate';
import { Repository } from 'typeorm';

import { CouponService } from './coupon.service';
import { CreateOrderDto } from '../dto/create-order.dto';
import { FilterOrdersDto } from '../dto/filter-orders.dto';
import { Order } from '../entities/order.entity';
import {
  OrderCancelledEvent,
  OrderCompletedEvent,
  OrderCreatedEvent,
  OrderEventType,
  OrderFailedEvent,
  OrderRefundedEvent,
} from '../events/order.events';

/**
 * Raw query result interfaces for sales analytics
 */
interface SalesTrendRawResult {
  date: string;
  orderCount: string;
  revenue: string;
}

interface TopSellingLicenseRawResult {
  licenseId: string;
  licenseName: string | null;
  projectId: string | null;
  projectName: string | null;
  orderCount: string;
  revenue: string;
}

/**
 * Customer stats interfaces
 */
interface CustomerStatsRaw {
  userId: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  profilePicture: string | null;
  userCreatedAt: string;
  totalOrders: string;
  completedOrders: string;
  totalSpent: string;
  firstPurchase: string | null;
  lastPurchase: string | null;
}

export interface CustomerStats {
  userId: string;
  email: string;
  firstName: string;
  lastName: string;
  profilePicture: string | null;
  userCreatedAt: Date;
  totalOrders: number;
  completedOrders: number;
  totalSpent: number;
  firstPurchase: Date | null;
  lastPurchase: Date | null;
}

export interface CustomerDetails extends CustomerStats {
  company: string | null;
  orders: Order[];
  licensesOwned: {
    licenseId: string;
    licenseName: string;
    purchaseCount: number;
  }[];
}

@Injectable()
export class OrderService {
  private readonly logger = new Logger(OrderService.name);

  constructor(
    @InjectRepository(Order)
    private readonly orderRepository: Repository<Order>,
    private readonly licenseService: LicenseService,
    private readonly eventEmitter: EventEmitter2,
    private readonly couponService: CouponService,
  ) {}

  /**
   * Create a new order for a license purchase
   */
  async create(userId: string, createOrderDto: CreateOrderDto): Promise<Order> {
    const { currency, license_id, coupon_code, ...rest } = createOrderDto;

    // Verify the license option exists and get full details
    const license = await this.licenseService.findOne(license_id);
    if (!license) {
      throw new NotFoundException(`License with ID ${license_id} not found`);
    }

    let finalAmount = license.price;
    const originalAmount = license.price;
    let discountAmount = 0;
    let couponId: string | null = null;
    let appliedCouponCode: string | null = null;

    // Validate and apply coupon if provided
    if (coupon_code) {
      const validation = await this.couponService.validateCoupon(
        coupon_code,
        license_id,
        license.price,
      );

      if (!validation.is_valid) {
        throw new BadRequestException(validation.message || 'Invalid coupon code');
      }

      finalAmount = validation.final_amount;
      discountAmount = validation.discount_amount;
      appliedCouponCode = validation.code;

      // Get coupon ID for reference
      const coupon = await this.couponService.findByCode(coupon_code);
      if (coupon) {
        couponId = coupon.id;
      }
    }

    // Create a new order
    const orderData: Partial<Order> = {
      ...rest,
      license_id,
      user_id: userId,
      amount: finalAmount,
      original_amount: originalAmount,
      discount_amount: discountAmount,
      coupon_id: couponId ?? undefined,
      coupon_code: appliedCouponCode ?? undefined,
      currency: currency || license.currency,
      status: OrderStatus.PENDING,
    };
    const order = this.orderRepository.create(orderData);

    const savedOrder = await this.orderRepository.save(order);

    // Fetch full order with relations for the event
    const fullOrder = await this.orderRepository.findOne({
      where: { id: savedOrder.id },
      relations: ['user', 'license', 'license.owner'],
    });

    if (fullOrder?.user && fullOrder?.license?.owner) {
      const buyerName =
        `${fullOrder.user.first_name || ''} ${fullOrder.user.last_name || ''}`.trim() ||
        fullOrder.user.email;
      const ownerName =
        `${fullOrder.license.owner.first_name || ''} ${fullOrder.license.owner.last_name || ''}`.trim() ||
        fullOrder.license.owner.email;

      // Emit order created event
      this.eventEmitter.emit(
        OrderEventType.ORDER_CREATED,
        new OrderCreatedEvent(
          fullOrder.id,
          fullOrder,
          fullOrder.user_id,
          fullOrder.user.email,
          buyerName,
          fullOrder.license.name,
          fullOrder.license.owner_id,
          fullOrder.license.owner.email,
          ownerName,
        ),
      );
    }

    return savedOrder;
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
   * Cancel a pending order (soft delete)
   * Only the owner of the order can cancel it, and only if it's pending
   */
  async cancelPendingOrder(id: string, userId: string): Promise<Order> {
    const order = await this.findOne(id, userId);

    if (order.status !== OrderStatus.PENDING) {
      throw new BadRequestException('Only pending orders can be cancelled');
    }

    return this.updateStatus(id, OrderStatus.CANCELLED);
  }

  /**
   * Update order status
   */
  async updateStatus(id: string, status: OrderStatus): Promise<Order> {
    const order = await this.findOne(id);
    const previousStatus = order.status;

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

      // Increment coupon usage if a coupon was applied
      if (order.coupon_id) {
        try {
          await this.couponService.applyCoupon(order.coupon_id);
          this.logger.log(`Applied coupon ${order.coupon_code} for order ${order.id}`);
        } catch (error) {
          this.logger.error(`Failed to apply coupon ${order.coupon_code}: ${error}`);
        }
      }

      // For subscription-based licenses, expiration is managed by Stripe
      // For one-time purchases (forever), no expiration is set
      // expires_at remains null for forever licenses
    }

    // If cancelling or refunding, deactivate the license
    if (status === OrderStatus.CANCELLED || status === OrderStatus.REFUNDED) {
      order.is_active = false;
    }

    const savedOrder = await this.orderRepository.save(order);

    // Emit status change events
    await this.emitOrderStatusChangeEvent(savedOrder, previousStatus, status);

    return savedOrder;
  }

  /**
   * Emit events based on order status changes
   */
  private async emitOrderStatusChangeEvent(
    order: Order,
    previousStatus: OrderStatus,
    newStatus: OrderStatus,
  ): Promise<void> {
    // Fetch full order with relations
    const fullOrder = await this.orderRepository.findOne({
      where: { id: order.id },
      relations: ['user', 'license', 'license.owner'],
    });

    if (!fullOrder?.user || !fullOrder?.license) {
      this.logger.warn(`Could not emit event for order ${order.id}: missing relations`);
      return;
    }

    const buyerName =
      `${fullOrder.user.first_name || ''} ${fullOrder.user.last_name || ''}`.trim() ||
      fullOrder.user.email;

    const ownerName = fullOrder.license.owner
      ? `${fullOrder.license.owner.first_name || ''} ${fullOrder.license.owner.last_name || ''}`.trim() ||
        fullOrder.license.owner.email
      : 'Unknown';

    switch (newStatus) {
      case OrderStatus.COMPLETED:
        this.eventEmitter.emit(
          OrderEventType.ORDER_COMPLETED,
          new OrderCompletedEvent(
            fullOrder.id,
            fullOrder,
            fullOrder.user_id,
            fullOrder.user.email,
            buyerName,
            fullOrder.license.name,
            fullOrder.license.owner_id,
            fullOrder.license.owner?.email || '',
            ownerName,
            fullOrder.amount,
            fullOrder.currency,
          ),
        );
        break;

      case OrderStatus.FAILED:
        this.eventEmitter.emit(
          OrderEventType.ORDER_FAILED,
          new OrderFailedEvent(
            fullOrder.id,
            fullOrder,
            fullOrder.user_id,
            fullOrder.user.email,
            buyerName,
            fullOrder.license.name,
            'Payment processing failed',
          ),
        );
        break;

      case OrderStatus.CANCELLED:
        this.eventEmitter.emit(
          OrderEventType.ORDER_CANCELLED,
          new OrderCancelledEvent(
            fullOrder.id,
            fullOrder,
            fullOrder.user_id,
            fullOrder.user.email,
            buyerName,
            fullOrder.license.name,
          ),
        );
        break;

      case OrderStatus.REFUNDED:
        this.eventEmitter.emit(
          OrderEventType.ORDER_REFUNDED,
          new OrderRefundedEvent(
            fullOrder.id,
            fullOrder,
            fullOrder.user_id,
            fullOrder.user.email,
            buyerName,
            fullOrder.license.name,
            fullOrder.amount,
            fullOrder.currency,
            fullOrder.license.owner_id,
            fullOrder.license.owner?.email || '',
          ),
        );
        break;
    }
  }

  /**
   * Find orders for licenses owned by a specific user (for sellers/owners)
   */
  findOrdersByOwner(
    ownerId: string,
    filter: FilterOrdersDto,
    paginationOptions: IPaginationOptions,
  ): Promise<Pagination<Order>> {
    const { status, license_id, currency, is_active, search } = filter;

    const queryBuilder = this.orderRepository
      .createQueryBuilder('order')
      .leftJoinAndSelect('order.license', 'license')
      .leftJoinAndSelect('license.projects', 'project')
      .leftJoinAndSelect('order.user', 'buyer')
      .where('license.owner_id = :ownerId', { ownerId });

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
        '(license.name ILIKE :search OR order.reference_number ILIKE :search OR buyer.email ILIKE :search)',
        { search: `%${search}%` },
      );
    }

    queryBuilder.orderBy('order.created_at', 'DESC');

    return paginate<Order>(queryBuilder, paginationOptions);
  }

  /**
   * Find a single order by ID (owner access)
   */
  async findOneByOwner(id: string, ownerId: string): Promise<Order> {
    const order = await this.orderRepository
      .createQueryBuilder('order')
      .leftJoinAndSelect('order.license', 'license')
      .leftJoinAndSelect('license.projects', 'project')
      .leftJoinAndSelect('order.user', 'buyer')
      .leftJoinAndSelect('order.payments', 'payment')
      .where('order.id = :id', { id })
      .andWhere('license.owner_id = :ownerId', { ownerId })
      .getOne();

    if (!order) {
      throw new NotFoundException(`Order with ID ${id} not found or not accessible`);
    }

    return order;
  }

  /**
   * Get sales analytics for an owner
   */
  async getSalesAnalytics(
    ownerId: string,
    startDate?: Date,
    endDate?: Date,
  ): Promise<{
    totalOrders: number;
    completedOrders: number;
    pendingOrders: number;
    failedOrders: number;
    cancelledOrders: number;
    refundedOrders: number;
    totalRevenue: number;
    pendingRevenue: number;
    averageOrderValue: number;
    conversionRate: number;
  }> {
    const queryBuilder = this.orderRepository
      .createQueryBuilder('order')
      .leftJoin('order.license', 'license')
      .where('license.owner_id = :ownerId', { ownerId });

    if (startDate && endDate) {
      queryBuilder.andWhere('order.created_at BETWEEN :startDate AND :endDate', {
        startDate,
        endDate,
      });
    }

    const orders = await queryBuilder.getMany();

    const totalOrders = orders.length;
    const completedOrders = orders.filter(o => o.status === OrderStatus.COMPLETED).length;
    const pendingOrders = orders.filter(o => o.status === OrderStatus.PENDING).length;
    const failedOrders = orders.filter(o => o.status === OrderStatus.FAILED).length;
    const cancelledOrders = orders.filter(o => o.status === OrderStatus.CANCELLED).length;
    const refundedOrders = orders.filter(o => o.status === OrderStatus.REFUNDED).length;

    const completedOrdersList = orders.filter(o => o.status === OrderStatus.COMPLETED);
    const totalRevenue = completedOrdersList.reduce((sum, o) => sum + o.amount, 0);
    const pendingRevenue = orders
      .filter(o => o.status === OrderStatus.PENDING)
      .reduce((sum, o) => sum + o.amount, 0);

    const averageOrderValue = completedOrders > 0 ? totalRevenue / completedOrders : 0;
    const conversionRate = totalOrders > 0 ? (completedOrders / totalOrders) * 100 : 0;

    return {
      totalOrders,
      completedOrders,
      pendingOrders,
      failedOrders,
      cancelledOrders,
      refundedOrders,
      totalRevenue,
      pendingRevenue,
      averageOrderValue: Math.round(averageOrderValue * 100) / 100,
      conversionRate: Math.round(conversionRate * 100) / 100,
    };
  }

  /**
   * Get sales trends over time for an owner
   */
  async getSalesTrends(
    ownerId: string,
    startDate: Date,
    endDate: Date,
    groupBy: 'day' | 'week' | 'month' = 'day',
  ): Promise<{ date: string; orderCount: number; revenue: number }[]> {
    let dateFormat: string;
    switch (groupBy) {
      case 'week':
        dateFormat = 'YYYY-WW';
        break;
      case 'month':
        dateFormat = 'YYYY-MM';
        break;
      default:
        dateFormat = 'YYYY-MM-DD';
    }

    const result = await this.orderRepository
      .createQueryBuilder('order')
      .select(`TO_CHAR(order.created_at, '${dateFormat}')`, 'date')
      .addSelect('COUNT(*)', 'orderCount')
      .addSelect(
        'COALESCE(SUM(CASE WHEN order.status = :completed THEN order.amount ELSE 0 END), 0)',
        'revenue',
      )
      .leftJoin('order.license', 'license')
      .where('license.owner_id = :ownerId', { ownerId })
      .andWhere('order.created_at BETWEEN :startDate AND :endDate', { startDate, endDate })
      .setParameter('completed', OrderStatus.COMPLETED)
      .groupBy(`TO_CHAR(order.created_at, '${dateFormat}')`)
      .orderBy(`TO_CHAR(order.created_at, '${dateFormat}')`, 'ASC')
      .getRawMany<SalesTrendRawResult>();

    return result.map(r => ({
      date: r.date,
      orderCount: parseInt(r.orderCount, 10),
      revenue: parseFloat(r.revenue),
    }));
  }

  /**
   * Get top selling licenses for an owner
   */
  async getTopSellingLicenses(
    ownerId: string,
    limit: number = 5,
    startDate?: Date,
    endDate?: Date,
  ): Promise<
    {
      licenseId: string;
      licenseName: string;
      projectId: string;
      projectName: string;
      orderCount: number;
      revenue: number;
    }[]
  > {
    const queryBuilder = this.orderRepository
      .createQueryBuilder('order')
      .select('order.license_id', 'licenseId')
      .addSelect('license.name', 'licenseName')
      .addSelect('COUNT(CASE WHEN order.status = :completed THEN 1 END)', 'orderCount')
      .addSelect(
        'COALESCE(SUM(CASE WHEN order.status = :completed THEN order.amount ELSE 0 END), 0)',
        'revenue',
      )
      .leftJoin('order.license', 'license')
      .leftJoin('license.projects', 'project')
      .addSelect('project.id', 'projectId')
      .addSelect('project.name', 'projectName')
      .where('license.owner_id = :ownerId', { ownerId })
      .setParameter('completed', OrderStatus.COMPLETED);

    if (startDate && endDate) {
      queryBuilder.andWhere('order.created_at BETWEEN :startDate AND :endDate', {
        startDate,
        endDate,
      });
    }

    const result = await queryBuilder
      .groupBy('order.license_id')
      .addGroupBy('license.name')
      .addGroupBy('project.id')
      .addGroupBy('project.name')
      .orderBy('revenue', 'DESC')
      .limit(limit)
      .getRawMany<TopSellingLicenseRawResult>();

    return result.map(r => ({
      licenseId: r.licenseId,
      licenseName: r.licenseName || 'Unknown License',
      projectId: r.projectId || '',
      projectName: r.projectName || 'Unknown Project',
      orderCount: parseInt(r.orderCount, 10),
      revenue: parseFloat(r.revenue),
    }));
  }

  /**
   * Get recent orders for owner's licenses
   */
  getRecentOrdersByOwner(ownerId: string, limit: number = 10): Promise<Order[]> {
    return this.orderRepository
      .createQueryBuilder('order')
      .leftJoinAndSelect('order.license', 'license')
      .leftJoinAndSelect('order.user', 'buyer')
      .where('license.owner_id = :ownerId', { ownerId })
      .orderBy('order.created_at', 'DESC')
      .take(limit)
      .getMany();
  }

  /**
   * Get customers (buyers) for an owner's licenses with pagination
   */
  async getCustomersByOwner(
    ownerId: string,
    filter: {
      search?: string;
      status?: OrderStatus;
      sortBy?: string;
      sortDirection?: 'ASC' | 'DESC';
    },
    paginationOptions: IPaginationOptions,
  ): Promise<Pagination<CustomerStats>> {
    const { search, status, sortBy = 'totalSpent', sortDirection = 'DESC' } = filter;

    // First, get unique customers with their stats
    const subQuery = this.orderRepository
      .createQueryBuilder('order')
      .select('order.user_id', 'userId')
      .addSelect('buyer.email', 'email')
      .addSelect('buyer.first_name', 'firstName')
      .addSelect('buyer.last_name', 'lastName')
      .addSelect('buyer.profile_picture', 'profilePicture')
      .addSelect('buyer.created_at', 'userCreatedAt')
      .addSelect('COUNT(DISTINCT order.id)', 'totalOrders')
      .addSelect(
        'COUNT(DISTINCT CASE WHEN order.status = :completed THEN order.id END)',
        'completedOrders',
      )
      .addSelect(
        'COALESCE(SUM(CASE WHEN order.status = :completed THEN order.amount ELSE 0 END), 0)',
        'totalSpent',
      )
      .addSelect('MIN(order.created_at)', 'firstPurchase')
      .addSelect('MAX(order.created_at)', 'lastPurchase')
      .leftJoin('order.license', 'license')
      .leftJoin('order.user', 'buyer')
      .where('license.owner_id = :ownerId', { ownerId })
      .setParameter('completed', OrderStatus.COMPLETED)
      .groupBy('order.user_id')
      .addGroupBy('buyer.email')
      .addGroupBy('buyer.first_name')
      .addGroupBy('buyer.last_name')
      .addGroupBy('buyer.profile_picture')
      .addGroupBy('buyer.created_at');

    if (search) {
      subQuery.andWhere(
        '(buyer.email ILIKE :search OR buyer.first_name ILIKE :search OR buyer.last_name ILIKE :search)',
        { search: `%${search}%` },
      );
    }

    if (status) {
      subQuery.andWhere('order.status = :status', { status });
    }

    // Map sort fields
    const sortFieldMap: Record<string, string> = {
      totalSpent: 'totalSpent',
      totalOrders: 'totalOrders',
      lastPurchase: 'lastPurchase',
      firstPurchase: 'firstPurchase',
      email: 'email',
    };

    const actualSortField = sortFieldMap[sortBy] || 'totalSpent';
    subQuery.orderBy(`"${actualSortField}"`, sortDirection);

    // Get total count for pagination
    const countQuery = this.orderRepository
      .createQueryBuilder('order')
      .select('COUNT(DISTINCT order.user_id)', 'count')
      .leftJoin('order.license', 'license')
      .leftJoin('order.user', 'buyer')
      .where('license.owner_id = :ownerId', { ownerId });

    if (search) {
      countQuery.andWhere(
        '(buyer.email ILIKE :search OR buyer.first_name ILIKE :search OR buyer.last_name ILIKE :search)',
        { search: `%${search}%` },
      );
    }

    const countResult = await countQuery.getRawOne<{ count: string }>();
    const totalItems = parseInt(countResult?.count || '0', 10);

    // Apply pagination
    const page = Number(paginationOptions.page) || 1;
    const limit = Number(paginationOptions.limit) || 10;
    const offset = (page - 1) * limit;

    subQuery.offset(offset).limit(limit);

    const results = await subQuery.getRawMany<CustomerStatsRaw>();

    const items: CustomerStats[] = results.map(r => ({
      userId: r.userId,
      email: r.email,
      firstName: r.firstName || '',
      lastName: r.lastName || '',
      profilePicture: r.profilePicture || null,
      userCreatedAt: new Date(r.userCreatedAt),
      totalOrders: parseInt(r.totalOrders, 10),
      completedOrders: parseInt(r.completedOrders, 10),
      totalSpent: parseFloat(r.totalSpent),
      firstPurchase: r.firstPurchase ? new Date(r.firstPurchase) : null,
      lastPurchase: r.lastPurchase ? new Date(r.lastPurchase) : null,
    }));

    const totalPages = Math.ceil(totalItems / limit);

    return {
      items,
      meta: {
        totalItems,
        itemCount: items.length,
        itemsPerPage: limit,
        totalPages,
        currentPage: page,
      },
    };
  }

  /**
   * Get customer details with their order history for an owner
   */
  async getCustomerDetailsByOwner(
    ownerId: string,
    customerId: string,
  ): Promise<CustomerDetails | null> {
    // Get customer stats
    const statsResult = await this.orderRepository
      .createQueryBuilder('order')
      .select('order.user_id', 'userId')
      .addSelect('buyer.email', 'email')
      .addSelect('buyer.first_name', 'firstName')
      .addSelect('buyer.last_name', 'lastName')
      .addSelect('buyer.profile_picture', 'profilePicture')
      .addSelect('buyer.company', 'company')
      .addSelect('buyer.created_at', 'userCreatedAt')
      .addSelect('COUNT(DISTINCT order.id)', 'totalOrders')
      .addSelect(
        'COUNT(DISTINCT CASE WHEN order.status = :completed THEN order.id END)',
        'completedOrders',
      )
      .addSelect(
        'COALESCE(SUM(CASE WHEN order.status = :completed THEN order.amount ELSE 0 END), 0)',
        'totalSpent',
      )
      .addSelect('MIN(order.created_at)', 'firstPurchase')
      .addSelect('MAX(order.created_at)', 'lastPurchase')
      .leftJoin('order.license', 'license')
      .leftJoin('order.user', 'buyer')
      .where('license.owner_id = :ownerId', { ownerId })
      .andWhere('order.user_id = :customerId', { customerId })
      .setParameter('completed', OrderStatus.COMPLETED)
      .groupBy('order.user_id')
      .addGroupBy('buyer.email')
      .addGroupBy('buyer.first_name')
      .addGroupBy('buyer.last_name')
      .addGroupBy('buyer.profile_picture')
      .addGroupBy('buyer.company')
      .addGroupBy('buyer.created_at')
      .getRawOne<CustomerStatsRaw & { company: string | null }>();

    if (!statsResult) {
      return null;
    }

    // Get order history
    const orders = await this.orderRepository
      .createQueryBuilder('order')
      .leftJoinAndSelect('order.license', 'license')
      .leftJoin('license.projects', 'project')
      .addSelect(['project.id', 'project.name'])
      .where('license.owner_id = :ownerId', { ownerId })
      .andWhere('order.user_id = :customerId', { customerId })
      .orderBy('order.created_at', 'DESC')
      .getMany();

    // Get licenses purchased
    const licenses = await this.orderRepository
      .createQueryBuilder('order')
      .select('DISTINCT license.id', 'licenseId')
      .addSelect('license.name', 'licenseName')
      .addSelect('COUNT(order.id)', 'purchaseCount')
      .leftJoin('order.license', 'license')
      .where('license.owner_id = :ownerId', { ownerId })
      .andWhere('order.user_id = :customerId', { customerId })
      .andWhere('order.status = :completed', { completed: OrderStatus.COMPLETED })
      .groupBy('license.id')
      .addGroupBy('license.name')
      .getRawMany<{ licenseId: string; licenseName: string; purchaseCount: string }>();

    return {
      userId: statsResult.userId,
      email: statsResult.email,
      firstName: statsResult.firstName || '',
      lastName: statsResult.lastName || '',
      profilePicture: statsResult.profilePicture || null,
      company: statsResult.company || null,
      userCreatedAt: new Date(statsResult.userCreatedAt),
      totalOrders: parseInt(statsResult.totalOrders, 10),
      completedOrders: parseInt(statsResult.completedOrders, 10),
      totalSpent: parseFloat(statsResult.totalSpent),
      firstPurchase: statsResult.firstPurchase ? new Date(statsResult.firstPurchase) : null,
      lastPurchase: statsResult.lastPurchase ? new Date(statsResult.lastPurchase) : null,
      orders,
      licensesOwned: licenses.map(l => ({
        licenseId: l.licenseId,
        licenseName: l.licenseName,
        purchaseCount: parseInt(l.purchaseCount, 10),
      })),
    };
  }
}
