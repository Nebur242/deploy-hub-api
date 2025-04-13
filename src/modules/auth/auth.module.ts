import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';

import { FirebaseAuthStrategy } from './firebase-auth.strategy';
import { FirebaseModule } from '../firebase/firebase.module';
import { UserModule } from '../users/users.module';

@Module({
  imports: [
    PassportModule.register({ defaultStrategy: 'firebase-jwt' }),
    FirebaseModule,
    UserModule,
  ],
  controllers: [],
  providers: [FirebaseAuthStrategy],
  exports: [PassportModule, FirebaseModule],
})
export class AuthModule {}
