import React, { useEffect } from 'react';
import ReactDOM from 'react-dom/client';
import { QueryClientProvider, QueryClient } from '@tanstack/react-query';
import { RouterProvider } from 'react-router-dom';
import './styles/index.css';
import { router } from './router';
import { usePartnerAuthStore } from './store/auth';
import { refreshPartnerSession } from './lib/api';

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, staleTime: 30_000 } },
});

function Root() {
  useEffect(() => {
    void refreshPartnerSession().then((token) => {
      if (!token) usePartnerAuthStore.getState().setStatus('unauthenticated');
    });
  }, []);
  return <RouterProvider router={router} />;
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <Root />
    </QueryClientProvider>
  </React.StrictMode>,
);
