import { EnvironmentVariables } from '@app/config/env.validation';
import { HttpService } from '@nestjs/axios';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { getAuth } from 'firebase-admin/auth';
import { lastValueFrom, map } from 'rxjs';

import { CatchFirebaseException } from './firebase-exception.decorator';

@Injectable()
export class FirebaseService {
  constructor(
    private readonly configService: ConfigService<EnvironmentVariables, true>,
    private readonly httpService: HttpService,
  ) {}

  @CatchFirebaseException()
  verifyToken(token: string, checkRevoked = false) {
    return getAuth().verifyIdToken(token.replace('Bearer', '').trim(), checkRevoked);
  }

  @CatchFirebaseException()
  createUser(email: string, password: string) {
    return getAuth().createUser({ email, password });
  }

  @CatchFirebaseException()
  getUser(uid: string) {
    return getAuth().getUser(uid);
  }

  @CatchFirebaseException()
  getUsers(maxResults?: number, pageToken?: string) {
    return getAuth().listUsers(maxResults, pageToken);
  }

  @CatchFirebaseException()
  async removeUser(uid: string) {
    await getAuth().deleteUser(uid);
  }

  @CatchFirebaseException()
  login(email: string, password: string) {
    return lastValueFrom(
      this.httpService
        .post<{ uid: string }>(
          `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${this.configService.get(
            'FIREBASE_REST_API_KEY',
          )}`,
          {
            email,
            password,
            returnSecureToken: true,
          },
        )
        .pipe(map(response => response.data)),
    );
  }
}
