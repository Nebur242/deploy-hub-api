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
  default_value: string;

  @IsNotEmpty()
  @IsString()
  description: string;

  @IsOptional()
  @IsString()
  video?: string;

  @IsNotEmpty()
  @IsBoolean()
  is_required: boolean;

  @IsEnum(EnvironmentVariableType)
  @IsNotEmpty()
  type: EnvironmentVariableType;

  @IsNotEmpty()
  @IsBoolean()
  is_secret: boolean;
}

class GithubAccountDto {
  @IsNotEmpty()
  @IsString()
  username: string;

  @IsNotEmpty()
  @IsString()
  access_token: string;

  @IsNotEmpty()
  @IsString()
  repository: string;

  @IsNotEmpty()
  @IsString()
  workflow_file: string;
}

class DeploymentOptionDto {
  @IsEnum(DeploymentProvider)
  provider: DeploymentProvider;

  @ValidateNested({ each: true })
  @Type(() => EnvironmentVariableDto)
  environment_variables: EnvironmentVariableDto[];
}

export class CreateProjectConfigurationDto {
  @IsDefined()
  @IsString()
  name: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => GithubAccountDto)
  @IsNotEmpty({ each: true })
  github_accounts: GithubAccountDto[];

  @IsNotEmpty()
  @ValidateNested()
  @Type(() => DeploymentOptionDto)
  deployment_option: DeploymentOptionDto;
}
