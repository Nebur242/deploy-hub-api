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
        DB_LOGGING: 'true',
        DB_SYNC: 'true',
        STAGE: 'dev',
      };

      // Act
      const validatedConfig = validate(mockConfig);

      // Assert
      expect(validatedConfig).toBeDefined();
      expect(validatedConfig.DB_PORT).toBe(5432); // Should be converted to number
      expect(validatedConfig.NODE_ENV).toBe('development');
      expect(validatedConfig.DB_TYPE).toBe('postgres');
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
        // For sqlite, we don't need these
        // DB_HOST, DB_PORT, DB_USERNAME, DB_PASSWORD
      };

      // Act
      const validatedConfig = validate(mockConfig);

      // Assert
      expect(validatedConfig).toBeDefined();
      expect(validatedConfig.DB_TYPE).toBe('sqlite');
      expect(validatedConfig.DB_NAME).toBe('testdb.sqlite');
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
      };

      // Act
      const validatedConfig = validate(mockConfig);

      // Assert
      expect(typeof validatedConfig.DB_PORT).toBe('number');
      expect(validatedConfig.DB_PORT).toBe(5432);
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
        ANOTHER_EXTRA: 123, // Another extraneous field
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
        DB_SSL: 'true', // Optional field
        DB_LOGGING: 'true', // Optional field
        DB_SYNC: 'true', // Optional field
        STAGE: 'production', // Optional field
      };

      // Act
      const validatedConfig = validate(mockConfig);

      // Assert
      expect(validatedConfig.DB_SSL).toBe('true');
      expect(validatedConfig.DB_LOGGING).toBe(true);
      expect(validatedConfig.DB_SYNC).toBe(true);
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
        // No optional fields: DB_SSL, DB_LOGGING, DB_SYNC, STAGE
      };

      // Act
      const validatedConfig = validate(mockConfig);

      // Assert
      expect(validatedConfig.DB_SSL).toBeUndefined();
      expect(validatedConfig.DB_LOGGING).toBeUndefined();
      expect(validatedConfig.DB_SYNC).toBeUndefined();
      expect(validatedConfig.STAGE).toBeUndefined();
    });
  });
});
