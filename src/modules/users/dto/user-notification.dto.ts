import { IsBoolean, IsOptional } from 'class-validator';

export class UserNotificationDto {
  @IsOptional()
  @IsBoolean()
  project_updates?: boolean;

  @IsOptional()
  @IsBoolean()
  deployment_alerts?: boolean;

  @IsOptional()
  @IsBoolean()
  license_expiration?: boolean;

  @IsOptional()
  @IsBoolean()
  marketing?: boolean;
}
