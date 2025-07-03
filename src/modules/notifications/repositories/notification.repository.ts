import { Injectable } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';

import { NotificationEntity } from '../entities/notification.enty';

@Injectable()
export class NotificationRepository extends Repository<NotificationEntity> {
  constructor(private dataSource: DataSource) {
    super(NotificationEntity, dataSource.createEntityManager());
  }
}
