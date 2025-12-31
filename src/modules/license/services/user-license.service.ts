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

  /**
   * Find active user license for a specific license and owner
   */
  findActiveUserLicense(licenseId: string, ownerId: string): Promise<UserLicense | null> {
    return this.userLicenseRepository.findOne({
      where: {
        license_id: licenseId,
        owner_id: ownerId,
        active: true,
      },
    });
  }

  /**
   * Increment deployment count for a user license
   * @param userLicenseId - The ID of the user license
   * @param deploymentId - The ID of the deployment to add to the history
   * @returns The updated user license
   */
  async incrementDeploymentCount(
    userLicenseId: string,
    deploymentId: string,
  ): Promise<UserLicense> {
    const userLicense = await this.getUserLicenseById(userLicenseId);

    userLicense.count = userLicense.count + 1;
    userLicense.deployments = [...(userLicense.deployments || []), deploymentId];

    return this.userLicenseRepository.save(userLicense);
  }

  /**
   * Check if user license has available deployments
   * @param userLicenseId - The ID of the user license
   * @returns True if deployments are available
   */
  async hasAvailableDeployments(userLicenseId: string): Promise<boolean> {
    const userLicense = await this.getUserLicenseById(userLicenseId);
    return userLicense.active && userLicense.count < userLicense.max_deployments;
  }

  /**
   * Get remaining deployment count for a user license
   * @param userLicenseId - The ID of the user license
   * @returns Number of remaining deployments
   */
  async getRemainingDeployments(userLicenseId: string): Promise<number> {
    const userLicense = await this.getUserLicenseById(userLicenseId);
    return Math.max(0, userLicense.max_deployments - userLicense.count);
  }

  /**
   * Save a user license
   */
  save(userLicense: UserLicense): Promise<UserLicense> {
    return this.userLicenseRepository.save(userLicense);
  }

  /**
   * Get user licenses for specific license IDs with license and project relations
   * Used for statistics calculations
   */
  getUserLicensesByLicenseIds(licenseIds: string[]): Promise<UserLicense[]> {
    if (licenseIds.length === 0) {
      return Promise.resolve([]);
    }

    return this.userLicenseRepository
      .createQueryBuilder('userLicense')
      .leftJoinAndSelect('userLicense.license', 'license')
      .leftJoinAndSelect('license.projects', 'project')
      .where('userLicense.license_id IN (:...licenseIds)', { licenseIds })
      .getMany();
  }

  /**
   * Get all user licenses for a specific owner (for user statistics)
   */
  findAllByOwner(ownerId: string): Promise<UserLicense[]> {
    return this.userLicenseRepository.find({
      where: { owner_id: ownerId },
    });
  }
}
