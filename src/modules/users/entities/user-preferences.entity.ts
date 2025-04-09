import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

import { DeploymentProvider, Theme } from '../dto/user-preferences.dto';

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
}
