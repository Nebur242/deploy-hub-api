import { Role } from '@app/shared/enums';
import {
  IsDefined,
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  Length,
} from 'class-validator';

import { UserNotification } from '../entities/user-notification.entity';
import { UserPreferences } from '../entities/user-preferences.entity';

export class CreateUserDto {
  @IsOptional()
  @IsNotEmpty()
  @IsString()
  @IsString()
  @Length(2, 50)
  first_name?: string;

  @IsOptional()
  @IsNotEmpty()
  @IsString()
  @IsString()
  @Length(2, 50)
  last_name?: string;

  @IsOptional()
  @IsNotEmpty()
  @IsString()
  @IsString()
  profile_picture?: string;

  @IsNotEmpty()
  @IsString()
  uid: string;

  @IsEnum(Role, { each: true })
  roles: `${Role}`[];

  @IsOptional()
  @IsString()
  company?: string;

  @IsEmail()
  @IsDefined()
  email: string;
}

export class UpdateUserDto {
  @IsOptional()
  @IsString()
  @Length(2, 50)
  first_name?: string;

  @IsOptional()
  @IsString()
  @Length(2, 50)
  @Length(2, 50)
  last_name?: string;

  @IsOptional()
  @IsNotEmpty()
  @IsString()
  @IsString()
  profile_picture?: string;

  @IsOptional()
  @IsString()
  company?: string;
}

export class UserResponseDto {
  id: string;
  uid: string;
  first_name?: string;
  last_name?: string;
  company?: string;
  profile_picture?: string;
  preferences?: UserPreferences;
  notifications?: UserNotification;
  roles: `${Role}`[];
  created_at: Date;
  updated_at: Date;
}
