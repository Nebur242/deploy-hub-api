import 'reflect-metadata';
import { validate } from '../env.validation';

describe('EnvironmentVariables', function (this: void) {
  describe('validate', function (this: void) {
    it('should validate a correct postgres configuration', function (this: void) {
      // Arrange
      const mockConfig = {
        FIREBASE_TYPE: 'service_account',
        FIREBASE_PROJECT_ID: 'test-project',
        FIREBASE_PRIVATE_KEY_ID: 'private-key-id',
        FIREBASE_PRIVATE_KEY: 'private-key',
        FIREBASE_CLIENT_EMAIL: 'client@example.com',
        FIREBASE_CLIENT_ID: 'client-id',
        FIREBASE_AUTH_URI: 'https://accounts.google.com/o/oauth2/auth',
        FIREBASE_TOKEN_URI: 'https://oauth2.googleapis.com/token',
        FIREBASE_AUTH_PROVIDER_X509_CERT_URL: 'https://www.googleapis.com/oauth2/v1/certs',
        FIREBASE_CLIENT_X509_CERT_URL: 'https://www.googleapis.com/robot/v1/metadata/x509/firebase',
        FIREBASE_REST_API_KEY: 'rest-api-key',
        NODE_ENV: 'development',
        NODE_TLS_REJECT_UNAUTHORIZED: '0',
        DB_TYPE: 'postgres',
        DB_HOST: 'localhost',
        DB_PORT: '5432',
        DB_NAME: 'testdb',
        SENTRY_DSN: 'https://sentry.io/123',
        PORT: '3000',
        DB_USERNAME: 'postgres',
        DB_PASSWORD: 'password',
        DB_SSL: 'false',
        DB_LOGGING: true, // Changed from string to boolean
        DB_SYNC: true, // Changed from string to boolean
        STAGE: 'dev',
        ENCRYPTION_KEY: 'encryption-key',
        ENCRYPTION_SALT: 'encryption-salt',
        DEPLOYMENT_TRACKER_BATCH_SIZE: '100',
        DEPLOYMENT_MAX_RUNNING_HOURS: '24',
        API_BASE_URL: 'https://api.example.com',
        REDIS_HOST: 'localhost',
        REDIS_PORT: 6379,
        REDIS_PASSWORD: 'redis-password',
        REDIS_DB: 0,
        SMTP_PORT: 587, // As number
        STRIPE_SECRET_KEY: 'sk_test_stripe_secret_key',
        STRIPE_WEBHOOK_SECRET: 'whsec_test_webhook_secret',
      };

      // Act
      const validatedConfig = validate(mockConfig);
      expect(validatedConfig.DB_PORT).toBe(5432); // Should be converted to number
      expect(validatedConfig.NODE_ENV).toBe('development');
      expect(validatedConfig.DB_TYPE).toBe('postgres');
      expect(validatedConfig.DEPLOYMENT_TRACKER_BATCH_SIZE).toBe(100);
      expect(validatedConfig.DEPLOYMENT_MAX_RUNNING_HOURS).toBe(24);
      expect(validatedConfig.API_BASE_URL).toBe('https://api.example.com');
      // Redis configuration validation
      expect(validatedConfig.REDIS_HOST).toBe('localhost');
      expect(validatedConfig.REDIS_PORT).toBe(6379);
      expect(validatedConfig.REDIS_PASSWORD).toBe('redis-password');
      expect(validatedConfig.REDIS_DB).toBe(0);
      // DB flags should be already booleans (not transformed)
      expect(validatedConfig.DB_LOGGING).toBe(true);
      expect(validatedConfig.DB_SYNC).toBe(true);
    });

    it('should validate a correct sqlite configuration', function (this: void) {
      // Arrange
      const mockConfig = {
        FIREBASE_TYPE: 'service_account',
        FIREBASE_PROJECT_ID: 'test-project',
        FIREBASE_PRIVATE_KEY_ID: 'private-key-id',
        FIREBASE_PRIVATE_KEY: 'private-key',
        FIREBASE_CLIENT_EMAIL: 'client@example.com',
        FIREBASE_CLIENT_ID: 'client-id',
        FIREBASE_AUTH_URI: 'https://accounts.google.com/o/oauth2/auth',
        FIREBASE_TOKEN_URI: 'https://oauth2.googleapis.com/token',
        FIREBASE_AUTH_PROVIDER_X509_CERT_URL: 'https://www.googleapis.com/oauth2/v1/certs',
        FIREBASE_CLIENT_X509_CERT_URL: 'https://www.googleapis.com/robot/v1/metadata/x509/firebase',
        FIREBASE_REST_API_KEY: 'rest-api-key',
        NODE_ENV: 'development',
        NODE_TLS_REJECT_UNAUTHORIZED: '0',
        DB_TYPE: 'sqlite',
        DB_NAME: 'testdb.sqlite',
        SENTRY_DSN: 'https://sentry.io/123',
        PORT: '3000',
        ENCRYPTION_KEY: 'encryption-key',
        ENCRYPTION_SALT: 'encryption-salt',
        DEPLOYMENT_TRACKER_BATCH_SIZE: '100',
        DEPLOYMENT_MAX_RUNNING_HOURS: '24',
        API_BASE_URL: 'https://api.example.com',
        // Redis configuration is required regardless of DB type
        REDIS_HOST: 'localhost',
        REDIS_PORT: 6379,
        REDIS_PASSWORD: 'redis-password',
        REDIS_DB: 0,
        SMTP_PORT: 587, // As number
        STRIPE_SECRET_KEY: 'sk_test_stripe_secret_key',
        STRIPE_WEBHOOK_SECRET: 'whsec_test_webhook_secret',
      };

      // Act
      const validatedConfig = validate(mockConfig);

      // Assert
      expect(validatedConfig).toBeDefined();
      expect(validatedConfig.DB_TYPE).toBe('sqlite');
      expect(validatedConfig.DB_NAME).toBe('testdb.sqlite');
      // Redis configuration validation
      expect(validatedConfig.REDIS_HOST).toBe('localhost');
      expect(validatedConfig.REDIS_PORT).toBe(6379);
      expect(validatedConfig.REDIS_PASSWORD).toBe('redis-password');
      expect(validatedConfig.REDIS_DB).toBe(0);
    });

    it('should allow empty Redis password when NODE_ENV is local', function (this: void) {
      // Arrange
      const mockConfig = {
        FIREBASE_TYPE: 'service_account',
        FIREBASE_PROJECT_ID: 'test-project',
        FIREBASE_PRIVATE_KEY_ID: 'private-key-id',
        FIREBASE_PRIVATE_KEY: 'private-key',
        FIREBASE_CLIENT_EMAIL: 'client@example.com',
        FIREBASE_CLIENT_ID: 'client-id',
        FIREBASE_AUTH_URI: 'https://accounts.google.com/o/oauth2/auth',
        FIREBASE_TOKEN_URI: 'https://oauth2.googleapis.com/token',
        FIREBASE_AUTH_PROVIDER_X509_CERT_URL: 'https://www.googleapis.com/oauth2/v1/certs',
        FIREBASE_CLIENT_X509_CERT_URL: 'https://www.googleapis.com/robot/v1/metadata/x509/firebase',
        FIREBASE_REST_API_KEY: 'rest-api-key',
        NODE_ENV: 'local',
        NODE_TLS_REJECT_UNAUTHORIZED: '0',
        DB_TYPE: 'postgres',
        DB_HOST: 'localhost',
        DB_PORT: '5432',
        DB_NAME: 'testdb',
        SENTRY_DSN: 'https://sentry.io/123',
        PORT: '3000',
        DB_USERNAME: 'postgres',
        DB_PASSWORD: 'password',
        ENCRYPTION_KEY: 'encryption-key',
        ENCRYPTION_SALT: 'encryption-salt',
        DEPLOYMENT_TRACKER_BATCH_SIZE: '100',
        DEPLOYMENT_MAX_RUNNING_HOURS: '24',
        API_BASE_URL: 'https://api.example.com',
        REDIS_HOST: 'localhost',
        REDIS_PORT: 6379,
        REDIS_PASSWORD: '', // Empty password should be allowed in local env
        REDIS_DB: 0,
        SMTP_PORT: 587, // As number
        STRIPE_SECRET_KEY: 'sk_test_stripe_secret_key',
        STRIPE_WEBHOOK_SECRET: 'whsec_test_webhook_secret',
      };

      // Act & Assert - should not throw error
      const validatedConfig = validate(mockConfig);
      expect(validatedConfig.REDIS_PASSWORD).toBe('');
    });

    it('should throw error for missing required fields', function (this: void) {
      // Arrange
      const mockConfig = {
        // Missing most required fields
        NODE_ENV: 'development',
        DB_TYPE: 'postgres',
      };

      // Act & Assert
      expect(() => validate(mockConfig)).toThrow();
    });

    it('should throw error for invalid NODE_ENV', function (this: void) {
      // Arrange
      const mockConfig = {
        FIREBASE_TYPE: 'service_account',
        FIREBASE_PROJECT_ID: 'test-project',
        FIREBASE_PRIVATE_KEY_ID: 'private-key-id',
        FIREBASE_PRIVATE_KEY: 'private-key',
        FIREBASE_CLIENT_EMAIL: 'client@example.com',
        FIREBASE_CLIENT_ID: 'client-id',
        FIREBASE_AUTH_URI: 'https://accounts.google.com/o/oauth2/auth',
        FIREBASE_TOKEN_URI: 'https://oauth2.googleapis.com/token',
        FIREBASE_AUTH_PROVIDER_X509_CERT_URL: 'https://www.googleapis.com/oauth2/v1/certs',
        FIREBASE_CLIENT_X509_CERT_URL: 'https://www.googleapis.com/robot/v1/metadata/x509/firebase',
        FIREBASE_REST_API_KEY: 'rest-api-key',
        NODE_ENV: 'invalid_environment', // Invalid enum value
        NODE_TLS_REJECT_UNAUTHORIZED: '0',
        DB_TYPE: 'postgres',
        DB_HOST: 'localhost',
        DB_PORT: '5432',
        DB_NAME: 'testdb',
        SENTRY_DSN: 'https://sentry.io/123',
        PORT: '3000',
        DB_USERNAME: 'postgres',
        DB_PASSWORD: 'password',
        REDIS_HOST: 'localhost',
        REDIS_PORT: 6379,
        REDIS_PASSWORD: 'redis-password',
        REDIS_DB: 0,
      };

      // Act & Assert
      expect(() => validate(mockConfig)).toThrow();
    });

    it('should throw error for invalid DB_TYPE', function (this: void) {
      // Arrange
      const mockConfig = {
        FIREBASE_TYPE: 'service_account',
        FIREBASE_PROJECT_ID: 'test-project',
        FIREBASE_PRIVATE_KEY_ID: 'private-key-id',
        FIREBASE_PRIVATE_KEY: 'private-key',
        FIREBASE_CLIENT_EMAIL: 'client@example.com',
        FIREBASE_CLIENT_ID: 'client-id',
        FIREBASE_AUTH_URI: 'https://accounts.google.com/o/oauth2/auth',
        FIREBASE_TOKEN_URI: 'https://oauth2.googleapis.com/token',
        FIREBASE_AUTH_PROVIDER_X509_CERT_URL: 'https://www.googleapis.com/oauth2/v1/certs',
        FIREBASE_CLIENT_X509_CERT_URL: 'https://www.googleapis.com/robot/v1/metadata/x509/firebase',
        FIREBASE_REST_API_KEY: 'rest-api-key',
        NODE_ENV: 'development',
        NODE_TLS_REJECT_UNAUTHORIZED: '0',
        DB_TYPE: 'mysql', // Invalid enum value
        DB_HOST: 'localhost',
        DB_PORT: '5432',
        DB_NAME: 'testdb',
        SENTRY_DSN: 'https://sentry.io/123',
        PORT: '3000',
        DB_USERNAME: 'postgres',
        DB_PASSWORD: 'password',
        REDIS_HOST: 'localhost',
        REDIS_PORT: 6379,
        REDIS_PASSWORD: 'redis-password',
        REDIS_DB: 0,
      };

      // Act & Assert
      expect(() => validate(mockConfig)).toThrow();
    });

    it('should throw error for missing postgres-specific fields when DB_TYPE is postgres', function (this: void) {
      // Arrange
      const mockConfig = {
        FIREBASE_TYPE: 'service_account',
        FIREBASE_PROJECT_ID: 'test-project',
        FIREBASE_PRIVATE_KEY_ID: 'private-key-id',
        FIREBASE_PRIVATE_KEY: 'private-key',
        FIREBASE_CLIENT_EMAIL: 'client@example.com',
        FIREBASE_CLIENT_ID: 'client-id',
        FIREBASE_AUTH_URI: 'https://accounts.google.com/o/oauth2/auth',
        FIREBASE_TOKEN_URI: 'https://oauth2.googleapis.com/token',
        FIREBASE_AUTH_PROVIDER_X509_CERT_URL: 'https://www.googleapis.com/oauth2/v1/certs',
        FIREBASE_CLIENT_X509_CERT_URL: 'https://www.googleapis.com/robot/v1/metadata/x509/firebase',
        FIREBASE_REST_API_KEY: 'rest-api-key',
        NODE_ENV: 'development',
        NODE_TLS_REJECT_UNAUTHORIZED: '0',
        DB_TYPE: 'postgres',
        // Missing: DB_HOST, DB_PORT, DB_USERNAME, DB_PASSWORD
        DB_NAME: 'testdb',
        SENTRY_DSN: 'https://sentry.io/123',
        PORT: '3000',
        REDIS_HOST: 'localhost',
        REDIS_PORT: 6379,
        REDIS_PASSWORD: 'redis-password',
        REDIS_DB: 0,
      };

      // Act & Assert
      expect(() => validate(mockConfig)).toThrow();
    });

    it('should correctly transform DB_PORT to a number', function (this: void) {
      // Arrange
      const mockConfig = {
        FIREBASE_TYPE: 'service_account',
        FIREBASE_PROJECT_ID: 'test-project',
        FIREBASE_PRIVATE_KEY_ID: 'private-key-id',
        FIREBASE_PRIVATE_KEY: 'private-key',
        FIREBASE_CLIENT_EMAIL: 'client@example.com',
        FIREBASE_CLIENT_ID: 'client-id',
        FIREBASE_AUTH_URI: 'https://accounts.google.com/o/oauth2/auth',
        FIREBASE_TOKEN_URI: 'https://oauth2.googleapis.com/token',
        FIREBASE_AUTH_PROVIDER_X509_CERT_URL: 'https://www.googleapis.com/oauth2/v1/certs',
        FIREBASE_CLIENT_X509_CERT_URL: 'https://www.googleapis.com/robot/v1/metadata/x509/firebase',
        FIREBASE_REST_API_KEY: 'rest-api-key',
        NODE_ENV: 'development',
        NODE_TLS_REJECT_UNAUTHORIZED: '0',
        DB_TYPE: 'postgres',
        DB_HOST: 'localhost',
        DB_PORT: '5432', // String port
        DB_NAME: 'testdb',
        SENTRY_DSN: 'https://sentry.io/123',
        PORT: '3000',
        DB_USERNAME: 'postgres',
        DB_PASSWORD: 'password',
        ENCRYPTION_KEY: 'encryption-key',
        ENCRYPTION_SALT: 'encryption-salt',
        DEPLOYMENT_TRACKER_BATCH_SIZE: '100',
        DEPLOYMENT_MAX_RUNNING_HOURS: '24',
        API_BASE_URL: 'https://api.example.com',
        REDIS_HOST: 'localhost',
        REDIS_PORT: '6379', // As string to test transformation
        REDIS_PASSWORD: 'redis-password',
        REDIS_DB: '0', // As string to test transformation
        SMTP_PORT: 587, // As number
        STRIPE_SECRET_KEY: 'sk_test_stripe_secret_key',
        STRIPE_WEBHOOK_SECRET: 'whsec_test_webhook_secret',
      };

      // Act
      const validatedConfig = validate(mockConfig);

      // Assert
      expect(typeof validatedConfig.DB_PORT).toBe('number');
      expect(validatedConfig.DB_PORT).toBe(5432);
      expect(typeof validatedConfig.REDIS_PORT).toBe('number');
      expect(validatedConfig.REDIS_PORT).toBe(6379);
      expect(typeof validatedConfig.REDIS_DB).toBe('number');
      expect(validatedConfig.REDIS_DB).toBe(0);
    });

    it('should exclude extraneous values', function (this: void) {
      // Arrange
      const mockConfig = {
        FIREBASE_TYPE: 'service_account',
        FIREBASE_PROJECT_ID: 'test-project',
        FIREBASE_PRIVATE_KEY_ID: 'private-key-id',
        FIREBASE_PRIVATE_KEY: 'private-key',
        FIREBASE_CLIENT_EMAIL: 'client@example.com',
        FIREBASE_CLIENT_ID: 'client-id',
        FIREBASE_AUTH_URI: 'https://accounts.google.com/o/oauth2/auth',
        FIREBASE_TOKEN_URI: 'https://oauth2.googleapis.com/token',
        FIREBASE_AUTH_PROVIDER_X509_CERT_URL: 'https://www.googleapis.com/oauth2/v1/certs',
        FIREBASE_CLIENT_X509_CERT_URL: 'https://www.googleapis.com/robot/v1/metadata/x509/firebase',
        FIREBASE_REST_API_KEY: 'rest-api-key',
        NODE_ENV: 'development',
        NODE_TLS_REJECT_UNAUTHORIZED: '0',
        DB_TYPE: 'postgres',
        DB_HOST: 'localhost',
        DB_PORT: '5432',
        DB_NAME: 'testdb',
        SENTRY_DSN: 'https://sentry.io/123',
        PORT: '3000',
        DB_USERNAME: 'postgres',
        DB_PASSWORD: 'password',
        EXTRA_FIELD: 'should not be included', // Extraneous field
        ANOTHER_EXTRA: 123, // Another extraneous field,
        ENCRYPTION_KEY: 'encryption-key',
        ENCRYPTION_SALT: 'encryption-salt',
        DEPLOYMENT_TRACKER_BATCH_SIZE: '100',
        DEPLOYMENT_MAX_RUNNING_HOURS: '24',
        API_BASE_URL: 'https://api.example.com',
        REDIS_HOST: 'localhost',
        REDIS_PORT: 6379,
        REDIS_PASSWORD: 'redis-password',
        REDIS_DB: 0,
        SMTP_PORT: 587, // As number
        STRIPE_SECRET_KEY: 'sk_test_stripe_secret_key',
        STRIPE_WEBHOOK_SECRET: 'whsec_test_webhook_secret',
      };

      // Act
      const validatedConfig = validate(mockConfig);

      // Assert
      expect('EXTRA_FIELD' in validatedConfig).toBe(false);
      expect('ANOTHER_EXTRA' in validatedConfig).toBe(false);
    });

    it('should accept optional fields when provided', function (this: void) {
      // Arrange
      const mockConfig = {
        FIREBASE_TYPE: 'service_account',
        FIREBASE_PROJECT_ID: 'test-project',
        FIREBASE_PRIVATE_KEY_ID: 'private-key-id',
        FIREBASE_PRIVATE_KEY: 'private-key',
        FIREBASE_CLIENT_EMAIL: 'client@example.com',
        FIREBASE_CLIENT_ID: 'client-id',
        FIREBASE_AUTH_URI: 'https://accounts.google.com/o/oauth2/auth',
        FIREBASE_TOKEN_URI: 'https://oauth2.googleapis.com/token',
        FIREBASE_AUTH_PROVIDER_X509_CERT_URL: 'https://www.googleapis.com/oauth2/v1/certs',
        FIREBASE_CLIENT_X509_CERT_URL: 'https://www.googleapis.com/robot/v1/metadata/x509/firebase',
        FIREBASE_REST_API_KEY: 'rest-api-key',
        NODE_ENV: 'development',
        NODE_TLS_REJECT_UNAUTHORIZED: '0',
        DB_TYPE: 'postgres',
        DB_HOST: 'localhost',
        DB_PORT: '5432',
        DB_NAME: 'testdb',
        SENTRY_DSN: 'https://sentry.io/123',
        PORT: '3000',
        DB_USERNAME: 'postgres',
        DB_PASSWORD: 'password',
        DB_SSL: 'true', // Optional field as string
        DB_LOGGING: true, // Optional field as boolean
        DB_SYNC: true, // Optional field as boolean
        STAGE: 'production', // Optional field
        ENCRYPTION_KEY: 'encryption-key',
        ENCRYPTION_SALT: 'encryption-salt',
        DEPLOYMENT_TRACKER_BATCH_SIZE: '100',
        DEPLOYMENT_MAX_RUNNING_HOURS: '24',
        API_BASE_URL: 'https://api.example.com',
        REDIS_HOST: 'localhost',
        REDIS_PORT: 6379,
        REDIS_PASSWORD: 'redis-password',
        REDIS_DB: 0,
        SMTP_PORT: 587, // As number
        STRIPE_SECRET_KEY: 'sk_test_stripe_secret_key',
        STRIPE_WEBHOOK_SECRET: 'whsec_test_webhook_secret',
      };

      // Act
      const validatedConfig = validate(mockConfig);

      // Assert
      expect(validatedConfig.DB_SSL).toBe('true');
      expect(validatedConfig.DB_LOGGING).toBe(true); // Should be boolean already
      expect(validatedConfig.DB_SYNC).toBe(true); // Should be boolean already
      expect(validatedConfig.STAGE).toBe('production');
    });

    it('should accept configuration without optional fields', function (this: void) {
      // Arrange
      const mockConfig = {
        FIREBASE_TYPE: 'service_account',
        FIREBASE_PROJECT_ID: 'test-project',
        FIREBASE_PRIVATE_KEY_ID: 'private-key-id',
        FIREBASE_PRIVATE_KEY: 'private-key',
        FIREBASE_CLIENT_EMAIL: 'client@example.com',
        FIREBASE_CLIENT_ID: 'client-id',
        FIREBASE_AUTH_URI: 'https://accounts.google.com/o/oauth2/auth',
        FIREBASE_TOKEN_URI: 'https://oauth2.googleapis.com/token',
        FIREBASE_AUTH_PROVIDER_X509_CERT_URL: 'https://www.googleapis.com/oauth2/v1/certs',
        FIREBASE_CLIENT_X509_CERT_URL: 'https://www.googleapis.com/robot/v1/metadata/x509/firebase',
        FIREBASE_REST_API_KEY: 'rest-api-key',
        NODE_ENV: 'development',
        NODE_TLS_REJECT_UNAUTHORIZED: '0',
        DB_TYPE: 'postgres',
        DB_HOST: 'localhost',
        DB_PORT: '5432',
        DB_NAME: 'testdb',
        SENTRY_DSN: 'https://sentry.io/123',
        PORT: '3000',
        DB_USERNAME: 'postgres',
        DB_PASSWORD: 'password',
        ENCRYPTION_KEY: 'encryption-key',
        ENCRYPTION_SALT: 'encryption-salt',
        DEPLOYMENT_TRACKER_BATCH_SIZE: '100',
        DEPLOYMENT_MAX_RUNNING_HOURS: '24',
        API_BASE_URL: 'https://api.example.com',
        REDIS_HOST: 'localhost',
        REDIS_PORT: 6379,
        REDIS_PASSWORD: 'redis-password',
        REDIS_DB: 0,
        SMTP_PORT: 587, // As number
        STRIPE_SECRET_KEY: 'sk_test_stripe_secret_key',
        STRIPE_WEBHOOK_SECRET: 'whsec_test_webhook_secret',
      };

      // Act
      const validatedConfig = validate(mockConfig);

      // Assert
      expect(validatedConfig.DB_SSL).toBeUndefined();
      expect(validatedConfig.DB_LOGGING).toBeUndefined();
      expect(validatedConfig.DB_SYNC).toBeUndefined();
      expect(validatedConfig.STAGE).toBeUndefined();
    });

    it('should correctly validate SMTP configuration when provided', function (this: void) {
      // Arrange
      const mockConfig = {
        FIREBASE_TYPE: 'service_account',
        FIREBASE_PROJECT_ID: 'test-project',
        FIREBASE_PRIVATE_KEY_ID: 'private-key-id',
        FIREBASE_PRIVATE_KEY: 'private-key',
        FIREBASE_CLIENT_EMAIL: 'client@example.com',
        FIREBASE_CLIENT_ID: 'client-id',
        FIREBASE_AUTH_URI: 'https://accounts.google.com/o/oauth2/auth',
        FIREBASE_TOKEN_URI: 'https://oauth2.googleapis.com/token',
        FIREBASE_AUTH_PROVIDER_X509_CERT_URL: 'https://www.googleapis.com/oauth2/v1/certs',
        FIREBASE_CLIENT_X509_CERT_URL: 'https://www.googleapis.com/robot/v1/metadata/x509/firebase',
        FIREBASE_REST_API_KEY: 'rest-api-key',
        NODE_ENV: 'development',
        NODE_TLS_REJECT_UNAUTHORIZED: '0',
        DB_TYPE: 'postgres',
        DB_HOST: 'localhost',
        DB_PORT: '5432',
        DB_NAME: 'testdb',
        SENTRY_DSN: 'https://sentry.io/123',
        PORT: '3000',
        DB_USERNAME: 'postgres',
        DB_PASSWORD: 'password',
        ENCRYPTION_KEY: 'encryption-key',
        ENCRYPTION_SALT: 'encryption-salt',
        DEPLOYMENT_TRACKER_BATCH_SIZE: '100',
        DEPLOYMENT_MAX_RUNNING_HOURS: '24',
        API_BASE_URL: 'https://api.example.com',
        REDIS_HOST: 'localhost',
        REDIS_PORT: 6379,
        REDIS_PASSWORD: 'redis-password',
        REDIS_DB: 0,
        // SMTP Configuration
        SMTP_HOST: 'smtp.example.com',
        SMTP_PORT: 587, // As number, not string
        SMTP_SECURE: false,
        SMTP_USER: 'smtp-user',
        SMTP_PASSWORD: 'smtp-password',
        SMTP_FROM_EMAIL: 'no-reply@example.com',
        SMTP_REJECT_UNAUTHORIZED: true,
        EMAIL_TEMPLATES_DIR: './templates',
        STRIPE_SECRET_KEY: 'sk_test_stripe_secret_key',
        STRIPE_WEBHOOK_SECRET: 'whsec_test_webhook_secret',
      };

      // Act
      const validatedConfig = validate(mockConfig);

      // Assert
      expect(validatedConfig.SMTP_HOST).toBe('smtp.example.com');
      expect(validatedConfig.SMTP_PORT).toBe(587); // Should be number
      expect(validatedConfig.SMTP_SECURE).toBe(false);
      expect(validatedConfig.SMTP_USER).toBe('smtp-user');
      expect(validatedConfig.SMTP_PASSWORD).toBe('smtp-password');
      expect(validatedConfig.SMTP_FROM_EMAIL).toBe('no-reply@example.com');
      expect(validatedConfig.SMTP_REJECT_UNAUTHORIZED).toBe(true);
      expect(validatedConfig.EMAIL_TEMPLATES_DIR).toBe('./templates');
    });
  });
});
