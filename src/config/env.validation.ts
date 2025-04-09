import { Environment } from '@app/shared/enums';
import { Expose, plainToInstance, Transform } from 'class-transformer';
import {
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  ValidateIf,
  validateSync,
} from 'class-validator';

export class EnvironmentVariables {
  @IsString()
  @Expose()
  FIREBASE_TYPE: string;

  @IsString()
  @Expose()
  FIREBASE_PROJECT_ID: string;

  @IsString()
  @Expose()
  FIREBASE_PRIVATE_KEY_ID: string;

  @IsString()
  @Expose()
  FIREBASE_PRIVATE_KEY: string;

  @IsString()
  @Expose()
  FIREBASE_CLIENT_EMAIL: string;

  @IsString()
  @Expose()
  FIREBASE_CLIENT_ID: string;

  @IsString()
  @Expose()
  FIREBASE_AUTH_URI: string;

  @IsString()
  @Expose()
  FIREBASE_TOKEN_URI: string;

  @IsString()
  @Expose()
  FIREBASE_AUTH_PROVIDER_X509_CERT_URL: string;

  @IsString()
  @Expose()
  FIREBASE_CLIENT_X509_CERT_URL: string;

  @IsString()
  @Expose()
  FIREBASE_REST_API_KEY: string;

  @IsEnum(Environment)
  @Expose()
  NODE_ENV: `${Environment}`;

  @IsString()
  @Expose()
  NODE_TLS_REJECT_UNAUTHORIZED: string;

  @IsEnum(['postgres', 'sqlite'])
  @Expose()
  DB_TYPE: 'postgres' | 'sqlite';

  @ValidateIf((env: EnvironmentVariables) => env.DB_TYPE !== 'sqlite')
  @IsString()
  @Expose()
  DB_HOST: string;

  @ValidateIf((env: EnvironmentVariables) => env.DB_TYPE !== 'sqlite')
  @IsNumber()
  @Expose()
  @Transform(item => parseInt(item.value as string, 10))
  DB_PORT: number;

  @IsString()
  @Expose()
  DB_NAME: string;

  @IsString()
  @Expose()
  SENTRY_DSN: string;

  @IsString()
  @Expose()
  PORT: string;

  @ValidateIf((env: EnvironmentVariables) => env.DB_TYPE !== 'sqlite')
  @IsString()
  @Expose()
  DB_USERNAME: string;

  @ValidateIf((env: EnvironmentVariables) => env.DB_TYPE !== 'sqlite')
  @IsString()
  @Expose()
  DB_PASSWORD: string;

  @ValidateIf((env: EnvironmentVariables) => env.DB_TYPE !== 'sqlite')
  @IsOptional()
  @IsString()
  @Expose()
  DB_SSL?: string;

  @IsOptional()
  @Expose()
  DB_LOGGING?: boolean;

  @IsOptional()
  @Expose()
  DB_SYNC?: boolean;

  @IsOptional()
  @IsString()
  @Expose()
  STAGE?: string;

  @IsNotEmpty()
  @IsString()
  @Expose()
  ENCRYPTION_KEY: string;
}

export const validate = (config: Record<string, unknown>) => {
  const validatedConfig = plainToInstance(EnvironmentVariables, config, {
    enableImplicitConversion: true,
    excludeExtraneousValues: true,
  });

  const errors = validateSync(validatedConfig, {
    skipMissingProperties: false,
  });

  if (errors.length > 0) {
    throw new Error(errors.toString());
  }

  return validatedConfig;
};
