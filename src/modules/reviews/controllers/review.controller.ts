import {
  Controller,
  Post,
  Get,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';

import { CurrentUser } from '../../../core/decorators/current-user.decorator';
import { RolesGuard } from '../../../core/guards/roles-auth.guard';
import { CreateReviewDto, UpdateReviewDto } from '../dto/review.dto';
import { ReviewService } from '../services/review.service';

@Controller('reviews')
export class ReviewController {
  constructor(private readonly reviewService: ReviewService) {}

  /**
   * Create a new review
   */
  @Post()
  @UseGuards(RolesGuard)
  create(@CurrentUser('id') userId: string, @Body() dto: CreateReviewDto) {
    return this.reviewService.create(userId, dto);
  }

  /**
   * Get a single review by ID
   */
  @Get(':id')
  getOne(@Param('id') id: string) {
    return this.reviewService.findOne(id);
  }

  /**
   * Get all reviews for a project with pagination
   */
  @Get('project/:projectId')
  getProjectReviews(
    @Param('projectId') projectId: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.reviewService.getProjectReviews(projectId, {
      page: page ? Number(page) : 1,
      limit: limit ? Number(limit) : 10,
    });
  }

  /**
   * Get current user's review for a project
   */
  @Get('project/:projectId/my-review')
  @UseGuards(RolesGuard)
  getMyReview(@Param('projectId') projectId: string, @CurrentUser('id') userId: string) {
    return this.reviewService.getUserReviewForProject(projectId, userId);
  }

  /**
   * Check if user can review a project (must have purchased)
   */
  @Get('project/:projectId/can-review')
  @UseGuards(RolesGuard)
  async canReview(@Param('projectId') projectId: string, @CurrentUser('id') userId: string) {
    const canReview = await this.reviewService.canUserReviewProject(projectId, userId);
    return { canReview };
  }

  /**
   * Update a review
   */
  @Patch(':id')
  @UseGuards(RolesGuard)
  update(@Param('id') id: string, @CurrentUser('id') userId: string, @Body() dto: UpdateReviewDto) {
    return this.reviewService.update(id, userId, dto);
  }

  /**
   * Delete a review
   */
  @Delete(':id')
  @UseGuards(RolesGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  async delete(@Param('id') id: string, @CurrentUser('id') userId: string) {
    await this.reviewService.delete(id, userId);
  }

  /**
   * Mark a review as helpful
   */
  @Post(':id/helpful')
  markAsHelpful(@Param('id') id: string) {
    return this.reviewService.markAsHelpful(id);
  }

  /**
   * Get aggregate review stats for a project
   */
  @Get('project/:projectId/stats')
  async getStats(@Param('projectId') projectId: string) {
    const averageRating = await this.reviewService.getAverageRating(projectId);
    const reviewCount = await this.reviewService.getReviewCount(projectId);
    const ratingDistribution = await this.reviewService.getRatingDistribution(projectId);

    return {
      project_id: projectId,
      average_rating: averageRating,
      total_reviews: reviewCount,
      rating_distribution: ratingDistribution,
    };
  }
}
