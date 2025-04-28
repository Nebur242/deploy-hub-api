import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('user_notifications')
export class UserNotification {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ default: true })
  projectUpdates: boolean;

  @Column({ default: true })
  deploymentAlerts: boolean;

  @Column({ default: true })
  licenseExpiration: boolean;

  @Column({ default: false })
  marketing: boolean;
}
