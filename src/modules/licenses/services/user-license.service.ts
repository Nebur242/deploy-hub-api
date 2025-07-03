import { Order } from '@app/modules/payment/entities/order.entity';
import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IPaginationOptions, paginate, Pagination } from 'nestjs-typeorm-paginate';
import { Repository } from 'typeorm';

import { UserLicense } from '../entities/user-license.entity';

@Injectable()
export class UserLicenseService {
  constructor(
    @InjectRepository(Order)
    private readonly orderRepository: Repository<Order>,
    @InjectRepository(UserLicense)
    private readonly userLicenseRepository: Repository<UserLicense>,
  ) {}

  /**
   * Get UserLicense by ID
   */
  async getUserLicenseById(id: string): Promise<UserLicense> {
    const userLicense = await this.userLicenseRepository.findOne({
      where: { id },
      relations: ['owner'],
    });

    if (!userLicense) {
      throw new NotFoundException(`User license with ID ${id} not found`);
    }

    return userLicense;
  }

  /**
   * Get all UserLicenses for a specific user
   */
  getUserLicenses(ownerId: string, options: IPaginationOptions): Promise<Pagination<UserLicense>> {
    const queryBuilder = this.userLicenseRepository
      .createQueryBuilder('userLicense')
      .leftJoinAndSelect('userLicense.owner', 'owner')
      .leftJoinAndSelect('userLicense.license', 'license')
      .where('userLicense.ownerId = :ownerId', { ownerId })
      .orderBy('userLicense.createdAt', 'DESC');

    return paginate<UserLicense>(queryBuilder, options);
  }

  /**
   * Get all active UserLicenses for a specific user
   */
  getActiveUserLicenses(ownerId: string): Promise<UserLicense[]> {
    return this.userLicenseRepository.find({
      where: {
        ownerId,
        active: true,
      },
      relations: ['owner', 'license'],
      order: {
        createdAt: 'DESC',
      },
    });
  }

  /**
   * Get all UserLicenses (admin only)
   */
  getAllUserLicenses(
    options: IPaginationOptions,
    filters?: { ownerId?: string; active?: boolean; licenseId?: string },
  ): Promise<Pagination<UserLicense>> {
    const queryBuilder = this.userLicenseRepository
      .createQueryBuilder('userLicense')
      .leftJoinAndSelect('userLicense.owner', 'owner');

    // Apply filters if provided
    if (filters?.ownerId) {
      queryBuilder.andWhere('userLicense.ownerId = :ownerId', { ownerId: filters.ownerId });
    }

    if (filters?.active !== undefined) {
      queryBuilder.andWhere('userLicense.active = :active', { active: filters.active });
    }

    if (filters?.licenseId) {
      queryBuilder.andWhere('userLicense.licenseId = :licenseId', { licenseId: filters.licenseId });
    }

    queryBuilder.orderBy('userLicense.createdAt', 'DESC');

    return paginate<UserLicense>(queryBuilder, options);
  }
}
