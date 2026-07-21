import { useEffect } from 'react';
import { Toaster as HotToaster, toast } from 'react-hot-toast';

export default function Toaster() {
  useEffect(() => {
    const handleToast = (event: any) => {
      const { message, type = 'success' } = event.detail;
      if (type === 'error') toast.error(message);
      else toast.success(message);
    };

    window.addEventListener('app:toast', handleToast);
    return () => window.removeEventListener('app:toast', handleToast);
  }, []);

  return (
    <HotToaster
      position="top-right"
      toastOptions={{
        style: {
          background: '#1A1A1A',
          color: '#fff',
          border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: '12px',
          fontSize: '13px',
          fontWeight: 'bold',
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
        },
        success: {
          iconTheme: {
            primary: '#009695',
            secondary: '#fff',
          },
        },
        error: {
          iconTheme: {
            primary: '#E85D4E',
            secondary: '#fff',
          },
        },
      }}
    />
  );
}
