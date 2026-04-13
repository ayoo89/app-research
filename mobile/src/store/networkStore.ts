import { create } from 'zustand';

interface NetworkState {
  isOnline: boolean;
  startMonitoring: () => () => void;
}

export const useNetworkStore = create<NetworkState>((set) => ({
  isOnline: true,

  startMonitoring: () => {
    try {
      // NetInfo native module may not be available in all build configs
      const NetInfo = require('@react-native-community/netinfo').default;
      const unsubscribe = NetInfo.addEventListener((state: any) => {
        set({ isOnline: !!(state.isConnected && state.isInternetReachable !== false) });
      });
      return unsubscribe;
    } catch {
      // NetInfo unavailable — assume online
      return () => {};
    }
  },
}));
