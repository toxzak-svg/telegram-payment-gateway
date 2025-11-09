export class FragmentService {
  constructor(apiKey?: string) {}
  
  async exchangeStars(amount: number, currency: string): Promise<number> {
    return amount * 0.015;
  }
}
