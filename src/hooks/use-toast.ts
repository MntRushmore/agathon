/**
 * Toast hook wrapper for sonner
 * Provides a shadcn/ui compatible interface using sonner toasts
 */

import { toast as sonnerToast } from 'sonner';

interface ToastOptions {
  title?: string;
  description?: string;
  variant?: 'default' | 'destructive';
}

export function useToast() {
  const toast = (options: ToastOptions) => {
    const message = options.title || options.description || '';

    if (options.variant === 'destructive') {
      sonnerToast.error(message, {
        description: options.title && options.description ? options.description : undefined,
      });
    } else {
      sonnerToast(message, {
        description: options.title && options.description ? options.description : undefined,
      });
    }
  };

  // Add convenience methods
  toast.success = (message: string) => sonnerToast.success(message);
  toast.error = (message: string) => sonnerToast.error(message);
  toast.info = (message: string) => sonnerToast.info(message);
  toast.warning = (message: string) => sonnerToast.warning(message);

  return { toast };
}
