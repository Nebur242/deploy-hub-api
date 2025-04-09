import { Body, Controller, Post } from '@nestjs/common';

import { CreateTestUserDto, LoginTestUserDto } from './dto/test-helpers.dto';
import { FirebaseService } from '../firebase/firebase.service';

@Controller('test-helpers')
export class TestHelpersController {
  constructor(private readonly firebaseService: FirebaseService) {}

  @Post('/register')
  async registerTestUser(@Body() createTestUserDto: CreateTestUserDto) {
    await this.firebaseService.createUser(createTestUserDto.email, createTestUserDto.password);
    return this.loginTestUser({
      email: createTestUserDto.email,
      password: createTestUserDto.password,
    });
  }

  @Post('/login')
  loginTestUser(@Body() loginTestUserDto: LoginTestUserDto) {
    return this.firebaseService.login(loginTestUserDto.email, loginTestUserDto.password);
  }
}
