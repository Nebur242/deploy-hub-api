import { DeploymentProvider } from '@app/modules/project-config/entities/project-configuration.entity';
import { IsBoolean, IsEnum, IsOptional } from 'class-validator';

export enum Theme {
  LIGHT = 'light',
  DARK = 'dark',
  SYSTEM = 'system',
}

export class UserPreferencesDto {
  @IsOptional()
  @IsEnum(Theme)
  theme?: Theme;

  @IsOptional()
  @IsBoolean()
  @IsBoolean()
  email_notifications?: boolean;

  @IsOptional()
  @IsEnum(DeploymentProvider, { each: true })
  preferred_deployment_providers?: DeploymentProvider[];
}
