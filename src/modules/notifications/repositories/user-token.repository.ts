import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IPaginationOptions, paginate, Pagination } from 'nestjs-typeorm-paginate';
import { In, Repository } from 'typeorm';

import { TokenQueryDto } from '../dto/token-query.dto';
import { UserTokenEntity } from '../entities/user-token.entity';
import { NotificationType } from '../enums/notification-type.enum';

@Injectable()
export class UserTokenRepository {
  constructor(
    @InjectRepository(UserTokenEntity)
    private readonly userTokenRepository: Repository<UserTokenEntity>,
  ) {}

  /**
   * Save a token for a user
   */
  async saveToken(
    userId: string,
    token: string,
    deviceInfo?: {
      platform?: string;
      browser?: string;
      version?: string;
      deviceName?: string;
    },
  ): Promise<UserTokenEntity> {
    let userToken = await this.getUserToken(userId);

    if (!userToken) {
      userToken = this.userTokenRepository.create({
        userId,
        tokens: [token],
        type: NotificationType.SYSTEM,
      });
    } else if (!userToken.tokens.includes(token)) {
      userToken.tokens = [...userToken.tokens, token];
    }

    // Handle device info if provided
    if (deviceInfo) {
      userToken.deviceInfo = userToken.deviceInfo || [];

      // Remove any existing device info with the same token
      userToken.deviceInfo = userToken.deviceInfo.filter(device => device.token !== token);

      // Add the new device info
      userToken.deviceInfo.push({
        token,
        ...deviceInfo,
        addedAt: new Date(),
        lastActive: new Date(),
      });
    }

    return this.userTokenRepository.save(userToken);
  }

  /**
   * Get a user's token entity
   */
  getUserToken(userId: string): Promise<UserTokenEntity | null> {
    return this.userTokenRepository.findOne({ where: { userId } });
  }

  /**
   * Get multiple users' token entities
   */
  getUserTokens(userIds: string[]): Promise<UserTokenEntity[]> {
    return this.userTokenRepository.find({ where: { userId: In(userIds) } });
  }

  /**
   * Check if a user has any tokens
   */
  async hasTokens(userId: string): Promise<boolean> {
    const userToken = await this.getUserToken(userId);
    return !!userToken && userToken.tokens.length > 0;
  }

  /**
   * Remove tokens for a user
   */
  async removeTokens(userId: string, tokens: string[]): Promise<UserTokenEntity | null> {
    const userToken = await this.getUserToken(userId);

    if (!userToken) {
      return null;
    }

    userToken.tokens = userToken.tokens.filter(t => !tokens.includes(t));

    // Also remove device info for these tokens
    if (userToken.deviceInfo) {
      userToken.deviceInfo = userToken.deviceInfo.filter(device => !tokens.includes(device.token));
    }

    return this.userTokenRepository.save(userToken);
  }

  /**
   * Remove all tokens for a user
   */
  async removeAllTokens(userId: string): Promise<void> {
    await this.userTokenRepository.delete({ userId });
  }

  /**
   * Paginate user tokens with filters
   */
  paginateUserTokens(
    options: IPaginationOptions,
    filters?: TokenQueryDto,
  ): Promise<Pagination<UserTokenEntity>> {
    const queryBuilder = this.userTokenRepository.createQueryBuilder('userToken');

    const { userId, type, platform } = filters || {};

    // Apply filters if provided
    if (userId) {
      queryBuilder.andWhere('userToken.userId = :userId', { userId });
    }

    if (type) {
      queryBuilder.andWhere('userToken.type = :type', { type });
    }

    if (platform) {
      queryBuilder.andWhere('userToken.deviceInfo @> :deviceInfo', {
        deviceInfo: JSON.stringify([{ platform }]),
      });
    }

    // Order by creation date, newest first
    queryBuilder.orderBy('userToken.createdAt', 'DESC');

    return paginate<UserTokenEntity>(queryBuilder, options);
  }

  /**
   * Count users with tokens
   */
  countUsersWithTokens(): Promise<number> {
    return this.userTokenRepository.count();
  }

  /**
   * Count all tokens
   */
  async countAllTokens(): Promise<number> {
    const tokens = await this.userTokenRepository.find();
    return tokens.reduce((acc, token) => acc + token.tokens.length, 0);
  }

  /**
   * Get token statistics by platform
   */
  async getTokenStatsByPlatform(): Promise<Array<{ platform: string; count: number }>> {
    const tokens = await this.userTokenRepository.find();
    const platformCounts = {};

    tokens.forEach(userToken => {
      if (userToken.deviceInfo) {
        userToken.deviceInfo.forEach(device => {
          if (device.platform) {
            platformCounts[device.platform] = (platformCounts[device.platform] || 0) + 1;
          }
        });
      }
    });

    return Object.entries(platformCounts).map(([platform, count]) => ({
      platform,
      count: count as number,
    }));
  }

  /**
   * Get token statistics by browser
   */
  async getTokenStatsByBrowser(): Promise<Array<{ browser: string; count: number }>> {
    const tokens = await this.userTokenRepository.find();
    const browserCounts = {};

    tokens.forEach(userToken => {
      if (userToken.deviceInfo) {
        userToken.deviceInfo.forEach(device => {
          if (device.browser) {
            browserCounts[device.browser] = (browserCounts[device.browser] || 0) + 1;
          }
        });
      }
    });

    return Object.entries(browserCounts).map(([browser, count]) => ({
      browser,
      count: count as number,
    }));
  }
}
