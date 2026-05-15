'use client';

import '@rainbow-me/rainbowkit/styles.css';
import { RainbowKitProvider as RKProvider } from '@rainbow-me/rainbowkit';
import { WagmiProvider } from 'wagmi';
import { QueryClientProvider, QueryClient } from '@tanstack/react-query';
import { config } from '../lib/wagmi';

const queryClient = new QueryClient();

export function RainbowKitProvider({ children }) {
  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <RKProvider>
          {children}
        </RKProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
