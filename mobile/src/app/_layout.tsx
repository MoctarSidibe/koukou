import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { QuickCaptureProvider } from '@/components/capture/QuickCaptureProvider';
import { CreateCenterProvider } from '@/components/create/CreateCenter';
import { OfflineAutoSync } from '@/components/OfflineAutoSync';
import { AuthProvider } from '@/auth/AuthContext';
import { palette } from '@/constants/theme';

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 30_000, retry: 1 } },
});

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <QuickCaptureProvider>
            <CreateCenterProvider>
              <OfflineAutoSync />
              <StatusBar style="dark" />
              <Stack
                screenOptions={{
                  headerShown: false,
                  contentStyle: { backgroundColor: palette.paper },
                }}>
                <Stack.Screen name="login" />
                <Stack.Screen name="register" />
                <Stack.Screen name="(tabs)" />
                <Stack.Screen name="lot/[id]" />
              </Stack>
            </CreateCenterProvider>
          </QuickCaptureProvider>
        </AuthProvider>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}