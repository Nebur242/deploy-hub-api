import { CurrentUser } from '@app/core/decorators/current-user.decorator';
import { Admin, Authenticated } from '@app/core/guards/roles-auth.guard';
import { User } from '@app/modules/users/entities/user.entity';
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Pagination } from 'nestjs-typeorm-paginate';

import { CreateSupportTicketDto } from '../dto/create-support-ticket.dto';
import { QuerySupportTicketsDto } from '../dto/query-support-tickets.dto';
import { UpdateSupportTicketDto } from '../dto/update-support-ticket.dto';
import { SupportTicket } from '../entities/support-ticket.entity';
import { SupportService } from '../services/support.service';

@ApiTags('support')
@ApiBearerAuth()
@Controller('support')
export class SupportController {
  constructor(private readonly supportService: SupportService) {}

  /**
   * Create a new support ticket (authenticated users)
   */
  @Post()
  @Authenticated()
  @ApiOperation({ summary: 'Create a new support ticket' })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Support ticket created successfully',
  })
  create(
    @Body() createDto: CreateSupportTicketDto,
    @CurrentUser() user: User,
  ): Promise<SupportTicket> {
    return this.supportService.create(createDto, user.id);
  }

  /**
   * Get current user's tickets
   */
  @Get('my-tickets')
  @Authenticated()
  @ApiOperation({ summary: "Get current user's support tickets" })
  @ApiResponse({
    status: HttpStatus.OK,
    description: "Returns paginated list of user's support tickets",
  })
  findMyTickets(
    @Query() queryDto: QuerySupportTicketsDto,
    @CurrentUser() user: User,
  ): Promise<Pagination<SupportTicket>> {
    return this.supportService.findByUser(user.id, queryDto);
  }

  /**
   * Get a specific ticket for current user
   */
  @Get('my-tickets/:id')
  @Authenticated()
  @ApiOperation({ summary: 'Get a specific support ticket for current user' })
  @ApiParam({ name: 'id', description: 'Support ticket ID' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Returns the support ticket',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Ticket not found',
  })
  findMyTicket(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: User,
  ): Promise<SupportTicket> {
    return this.supportService.findOneByUser(id, user.id);
  }

  /**
   * Admin: Get all support tickets
   */
  @Get()
  @Admin()
  @ApiOperation({ summary: 'Get all support tickets (Admin only)' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Returns paginated list of all support tickets',
  })
  findAll(@Query() queryDto: QuerySupportTicketsDto): Promise<Pagination<SupportTicket>> {
    return this.supportService.findAll(queryDto);
  }

  /**
   * Admin: Get ticket statistics
   */
  @Get('statistics')
  @Admin()
  @ApiOperation({ summary: 'Get support ticket statistics (Admin only)' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Returns support ticket statistics',
  })
  getStatistics() {
    return this.supportService.getStatistics();
  }

  /**
   * Admin: Get a specific ticket
   */
  @Get(':id')
  @Admin()
  @ApiOperation({ summary: 'Get a specific support ticket (Admin only)' })
  @ApiParam({ name: 'id', description: 'Support ticket ID' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Returns the support ticket',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Ticket not found',
  })
  findOne(@Param('id', ParseUUIDPipe) id: string): Promise<SupportTicket> {
    return this.supportService.findOne(id);
  }

  /**
   * Admin: Update a support ticket
   */
  @Patch(':id')
  @Admin()
  @ApiOperation({ summary: 'Update a support ticket (Admin only)' })
  @ApiParam({ name: 'id', description: 'Support ticket ID' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Support ticket updated successfully',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Ticket not found',
  })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateDto: UpdateSupportTicketDto,
  ): Promise<SupportTicket> {
    return this.supportService.update(id, updateDto);
  }

  /**
   * Admin: Delete a support ticket
   */
  @Delete(':id')
  @Admin()
  @ApiOperation({ summary: 'Delete a support ticket (Admin only)' })
  @ApiParam({ name: 'id', description: 'Support ticket ID' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Support ticket deleted successfully',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Ticket not found',
  })
  remove(@Param('id', ParseUUIDPipe) id: string): Promise<{ deleted: boolean }> {
    return this.supportService.remove(id);
  }
}
