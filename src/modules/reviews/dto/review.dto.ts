import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsNotEmpty, IsOptional, IsString, IsUUID, Max, Min } from 'class-validator';

export class CreateReviewDto {
  @ApiProperty({
    description: 'Project ID',
    example: '550e8400-e29b-12d3-a456-426614174000',
  })
  @IsNotEmpty()
  @IsUUID()
  project_id: string;

  @ApiProperty({
    description: 'Rating from 1 to 5 stars',
    example: 5,
    minimum: 1,
    maximum: 5,
  })
  @IsNotEmpty()
  @IsInt()
  @Min(1)
  @Max(5)
  rating: number;

  @ApiPropertyOptional({
    description: 'Review comment',
    example: 'Great project! Very easy to use and reliable.',
  })
  @IsOptional()
  @IsString()
  comment?: string;
}

export class UpdateReviewDto {
  @ApiPropertyOptional({
    description: 'Rating from 1 to 5 stars',
    example: 4,
    minimum: 1,
    maximum: 5,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(5)
  rating?: number;

  @ApiPropertyOptional({
    description: 'Review comment',
    example: 'Updated review after more usage.',
  })
  @IsOptional()
  @IsString()
  comment?: string;
}

export class ReviewResponseDto {
  id: string;
  project_id: string;
  user_id: string;
  user?: {
    id: string;
    first_name?: string;
    last_name?: string;
    email: string;
  };
  rating: number;
  comment?: string;
  is_verified_purchase: boolean;
  helpful_count: number;
  created_at: Date;
  updated_at: Date;
}

export class ProjectReviewStatsDto {
  total_reviews: number;
  average_rating: number;
  rating_distribution: Record<number, number>;
  reviews: ReviewResponseDto[];
}

export class PaginatedReviewsDto {
  items: ReviewResponseDto[];
  meta: {
    totalItems?: number;
    itemCount: number;
    itemsPerPage: number;
    totalPages?: number;
    currentPage: number;
  };
  stats: {
    average_rating: number;
    rating_distribution: Record<number, number>;
  };
}
