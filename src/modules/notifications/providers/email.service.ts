/* eslint-disable @typescript-eslint/no-unsafe-member-access */

/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs/promises';
import * as handlebars from 'handlebars';
import * as nodemailer from 'nodemailer';
import * as path from 'path';

export interface EmailOptions {
  to: string;
  subject: string;
  text?: string;
  html?: string;
  template?: string;
  templateData?: Record<string, any>;
  attachments?: Array<{
    filename: string;
    content: Buffer | string;
    contentType?: string;
  }>;
  from?: string;
  cc?: string | string[];
  bcc?: string | string[];
}

/**
 * Service for sending email notifications via SMTP
 */
@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private transporter: nodemailer.Transporter;
  private defaultFrom: string;
  private templateDir: string;

  constructor(private readonly configService: ConfigService) {
    this.initializeTransporter();
    this.defaultFrom = this.configService.get<string>('SMTP_FROM_EMAIL') || 'noreply@deployhub.com';
    this.templateDir =
      this.configService.get<string>('EMAIL_TEMPLATES_DIR') ||
      path.join(process.cwd(), 'src', 'modules', 'notifications', 'templates');
  }

  /**
   * Initialize the SMTP transporter
   */
  private initializeTransporter() {
    const host = this.configService.get<string>('SMTP_HOST');
    const port = this.configService.get<number>('SMTP_PORT');
    // const secure = this.configService.get<boolean>('SMTP_SECURE') || false;
    const user = this.configService.get<string>('SMTP_USER');
    const pass = this.configService.get<string>('SMTP_PASSWORD');

    if (!host || !port) {
      this.logger.warn(
        'SMTP configuration is missing or incomplete. Email sending will be mocked.',
      );
      return;
    }

    this.transporter = nodemailer.createTransport({
      host,
      port,
      secure: true,
      auth: user && pass ? { user, pass } : undefined,
    });

    this.logger.log('SMTP transporter initialized');
  }

  /**
   * Send an email
   * @param options Email options including recipient, subject, and content
   * @returns Result of sending the email
   */
  async sendEmail(options: EmailOptions) {
    this.logger.debug(`Sending email to: ${options.to}, subject: ${options.subject}`);

    try {
      let html = options.html;

      // Render template if provided
      if (options.template && !html) {
        html = await this.renderTemplate(options.template, options.templateData || {});
      }

      // If no transporter is available, fall back to mock implementation
      if (!this.transporter) {
        return this.mockSendEmail(options, html);
      }

      // Prepare email message
      const mail = {
        from: options.from || this.defaultFrom,
        to: options.to,
        subject: options.subject,
        text: options.text,
        html, // html body
        cc: options.cc,
        bcc: options.bcc,
        attachments: options.attachments,
      };

      // Send email
      const info = await this.transporter.sendMail(mail);

      this.logger.log(`Email sent successfully to ${options.to}, message ID: ${info.messageId}`);

      return {
        success: true,
        messageId: info.messageId,
        recipient: options.to,
      };
    } catch (err) {
      const error = err as Error;
      this.logger.error(`Failed to send email: ${error.message}`, error.stack);
      throw new Error(`Failed to send email: ${error.message}`);
    }
  }

  /**
   * Mock email sending when SMTP is not configured
   */
  private async mockSendEmail(options: EmailOptions, html?: string) {
    this.logger.log('SMTP transporter not configured, mocking email sending', html);
    this.logger.log(`[MOCK] Email would be sent with the following details:
      - To: ${options.to}
      - Subject: ${options.subject}
      - Template: ${options.template || 'N/A'}
      - Text: ${options.text?.substring(0, 50)}${(options?.text?.length || 0) > 50 ? '...' : ''}
    `);

    // Simulate email sending delay
    await new Promise(resolve => setTimeout(resolve, 100));

    return {
      success: true,
      messageId: `mock-email-${Date.now()}`,
      recipient: options.to,
    };
  }

  /**
   * Render an email template with data
   * @param templateName Template name
   * @param data Data to inject into the template
   * @returns Rendered HTML
   */
  private async renderTemplate(templateName: string, data: Record<string, any>) {
    try {
      // Try to load the template file
      const templatePath = path.join(this.templateDir, `${templateName}.hbs`);
      const templateContent = await fs.readFile(templatePath, 'utf-8');

      // Compile and render the template
      const template = handlebars.compile(templateContent);
      return template(data);
    } catch (err) {
      this.logger.error(`Failed to render template ${templateName}: ${(err as Error).message}`);

      // Fallback to a basic template
      return `<html>
        <body>
          <h1>${data.title || 'Notification'}</h1>
          <p>${data.message || 'No message content provided.'}</p>
          <hr>
          <p>Data: ${JSON.stringify(data)}</p>
        </body>
      </html>`;
    }
  }
}
