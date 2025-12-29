import { EnvironmentVariableDto } from '@app/modules/project-config/dto/create-project-configuration.dto';
import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsString,
  IsNotEmpty,
  ValidateNested,
  IsEnum,
  IsOptional,
  IsUUID,
  IsBoolean,
  IsArray,
} from 'class-validator';

import { DeplomentEnvironment } from '../entities/deployment.entity';

export class CreateDeploymentDto {
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
  deployment_url?: string;

  @IsString()
  @IsNotEmpty()
  branch: string;

  @IsString()
  @IsUUID()
  project_id: string;

  @IsOptional()
  @IsString()
  @IsUUID()
  license_id?: string;

  @IsOptional()
  @IsString()
  @IsUUID()
  user_license_id?: string;

  @IsString()
  @IsNotEmpty()
  configuration_id: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => EnvironmentVariableDto)
  environment_variables: EnvironmentVariableDto[];

  @IsOptional()
  @IsBoolean()
  @ApiProperty({
    description:
      'Whether this is a test deployment (for testing configuration before making project public)',
    example: false,
    default: false,
  })
  is_test?: boolean;
}

export class ServiceCreateDeploymentDto extends CreateDeploymentDto {
  owner_id: string;
  site_id: string | null;
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
