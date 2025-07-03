import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { IPaginationOptions, Pagination } from 'nestjs-typeorm-paginate';

import { CreateTokenDto } from '../dto/create-token.dto';
import { TokenQueryDto } from '../dto/token-query.dto';
import { UpdateTokenDto } from '../dto/update-token.dto';
import { UserTokenEntity } from '../entities/user-token.entity';
import { NotificationType } from '../enums/notification-type.enum';
import { UserTokenRepository } from '../repositories/user-token.repository';

@Injectable()
export class TokensService {
  private readonly logger = new Logger(TokensService.name);

  constructor(private readonly userTokenRepository: UserTokenRepository) {}

  /**
   * Create a new token entry for a user
   */
  async create(userId: string, createTokenDto: CreateTokenDto): Promise<UserTokenEntity> {
    try {
      const { token, deviceInfo, type = NotificationType.SYSTEM } = createTokenDto;

      // Find existing or create new
      let userToken = await this.userTokenRepository.getUserToken(userId);

      if (!userToken) {
        // Create new user token entity
        userToken = new UserTokenEntity();
        userToken.userId = userId;
        userToken.tokens = [];
        userToken.type = type;
      }

      // Add token if it doesn't exist
      if (!userToken.tokens.includes(token)) {
        userToken.tokens = [...userToken.tokens, token];
      }

      // Handle device info
      if (deviceInfo) {
        userToken.deviceInfo = userToken.deviceInfo || [];

        // Remove any existing entry with the same token
        userToken.deviceInfo = userToken.deviceInfo.filter(device => device.token !== token);

        // Add new device info
        userToken.deviceInfo.push({
          token,
          ...deviceInfo,
          addedAt: new Date(),
          lastActive: new Date(),
        });
      }

      // Save and return
      return await this.userTokenRepository.saveToken(userId, token, deviceInfo);
    } catch (err) {
      const error = err as Error;
      this.logger.error(`Error creating token for user ${userId}:`, error);
      throw new BadRequestException(`Failed to create token: ${error.message}`);
    }
  }

  /**
   * Find all tokens with pagination
   */
  findAll(
    options: IPaginationOptions,
    filters?: TokenQueryDto,
  ): Promise<Pagination<UserTokenEntity>> {
    return this.userTokenRepository.paginateUserTokens(options, filters);
  }

  /**
   * Find tokens for a specific user
   */
  async findOne(userId: string): Promise<UserTokenEntity> {
    const userToken = await this.userTokenRepository.getUserToken(userId);

    if (!userToken) {
      throw new NotFoundException(`Tokens for user with ID ${userId} not found`);
    }

    return userToken;
  }

  /**
   * Check if a user has tokens
   */
  hasTokens(userId: string): Promise<boolean> {
    return this.userTokenRepository.hasTokens(userId);
  }

  /**
   * Update a user's tokens
   */
  async update(userId: string, updateTokenDto: UpdateTokenDto) {
    const userToken = await this.userTokenRepository.getUserToken(userId);

    const { type, addTokens = [], removeTokens = [] } = updateTokenDto;

    if (!userToken) {
      throw new NotFoundException(`Tokens for user with ID ${userId} not found`);
    }

    if (type) {
      userToken.type = type;
    }

    // Handle token additions
    if (addTokens.length > 0) {
      for (const tokenInfo of addTokens) {
        await this.userTokenRepository.saveToken(userId, tokenInfo.token, tokenInfo.deviceInfo);
      }
    }

    // Handle token removals
    if (removeTokens && removeTokens.length > 0) {
      await this.userTokenRepository.removeTokens(userId, removeTokens);
    }

    // Fetch and return updated record
    return this.userTokenRepository.getUserToken(userId);
  }

  /**
   * Remove all tokens for a user
   */
  async remove(userId: string): Promise<{ deleted: boolean }> {
    const userToken = await this.userTokenRepository.getUserToken(userId);

    if (!userToken) {
      throw new NotFoundException(`Tokens for user with ID ${userId} not found`);
    }

    await this.userTokenRepository.removeAllTokens(userId);
    return { deleted: true };
  }

  /**
   * Remove specific tokens for a user
   */
  async removeTokens(userId: string, tokens: string[]) {
    const userToken = await this.userTokenRepository.getUserToken(userId);

    if (!userToken) {
      throw new NotFoundException(`Tokens for user with ID ${userId} not found`);
    }

    return this.userTokenRepository.removeTokens(userId, tokens);
  }

  /**
   * Get token statistics
   */
  async getStatistics(): Promise<{
    userCount: number;
    tokenCount: number;
    byPlatform: Array<{ platform: string; count: number }>;
    byBrowser: Array<{ browser: string; count: number }>;
  }> {
    const [userCount, tokenCount, byPlatform, byBrowser] = await Promise.all([
      this.userTokenRepository.countUsersWithTokens(),
      this.userTokenRepository.countAllTokens(),
      this.userTokenRepository.getTokenStatsByPlatform(),
      this.userTokenRepository.getTokenStatsByBrowser(),
    ]);

    return {
      userCount,
      tokenCount,
      byPlatform,
      byBrowser,
    };
  }
}
