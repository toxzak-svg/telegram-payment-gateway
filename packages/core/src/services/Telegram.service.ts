import { Telegraf } from 'telegraf';
import { PaymentModel, PaymentStatus, Payment } from '../models/payment.model';

export interface TelegramPaymentPayload {
  update_id: number;
  message?: {
    from?: {
      id: number;
      first_name?: string;
      last_name?: string;
      username?: string;
    };
    successful_payment?: {
      currency: string;
      total_amount: number;
      invoice_payload: string;
      telegram_payment_charge_id: string;
      provider_payment_charge_id: string;
    };
  };
  pre_checkout_query?: {
    id: string;
    from: {
      id: number;
      first_name: string;
      last_name?: string;
      username?: string;
    };
    currency: string;
    total_amount: number;
    invoice_payload: string;
  };
}

export interface PaymentRecord {
  id: string;
  userId: string;
  telegramInvoiceId: string;
  starsAmount: number;
  status: PaymentStatus;
  telegramChargeId: string;
  providerChargeId?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface TelegramServiceOptions {
  paymentModel?: PaymentModel;
  /**
   * Optional resolver to map a Telegram payload to an internal user ID.
   * Defaults to Telegram sender ID.
   */
  resolveUserId?: (payload: TelegramPaymentPayload) => string | null;
  /**
   * Allowed ISO currency codes for Telegram Stars payments (e.g. ['XTR']).
   */
  allowedCurrencies?: string[];
  /** Minimum amount (in stars) accepted during pre-checkout verification */
  minStarsAmount?: number;
  /** Maximum amount (in stars) accepted during pre-checkout verification */
  maxStarsAmount?: number;
  /** Expected prefix for invoice payloads to prevent spoofing */
  invoicePrefix?: string;
  /** Additional custom validator for pre-checkout queries */
  customValidator?: (query: TelegramPaymentPayload['pre_checkout_query']) => Promise<boolean> | boolean;
  /** Optional static fallback user id when resolver cannot derive one */
  defaultUserId?: string;
}

export class TelegramService {
  private bot: Telegraf;
  private webhookUrl?: string; // FIXED: Made optional
  private options: TelegramServiceOptions;

  constructor(botToken: string, options: TelegramServiceOptions = {}) {
    this.bot = new Telegraf(botToken);
    this.options = options;
    this.setupHandlers();
  }

  /**
   * Initialize webhook for Telegram Bot API
   */
  async initializeWebhook(webhookUrl: string): Promise<void> {
    try {
      this.webhookUrl = webhookUrl;
      await this.bot.telegram.setWebhook(webhookUrl);
      console.log(`✅ Telegram webhook set to: ${webhookUrl}`);
    } catch (error) {
      console.error('❌ Failed to set Telegram webhook:', error);
      throw error;
    }
  }

  /**
   * Setup Telegram bot handlers
   */
  private setupHandlers(): void {
    // Handle successful payments
    this.bot.on('successful_payment', async (ctx) => {
      try {
        await this.processSuccessfulPayment({
          update_id: ctx.update.update_id,
          message: {
            successful_payment: ctx.message.successful_payment,
          },
        });
      } catch (error) {
        console.error('❌ Error processing successful payment:', error);
      }
    });

    // Handle pre-checkout queries
    this.bot.on('pre_checkout_query', async (ctx) => {
      try {
        // FIXED: Added update_id to payload
        const isValid = await this.verifyPreCheckout({
          update_id: ctx.update.update_id,
          pre_checkout_query: ctx.preCheckoutQuery,
        });

        if (isValid) {
          await ctx.answerPreCheckoutQuery(true);
        } else {
          await ctx.answerPreCheckoutQuery(false, 'Payment validation failed');
        }
      } catch (error) {
        console.error('❌ Error verifying pre-checkout:', error);
        await ctx.answerPreCheckoutQuery(false, 'Internal server error');
      }
    });
  }

  /**
   * Process successful payment notification from Telegram
   */
  async processSuccessfulPayment(payload: TelegramPaymentPayload): Promise<PaymentRecord> {
    const payment = payload.message?.successful_payment;
    if (!payment) {
      throw new Error('Invalid payment payload');
    }

    console.log('💰 Processing payment:', {
      amount: payment.total_amount,
      currency: payment.currency,
      chargeId: payment.telegram_payment_charge_id,
    });

    const userId = this.resolveUserId(payload);
    if (!userId) {
      throw new Error('Unable to resolve user ID for Telegram payment');
    }

    if (this.options.paymentModel) {
      const stored = await this.options.paymentModel.create({
        userId,
        telegramInvoiceId: payment.invoice_payload || 'unknown',
        starsAmount: payment.total_amount,
        telegramPaymentId: payment.telegram_payment_charge_id,
        status: PaymentStatus.RECEIVED,
        rawPayload: payload,
      });

      console.log('✅ Telegram payment persisted:', stored.id);
      return this.mapPaymentRecord(stored, payment.provider_payment_charge_id);
    }

    console.warn('⚠️ PaymentModel not configured, returning ephemeral record');
    return {
      id: payment.telegram_payment_charge_id,
      userId,
      telegramInvoiceId: payment.invoice_payload || 'unknown',
      starsAmount: payment.total_amount,
      status: PaymentStatus.RECEIVED,
      telegramChargeId: payment.telegram_payment_charge_id,
      providerChargeId: payment.provider_payment_charge_id,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  }

  /**
   * Verify pre-checkout query before payment
   */
  async verifyPreCheckout(query: TelegramPaymentPayload): Promise<boolean> {
    const preCheckout = query.pre_checkout_query;
    if (!preCheckout) {
      return false;
    }

    console.log('🔍 Verifying pre-checkout:', {
      userId: preCheckout.from.id,
      amount: preCheckout.total_amount,
      currency: preCheckout.currency,
    });

    const minAmount = this.options.minStarsAmount ?? parseInt(process.env.MIN_CONVERSION_STARS || '0', 10);
    const maxAmount = this.options.maxStarsAmount ?? 0;
    const allowedCurrencies = this.options.allowedCurrencies;

    if (allowedCurrencies && !allowedCurrencies.includes(preCheckout.currency)) {
      console.warn(`⚠️ Currency ${preCheckout.currency} not allowed`);
      return false;
    }

    if (minAmount && preCheckout.total_amount < minAmount) {
      console.warn(`⚠️ Amount ${preCheckout.total_amount} below minimum ${minAmount}`);
      return false;
    }

    if (maxAmount && preCheckout.total_amount > maxAmount) {
      console.warn(`⚠️ Amount ${preCheckout.total_amount} exceeds maximum ${maxAmount}`);
      return false;
    }

    if (this.options.invoicePrefix && preCheckout.invoice_payload && !preCheckout.invoice_payload.startsWith(this.options.invoicePrefix)) {
      console.warn('⚠️ Invoice payload prefix mismatch');
      return false;
    }

    if (this.options.customValidator) {
      const result = await this.options.customValidator(preCheckout);
      if (!result) {
        console.warn('⚠️ Custom validator rejected pre-checkout');
        return false;
      }
    }

    return true;
  }

  /**
   * Get bot webhook info
   */
  async getWebhookInfo(): Promise<any> {
    try {
      return await this.bot.telegram.getWebhookInfo();
    } catch (error) {
      console.error('❌ Failed to get webhook info:', error);
      throw error;
    }
  }

  /**
   * Get Telegraf bot instance for middleware integration
   */
  getBot(): Telegraf {
    return this.bot;
  }

  private resolveUserId(payload: TelegramPaymentPayload): string | null {
    if (this.options.resolveUserId) {
      const resolved = this.options.resolveUserId(payload);
      if (resolved) {
        return resolved;
      }
    }

    if (this.options.defaultUserId) {
      return this.options.defaultUserId;
    }

    if (payload.message?.from?.id) {
      return payload.message.from.id.toString();
    }

    return null;
  }

  private mapPaymentRecord(payment: Payment, providerChargeId?: string): PaymentRecord {
    return {
      id: payment.id,
      userId: payment.userId,
      telegramInvoiceId: payment.telegramInvoiceId,
      starsAmount: payment.starsAmount,
      status: payment.status,
      telegramChargeId: payment.telegramPaymentId,
      providerChargeId,
      createdAt: payment.createdAt,
      updatedAt: payment.updatedAt,
    };
  }
}

export default TelegramService;
