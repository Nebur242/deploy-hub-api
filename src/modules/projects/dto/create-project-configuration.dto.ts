import { Type } from 'class-transformer';
import {
  IsString,
  IsEnum,
  IsArray,
  IsOptional,
  ValidateNested,
  IsBoolean,
  IsUrl,
} from 'class-validator';

import { DeploymentProvider } from '../entities/project-configuration.entity';

export class EnvironmentVariableDto {
  @IsString()
  key: string;

  @IsString()
  defaultValue: string;

  @IsString()
  description: string;

  @IsOptional()
  @IsString()
  @IsUrl()
  video?: string;

  @IsBoolean()
  isRequired: boolean;

  @IsBoolean()
  isSecret: boolean;
}

class GithubAccountDto {
  @IsString()
  username: string;

  @IsString()
  accessToken: string;

  @IsString()
  repository: string;

  @IsString()
  workflowFile: string;
}

class DeploymentOptionDto {
  @IsEnum(DeploymentProvider)
  provider: DeploymentProvider;

  @ValidateNested({ each: true })
  @Type(() => EnvironmentVariableDto)
  environmentVariables: EnvironmentVariableDto[];
}

export class CreateProjectConfigurationDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => GithubAccountDto)
  @IsOptional()
  githubAccounts: GithubAccountDto[];

  @ValidateNested()
  @Type(() => DeploymentOptionDto)
  deploymentOption: DeploymentOptionDto;
}
