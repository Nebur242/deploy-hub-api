import { CurrentUser } from '@app/core/decorators/current-user.decorator';
import { Authenticated } from '@app/core/guards/roles-auth.guard';
import { User } from '@app/modules/users/entities/user.entity';
import {
  Controller,
  Post,
  Get,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';

import { CreateCouponDto, UpdateCouponDto, ValidateCouponDto } from '../dto/coupon.dto';
import { CouponService } from '../services/coupon.service';

@Controller('coupons')
export class CouponController {
  constructor(private readonly couponService: CouponService) {}

  /**
   * Create a new coupon
   * Only project owners can create coupons
   */
  @Post()
  @Authenticated()
  create(@CurrentUser() user: User, @Body() dto: CreateCouponDto) {
    return this.couponService.create(user.id, dto);
  }

  /**
   * Get a coupon by ID (owner only)
   */
  @Get(':id')
  @Authenticated()
  getOne(@Param('id') id: string, @CurrentUser() user: User) {
    return this.couponService.getOne(id, user.id);
  }

  /**
   * Get all coupons for the current user
   */
  @Get()
  @Authenticated()
  getByOwner(
    @CurrentUser() user: User,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.couponService.getByOwner(user.id, {
      page: page ? parseInt(page.toString()) : 1,
      limit: limit ? parseInt(limit.toString()) : 10,
    });
  }

  /**
   * Get all valid coupons for the current user
   * (active, not expired, have uses remaining)
   */
  @Get('valid/list')
  @Authenticated()
  getValidCoupons(@CurrentUser() user: User) {
    return this.couponService.getValidCoupons(user.id);
  }

  /**
   * Update a coupon
   */
  @Patch(':id')
  @Authenticated()
  update(@Param('id') id: string, @CurrentUser() user: User, @Body() dto: UpdateCouponDto) {
    return this.couponService.update(id, user.id, dto);
  }

  /**
   * Delete a coupon
   */
  @Delete(':id')
  @Authenticated()
  @HttpCode(HttpStatus.NO_CONTENT)
  async delete(@Param('id') id: string, @CurrentUser() user: User) {
    await this.couponService.delete(id, user.id);
  }

  /**
   * Validate a coupon code
   * Public endpoint - can be called by anyone to validate a code
   * Used in cart/checkout to show discount amount before purchase
   */
  @Post('validate')
  validate(@Body() dto: ValidateCouponDto) {
    return this.couponService.validateCoupon(dto.code, dto.license_id, dto.base_amount);
  }
}
