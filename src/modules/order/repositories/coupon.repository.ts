import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository, SelectQueryBuilder } from 'typeorm';

import { License } from '../../license/entities/license.entity';
import { CreateCouponDto, UpdateCouponDto } from '../dto/coupon.dto';
import { Coupon } from '../entities/coupon.entity';

@Injectable()
export class CouponRepository {
  constructor(
    @InjectRepository(Coupon)
    private readonly repository: Repository<Coupon>,
    @InjectRepository(License)
    private readonly licenseRepository: Repository<License>,
  ) {}

  async create(ownerId: string, dto: CreateCouponDto): Promise<Coupon> {
    const coupon = this.repository.create({
      owner_id: ownerId,
      code: dto.code.toUpperCase(),
      discount_type: dto.discount_type,
      discount_value: dto.discount_value,
      max_uses: dto.max_uses ?? null,
      expires_at: dto.expires_at ?? null,
      description: dto.description ?? undefined,
    });

    // Handle license assignments if provided
    if (dto.license_ids && dto.license_ids.length > 0) {
      const licenses = await this.licenseRepository.find({
        where: { id: In(dto.license_ids) },
      });
      coupon.licenses = licenses;
    } else {
      coupon.licenses = [];
    }

    const savedCoupon = await this.repository.save(coupon);

    // Reload with relations
    return this.findOne(savedCoupon.id) as Promise<Coupon>;
  }

  findOne(id: string): Promise<Coupon | null> {
    return this.repository.findOne({
      where: { id },
      relations: ['licenses'],
    });
  }

  findByCode(code: string): Promise<Coupon | null> {
    return this.repository.findOne({
      where: { code: code.toUpperCase() },
      relations: ['licenses'],
    });
  }

  async findByOwner(
    ownerId: string,
    options: { page?: number; limit?: number } = {},
  ): Promise<{
    coupons: Coupon[];
    total: number;
  }> {
    const page = options.page ?? 1;
    const limit = options.limit ?? 10;
    const skip = (page - 1) * limit;

    const [coupons, total] = await this.repository.findAndCount({
      where: { owner_id: ownerId },
      relations: ['licenses'],
      order: { created_at: 'DESC' },
      take: limit,
      skip,
    });

    return { coupons, total };
  }

  createQueryBuilder(alias?: string): SelectQueryBuilder<Coupon> {
    return this.repository.createQueryBuilder(alias || 'coupon');
  }

  async update(id: string, dto: UpdateCouponDto): Promise<Coupon | null> {
    await this.repository.update(id, dto);

    return this.findOne(id);
  }

  async incrementUsage(id: string): Promise<void> {
    await this.repository.increment({ id }, 'current_uses', 1);
  }

  async delete(id: string): Promise<void> {
    await this.repository.delete(id);
  }

  findActiveCoupons(ownerId: string): Promise<Coupon[]> {
    return this.repository.find({
      where: {
        owner_id: ownerId,
        is_active: true,
      },
      relations: ['licenses'],
      order: { created_at: 'DESC' },
    });
  }

  /**
   * Find all coupons that are currently valid (active, not expired, have uses left)
   */
  findValidCoupons(ownerId: string): Promise<Coupon[]> {
    return this.repository
      .createQueryBuilder('coupon')
      .where('coupon.owner_id = :ownerId', { ownerId })
      .andWhere('coupon.is_active = true')
      .andWhere('(coupon.expires_at IS NULL OR coupon.expires_at > NOW())')
      .andWhere('(coupon.max_uses IS NULL OR coupon.current_uses < coupon.max_uses)')
      .orderBy('coupon.created_at', 'DESC')
      .leftJoinAndSelect('coupon.licenses', 'licenses')
      .getMany();
  }
}
