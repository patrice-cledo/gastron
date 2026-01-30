import { useSuperwall, usePlacement } from 'expo-superwall';
import type { usePlacementCallbacks } from 'expo-superwall';

/**
 * Superwall service for managing paywalls and subscriptions
 * 
 * This service provides helper functions and hooks for integrating
 * Superwall paywalls throughout the app.
 */

// Superwall API Keys - should be set via environment variables
export const SUPERWALL_API_KEYS = {
  ios: process.env.EXPO_PUBLIC_SUPERWALL_IOS_API_KEY || '',
  android: process.env.EXPO_PUBLIC_SUPERWALL_ANDROID_API_KEY || '',
};

/**
 * Hook to access Superwall instance
 * Use this in components to trigger paywalls, check subscription status, etc.
 */
export const useSuperwallService = () => {
  const superwall = useSuperwall();
  return superwall;
};

/**
 * Hook to get a specific placement
 * Use this to show paywalls at specific placements configured in Superwall dashboard
 */
export const useSuperwallPlacement = (callbacks?: usePlacementCallbacks) => {
  return usePlacement(callbacks);
};

/**
 * Helper function to identify user with Superwall
 * Call this after user logs in to sync subscription status
 */
export const identifyUser = async (superwall: ReturnType<typeof useSuperwall>, userId: string) => {
  try {
    const sw = superwall as unknown as { identify?: (id: string, options?: unknown) => Promise<void> };
    await sw.identify?.(userId);
  } catch (error) {
    console.error('❌ Error identifying Superwall user:', error);
  }
};

/**
 * Helper function to reset user session
 * Call this when user logs out
 */
export const resetUser = async (superwall: ReturnType<typeof useSuperwall>) => {
  try {
    const sw = superwall as unknown as { reset?: () => Promise<void> };
    await sw.reset?.();
  } catch (error) {
    console.error('❌ Error resetting Superwall user:', error);
  }
};

/**
 * Helper function to check if user has active subscription
 */
export const hasActiveSubscription = (superwall: unknown): boolean => {
  try {
    const sw = superwall as any;
    const status = sw?.subscriptionStatus?.status ?? sw?.user?.subscriptionStatus;
    return status === 'ACTIVE';
  } catch (error) {
    console.error('❌ Error checking subscription status:', error);
    return false;
  }
};

/**
 * Helper function to register purchase
 * Call this after a successful purchase to sync with Superwall
 */
export const registerPurchase = async (
  superwall: ReturnType<typeof useSuperwall>,
  productId: string,
  transactionId: string
) => {
  try {
    const sw = superwall as unknown as { register?: (id: string) => Promise<void> };
    await sw.register?.(transactionId);
  } catch (error) {
    console.error('❌ Error registering purchase:', error);
  }
};
