import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsEmail, IsNotEmpty, IsOptional, IsString, ValidateNested } from 'class-validator';

class BillingInfoDto {
  @ApiProperty({ description: 'First name of the billing contact' })
  @IsString()
  @IsNotEmpty()
  first_name: string;

  @ApiProperty({ description: 'Last name of the billing contact' })
  @IsString()
  @IsNotEmpty()
  last_name: string;

  @ApiProperty({ description: 'Email address of the billing contact' })
  @IsString()
  @IsNotEmpty()
  @IsEmail()
  email: string;

  @ApiProperty({ description: 'Company name of the billing contact', required: false })
  @IsString()
  @IsOptional()
  company?: string;

  @ApiProperty({ description: 'Street address of the billing contact', required: false })
  @IsString()
  @IsOptional()
  address?: string;

  @ApiProperty({ description: 'City of the billing contact' })
  @IsString()
  @IsNotEmpty()
  city: string;

  @ApiProperty({ description: 'State of the billing contact', required: false })
  @IsString()
  @IsOptional()
  state?: string;

  @ApiProperty({ description: 'Postal code of the billing contact', required: false })
  @IsString()
  @IsOptional()
  postal_code?: string;

  @ApiProperty({ description: 'Country of the billing contact' })
  @IsString()
  @IsNotEmpty()
  country: string;
}

export class CheckoutLicenseDto {
  @ApiProperty({ description: 'Billing information for the order' })
  @IsNotEmpty()
  @ValidateNested()
  @Type(() => BillingInfoDto)
  billing: BillingInfoDto;

  @ApiProperty({ description: 'Coupon code for discount', required: false })
  @IsString()
  @IsOptional()
  coupon_code?: string;

  @ApiProperty({ description: 'Additional notes for the order', required: false })
  @IsString()
  @IsOptional()
  notes?: string;
}
