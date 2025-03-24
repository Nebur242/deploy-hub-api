import { BadRequestException, NotFoundException } from '@nestjs/common';
import { AxiosError } from 'axios';

import { CatchFirebaseException } from '../firebase-exception.decorator';

describe('CatchFirebaseException', () => {
  class TestClass {
    @CatchFirebaseException()
    successMethod() {
      return Promise.resolve({ success: true });
    }

    @CatchFirebaseException()
    errorMethod() {
      throw {
        response: {
          data: {
            error: {
              message: 'Test error message',
            },
          },
        },
      } as AxiosError;
    }

    @CatchFirebaseException()
    genericErrorMethod() {
      throw new Error('Generic error');
    }

    @CatchFirebaseException(NotFoundException)
    customExceptionMethod() {
      throw {
        response: {
          data: {
            error: {
              message: 'Not found error',
            },
          },
        },
      } as AxiosError;
    }
  }

  let testInstance: TestClass;

  beforeEach(() => {
    testInstance = new TestClass();
  });

  it('should return the original method result when no error occurs', async () => {
    const result = await testInstance.successMethod();
    expect(result).toEqual({ success: true });
  });

  it('should throw BadRequestException with the error message when method fails', async () => {
    await expect(testInstance.errorMethod()).rejects.toThrow(BadRequestException);
    await expect(testInstance.errorMethod()).rejects.toThrow('Test error message');
  });

  it('should throw BadRequestException with default message when error has no specific message', async () => {
    await expect(testInstance.genericErrorMethod()).rejects.toThrow(BadRequestException);
    await expect(testInstance.genericErrorMethod()).rejects.toThrow('Firebase error');
  });

  it('should use custom exception type when provided', async () => {
    await expect(testInstance.customExceptionMethod()).rejects.toThrow(NotFoundException);
    await expect(testInstance.customExceptionMethod()).rejects.toThrow('Not found error');
  });
});
