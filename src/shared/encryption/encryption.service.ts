// src/common/encryption/encryption.service.ts
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';

@Injectable()
export class EncryptionService {
  private readonly algorithm = 'aes-256-gcm';
  private readonly key: Buffer;

  constructor(private configService: ConfigService) {
    // Get encryption key from environment variables
    const encryptionKey = this.configService.get<string>('ENCRYPTION_KEY');
    const encryptionSalt = this.configService.get<string>('ENCRYPTION_SALT');
    if (!encryptionKey) {
      throw new Error('ENCRYPTION_KEY environment variable is not set');
    }
    if (!encryptionSalt) {
      throw new Error('ENCRYPTION_SALT environment variable is not set');
    }
    // Create a fixed-length key using a hash of the provided key
    // For production, store the salt in an environment variable or a secure store
    const stableSalt = Buffer.from(encryptionSalt, 'hex');
    this.key = crypto.pbkdf2Sync(encryptionKey, stableSalt, 100000, 32, 'sha256');
  }
  encrypt(text: string): string {
    // Generate a random initialization vector
    const iv = crypto.randomBytes(16);
    // Create cipher
    const cipher = crypto.createCipheriv(this.algorithm, this.key, iv);
    // Encrypt the text
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    // Get the authentication tag
    const authTag = cipher.getAuthTag();
    // Return IV + Auth Tag + Encrypted data, all as hex
    return iv.toString('hex') + ':' + authTag.toString('hex') + ':' + encrypted;
  }

  decrypt(encryptedText: string): string {
    // Split the stored data to get IV, Auth Tag and encrypted content
    const [ivHex, authTagHex, encryptedHex] = encryptedText.split(':');
    if (!ivHex || !authTagHex || !encryptedHex) {
      throw new Error('Invalid encrypted text format');
    }

    // Convert from hex
    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');

    // Create decipher
    const decipher = crypto.createDecipheriv(this.algorithm, this.key, iv);
    decipher.setAuthTag(authTag);

    // Decrypt
    try {
      let decrypted = decipher.update(encryptedHex, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      return decrypted;
    } catch (err) {
      const error = err as Error;
      if (error.message.includes('auth')) {
        throw new Error('Data integrity compromised: Authentication failed');
      }
      throw error;
    }
  }
}
