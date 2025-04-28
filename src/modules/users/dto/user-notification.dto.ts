import { IsBoolean, IsOptional } from 'class-validator';

export class UserNotificationDto {
  @IsOptional()
  @IsBoolean()
  projectUpdates?: boolean;

  @IsOptional()
  @IsBoolean()
  deploymentAlerts?: boolean;

  @IsOptional()
  @IsBoolean()
  licenseExpiration?: boolean;

  @IsOptional()
  @IsBoolean()
  marketing?: boolean;
}
