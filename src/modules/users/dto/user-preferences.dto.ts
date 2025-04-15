import { DeploymentProvider } from '@app/modules/projects/entities/project-configuration.entity';
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
  emailNotifications?: boolean;

  @IsOptional()
  @IsEnum(DeploymentProvider, { each: true })
  preferredDeploymentProviders?: DeploymentProvider[];
}
