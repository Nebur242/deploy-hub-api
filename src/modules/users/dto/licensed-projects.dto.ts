import { Visibility } from '@app/modules/projects/entities/project.entity';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsEnum, IsNumber, IsOptional, IsString, IsUUID, Min } from 'class-validator';

export class LicensedProjectsQueryDto {
  @ApiPropertyOptional({
    description: 'Page number for pagination',
    default: 1,
    minimum: 1,
  })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Type(() => Number)
  page?: number = 1;

  @ApiPropertyOptional({
    description: 'Number of items per page',
    default: 10,
    minimum: 1,
  })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Type(() => Number)
  limit?: number = 10;

  @ApiPropertyOptional({
    description: 'Filter by project visibility',
    enum: Visibility,
  })
  @IsOptional()
  @IsEnum(Visibility)
  visibility?: Visibility;

  @ApiPropertyOptional({
    description: 'Search term to filter projects',
  })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({
    description: 'Filter by license ID',
  })
  @IsOptional()
  @IsUUID()
  licenseId?: string;
}

export class LicensedProjectsResponseDto {
  @ApiProperty({ description: 'Project ID' })
  id: string;

  @ApiProperty({ description: 'Project name' })
  name: string;

  @ApiProperty({ description: 'Project description' })
  description: string;

  @ApiProperty({ description: 'Project owner ID' })
  ownerId: string;

  @ApiProperty({ description: 'Project repository URL' })
  repository: string;

  @ApiPropertyOptional({ description: 'Project preview URL' })
  previewUrl?: string;

  @ApiPropertyOptional({ description: 'Project image' })
  image?: string;

  @ApiProperty({ description: 'License ID' })
  licenseId: string;

  @ApiProperty({ description: 'License name' })
  licenseName: string;

  @ApiProperty({ description: 'License expiration date' })
  expiresAt?: Date;
}
