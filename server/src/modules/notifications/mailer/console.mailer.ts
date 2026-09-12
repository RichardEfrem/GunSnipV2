import { Injectable, Logger } from '@nestjs/common';
import type { Mailer, MailMessage } from './mailer.js';

/**
 * The Phase 0 transport (FR-NOTIF-02): every message printed where the developer already is.
 *
 * Prints the body in full rather than summarising it. The whole reason to write transactional
 * mail before there is a provider to send it is to be able to *read* it — a log line saying
 * "sent order-placed to ada@example.com" proves the wiring and hides the only thing worth
 * checking, which is whether the mail makes sense.
 */
@Injectable()
export class ConsoleMailer implements Mailer {
  readonly name = 'console';

  private readonly logger = new Logger('Mailer');

  async send(message: MailMessage): Promise<void> {
    this.logger.log(
      `\n┌─ mail → ${message.to}\n│  ${message.subject}\n` +
        `${message.text.split('\n').map((line) => `│  ${line}`).join('\n')}\n└─`,
    );
  }
}
