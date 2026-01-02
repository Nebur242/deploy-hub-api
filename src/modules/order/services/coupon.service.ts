import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { paginate, Pagination } from 'nestjs-typeorm-paginate';
import { Repository } from 'typeorm';

import { License } from '../../license/entities/license.entity';
import { CreateCouponDto, UpdateCouponDto, CouponValidationResponseDto } from '../dto/coupon.dto';
import { Coupon } from '../entities/coupon.entity';
import { CouponRepository } from '../repositories/coupon.repository';

@Injectable()
export class CouponService {
  constructor(
    private readonly couponRepository: CouponRepository,
    @InjectRepository(License)
    private readonly licenseRepository: Repository<License>,
  ) {}

  /**
   * Create a new coupon
   */
  async create(ownerId: string, dto: CreateCouponDto): Promise<Coupon> {
    // Check if code already exists
    const existing = await this.couponRepository.findByCode(dto.code);
    if (existing) {
      throw new ConflictException(`Coupon code "${dto.code}" already exists`);
    }

    // Validate discount value
    if (dto.discount_type === 'percent' && (dto.discount_value < 0 || dto.discount_value > 100)) {
      throw new BadRequestException('Percentage discount must be between 0 and 100');
    }

    // Verify licenses exist if provided
    if (dto.license_ids && dto.license_ids.length > 0) {
      const licenses = await this.licenseRepository.findByIds(dto.license_ids);
      if (licenses.length !== dto.license_ids.length) {
        throw new BadRequestException('Some license IDs do not exist');
      }
    }

    const coupon = await this.couponRepository.create(ownerId, dto);

    return this.mapToCouponResponseDto(coupon);
  }

  /**
   * Get a coupon by ID
   */
  async getOne(id: string, ownerId?: string): Promise<Coupon> {
    const coupon = await this.couponRepository.findOne(id);

    if (!coupon) {
      throw new NotFoundException(`Coupon with ID ${id} not found`);
    }

    // If ownerId is provided, verify ownership
    if (ownerId && coupon.owner_id !== ownerId) {
      throw new BadRequestException('You can only access your own coupons');
    }

    return this.mapToCouponResponseDto(coupon);
  }

  /**
   * Get all coupons for an owner
   */
  async getByOwner(
    ownerId: string,
    options: { page?: number; limit?: number } = {},
  ): Promise<Pagination<Coupon>> {
    const page = options.page || 1;
    const limit = options.limit || 10;

    const queryBuilder = this.couponRepository
      .createQueryBuilder('coupon')
      .where('coupon.owner_id = :ownerId', { ownerId })
      .orderBy('coupon.created_at', 'DESC');

    const paginationResult = await paginate<Coupon>(queryBuilder, {
      page,
      limit,
    });

    return {
      items: paginationResult.items.map(coupon => this.mapToCouponResponseDto(coupon)),
      meta: paginationResult.meta,
      links: paginationResult.links,
    };
  }

  /**
   * Update a coupon
   */
  async update(id: string, ownerId: string, dto: UpdateCouponDto): Promise<Coupon> {
    const coupon = await this.couponRepository.findOne(id);

    if (!coupon) {
      throw new NotFoundException(`Coupon with ID ${id} not found`);
    }

    if (coupon.owner_id !== ownerId) {
      throw new BadRequestException('You can only update your own coupons');
    }

    // Validate discount value if changing
    if (dto.discount_value !== undefined) {
      if (
        coupon.discount_type === 'percent' &&
        (dto.discount_value < 0 || dto.discount_value > 100)
      ) {
        throw new BadRequestException('Percentage discount must be between 0 and 100');
      }
    }

    const updated = await this.couponRepository.update(id, dto);
    if (!updated) {
      throw new NotFoundException(`Coupon with ID ${id} not found`);
    }
    return this.mapToCouponResponseDto(updated);
  }

  /**
   * Delete a coupon
   */
  async delete(id: string, ownerId: string): Promise<void> {
    const coupon = await this.couponRepository.findOne(id);

    if (!coupon) {
      throw new NotFoundException(`Coupon with ID ${id} not found`);
    }

    if (coupon.owner_id !== ownerId) {
      throw new BadRequestException('You can only delete your own coupons');
    }

    await this.couponRepository.delete(id);
  }

  /**
   * Validate a coupon code for use in an order
   */
  async validateCoupon(
    code: string,
    licenseId: string,
    baseAmount: number,
  ): Promise<CouponValidationResponseDto> {
    const coupon = await this.couponRepository.findByCode(code);

    if (!coupon) {
      return {
        is_valid: false,
        code,
        discount_amount: 0,
        final_amount: baseAmount,
        message: 'Coupon code not found',
      };
    }

    // Check if coupon is valid
    if (!coupon.isValid()) {
      return {
        is_valid: false,
        code,
        discount_amount: 0,
        final_amount: baseAmount,
        message:
          coupon.expires_at && new Date() > coupon.expires_at
            ? 'Coupon has expired'
            : coupon.max_uses !== null && coupon.current_uses >= coupon.max_uses
              ? 'Coupon has reached maximum uses'
              : 'Coupon is no longer active',
      };
    }

    // Check if coupon applies to this license
    if (coupon.licenses && coupon.licenses.length > 0) {
      const appliesTo = coupon.licenses.some(license => license.id === licenseId);
      if (!appliesTo) {
        return {
          is_valid: false,
          code,
          discount_amount: 0,
          final_amount: baseAmount,
          message: 'Coupon does not apply to this license',
        };
      }
    }

    // Calculate discount
    const discountAmount = coupon.calculateDiscount(baseAmount);
    const finalAmount = Math.max(0, baseAmount - discountAmount);

    return {
      is_valid: true,
      code: coupon.code,
      discount_amount: discountAmount,
      final_amount: finalAmount,
    };
  }

  /**
   * Apply coupon to an order (increment usage)
   * Should be called after successful payment
   */
  async applyCoupon(couponId: string): Promise<void> {
    const coupon = await this.couponRepository.findOne(couponId);

    if (!coupon) {
      throw new NotFoundException(`Coupon with ID ${couponId} not found`);
    }

    await this.couponRepository.incrementUsage(couponId);
  }

  /**
   * Find a coupon by code (for internal use)
   */
  findByCode(code: string): Promise<Coupon | null> {
    return this.couponRepository.findByCode(code);
  }

  /**
   * Get all valid coupons for an owner
   * Used for displaying available coupons in dashboard
   */
  async getValidCoupons(ownerId: string): Promise<Coupon[]> {
    const coupons = await this.couponRepository.findValidCoupons(ownerId);
    return coupons.map(coupon => this.mapToCouponResponseDto(coupon));
  }

  /**
   * Helper method to map entity to DTO
   */
  private mapToCouponResponseDto(coupon: Coupon): Coupon {
    return coupon;
  }
}
