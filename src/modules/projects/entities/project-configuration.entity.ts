import { EncryptionService } from '@app/common/encryption/encryption.service';
import {
  Column,
  Entity,
  ManyToOne,
  PrimaryGeneratedColumn,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
  BeforeInsert,
  BeforeUpdate,
} from 'typeorm';

import { Project } from './project.entity';
import { EnvironmentVariableDto } from '../dto/create-project-configuration.dto';

export enum DeploymentProvider {
  NETLIFY = 'netlify',
  VERCEL = 'vercel',
}

@Entity('project_configurations')
export class ProjectConfiguration {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'project_id' })
  projectId: string;

  @Column({ type: 'jsonb' })
  githubAccounts: {
    username: string;
    accessToken: string;
    repository: string;
    workflowFile: string;
  }[];

  @Column({ type: 'jsonb' })
  deploymentOption: {
    provider: DeploymentProvider;
    environmentVariables: EnvironmentVariableDto[];
  };

  @ManyToOne(() => Project, project => project.configurations, {
    onDelete: 'CASCADE',
    onUpdate: 'CASCADE',
  })
  @JoinColumn({ name: 'project_id' })
  project: Project;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  // Temporary field to hold decrypted values in memory
  private decryptedAccessTokens: Record<number, string> = {};

  // Method to decrypt sensitive data - now takes encryptionService as parameter
  decryptSensitiveData(encryptionService: EncryptionService) {
    if (this.githubAccounts && Array.isArray(this.githubAccounts)) {
      this.githubAccounts.forEach((account, index) => {
        if (account.accessToken && account.accessToken !== '[ENCRYPTED]') {
          // Store decrypted value temporarily
          this.decryptedAccessTokens[index] = encryptionService.decrypt(account.accessToken);
          // Replace encrypted value with placeholder for extra security
          account.accessToken = '[ENCRYPTED]';
        }
      });
    }
  }

  // Method to access decrypted values when needed
  getDecryptedAccessToken(accountIndex: number): string {
    return this.decryptedAccessTokens[accountIndex];
  }

  // Now takes encryptionService as parameter
  encryptSensitiveData(encryptionService: EncryptionService) {
    if (this.githubAccounts && Array.isArray(this.githubAccounts)) {
      this.githubAccounts.forEach(account => {
        if (account.accessToken && account.accessToken !== '[ENCRYPTED]') {
          account.accessToken = encryptionService.encrypt(account.accessToken);
        }
      });
    }

    // Also encrypt sensitive environment variables
    if (this.deploymentOption?.environmentVariables) {
      this.deploymentOption.environmentVariables.forEach(envVar => {
        if (envVar.isSecret && envVar.defaultValue && envVar.defaultValue !== '[ENCRYPTED]') {
          envVar.defaultValue = encryptionService.encrypt(envVar.defaultValue);
        }
      });
    }
  }

  /**
   * Process an environment variable and encrypt its value if it's marked as secret
   * @param environmentVariable Environment variable to process
   * @param encryptionService Encryption service to use
   * @returns Processed environment variable with encrypted value if necessary
   */
  static createEnvironmentVariable(
    environmentVariable: EnvironmentVariableDto,
    encryptionService: EncryptionService,
  ): EnvironmentVariableDto {
    if (environmentVariable.isSecret && environmentVariable.defaultValue) {
      environmentVariable.defaultValue = encryptionService.encrypt(
        environmentVariable.defaultValue,
      );
    }
    return environmentVariable;
  }

  // Inject encryptionService via property
  private static injectedEncryptionService: EncryptionService;

  // Set the encryption service for the entity to use in hooks
  static setEncryptionService(encryptionService: EncryptionService): void {
    ProjectConfiguration.injectedEncryptionService = encryptionService;
  }

  // Process environment variables before insert
  @BeforeInsert()
  processEnvironmentVariablesBeforeInsert(): void {
    if (!ProjectConfiguration.injectedEncryptionService) {
      throw new Error('EncryptionService not injected into ProjectConfiguration entity');
    }

    if (this.deploymentOption?.environmentVariables) {
      this.deploymentOption.environmentVariables = this.deploymentOption.environmentVariables.map(
        envVar =>
          ProjectConfiguration.createEnvironmentVariable(
            envVar,
            ProjectConfiguration.injectedEncryptionService,
          ),
      );
    }
  }

  // Process environment variables before update
  @BeforeUpdate()
  processEnvironmentVariablesBeforeUpdate(): void {
    if (!ProjectConfiguration.injectedEncryptionService) {
      throw new Error('EncryptionService not injected into ProjectConfiguration entity');
    }

    if (this.deploymentOption?.environmentVariables) {
      this.deploymentOption.environmentVariables = this.deploymentOption.environmentVariables.map(
        envVar =>
          ProjectConfiguration.createEnvironmentVariable(
            envVar,
            ProjectConfiguration.injectedEncryptionService,
          ),
      );
    }
  }
}
