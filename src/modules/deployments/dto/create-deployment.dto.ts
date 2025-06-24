import { EnvironmentVariableDto } from '@app/modules/projects/dto/create-project-configuration.dto';
import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsString, IsNotEmpty, ValidateNested, IsEnum, IsOptional, IsUUID } from 'class-validator';

import { DeplomentEnvironment } from '../entities/deployment.entity';

export class CreateDeploymentDto {
  // User identification
  @IsEnum(DeplomentEnvironment)
  @IsNotEmpty()
  environment: `${DeplomentEnvironment}`;

  @IsOptional()
  @ApiProperty({
    description: 'Deployment URL where the deployment will be accessible',
    example: 'https://example.com/deployment/12345',
  })
  @IsString()
  @IsNotEmpty()
  deploymentUrl?: string;

  @IsString()
  @IsNotEmpty()
  branch: string;

  @IsString()
  @IsUUID()
  projectId: string;

  @IsString()
  @IsUUID()
  licenseId: string;

  @IsString()
  @IsUUID()
  userLicenseId: string;

  @IsString()
  @IsNotEmpty()
  configurationId: string;

  @ValidateNested({ each: true })
  @Type(() => EnvironmentVariableDto)
  environmentVariables: EnvironmentVariableDto[];
}

export class ServiceCreateDeploymentDto extends CreateDeploymentDto {
  ownerId: string;
  siteId: string | null;
}

// batch-deployment.dto.ts
export class BatchDeploymentDto {
  @ApiProperty({
    type: [CreateDeploymentDto],
    description: 'Array of deployments to process in batch',
  })
  @IsNotEmpty()
  deployments: CreateDeploymentDto[];
}
