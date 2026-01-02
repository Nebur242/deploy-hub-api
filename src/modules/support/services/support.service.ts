import { Injectable, NotFoundException } from '@nestjs/common';
import { IPaginationOptions, paginate, Pagination } from 'nestjs-typeorm-paginate';

import { CreateSupportTicketDto } from '../dto/create-support-ticket.dto';
import { QuerySupportTicketsDto } from '../dto/query-support-tickets.dto';
import { UpdateSupportTicketDto } from '../dto/update-support-ticket.dto';
import { SupportTicket, TicketStatus } from '../entities/support-ticket.entity';
import { SupportTicketRepository } from '../repositories/support-ticket.repository';

interface RawPriorityCount {
  priority: string;
  count: string;
}

interface RawCategoryCount {
  category: string;
  count: string;
}

@Injectable()
export class SupportService {
  constructor(private readonly supportTicketRepository: SupportTicketRepository) {}

  /**
   * Create a new support ticket
   */
  create(createDto: CreateSupportTicketDto, user_id?: string): Promise<SupportTicket> {
    const ticket = this.supportTicketRepository.create({
      ...createDto,
      user_id,
    });

    return this.supportTicketRepository.save(ticket);
  }

  /**
   * Find all support tickets with pagination and filtering
   */
  findAll(queryDto: QuerySupportTicketsDto): Promise<Pagination<SupportTicket>> {
    const {
      page = 1,
      limit = 10,
      status,
      priority,
      category,
      user_id,
      assigned_to_id,
      search,
      sortBy = 'created_at',
      sortOrder = 'DESC',
    } = queryDto;

    const queryBuilder = this.supportTicketRepository
      .createQueryBuilder('ticket')
      .leftJoinAndSelect('ticket.user', 'user')
      .leftJoinAndSelect('ticket.assigned_to', 'assigned_to');

    // Apply filters
    if (status) {
      queryBuilder.andWhere('ticket.status = :status', { status });
    }

    if (priority) {
      queryBuilder.andWhere('ticket.priority = :priority', { priority });
    }

    if (category) {
      queryBuilder.andWhere('ticket.category = :category', { category });
    }

    if (user_id) {
      queryBuilder.andWhere('ticket.user_id = :user_id', { user_id });
    }

    if (assigned_to_id) {
      queryBuilder.andWhere('ticket.assigned_to_id = :assigned_to_id', { assigned_to_id });
    }

    if (search) {
      queryBuilder.andWhere('(ticket.subject ILIKE :search OR ticket.message ILIKE :search)', {
        search: `%${search}%`,
      });
    }

    // Apply sorting
    queryBuilder.orderBy(`ticket.${sortBy}`, sortOrder);

    const options: IPaginationOptions = { page: page ?? 1, limit: limit ?? 10 };
    return paginate<SupportTicket>(queryBuilder, options);
  }

  /**
   * Find tickets for a specific user
   */
  findByUser(
    user_id: string,
    queryDto: QuerySupportTicketsDto,
  ): Promise<Pagination<SupportTicket>> {
    return this.findAll({ ...queryDto, user_id });
  }

  /**
   * Find a single ticket by ID
   */
  async findOne(id: string): Promise<SupportTicket> {
    const ticket = await this.supportTicketRepository.findOne({
      where: { id },
      relations: ['user', 'assigned_to'],
    });

    if (!ticket) {
      throw new NotFoundException(`Support ticket with ID ${id} not found`);
    }

    return ticket;
  }

  /**
   * Find a ticket by ID for a specific user
   */
  async findOneByUser(id: string, user_id: string): Promise<SupportTicket> {
    const ticket = await this.supportTicketRepository.findOne({
      where: { id, user_id },
      relations: ['user', 'assigned_to'],
    });

    if (!ticket) {
      throw new NotFoundException(`Support ticket with ID ${id} not found`);
    }

    return ticket;
  }

  /**
   * Update a support ticket
   */
  async update(id: string, updateDto: UpdateSupportTicketDto): Promise<SupportTicket> {
    const ticket = await this.findOne(id);

    // If status is being changed to resolved, set resolved_at
    if (updateDto.status === TicketStatus.RESOLVED && ticket.status !== TicketStatus.RESOLVED) {
      ticket.resolved_at = new Date();
    }

    // If status is being changed from resolved, clear resolved_at
    if (
      updateDto.status &&
      updateDto.status !== TicketStatus.RESOLVED &&
      ticket.status === TicketStatus.RESOLVED
    ) {
      ticket.resolved_at = undefined;
    }

    Object.assign(ticket, updateDto);
    return this.supportTicketRepository.save(ticket);
  }

  /**
   * Delete a support ticket
   */
  async remove(id: string): Promise<{ deleted: boolean }> {
    const ticket = await this.findOne(id);
    await this.supportTicketRepository.remove(ticket);
    return { deleted: true };
  }

  /**
   * Get ticket statistics
   */
  async getStatistics(): Promise<{
    total: number;
    open: number;
    in_progress: number;
    resolved: number;
    closed: number;
    by_priority: Record<string, number>;
    by_category: Record<string, number>;
  }> {
    const [total, open, in_progress, resolved, closed] = await Promise.all([
      this.supportTicketRepository.count(),
      this.supportTicketRepository.count({ where: { status: TicketStatus.OPEN } }),
      this.supportTicketRepository.count({ where: { status: TicketStatus.IN_PROGRESS } }),
      this.supportTicketRepository.count({ where: { status: TicketStatus.RESOLVED } }),
      this.supportTicketRepository.count({ where: { status: TicketStatus.CLOSED } }),
    ]);

    // Get counts by priority
    const priorityCounts: RawPriorityCount[] = await this.supportTicketRepository
      .createQueryBuilder('ticket')
      .select('ticket.priority', 'priority')
      .addSelect('COUNT(*)', 'count')
      .groupBy('ticket.priority')
      .getRawMany();

    const by_priority: Record<string, number> = {};
    priorityCounts.forEach(item => {
      by_priority[item.priority] = parseInt(item.count, 10);
    });

    // Get counts by category
    const categoryCounts: RawCategoryCount[] = await this.supportTicketRepository
      .createQueryBuilder('ticket')
      .select('ticket.category', 'category')
      .addSelect('COUNT(*)', 'count')
      .groupBy('ticket.category')
      .getRawMany();

    const by_category: Record<string, number> = {};
    categoryCounts.forEach(item => {
      by_category[item.category] = parseInt(item.count, 10);
    });

    return {
      total,
      open,
      in_progress,
      resolved,
      closed,
      by_priority,
      by_category,
    };
  }
}
