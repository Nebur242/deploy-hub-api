import { IsNotEmpty, IsOptional, IsString, Length } from 'class-validator';

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

  @IsNotEmpty()
  @IsString()
  firebaseUid: string;

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
  @IsString()
  company?: string;
}

export class UserResponseDto {
  id: string;
  firebaseUid: string;
  firstName?: string;
  lastName?: string;
  company?: string;
  profilePicture?: string;
  createdAt: Date;
  updatedAt: Date;
}
