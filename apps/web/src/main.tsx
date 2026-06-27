import React, { useEffect } from 'react';
import ReactDOM from 'react-dom/client';
import { QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider } from 'react-router-dom';
import './lib/i18n';
import './styles/index.css';
import { queryClient } from './lib/queryClient';
import { router } from './router';
import { applyTheme, getStoredTheme, watchSystemTheme } from './lib/theme';
import { useAuthStore } from './store/auth';
import { useUIStore } from './store/ui';
import { refreshSession } from './lib/api';
import { BrandSplash } from './components/BrandSplash';

applyTheme(getStoredTheme());

function Root() {
  const status = useAuthStore((s) => s.status);

  useEffect(() => {
    const unwatch = watchSystemTheme(() => useUIStore.getState().theme);
    void refreshSession().then((token) => {
      if (!token) useAuthStore.getState().setStatus('unauthenticated');
    });
    return unwatch;
  }, []);

  if (status === 'loading') return <BrandSplash />;
  return <RouterProvider router={router} />;
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <Root />
    </QueryClientProvider>
  </React.StrictMode>,
);
