import { Module } from '@nestjs/common';

import { TestHelpersController } from './test-helpers.controller';
import { FirebaseModule } from '../firebase/firebase.module';

@Module({
  imports: [FirebaseModule],
  controllers: [TestHelpersController],
})
export class TestHelpersModule {}
