import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsObject } from 'class-validator';

export class UpgradeSubscriptionDto {
  @ApiProperty({
    description: 'Additional metadata for the upgrade',
    required: false,
    example: {
      source: 'dashboard',
      campaign: 'black-friday',
    },
  })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}
