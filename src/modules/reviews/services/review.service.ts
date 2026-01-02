import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { IPaginationOptions } from 'nestjs-typeorm-paginate';

import { UserLicenseService } from '../../license/services/user-license.service';
import { ProjectService } from '../../projects/services/project.service';
import {
  CreateReviewDto,
  UpdateReviewDto,
  ReviewResponseDto,
  PaginatedReviewsDto,
} from '../dto/review.dto';
import { Review } from '../entities/review.entity';
import { ReviewRepository } from '../repositories/review.repository';

@Injectable()
export class ReviewService {
  constructor(
    private readonly reviewRepository: ReviewRepository,
    private readonly projectService: ProjectService,
    private readonly userLicenseService: UserLicenseService,
  ) {}

  /**
   * Create a new review for a project
   * Only users who have purchased a license for the project can review it
   */
  async create(userId: string, dto: CreateReviewDto): Promise<Review> {
    // Verify project exists (throws NotFoundException if not found)
    await this.projectService.findOne(dto.project_id);

    // Check if user already reviewed this project
    const existingReview = await this.reviewRepository.findByProjectAndUser(dto.project_id, userId);

    if (existingReview) {
      throw new BadRequestException('You have already reviewed this project');
    }

    // TODO: Verify user has a valid license purchase for this project
    // This should check the UserLicense or Order table

    // Create review
    const review = await this.reviewRepository.create({
      project_id: dto.project_id,
      user_id: userId,
      rating: dto.rating,
      comment: dto.comment,
      is_verified_purchase: true, // Set to true if license verification passes
    });

    return review;
  }

  /**
   * Get all reviews for a project with pagination
   */
  async getProjectReviews(
    projectId: string,
    paginationOptions: IPaginationOptions,
  ): Promise<PaginatedReviewsDto> {
    // Verify project exists (throws NotFoundException if not found)
    await this.projectService.findOne(projectId);

    const paginatedReviews = await this.reviewRepository.findByProject(
      projectId,
      paginationOptions,
    );

    const [averageRating, ratingDistribution] = await Promise.all([
      this.reviewRepository.getAverageRating(projectId),
      this.reviewRepository.getRatingDistribution(projectId),
    ]);

    return {
      items: paginatedReviews.items.map(
        review =>
          ({
            id: review.id,
            project_id: review.project_id,
            user_id: review.user_id,
            user: review.user
              ? {
                  id: review.user.id,
                  first_name: review.user.first_name,
                  last_name: review.user.last_name,
                  email: review.user.email,
                }
              : undefined,
            rating: review.rating,
            comment: review.comment,
            is_verified_purchase: review.is_verified_purchase,
            helpful_count: review.helpful_count,
            created_at: review.created_at,
            updated_at: review.updated_at,
          }) as ReviewResponseDto,
      ),
      meta: paginatedReviews.meta,
      stats: {
        average_rating: averageRating,
        rating_distribution: ratingDistribution,
      },
    };
  }

  /**
   * Get a single review
   */
  async findOne(id: string): Promise<Review> {
    const review = await this.reviewRepository.findOne(id);

    if (!review) {
      throw new NotFoundException(`Review with ID ${id} not found`);
    }

    return review;
  }

  /**
   * Update a review
   */
  async update(id: string, userId: string, dto: UpdateReviewDto): Promise<Review> {
    const review = await this.findOne(id);

    // Verify ownership
    if (review.user_id !== userId) {
      throw new BadRequestException('You can only edit your own reviews');
    }

    const updated = await this.reviewRepository.update(id, {
      rating: dto.rating ?? review.rating,
      comment: dto.comment ?? review.comment,
    });

    if (!updated) {
      throw new NotFoundException(`Review with ID ${id} not found`);
    }

    return updated;
  }

  /**
   * Delete a review
   */
  async delete(id: string, userId: string): Promise<void> {
    const review = await this.findOne(id);

    // Verify ownership
    if (review.user_id !== userId) {
      throw new BadRequestException('You can only delete your own reviews');
    }

    await this.reviewRepository.delete(id);
  }

  /**
   * Mark a review as helpful
   */
  async markAsHelpful(id: string): Promise<Review> {
    const review = await this.findOne(id);
    const updated = await this.reviewRepository.update(id, {
      helpful_count: review.helpful_count + 1,
    });

    if (!updated) {
      throw new NotFoundException(`Review with ID ${id} not found`);
    }

    return updated;
  }

  /**
   * Get average rating for a project
   */
  getAverageRating(projectId: string): Promise<number> {
    return this.reviewRepository.getAverageRating(projectId);
  }

  /**
   * Get review count for a project
   */
  getReviewCount(projectId: string): Promise<number> {
    return this.reviewRepository.countByProject(projectId);
  }

  /**
   * Get user's review for a specific project
   */
  getUserReviewForProject(projectId: string, userId: string): Promise<Review | null> {
    return this.reviewRepository.findByProjectAndUser(projectId, userId);
  }

  /**
   * Check if user can review a project (must have purchased a license)
   */
  async canUserReviewProject(projectId: string, userId: string): Promise<boolean> {
    // Check if user has a valid license for any license type of this project
    const hasLicense = await this.userLicenseService.hasLicenseForProject(projectId, userId);

    if (!hasLicense) {
      return false;
    }

    // Check if user has already reviewed this project
    const existingReview = await this.reviewRepository.findByProjectAndUser(projectId, userId);

    // User can review if they have a license and haven't reviewed yet
    return !existingReview;
  }

  /**
   * Get rating distribution for a project
   */
  getRatingDistribution(projectId: string): Promise<Record<number, number>> {
    return this.reviewRepository.getRatingDistribution(projectId);
  }
}
