import React from 'react';
import { render, fireEvent, waitFor, act } from '@testing-library/react-native';

const mockNavigate  = jest.fn();
const mockGoBack    = jest.fn();
const mockReplace   = jest.fn();

// Capture onBarcodeScanned so tests can fire it programmatically
let capturedBarcodeHandler: ((e: { type: string; data: string }) => void) | undefined;
let mockPermission = { granted: true };
const mockRequestPermission = jest.fn();

jest.mock('expo-camera', () => ({
  CameraView: ({ onBarcodeScanned, ...rest }: any) => {
    capturedBarcodeHandler = onBarcodeScanned;
    const { View } = require('react-native');
    return <View testID="camera-view" {...rest} />;
  },
  useCameraPermissions: () => [mockPermission, mockRequestPermission],
}));

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: mockNavigate, goBack: mockGoBack, replace: mockReplace }),
  useRoute: () => ({ params: {} }),
}));

jest.mock('../../api/search', () => ({
  searchByBarcode: jest.fn(),
}));

jest.mock('../../store/networkStore', () => ({
  useNetworkStore: jest.fn(),
}));

jest.mock('../../i18n', () => ({
  useI18n: () => ({ t: (key: string) => key, lang: 'en', setLang: jest.fn() }),
}));

import ScannerScreen from '../../screens/ScannerScreen';
import { searchByBarcode } from '../../api/search';
import { useNetworkStore } from '../../store/networkStore';

const mockSearchByBarcode = searchByBarcode as unknown as jest.Mock;
const mockUseNetworkStore = useNetworkStore as unknown as jest.Mock;

const MOCK_PRODUCT = {
  id: 'prod-1', name: 'Widget', brand: null, codeGold: null, barcode: '1234567890128',
  description: null, category: null, subcategory: null, family: null, images: [], createdAt: '',
};

describe('ScannerScreen — UC-5/6: barcode and QR code scanning', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    capturedBarcodeHandler = undefined;
    mockPermission = { granted: true };
    mockUseNetworkStore.mockImplementation((s: any) => s({ isOnline: true }));
  });

  it('shows camera view when permission is granted', () => {
    const { getByTestId } = render(<ScannerScreen />);
    expect(getByTestId('camera-view')).toBeTruthy();
  });

  it('shows permission request UI when camera is not granted', () => {
    mockPermission = { granted: false };
    const { getByText } = render(<ScannerScreen />);
    expect(getByText('scanner_perm_title')).toBeTruthy();
    expect(getByText('scanner_grant_perm')).toBeTruthy();
  });

  it('calls requestPermission when grant button is pressed', () => {
    mockPermission = { granted: false };
    const { getByText } = render(<ScannerScreen />);
    fireEvent.press(getByText('scanner_grant_perm'));
    expect(mockRequestPermission).toHaveBeenCalled();
  });

  it('navigates to ProductDetail when barcode scan finds a product', async () => {
    mockSearchByBarcode.mockResolvedValueOnce({
      results: [MOCK_PRODUCT],
      meta: { totalMs: 12, cacheHit: false, methods: ['barcode'] },
    });

    render(<ScannerScreen />);

    await act(async () => {
      capturedBarcodeHandler?.({ type: 'ean13', data: '1234567890128' });
    });

    await waitFor(() => {
      expect(mockSearchByBarcode).toHaveBeenCalledWith('1234567890128', undefined);
      expect(mockReplace).toHaveBeenCalledWith('ProductDetail', { id: 'prod-1', fromScan: true });
    });
  });

  it('shows not_found state when barcode returns no results', async () => {
    mockSearchByBarcode.mockResolvedValueOnce({
      results: [],
      meta: { totalMs: 8, cacheHit: false, methods: [] },
    });

    const { findByText } = render(<ScannerScreen />);

    await act(async () => {
      capturedBarcodeHandler?.({ type: 'ean13', data: '9999999999999' });
    });

    await findByText('scanner_status_notfound');
  });

  it('shows error state when offline and barcode is scanned', async () => {
    mockUseNetworkStore.mockImplementation((s: any) => s({ isOnline: false }));
    const { findByText } = render(<ScannerScreen />);

    await act(async () => {
      capturedBarcodeHandler?.({ type: 'ean13', data: '1234567890128' });
    });

    await findByText('scanner_offline');
  });

  it('shows error state when API throws', async () => {
    mockSearchByBarcode.mockRejectedValueOnce({ message: 'Server error' });
    const { findByText } = render(<ScannerScreen />);

    await act(async () => {
      capturedBarcodeHandler?.({ type: 'ean13', data: '1234567890128' });
    });

    await findByText(/Server error/);
  });

  it('navigates to Search with barcode when manual search is pressed (not_found)', async () => {
    mockSearchByBarcode.mockResolvedValueOnce({
      results: [],
      meta: { totalMs: 8, cacheHit: false, methods: [] },
    });

    const { findByText } = render(<ScannerScreen />);

    await act(async () => {
      capturedBarcodeHandler?.({ type: 'ean13', data: '9999999999999' });
    });

    const manualBtn = await findByText('scanner_manual');
    fireEvent.press(manualBtn);

    expect(mockReplace).toHaveBeenCalledWith('Search', {
      barcode: '9999999999999',
      filters: undefined,
    });
  });

  it('closes scanner when close button is pressed', () => {
    const { getByLabelText } = render(<ScannerScreen />);
    fireEvent.press(getByLabelText('scanner_close_a11y'));
    expect(mockGoBack).toHaveBeenCalled();
  });

  it('resets scan state when scan again is pressed', async () => {
    mockSearchByBarcode.mockResolvedValueOnce({
      results: [],
      meta: { totalMs: 8, cacheHit: false, methods: [] },
    });

    const { findByText, queryByTestId } = render(<ScannerScreen />);

    await act(async () => {
      capturedBarcodeHandler?.({ type: 'ean13', data: '9999999999999' });
    });

    const againBtn = await findByText('scanner_again');
    fireEvent.press(againBtn);

    // Camera should reappear after reset
    await waitFor(() => expect(queryByTestId('camera-view')).toBeTruthy());
  });
});
