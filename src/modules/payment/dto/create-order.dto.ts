import { Currency } from '@app/shared/enums';
import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  ValidateNested,
} from 'class-validator';

class BillingInfoDto {
  @ApiProperty({ description: 'First name of the billing contact' })
  @IsString()
  @IsNotEmpty()
  firstName: string;

  @ApiProperty({ description: 'Last name of the billing contact' })
  @IsString()
  @IsNotEmpty()
  lastName: string;

  @ApiProperty({ description: 'Email address of the billing contact' })
  @IsString()
  @IsNotEmpty()
  @IsEmail()
  email: string;

  @ApiProperty({ description: 'Company name of the billing contact' })
  @IsString()
  @IsOptional()
  company?: string;

  @ApiProperty({ description: 'Street address of the billing contact' })
  @IsString()
  @IsNotEmpty()
  address?: string;

  @ApiProperty({ description: 'City of the billing contact' })
  @IsString()
  @IsNotEmpty()
  city: string;

  @ApiProperty({ description: 'State of the billing contact' })
  @IsString()
  @IsNotEmpty()
  state?: string;

  @ApiProperty({ description: 'Postal code of the billing contact' })
  @IsString()
  @IsNotEmpty()
  @IsOptional()
  postalCode?: string;

  @ApiProperty({ description: 'Country of the billing contact' })
  @IsString()
  @IsNotEmpty()
  country: string;
}

export class CreateOrderDto {
  @ApiProperty({ description: 'License Option ID to purchase' })
  @IsUUID()
  @IsNotEmpty()
  licenseId: string;

  @ApiProperty({ description: 'Currency for the payment', enum: Currency, default: Currency.USD })
  @IsEnum(Currency)
  @IsOptional()
  currency?: Currency = Currency.USD;

  @ApiProperty({ description: 'Additional notes for the order', required: false })
  @IsString()
  @IsOptional()
  notes?: string;

  @ApiProperty({ description: 'Billing information for the order' })
  @IsNotEmpty()
  @ValidateNested()
  @Type(() => BillingInfoDto)
  billing: BillingInfoDto;
}
