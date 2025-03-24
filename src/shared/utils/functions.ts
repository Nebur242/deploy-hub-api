import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export const Claims = createParamDecorator((field: string, ctx: ExecutionContext) => {
  const req = ctx.switchToHttp().getRequest<{ user: Record<string, string> }>();
  return field ? req.user[field] : req.user;
});
