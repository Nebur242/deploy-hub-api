import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsOptional, IsUUID, IsDateString, IsNumber, Min } from 'class-validator';

export class FilterDeploymentCountDto {
  @ApiPropertyOptional({
    description: 'Filter by license ID',
    type: String,
  })
  @IsOptional()
  @IsUUID()
  licenseId?: string;

  @ApiPropertyOptional({
    description: 'Filter by owner ID',
    type: String,
  })
  @IsOptional()
  @IsUUID()
  ownerId?: string;

  @ApiPropertyOptional({
    description: 'Filter by created date (from)',
    type: Date,
  })
  @IsOptional()
  @IsDateString()
  createdFrom?: string;

  @ApiPropertyOptional({
    description: 'Filter by created date (to)',
    type: Date,
  })
  @IsOptional()
  @IsDateString()
  createdTo?: string;

  @ApiPropertyOptional({
    description: 'Filter by minimum deployment count',
    type: Number,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  minCount?: number;
}
