/** Delivers the six-digit sign-in code. `log` prints it (local and test runs); `resend` mails it. */
export interface OtpSender {
  send(email: string, code: string): Promise<void>;
}

export class OtpDeliveryError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'OtpDeliveryError';
  }
}

/** Prints `[otp] code for <email>: <code>`; the local smoke script reads the code from this log. */
export class LogOtpSender implements OtpSender {
  constructor(private readonly write: (line: string) => void = (line) => console.log(line)) {}

  async send(email: string, code: string): Promise<void> {
    this.write(`[otp] code for ${email}: ${code}`);
  }
}

export const RESEND_URL = 'https://api.resend.com/emails';

export class ResendOtpSender implements OtpSender {
  constructor(
    private readonly options: { apiKey: string; from: string; fetch?: typeof fetch },
  ) {}

  async send(email: string, code: string): Promise<void> {
    let response: Response;
    try {
      response = await (this.options.fetch ?? fetch)(RESEND_URL, {
        method: 'POST',
        headers: { authorization: `Bearer ${this.options.apiKey}`, 'content-type': 'application/json' },
        body: JSON.stringify({
          from: this.options.from,
          to: [email],
          subject: 'Your CoachCal sign-in code',
          text: `Your CoachCal code is ${code}. It expires in 10 minutes. If you did not ask for it, ignore this e-mail.`,
        }),
      });
    } catch {
      throw new OtpDeliveryError('the mail service could not be reached');
    }
    if (!response.ok) throw new OtpDeliveryError(`the mail service answered ${response.status}`);
  }
}
