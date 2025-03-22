import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { EnvironmentVariables } from './config/env.validation';

@Injectable()
export class AppService {
  constructor(private readonly configService: ConfigService<EnvironmentVariables, true>) {}
  getHello(): string {
    return 'Hello World!';
  }
}
