import { Transform } from 'class-transformer';
import { IsString, IsEnum, IsNumber, IsOptional, IsArray, Min, IsUUID, Max } from 'class-validator';

export class CreateCouponDto {
  @IsString()
  code: string;

  @IsEnum(['percent', 'fixed'])
  discount_type: 'percent' | 'fixed';

  @Transform(({ value }) => Number(value))
  @IsNumber()
  @Min(0)
  discount_value: number;

  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  license_ids?: string[];

  @IsOptional()
  @Transform(({ value }) => (value ? Number(value) : undefined))
  @IsNumber()
  @Min(1)
  max_uses?: number;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @Transform(({ value }) => (value ? new Date(value) : undefined))
  expires_at?: Date;
}

export class UpdateCouponDto {
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  discount_value?: number;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  expires_at?: Date;

  @IsOptional()
  is_active?: boolean;
}

export class CouponResponseDto {
  id: string;
  code: string;
  discount_type: 'percent' | 'fixed';
  discount_value: number;
  max_uses: number | null;
  current_uses: number;
  expires_at: Date | null;
  is_active: boolean;
  description: string;
  license_ids: string[];
  created_at: Date;
  updated_at: Date;
  remaining_uses?: number | null;
}

export class ValidateCouponDto {
  @IsString()
  code: string;

  @IsUUID('4')
  license_id: string;

  @IsNumber()
  @Min(0)
  base_amount: number;
}

export class CouponValidationResponseDto {
  is_valid: boolean;
  code: string;
  discount_amount: number;
  final_amount: number;
  message?: string;
}
