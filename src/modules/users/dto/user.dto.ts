import { Role } from '@app/shared/enums';
import { IsEnum, IsNotEmpty, IsOptional, IsString, Length } from 'class-validator';

import { UserNotification } from '../entities/user-notification.entity';
import { UserPreferences } from '../entities/user-preferences.entity';

export class CreateUserDto {
  @IsOptional()
  @IsNotEmpty()
  @IsString()
  @Length(2, 50)
  firstName?: string;

  @IsOptional()
  @IsNotEmpty()
  @IsString()
  @Length(2, 50)
  lastName?: string;

  @IsOptional()
  @IsNotEmpty()
  @IsString()
  profilePicture?: string;

  @IsNotEmpty()
  @IsString()
  uid: string;

  @IsEnum(Role, { each: true })
  roles: `${Role}`[];

  @IsOptional()
  @IsString()
  company?: string;
}

export class UpdateUserDto {
  @IsOptional()
  @IsString()
  @Length(2, 50)
  firstName?: string;

  @IsOptional()
  @IsString()
  @Length(2, 50)
  lastName?: string;

  @IsOptional()
  @IsNotEmpty()
  @IsString()
  profilePicture?: string;

  @IsOptional()
  @IsString()
  company?: string;
}

export class UserResponseDto {
  id: string;
  uid: string;
  firstName?: string;
  lastName?: string;
  company?: string;
  profilePicture?: string;
  preferences?: UserPreferences;
  notifications?: UserNotification;
  roles: `${Role}`[];
  createdAt: Date;
  updatedAt: Date;
}
