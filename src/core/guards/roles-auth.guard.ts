import { Role } from '@app/shared/enums';
import {
  applyDecorators,
  ExecutionContext,
  Injectable,
  SetMetadata,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import { Observable } from 'rxjs';

@Injectable()
export class RolesGuard extends AuthGuard('firebase-jwt') {
  private roles: Role[] = [];

  constructor(private reflector: Reflector) {
    super();
  }

  canActivate(context: ExecutionContext): boolean | Promise<boolean> | Observable<boolean> {
    this.roles =
      this.reflector.get<Role[]>('roles', context.getClass()) ||
      this.reflector.get<Role[]>('roles', context.getHandler()) ||
      [];
    return super.canActivate(context);
  }

  override handleRequest(err: unknown, user: { roles?: Role[] } | undefined): any {
    // You can throw an exception based on either "info" or "err" arguments
    if (err || !user) {
      throw err instanceof Error
        ? err
        : new UnauthorizedException(err instanceof Error ? err.message : 'Unauthorized');
    }
    if (this.roles.length === 0) {
      return user;
    }
    const hasRole = this.roles.some(role => user.roles?.includes(role));
    if (!hasRole) {
      throw new UnauthorizedException("You don't have access");
    }
    return user;
  }
}

export function Roles(...roles: Role[]) {
  return applyDecorators(SetMetadata('roles', roles), UseGuards(RolesGuard));
}

export function Admin() {
  return Roles(Role.ADMIN);
}

export function Authenticated() {
  return Roles();
}
