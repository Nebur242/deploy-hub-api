import { IsEnum, IsOptional, IsString } from 'class-validator';

import { DeploymentStatus } from '../entities/deployment.entity';

export class FilterDeploymentDto {
  @IsOptional()
  @IsString()
  project_id?: string;

  @IsOptional()
  @IsString()
  owner_id?: string;

  @IsOptional()
  @IsString()
  environment?: string;

  @IsOptional()
  @IsEnum(DeploymentStatus)
  status?: DeploymentStatus;

  @IsOptional()
  @IsString()
  branch?: string;

  @IsOptional()
  page?: number;

  @IsOptional()
  limit?: number = 10;
}
