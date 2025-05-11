import { Currency, PaymentMethod } from '@app/shared/enums';
import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty, IsNumber, IsOptional, IsString, IsUUID, Min } from 'class-validator';

export class CreatePaymentDto {
  @ApiProperty({ description: 'Order ID associated with this payment' })
  @IsUUID()
  @IsNotEmpty()
  orderId: string;

  @ApiProperty({ description: 'Amount to be paid' })
  @IsNumber()
  @Min(0)
  amount: number;

  @ApiProperty({ description: 'Currency for the payment', enum: Currency, default: Currency.USD })
  @IsEnum(Currency)
  currency: Currency;

  @ApiProperty({ description: 'Payment method', enum: PaymentMethod })
  @IsEnum(PaymentMethod)
  paymentMethod: PaymentMethod;

  @ApiProperty({ description: 'Transaction ID from payment provider', required: false })
  @IsString()
  @IsOptional()
  transactionId?: string;

  @ApiProperty({ description: 'Payment gateway response', required: false })
  @IsString()
  @IsOptional()
  paymentGatewayResponse?: string;
}
