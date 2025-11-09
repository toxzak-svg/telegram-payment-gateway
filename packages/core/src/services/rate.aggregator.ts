export class RateAggregatorService {
  async getRate(from: string, to: string): Promise<number> {
    // Stub rates
    const rates: any = {
      'STARS-USD': 0.015,
      'TON-USD': 2.5,
      'USDT-USD': 1,
    };
    return rates[`${from}-${to}`] || 1;
  }
}
