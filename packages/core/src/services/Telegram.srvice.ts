export interface TelegramPayment {
  id: string;
  telegramPaymentId: string;
}

export class TelegramService {
  async processPayment(payload: any): Promise<TelegramPayment> {
    return {
      id: 'test-' + Date.now(),
      telegramPaymentId: payload.telegramPaymentId || 'test-payment',
    };
  }
}
