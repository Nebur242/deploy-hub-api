import { Order } from '@app/modules/payment/entities/order.entity';
import { OrderStatus } from '@app/shared/enums';
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

@Injectable()
export class UserLicenseService {
  constructor(
    @InjectRepository(Order)
    private readonly orderRepository: Repository<Order>,
  ) {}

  /**
   * Check if a user has an active license
   */
  async hasActiveLicense(userId: string, projectId?: string): Promise<boolean> {
    const query = this.orderRepository
      .createQueryBuilder('order')
      .leftJoinAndSelect('order.license', 'license')
      .leftJoin('license.projects', 'project')
      .where('order.userId = :userId', { userId })
      .andWhere('order.status = :status', { status: OrderStatus.COMPLETED })
      .andWhere('order.isActive = :isActive', { isActive: true })
      .andWhere('order.expiresAt IS NULL OR order.expiresAt > :now', { now: new Date() });

    // If projectId is specified, filter by project
    if (projectId) {
      query.andWhere('project.id = :projectId', { projectId });
    }

    const activeOrder = await query.getOne();
    return !!activeOrder;
  }

  /**
   * Get all active licenses for a user
   */
  getUserActiveLicenses(userId: string) {
    return this.orderRepository
      .createQueryBuilder('order')
      .leftJoinAndSelect('order.license', 'license')
      .leftJoinAndSelect('license.projects', 'project')
      .where('order.userId = :userId', { userId })
      .andWhere('order.status = :status', { status: OrderStatus.COMPLETED })
      .andWhere('order.isActive = :isActive', { isActive: true })
      .andWhere('order.expiresAt IS NULL OR order.expiresAt > :now', { now: new Date() })
      .getMany();
  }

  /**
   * Get a specific active license for a user
   */
  getUserActiveLicense(userId: string, licenseId: string) {
    return this.orderRepository
      .createQueryBuilder('order')
      .leftJoinAndSelect('order.license', 'license')
      .where('order.userId = :userId', { userId })
      .andWhere('order.licenseId = :licenseId', { licenseId })
      .andWhere('order.status = :status', { status: OrderStatus.COMPLETED })
      .andWhere('order.isActive = :isActive', { isActive: true })
      .andWhere('order.expiresAt IS NULL OR order.expiresAt > :now', { now: new Date() })
      .getOne();
  }
}
