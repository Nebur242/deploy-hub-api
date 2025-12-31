import { Currency, LicensePeriod } from '@app/shared/enums';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsString,
  IsNumber,
  IsEnum,
  IsArray,
  IsOptional,
  Min,
  IsUUID,
  IsBoolean,
} from 'class-validator';

import { LicenseStatus } from '../entities/license.entity';

export class CreateLicenseDto {
  @ApiProperty({
    description: 'Name of the license option',
    example: 'Enterprise License',
  })
  @IsNotEmpty()
  @IsString()
  name: string;

  @ApiProperty({
    description: 'Description of the license terms and features',
    example: 'Full access to all enterprise features with priority support',
  })
  @IsString()
  description: string;

  @ApiProperty({
    description: 'Price of the license',
    example: 99.99,
    minimum: 0,
  })
  @IsNumber()
  @Min(0)
  price: number;

  @ApiPropertyOptional({
    description: 'Currency for the price',
    enum: Currency,
    default: Currency.USD,
    example: Currency.USD,
  })
  @IsEnum(Currency)
  @IsOptional()
  currency: Currency = Currency.USD;

  @ApiPropertyOptional({
    description: 'Maximum number of deployments allowed with this license (minimum 5)',
    example: 10,
    default: 5,
    minimum: 5,
  })
  @IsNumber()
  @Min(5, { message: 'Deployment limit must be at least 5' })
  @IsOptional()
  deployment_limit: number = 5;

  @ApiPropertyOptional({
    description:
      'Billing period for the license (forever = one-time purchase, others = recurring subscription)',
    enum: LicensePeriod,
    example: LicensePeriod.MONTHLY,
    default: LicensePeriod.FOREVER,
  })
  @IsEnum(LicensePeriod)
  @IsOptional()
  period: LicensePeriod = LicensePeriod.FOREVER;

  @ApiPropertyOptional({
    description: 'List of features included in this license',
    example: ['CI/CD Integration', 'Premium Support', 'Custom Domain'],
    default: [],
  })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  features: string[] = [];

  @ApiPropertyOptional({
    description: 'Indicates if the license is popular',
    example: false,
    default: false,
  })
  @IsBoolean()
  @IsOptional()
  popular: boolean = false;

  @ApiProperty({
    description: 'List of project IDs this license applies to',
    example: ['550e8400-e29b-41d4-a456-426614174000'],
    isArray: true,
    type: String,
  })
  @IsArray()
  @IsUUID(undefined, { each: true })
  project_ids: string[] = [];

  @ApiPropertyOptional({
    description: 'Status of the license option',
    enum: LicenseStatus,
    default: LicenseStatus.DRAFT,
    example: LicenseStatus.DRAFT,
  })
  @IsEnum(LicenseStatus)
  @IsOptional()
  status?: LicenseStatus = LicenseStatus.DRAFT;
}
