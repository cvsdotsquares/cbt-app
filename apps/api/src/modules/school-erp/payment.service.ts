import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac } from 'crypto';

export type PaymentOrderResult = {
  orderId: string;
  gatewayOrderId: string;
  amount: number;
  currency: string;
  razorpayKeyId?: string;
  mock: boolean;
};

@Injectable()
export class PaymentService {
  private readonly logger = new Logger(PaymentService.name);

  constructor(private config: ConfigService) {}

  isConfigured(): boolean {
    return !!(this.config.get('RAZORPAY_KEY_ID') && this.config.get('RAZORPAY_KEY_SECRET'));
  }

  getKeyId(): string | undefined {
    return this.config.get<string>('RAZORPAY_KEY_ID');
  }

  async createRazorpayOrder(params: {
    amountInr: number;
    receipt: string;
    notes?: Record<string, string>;
  }): Promise<{ id: string; amount: number; currency: string }> {
    const keyId = this.config.get<string>('RAZORPAY_KEY_ID');
    const keySecret = this.config.get<string>('RAZORPAY_KEY_SECRET');
    if (!keyId || !keySecret) {
      const mockId = `order_mock_${Date.now()}`;
      this.logger.log(`[DEV PAYMENT] Mock order ${mockId} for ₹${params.amountInr}`);
      return { id: mockId, amount: Math.round(params.amountInr * 100), currency: 'INR' };
    }

    const amountPaise = Math.round(params.amountInr * 100);
    const auth = Buffer.from(`${keyId}:${keySecret}`).toString('base64');
    const res = await fetch('https://api.razorpay.com/v1/orders', {
      method: 'POST',
      headers: {
        Authorization: `Basic ${auth}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        amount: amountPaise,
        currency: 'INR',
        receipt: params.receipt,
        notes: params.notes,
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      this.logger.error(`Razorpay order failed: ${err}`);
      throw new Error('Payment gateway error');
    }

    const data = (await res.json()) as { id: string; amount: number; currency: string };
    return data;
  }

  verifyRazorpaySignature(orderId: string, paymentId: string, signature: string): boolean {
    const secret = this.config.get<string>('RAZORPAY_KEY_SECRET');
    if (!secret) {
      // Dev/mock mode — accept any non-empty signature
      return signature.length > 0;
    }
    const expected = createHmac('sha256', secret)
      .update(`${orderId}|${paymentId}`)
      .digest('hex');
    return expected === signature;
  }
}
