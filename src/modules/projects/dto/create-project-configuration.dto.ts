import { Type } from 'class-transformer';
import {
  IsString,
  IsEnum,
  IsArray,
  IsOptional,
  ValidateNested,
  IsBoolean,
  IsNotEmpty,
  IsDefined,
} from 'class-validator';

import { DeploymentProvider } from '../entities/project-configuration.entity';

export enum EnvironmentVariableType {
  TEXT = 'text',
  JSON = 'json',
}

export class EnvironmentVariableDto {
  @IsNotEmpty()
  @IsString()
  key: string;

  @IsString()
  defaultValue: string;

  @IsNotEmpty()
  @IsString()
  description: string;

  @IsOptional()
  @IsString()
  video?: string;

  @IsNotEmpty()
  @IsBoolean()
  isRequired: boolean;

  @IsEnum(EnvironmentVariableType)
  @IsNotEmpty()
  type: EnvironmentVariableType;

  @IsNotEmpty()
  @IsBoolean()
  isSecret: boolean;
}

class GithubAccountDto {
  @IsNotEmpty()
  @IsString()
  username: string;

  @IsNotEmpty()
  @IsString()
  accessToken: string;

  @IsNotEmpty()
  @IsString()
  repository: string;

  @IsNotEmpty()
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
  @IsDefined()
  @IsString()
  name: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => GithubAccountDto)
  @IsNotEmpty({ each: true })
  githubAccounts: GithubAccountDto[];

  @IsNotEmpty()
  @ValidateNested()
  @Type(() => DeploymentOptionDto)
  deploymentOption: DeploymentOptionDto;
}
