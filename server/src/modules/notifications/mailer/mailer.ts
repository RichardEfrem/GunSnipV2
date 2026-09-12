/**
 * The mail seam (FR-NOTIF-02, PRD §11 — the same shape as `PaymentProvider`).
 *
 * Phase 0 prints to the console. A real provider is a second class implementing this interface
 * and one entry in `mailer.module.ts`; nothing that *sends* mail changes, because nothing that
 * sends mail knows which transport is running.
 *
 * Deliberately minimal. A transactional mail needs a recipient, a subject and a body, and every
 * feature beyond that — attachments, templates, tracking — is a provider concern that would
 * bind this interface to one vendor's idea of them.
 */
export interface MailMessage {
  to: string;
  subject: string;
  /**
   * Plain text. Not an aesthetic choice: a console transport has nowhere to render HTML, and a
   * text body is the one form every mail client and every provider accepts unchanged. When a
   * real provider arrives it can wrap this in a template; it cannot un-mangle HTML we guessed at.
   */
  text: string;
}

export interface Mailer {
  /** Named so logs say which transport handled a message. */
  readonly name: string;
  send(message: MailMessage): Promise<void>;
}

/** Injection token — `Mailer` is an interface and erases at runtime. */
export const MAILER = Symbol('MAILER');
