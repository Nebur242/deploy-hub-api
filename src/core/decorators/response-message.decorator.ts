import { SetMetadata } from '@nestjs/common';

export interface ResponseMetadata {
  message?: string;
  meta?: Record<string, any>;
  successCode?: number;
}

export const RESPONSE_MESSAGE_KEY = 'response_message';

export const ResponseMessage = (metadata: ResponseMetadata | string) => {
  const data = typeof metadata === 'string' ? { message: metadata } : metadata;

  return SetMetadata(RESPONSE_MESSAGE_KEY, data);
};
