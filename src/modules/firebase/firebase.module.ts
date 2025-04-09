import { HttpModule } from '@nestjs/axios';
import { Module } from '@nestjs/common';

import { FirebaseService } from './firebase.service';

@Module({
  imports: [HttpModule],
  providers: [FirebaseService],
  exports: [FirebaseService],
})
export class FirebaseModule {}
