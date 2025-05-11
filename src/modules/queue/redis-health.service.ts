import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

@Injectable()
export class RedisHealthService implements OnModuleInit {
  private readonly logger = new Logger(RedisHealthService.name);
  private readonly redisClient: Redis;
  private readonly redisConfig: {
    host: string;
    port: number;
    password: string;
    db: number;
  };

  constructor(private readonly configService: ConfigService) {
    this.redisConfig = {
      host: this.configService.get<string>('REDIS_HOST', 'localhost'),
      port: this.configService.get<number>('REDIS_PORT', 6379),
      password: this.configService.get<string>('REDIS_PASSWORD', ''),
      db: this.configService.get<number>('REDIS_DB', 0),
    };

    this.redisClient = new Redis(this.redisConfig);

    this.redisClient.on('error', (error: Error) => {
      this.logger.error(`Redis connection error: ${error.message}`, error.stack);
    });

    this.redisClient.on('connect', () => {
      this.logger.log('Successfully connected to Redis');
    });

    this.redisClient.on('reconnecting', () => {
      this.logger.warn('Reconnecting to Redis...');
    });
  }

  async onModuleInit() {
    this.logger.log('Checking Redis health during application startup...');
    this.logger.log(
      `Redis configuration: host=${this.redisConfig.host}, port=${this.redisConfig.port}, db=${this.redisConfig.db}`,
    );

    try {
      const isHealthy = await this.validateConnection();

      if (isHealthy) {
        this.logger.log('✅ Redis connection check successful');

        // Get and log Redis server information
        const info = await this.getRedisInfo();
        const serverInfo = this.parseRedisInfo(info);

        this.logger.log(`Redis server version: ${serverInfo.redis_version || 'unknown'}`);
        this.logger.log(`Redis memory usage: ${serverInfo.used_memory_human || 'unknown'}`);
        this.logger.log(`Redis connected clients: ${serverInfo.connected_clients || 'unknown'}`);
      } else {
        this.logger.error('❌ Redis connection validation failed - received unexpected response');
        // Don't throw here to allow the application to start even if Redis is not healthy
        // You can modify this behavior if you want to fail fast
      }
    } catch (err) {
      const error = err as Error;
      this.logger.error(`❌ Failed to connect to Redis on initialization: ${error.message}`);

      // You can uncomment the line below if you want the application to fail
      // when Redis is not available during startup
      // throw new Error(`Redis connection failed: ${error.message}`);
    }
  }

  async isHealthy(): Promise<boolean> {
    try {
      return await this.validateConnection();
    } catch (err) {
      const error = err as Error;
      this.logger.error(`Redis health check failed: ${error.message}`);
      return false;
    }
  }

  private async validateConnection(): Promise<boolean> {
    try {
      const pong = await this.redisClient.ping();
      if (pong !== 'PONG') {
        // this.logger.warn(`Redis ping response was not 'PONG', received: ${String(pong)}`);
        return false;
      }
      return true;
    } catch (err) {
      const error = err as Error;
      this.logger.error(`Redis validation failed: ${error.message}`);
      throw error;
    }
  }

  getRedisInfo(): Promise<string> {
    return this.redisClient.info();
  }

  // Parse Redis INFO command output into a key-value object
  private parseRedisInfo(info: string): Record<string, string> {
    const lines = info.split('\n');
    const result: Record<string, string> = {};

    for (const line of lines) {
      // Skip comments and empty lines
      if (line.startsWith('#') || !line.trim()) {
        continue;
      }

      const [key, value] = line.split(':');
      if (key && value) {
        result[key.trim()] = value.trim();
      }
    }

    return result;
  }
}
