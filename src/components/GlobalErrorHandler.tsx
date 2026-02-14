import { useEffect } from 'react';
import { toast } from 'sonner';

export const GlobalErrorHandler = () => {
  useEffect(() => {
    const handleError = (event: ErrorEvent) => {
      console.error('Global Error Caught:', event.error);
      toast.error('An unexpected error occurred', {
        description: event.message || 'Please reload the page or try again.',
        duration: 5000,
      });
    };

    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      console.error('Unhandled Promise Rejection:', event.reason);
      const message = event.reason?.message || 'A network or async operation failed unexpectedly.';
      toast.error('Operation Failed', {
        description: message,
        duration: 5000,
      });
    };

    window.addEventListener('error', handleError);
    window.addEventListener('unhandledrejection', handleUnhandledRejection);

    return () => {
      window.removeEventListener('error', handleError);
      window.removeEventListener('unhandledrejection', handleUnhandledRejection);
    };
  }, []);

  return null;
};
