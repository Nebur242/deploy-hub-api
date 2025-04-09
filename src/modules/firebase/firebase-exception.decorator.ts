import { BadRequestException } from '@nestjs/common';
import { AxiosError } from 'axios';

export function CatchFirebaseException(HttpException = BadRequestException) {
  return (target: unknown, propertyKey: string, propertyDescriptor: PropertyDescriptor) => {
    const originalMethod = propertyDescriptor.value as (...args: unknown[]) => Promise<unknown>;
    propertyDescriptor.value = async function (...args: unknown[]) {
      try {
        return (await originalMethod.apply(this, args)) as Promise<unknown>;
      } catch (error) {
        const err = error as AxiosError<{
          error?: { code: number; message: string };
        }>;
        throw new HttpException(err.response?.data.error?.message || 'Firebase error');
      }
    };
  };
}
