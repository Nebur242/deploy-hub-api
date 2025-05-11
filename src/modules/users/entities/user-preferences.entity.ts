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
  emailNotifications: boolean;

  @Column({ type: 'simple-array', nullable: true })
  preferredDeploymentProviders: DeploymentProvider[] | null;

  @Column({ type: 'simple-array', nullable: true, default: [] })
  billings?: {
    firstName: string;
    lastName: string;
    email: string;
    company: string;
    address: string;
    city: string;
    state: string;
    postalCode: string;
    country: string;
  }[];
}
