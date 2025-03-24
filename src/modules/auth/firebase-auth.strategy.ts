import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { auth } from 'firebase-admin';
import { FirebaseAuthError } from 'firebase-admin/auth';
import { ExtractJwt, Strategy } from 'passport-firebase-jwt';

@Injectable()
export class FirebaseAuthStrategy extends PassportStrategy(Strategy) {
  constructor() {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
    });
  }

  async validate(token: string) {
    try {
      const user = await auth().verifyIdToken(token, true);
      return user;
    } catch (error) {
      const err = error as FirebaseAuthError;
      throw new UnauthorizedException(err.message || 'unauthorized');
    }
  }
}
