import { create } from 'zustand';
import NetInfo from '@react-native-community/netinfo';

interface NetworkState {
  isOnline: boolean;
  startMonitoring: () => () => void;
}

export const useNetworkStore = create<NetworkState>((set) => ({
  isOnline: true,

  startMonitoring: () => {
    const unsubscribe = NetInfo.addEventListener((state) => {
      set({ isOnline: !!(state.isConnected && state.isInternetReachable !== false) });
    });
    return unsubscribe;
  },
}));
