import { DeploymentProvider } from '@app/modules/projects/entities/project-configuration.entity';
import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

import { Theme } from '../dto/user-preferences.dto';

@Entity('user_preferences')
export class UserPreferences {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'enum', enum: Theme, default: Theme.SYSTEM })
  theme: Theme;

  @Column({ default: true })
  email_notifications: boolean;

  @Column({ type: 'simple-array', nullable: true })
  preferred_deployment_providers: DeploymentProvider[] | null;

  @Column({ type: 'simple-array', nullable: true, default: [] })
  billings?: {
    first_name: string;
    last_name: string;
    email: string;
    company: string;
    address: string;
    city: string;
    state: string;
    postal_code: string;
    country: string;
  }[];
}
