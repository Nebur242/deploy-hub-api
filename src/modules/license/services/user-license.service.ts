import { Order } from '@app/modules/order/entities/order.entity';
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
      .where('userLicense.owner_id = :ownerId', { ownerId })
      .orderBy('userLicense.created_at', 'DESC');

    return paginate<UserLicense>(queryBuilder, options);
  }

  /**
   * Get all active UserLicenses for a specific user
   */
  getActiveUserLicenses(ownerId: string): Promise<UserLicense[]> {
    return this.userLicenseRepository.find({
      where: {
        owner_id: ownerId,
        active: true,
      },
      relations: ['owner', 'license'],
      order: {
        created_at: 'DESC',
      },
    });
  }

  /**
   * Get all UserLicenses (admin only)
   */
  getAllUserLicenses(
    options: IPaginationOptions,
    filters?: { owner_id?: string; active?: boolean; license_id?: string },
  ): Promise<Pagination<UserLicense>> {
    const queryBuilder = this.userLicenseRepository
      .createQueryBuilder('userLicense')
      .leftJoinAndSelect('userLicense.owner', 'owner');

    // Apply filters if provided
    if (filters?.owner_id) {
      queryBuilder.andWhere('userLicense.owner_id = :ownerId', { ownerId: filters.owner_id });
    }

    if (filters?.active !== undefined) {
      queryBuilder.andWhere('userLicense.active = :active', { active: filters.active });
    }

    if (filters?.license_id) {
      queryBuilder.andWhere('userLicense.license_id = :licenseId', {
        licenseId: filters.license_id,
      });
    }

    queryBuilder.orderBy('userLicense.created_at', 'DESC');

    return paginate<UserLicense>(queryBuilder, options);
  }
}
