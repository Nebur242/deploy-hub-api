import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IPaginationOptions, paginate, Pagination } from 'nestjs-typeorm-paginate';
import { Repository } from 'typeorm';

import { Review } from '../entities/review.entity';

@Injectable()
export class ReviewRepository {
  constructor(
    @InjectRepository(Review)
    private readonly repository: Repository<Review>,
  ) {}

  create(review: Partial<Review>): Promise<Review> {
    const newReview = this.repository.create(review);
    return this.repository.save(newReview);
  }

  findOne(id: string): Promise<Review | null> {
    return this.repository.findOne({
      where: { id },
      relations: ['user', 'project'],
    });
  }

  findByProjectAndUser(projectId: string, userId: string): Promise<Review | null> {
    return this.repository.findOne({
      where: { project_id: projectId, user_id: userId },
      relations: ['user'],
    });
  }

  findByProject(
    projectId: string,
    paginationOptions: IPaginationOptions,
  ): Promise<Pagination<Review>> {
    const queryBuilder = this.repository
      .createQueryBuilder('review')
      .leftJoinAndSelect('review.user', 'user')
      .where('review.project_id = :projectId', { projectId })
      .orderBy('review.created_at', 'DESC');

    return paginate<Review>(queryBuilder, paginationOptions);
  }

  async getRatingDistribution(projectId: string): Promise<{ [key in 1 | 2 | 3 | 4 | 5]: number }> {
    const distribution = await this.repository
      .createQueryBuilder('review')
      .select('review.rating', 'rating')
      .addSelect('COUNT(*)', 'count')
      .where('review.project_id = :projectId', { projectId })
      .groupBy('review.rating')
      .getRawMany<{ rating: number; count: string }>();

    const result: { [key in 1 | 2 | 3 | 4 | 5]: number } = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    distribution.forEach(item => {
      result[item.rating as 1 | 2 | 3 | 4 | 5] = parseInt(item.count, 10);
    });

    return result;
  }

  async getAverageRating(projectId: string): Promise<number> {
    const result = await this.repository
      .createQueryBuilder('review')
      .select('AVG(review.rating)', 'average')
      .where('review.project_id = :projectId', { projectId })
      .getRawOne<{ average: string }>();

    return result?.average ? Math.round(parseFloat(result.average) * 10) / 10 : 0;
  }

  async update(
    id: string,
    partial: { rating?: number; comment?: string; helpful_count?: number },
  ): Promise<Review | null> {
    await this.repository.update(id, partial);
    return this.findOne(id);
  }

  async delete(id: string): Promise<void> {
    await this.repository.delete(id);
  }

  countByProject(projectId: string): Promise<number> {
    return this.repository.count({
      where: { project_id: projectId },
    });
  }
}
