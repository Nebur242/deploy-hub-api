import { ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

import { CreateSupportTicketDto } from './create-support-ticket.dto';
import { TicketPriority, TicketStatus } from '../entities/support-ticket.entity';

export class UpdateSupportTicketDto extends PartialType(CreateSupportTicketDto) {
  @ApiPropertyOptional({
    description: 'Status of the ticket',
    enum: TicketStatus,
    example: TicketStatus.IN_PROGRESS,
  })
  @IsEnum(TicketStatus)
  @IsOptional()
  status?: TicketStatus;

  @ApiPropertyOptional({
    description: 'Priority level of the ticket',
    enum: TicketPriority,
    example: TicketPriority.HIGH,
  })
  @IsEnum(TicketPriority)
  @IsOptional()
  priority?: TicketPriority;

  @ApiPropertyOptional({
    description: 'ID of the admin assigned to this ticket',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @IsUUID()
  @IsOptional()
  assigned_to_id?: string;

  @ApiPropertyOptional({
    description: 'Internal admin notes',
    example: 'User has been contacted via email',
  })
  @IsString()
  @IsOptional()
  @MaxLength(2000)
  admin_notes?: string;
}
