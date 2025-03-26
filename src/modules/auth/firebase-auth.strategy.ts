import { tryCatch } from '@app/shared/utils/functions';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { auth } from 'firebase-admin';
import { ExtractJwt, Strategy } from 'passport-firebase-jwt';

import { UsersService } from '../users/users.service';

@Injectable()
export class FirebaseAuthStrategy extends PassportStrategy(Strategy) {
  constructor(private readonly usersService: UsersService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
    });
  }

  async validate(token: string) {
    const { data: firebaseUser, error: firebaseError } = await tryCatch(() =>
      auth().verifyIdToken(token, true),
    );

    if (firebaseError) {
      throw new UnauthorizedException(firebaseError.message || 'unauthorized');
    }

    const { data: user, error: userError } = await tryCatch(() =>
      this.usersService.findByFirebaseUid(firebaseUser.uid),
    );

    if (userError) {
      return firebaseUser;
    }

    return user || firebaseUser;
  }
}
