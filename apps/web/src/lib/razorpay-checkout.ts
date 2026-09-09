declare global {
  interface Window {
    Razorpay?: new (options: Record<string, unknown>) => { open: () => void };
  }
}

function loadRazorpayScript(): Promise<void> {
  if (window.Razorpay) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = 'https://checkout.razorpay.com/v1/checkout.js';
    s.onload = () => resolve();
    s.onerror = () => reject(new Error('Failed to load Razorpay'));
    document.body.appendChild(s);
  });
}

export type FeeCheckoutParams = {
  orderId: string;
  gatewayOrderId: string;
  amount: number;
  currency: string;
  razorpayKeyId?: string;
  mock?: boolean;
  studentName?: string;
  onSuccess: (payload: { razorpayPaymentId?: string; razorpaySignature?: string }) => void | Promise<void>;
  onError?: (err: Error) => void;
};

export async function openFeeCheckout(params: FeeCheckoutParams): Promise<void> {
  if (params.mock || !params.razorpayKeyId) {
    const mockId = `pay_mock_${Date.now()}`;
    await params.onSuccess({ razorpayPaymentId: mockId, razorpaySignature: 'mock_signature' });
    return;
  }

  await loadRazorpayScript();
  if (!window.Razorpay) throw new Error('Razorpay unavailable');

  return new Promise((resolve, reject) => {
    const rzp = new window.Razorpay!({
      key: params.razorpayKeyId,
      amount: Math.round(params.amount * 100),
      currency: params.currency,
      name: 'School Fee Payment',
      description: 'Fee invoice payment',
      order_id: params.gatewayOrderId,
      handler: async (response: { razorpay_payment_id: string; razorpay_signature: string }) => {
        try {
          await params.onSuccess({
            razorpayPaymentId: response.razorpay_payment_id,
            razorpaySignature: response.razorpay_signature,
          });
          resolve();
        } catch (e) {
          reject(e);
        }
      },
      prefill: params.studentName ? { name: params.studentName } : undefined,
      theme: { color: '#1e3a8a' },
      modal: {
        ondismiss: () => reject(new Error('Payment cancelled')),
      },
    });
    rzp.open();
  });
}
