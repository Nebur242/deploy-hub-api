import { Type } from 'class-transformer';
import { IsString, IsEnum, IsArray, IsOptional, IsBoolean, ValidateNested } from 'class-validator';

import { DeploymentProvider } from '../entities/project-configuration.entity';

class GithubAccountDto {
  @IsString()
  username: string;

  @IsString()
  accessToken: string;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  repositories: string[] = [];
}

class DeploymentOptionDto {
  @IsEnum(DeploymentProvider)
  provider: DeploymentProvider;

  @IsString()
  configTemplate: string;
}

class EnvironmentVariableDto {
  @IsString()
  key: string;

  @IsString()
  @IsOptional()
  defaultValue: string = '';

  @IsBoolean()
  @IsOptional()
  isRequired: boolean = false;

  @IsBoolean()
  @IsOptional()
  isSecret: boolean = false;
}

export class CreateProjectConfigurationDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => GithubAccountDto)
  @IsOptional()
  githubAccounts: GithubAccountDto[] = [];

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => DeploymentOptionDto)
  @IsOptional()
  deploymentOptions: DeploymentOptionDto[] = [];

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  buildCommands: string[] = [];

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => EnvironmentVariableDto)
  @IsOptional()
  environmentVariables: EnvironmentVariableDto[] = [];
}
