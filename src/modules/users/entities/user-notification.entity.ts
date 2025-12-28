import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('user_notifications')
export class UserNotification {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ default: true })
  project_updates: boolean;

  @Column({ default: true })
  deployment_alerts: boolean;

  @Column({ default: true })
  license_expiration: boolean;

  @Column({ default: false })
  marketing: boolean;
}
