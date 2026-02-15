/**
 * Toast hook wrapper for sileo
 * Provides a shadcn/ui compatible interface using sileo toasts
 */

import { sileo } from 'sileo';

interface ToastOptions {
  title?: string;
  description?: string;
  variant?: 'default' | 'destructive';
}

export function useToast() {
  const toast = (options: ToastOptions) => {
    const title = options.title || options.description || '';
    const description = options.title && options.description ? options.description : undefined;

    if (options.variant === 'destructive') {
      sileo.error({ title, description });
    } else {
      sileo.show({ title, description });
    }
  };

  // Add convenience methods
  toast.success = (message: string) => sileo.success({ title: message });
  toast.error = (message: string) => sileo.error({ title: message });
  toast.info = (message: string) => sileo.info({ title: message });
  toast.warning = (message: string) => sileo.warning({ title: message });

  return { toast };
}
