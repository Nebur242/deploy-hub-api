import { Currency, OrderStatus } from '@app/shared/enums';
import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsEnum, IsNumber, IsOptional, IsString, IsUUID, Max, Min } from 'class-validator';

export class FilterOrdersDto {
  @ApiProperty({ description: 'Page number', default: 1, required: false })
  @IsNumber()
  @IsOptional()
  @Min(1)
  @Type(() => Number)
  page?: number = 1;

  @ApiProperty({ description: 'Number of items per page', default: 10, required: false })
  @IsNumber()
  @IsOptional()
  @Min(1)
  @Max(100)
  @Type(() => Number)
  limit?: number = 10;

  @ApiProperty({ description: 'Filter by order status', enum: OrderStatus, required: false })
  @IsEnum(OrderStatus)
  @IsOptional()
  status?: OrderStatus;

  @ApiProperty({ description: 'Filter by license ID', required: false })
  @IsUUID()
  @IsOptional()
  licenseId?: string;

  @ApiProperty({ description: 'Filter by currency', enum: Currency, required: false })
  @IsEnum(Currency)
  @IsOptional()
  currency?: Currency;

  @ApiProperty({ description: 'Filter by active orders', required: false })
  @IsOptional()
  @Type(() => Boolean)
  isActive?: boolean;

  @ApiProperty({ description: 'Search term', required: false })
  @IsString()
  @IsOptional()
  search?: string;
}
