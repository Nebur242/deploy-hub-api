import { Currency } from '@app/shared/enums';
import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty, IsOptional, IsString, IsUUID } from 'class-validator';

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
}
