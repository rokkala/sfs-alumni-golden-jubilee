/** Browser helpers for Razorpay Checkout.js */

export type CheckoutOrder = {
  orderId: string;
  amount: number;
  currency: string;
  keyId: string;
  name?: string | null;
  email?: string | null;
  contact?: string | null;
  description?: string | null;
};

type RazorpayHandlerResponse = {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
};

export type CheckoutFailure = { failed: true; message: string };

export type OpenCheckoutResult = RazorpayHandlerResponse | CheckoutFailure | null;

declare global {
  interface Window {
    Razorpay?: new (options: Record<string, unknown>) => {
      open: () => void;
      on: (event: string, cb: (resp: unknown) => void) => void;
    };
  }
}

let scriptPromise: Promise<void> | null = null;

export function loadRazorpayScript(): Promise<void> {
  if (typeof window === 'undefined') return Promise.reject(new Error('no window'));
  if (window.Razorpay) return Promise.resolve();
  if (scriptPromise) return scriptPromise;
  scriptPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector('script[data-razorpay-checkout]');
    if (existing) {
      existing.addEventListener('load', () => resolve());
      existing.addEventListener('error', () => reject(new Error('Checkout script failed')));
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.async = true;
    script.dataset.razorpayCheckout = '1';
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Checkout script failed'));
    document.body.appendChild(script);
  });
  return scriptPromise;
}

function paymentFailureMessage(resp: unknown): string {
  const description =
    resp &&
    typeof resp === 'object' &&
    'error' in resp &&
    resp.error &&
    typeof resp.error === 'object' &&
    'description' in resp.error
      ? String((resp.error as { description?: unknown }).description || '')
      : '';
  return description || 'Payment failed. Please try again.';
}

export async function openRazorpayCheckout(order: CheckoutOrder): Promise<OpenCheckoutResult> {
  await loadRazorpayScript();
  if (!window.Razorpay) throw new Error('Razorpay Checkout unavailable');

  return new Promise((resolve) => {
    let failureMessage = '';
    let settled = false;
    const rzp = new window.Razorpay!({
      key: order.keyId,
      amount: order.amount,
      currency: order.currency,
      name: 'SFS Alumni',
      description: order.description || 'Event registration',
      order_id: order.orderId,
      prefill: {
        name: order.name || '',
        email: order.email || '',
        contact: order.contact || '',
      },
      // Desktop shows a UPI QR (PhonePe and Google Pay can scan it).
      // Mobile web shows those two apps via UPI intent. Collect/VPA entry stays off.
      config: {
        display: {
          blocks: {
            upi: {
              name: 'Pay via UPI',
              instruments: [
                {
                  method: 'upi',
                  flows: ['qr', 'intent'],
                  apps: ['google_pay', 'phonepe'],
                },
              ],
            },
          },
          sequence: ['block.upi'],
          preferences: {
            show_default_blocks: true,
          },
          hide: [{ method: 'upi', flows: ['collect'] }],
        },
      },
      handler: (response: RazorpayHandlerResponse) => {
        if (settled) return;
        settled = true;
        resolve(response);
      },
      modal: {
        ondismiss: () => {
          if (settled) return;
          settled = true;
          resolve(failureMessage ? { failed: true, message: failureMessage } : null);
        },
      },
    });
    rzp.on('payment.failed', (resp: unknown) => {
      failureMessage = paymentFailureMessage(resp);
    });
    rzp.open();
  });
}
