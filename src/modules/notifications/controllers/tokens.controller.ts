import { CurrentUser } from '@app/core/decorators/current-user.decorator';
import { Admin, Authenticated } from '@app/core/guards/roles-auth.guard';
import { User } from '@app/modules/users/entities/user.entity';
import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  HttpStatus,
  HttpCode,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam, ApiBearerAuth } from '@nestjs/swagger';
import { Pagination } from 'nestjs-typeorm-paginate';

import { CreateTokenDto } from '../dto/create-token.dto';
import { TokenQueryDto } from '../dto/token-query.dto';
import { TokenResponseDto } from '../dto/token-response.dto';
import { UpdateTokenDto } from '../dto/update-token.dto';
import { UserTokenEntity } from '../entities/user-token.entity';
import { TokensService } from '../services/tokens.service';

@ApiTags('tokens')
@ApiBearerAuth()
@Controller('tokens')
@Authenticated()
export class TokensController {
  constructor(private readonly tokensService: TokensService) {}

  @Post()
  @ApiOperation({ summary: 'Register a new notification token for the current user' })
  @ApiResponse({
    status: 201,
    description: 'The token has been successfully registered',
    type: TokenResponseDto,
  })
  create(
    @Body() createTokenDto: CreateTokenDto,
    @CurrentUser() user: User,
  ): Promise<UserTokenEntity> {
    return this.tokensService.create(user.id, createTokenDto);
  }

  @Post(':userId')
  @Admin()
  @ApiOperation({ summary: 'Register a token for a specific user (Admin only)' })
  @ApiParam({ name: 'userId', description: 'User ID' })
  @ApiResponse({
    status: 201,
    description: 'The token has been successfully registered',
    type: TokenResponseDto,
  })
  createForUser(
    @Param('userId') userId: string,
    @Body() createTokenDto: CreateTokenDto,
  ): Promise<UserTokenEntity> {
    return this.tokensService.create(userId, createTokenDto);
  }

  @Get()
  @Admin()
  @ApiOperation({ summary: 'Get paginated user tokens (Admin only)' })
  @ApiResponse({
    status: 200,
    description: 'Return a paginated list of user tokens',
    schema: {
      properties: {
        items: {
          type: 'array',
          items: { $ref: '#/components/schemas/TokenResponseDto' },
        },
        meta: {
          properties: {
            totalItems: { type: 'number' },
            itemCount: { type: 'number' },
            itemsPerPage: { type: 'number' },
            totalPages: { type: 'number' },
            currentPage: { type: 'number' },
          },
          type: 'object',
        },
      },
    },
  })
  findAll(@Query() queryDto: TokenQueryDto): Promise<Pagination<UserTokenEntity>> {
    const options = {
      page: queryDto.page || 1,
      limit: queryDto.limit || 10,
    };

    return this.tokensService.findAll(options, queryDto);
  }

  @Get('me')
  @ApiOperation({ summary: 'Get tokens for the current user' })
  @ApiResponse({
    status: 200,
    description: 'Return tokens for the current user',
    type: TokenResponseDto,
  })
  findMine(@CurrentUser() user: User): Promise<UserTokenEntity> {
    return this.tokensService.findOne(user.id);
  }

  @Get(':userId')
  @Admin()
  @ApiOperation({ summary: 'Get tokens for a specific user (Admin only)' })
  @ApiParam({ name: 'userId', description: 'User ID' })
  @ApiResponse({
    status: 200,
    description: 'Return tokens for the specified user',
    type: TokenResponseDto,
  })
  @ApiResponse({
    status: 404,
    description: 'User tokens not found',
  })
  findOne(@Param('userId') userId: string): Promise<UserTokenEntity> {
    return this.tokensService.findOne(userId);
  }

  @Patch('me')
  @ApiOperation({ summary: 'Update tokens for the current user' })
  @ApiResponse({
    status: 200,
    description: 'The user tokens have been successfully updated',
    type: TokenResponseDto,
  })
  updateMine(@CurrentUser() user: User, @Body() updateTokenDto: UpdateTokenDto) {
    return this.tokensService.update(user.id, updateTokenDto);
  }

  @Patch(':userId')
  @Admin()
  @ApiOperation({ summary: 'Update tokens for a specific user (Admin only)' })
  @ApiParam({ name: 'userId', description: 'User ID' })
  @ApiResponse({
    status: 200,
    description: 'The user tokens have been successfully updated',
    type: TokenResponseDto,
  })
  @ApiResponse({
    status: 404,
    description: 'User tokens not found',
  })
  update(@Param('userId') userId: string, @Body() updateTokenDto: UpdateTokenDto) {
    return this.tokensService.update(userId, updateTokenDto);
  }

  @Delete('me')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete all tokens for the current user' })
  @ApiResponse({
    status: 204,
    description: 'The tokens have been successfully deleted',
  })
  removeAllMine(@CurrentUser() user: User): Promise<{ deleted: boolean }> {
    return this.tokensService.remove(user.id);
  }

  @Delete(':userId')
  @Admin()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete all tokens for a specific user (Admin only)' })
  @ApiParam({ name: 'userId', description: 'User ID' })
  @ApiResponse({
    status: 204,
    description: 'The tokens have been successfully deleted',
  })
  @ApiResponse({
    status: 404,
    description: 'User tokens not found',
  })
  remove(@Param('userId') userId: string): Promise<{ deleted: boolean }> {
    return this.tokensService.remove(userId);
  }

  @Delete('me/tokens')
  @ApiOperation({ summary: 'Remove specific tokens for the current user' })
  @ApiResponse({
    status: 200,
    description: 'The specific tokens have been removed',
    type: TokenResponseDto,
  })
  removeTokensForCurrentUser(@CurrentUser() user: User, @Body() tokens: string[]) {
    return this.tokensService.removeTokens(user.id, tokens);
  }

  @Delete(':userId/tokens')
  @Admin()
  @ApiOperation({ summary: 'Remove specific tokens for a user (Admin only)' })
  @ApiParam({ name: 'userId', description: 'User ID' })
  @ApiResponse({
    status: 200,
    description: 'The specific tokens have been removed',
    type: TokenResponseDto,
  })
  @ApiResponse({
    status: 404,
    description: 'User tokens not found',
  })
  removeTokens(@Param('userId') userId: string, @Body() tokens: string[]) {
    return this.tokensService.removeTokens(userId, tokens);
  }

  @Get('statistics')
  @Admin()
  @ApiOperation({ summary: 'Get token statistics (Admin only)' })
  @ApiResponse({
    status: 200,
    description: 'Return token statistics',
    schema: {
      properties: {
        userCount: { type: 'number' },
        tokenCount: { type: 'number' },
        byPlatform: {
          type: 'array',
          items: {
            properties: {
              platform: { type: 'string' },
              count: { type: 'number' },
            },
          },
        },
        byBrowser: {
          type: 'array',
          items: {
            properties: {
              browser: { type: 'string' },
              count: { type: 'number' },
            },
          },
        },
      },
    },
  })
  getStatistics(): Promise<{
    userCount: number;
    tokenCount: number;
    byPlatform: Array<{ platform: string; count: number }>;
    byBrowser: Array<{ browser: string; count: number }>;
  }> {
    return this.tokensService.getStatistics();
  }
}
