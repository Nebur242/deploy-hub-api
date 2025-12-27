import { EnvironmentVariableDto } from '@app/modules/project-config/dto/create-project-configuration.dto';
import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsOptional, IsString, IsNotEmpty, ValidateNested, IsEnum } from 'class-validator';

import { DeplomentEnvironment } from '../entities/deployment.entity';

export class RedeployDeploymentDto {
  @IsOptional()
  @IsEnum(DeplomentEnvironment)
  @ApiProperty({
    description:
      'Environment to redeploy to (optional, will use original deployment environment if not provided)',
    example: 'production',
    enum: DeplomentEnvironment,
    required: false,
  })
  environment?: `${DeplomentEnvironment}`;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @ApiProperty({
    description:
      'Branch to redeploy from (optional, will use original deployment branch if not provided)',
    example: 'main',
    required: false,
  })
  branch?: string;

  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => EnvironmentVariableDto)
  @ApiProperty({
    description:
      'Environment variables to override (optional, will use original deployment environment variables if not provided)',
    type: [EnvironmentVariableDto],
    required: false,
  })
  environmentVariables?: EnvironmentVariableDto[];
}
