import { Injectable } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';

import { SupportTicket } from '../entities/support-ticket.entity';

@Injectable()
export class SupportTicketRepository extends Repository<SupportTicket> {
  constructor(private dataSource: DataSource) {
    super(SupportTicket, dataSource.createEntityManager());
  }
}
