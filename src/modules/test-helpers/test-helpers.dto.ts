import { ApiProperty } from '@nestjs/swagger';
import { IsDefined, IsEmail, IsString } from 'class-validator';

export class CreateTestUserDto {
  @IsDefined()
  @IsEmail()
  email: string;

  @ApiProperty()
  @IsString()
  @IsDefined()
  password: string;
}

export class LoginTestUserDto {
  @IsEmail()
  email: string;

  @IsString()
  password: string;
}
