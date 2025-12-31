import { License } from '../../license/entities/license.entity';
import { UserLicense } from '../../license/entities/user-license.entity';
import { ProjectConfiguration } from '../../project-config/entities/project-configuration.entity';
import { Project } from '../../projects/entities/project.entity';
import { User } from '../../users/entities/user.entity';
import { CreateDeploymentDto } from '../dto/create-deployment.dto';

/**
 * Entities required for deployment creation
 */
export interface DeploymentEntities {
  project: Project;
  configuration: ProjectConfiguration;
  license: License | null;
  userLicense: UserLicense | null;
}

/**
 * Context for deployment creation
 */
export interface CreateDeploymentContext {
  dto: CreateDeploymentDto;
  user: User;
  entities: DeploymentEntities;
}

/**
 * GitHub account with runtime metadata
 */
export interface GitHubAccountWithMetadata {
  username: string;
  access_token: string;
  repository: string;
  workflow_file: string;
  available: boolean;
  failureCount: number;
  lastUsed: Date;
}

/**
 * Webhook information stored in deployment
 */
export interface WebhookInfo {
  hookId: number;
  repositoryOwner: string;
  repositoryName: string;
}

/**
 * Result of a deployment trigger operation
 */
export interface DeploymentTriggerResult {
  success: boolean;
  workflowRunId?: number;
  error?: string;
}

/**
 * Deployment cancellation result
 */
export interface DeploymentCancellationResult {
  success: boolean;
  message: string;
}
