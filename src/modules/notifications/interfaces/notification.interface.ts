import { NotificationScope } from '../entities/notification.enty';
import { NotificationType } from '../enums/notification-type.enum';

export interface Notification {
  id: string;
  type: NotificationType;
  scope?: NotificationScope;
  userId: string;
  recipient?: string; // Email address or phone number
  subject?: string; // For email notifications
  message: string;
  template?: string; // Email template identifier
  data?: Record<string, any>; // Additional data for the notification
  createdAt: Date;
  processedAt?: Date;
  status?: string;
  error?: string;
}
