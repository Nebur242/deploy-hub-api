import { IsNotEmpty, IsString, IsNumber, IsEnum, IsArray, IsOptional, Min } from 'class-validator';

import { Currency } from '../entities/license-option.entity';

export class CreateLicenseOptionDto {
  @IsNotEmpty()
  @IsString()
  name: string;

  @IsString()
  description: string;

  @IsNumber()
  @Min(0)
  price: number;

  @IsEnum(Currency)
  @IsOptional()
  currency: Currency = Currency.USD;

  @IsNumber()
  @Min(1)
  @IsOptional()
  deploymentLimit: number = 1;

  @IsNumber()
  @Min(0)
  @IsOptional()
  duration: number = 0;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  features: string[] = [];
}
