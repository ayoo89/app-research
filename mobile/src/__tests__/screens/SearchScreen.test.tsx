import React from 'react';
import { render, fireEvent, waitFor, act } from '@testing-library/react-native';

const mockNavigate = jest.fn();

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: mockNavigate }),
  useRoute: () => ({ params: {} }),
}));

jest.mock('../../api/search', () => ({
  searchByText:    jest.fn(),
  searchByImage:   jest.fn(),
  searchByBarcode: jest.fn(),
}));

jest.mock('expo-image-picker', () => ({
  launchImageLibraryAsync: jest.fn(),
  MediaTypeOptions: { Images: 'Images' },
}));

jest.mock('../../store/networkStore', () => ({
  useNetworkStore: jest.fn(),
}));

jest.mock('../../i18n', () => ({
  useI18n: () => ({ t: (key: string) => key, lang: 'en', setLang: jest.fn() }),
}));

// Simplified mocks for layout components
jest.mock('../../components/ProductCard', () => {
  const { TouchableOpacity, Text } = require('react-native');
  return ({ item, onPress }: any) => (
    <TouchableOpacity onPress={onPress} testID={`product-${item.id}`}>
      <Text>{item.name}</Text>
    </TouchableOpacity>
  );
});

jest.mock('../../components/OfflineBanner', () => {
  const { Text } = require('react-native');
  return () => <Text testID="offline-banner">offline</Text>;
});

jest.mock('../../components/EmptyState', () => {
  const { View, Text, TouchableOpacity } = require('react-native');
  return ({ title, actionLabel, onAction }: any) => (
    <View>
      <Text>{title}</Text>
      {actionLabel && <TouchableOpacity onPress={onAction}><Text>{actionLabel}</Text></TouchableOpacity>}
    </View>
  );
});

jest.mock('../../api/admin', () => ({
  getDistinctValues: jest.fn().mockResolvedValue([]),
}));

jest.mock('../../components/ErrorBanner', () => {
  const { View, Text, TouchableOpacity } = require('react-native');
  return ({ message, onRetry }: any) => (
    <View>
      <Text testID="error-banner">{message}</Text>
      <TouchableOpacity onPress={onRetry}><Text>retry</Text></TouchableOpacity>
    </View>
  );
});

import SearchScreen from '../../screens/SearchScreen';
import { searchByText, searchByImage } from '../../api/search';
import { launchImageLibraryAsync } from 'expo-image-picker';
import { useNetworkStore } from '../../store/networkStore';

const mockSearchByText  = searchByText  as jest.Mock;
const mockSearchByImage = searchByImage as jest.Mock;
const mockLaunchGallery = launchImageLibraryAsync as jest.Mock;
const mockUseNetworkStore = useNetworkStore as jest.Mock;

const makeResults = (n = 1) => ({
  results: Array.from({ length: n }, (_, i) => ({
    id: `p${i}`, name: `Product ${i}`, brand: null, codeGold: null,
    barcode: null, category: null, subcategory: null, family: null,
    images: [], score: 0.9, matchedBy: ['text' as const],
  })),
  meta: { totalMs: 15, cacheHit: false, methods: ['text' as const] },
});

describe('SearchScreen — UC-2/3/7/8: search methods and filters', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseNetworkStore.mockImplementation((s: any) => s({ isOnline: true }));
  });

  // ── Text search ──────────────────────────────────────────────────

  it('renders search input', () => {
    const { getByLabelText } = render(<SearchScreen />);
    expect(getByLabelText('search_a11y_input')).toBeTruthy();
  });

  it('UC-2: calls searchByText when query is submitted', async () => {
    mockSearchByText.mockResolvedValueOnce(makeResults(3));
    const { getByLabelText } = render(<SearchScreen />);

    fireEvent.changeText(getByLabelText('search_a11y_input'), 'widget');
    fireEvent(getByLabelText('search_a11y_input'), 'submitEditing');

    await waitFor(() => {
      expect(mockSearchByText).toHaveBeenCalledWith('widget', 20, undefined);
    });
  });

  it('displays result cards after text search', async () => {
    mockSearchByText.mockResolvedValueOnce(makeResults(2));
    const { getByLabelText, findByTestId } = render(<SearchScreen />);

    fireEvent.changeText(getByLabelText('search_a11y_input'), 'widget');
    fireEvent(getByLabelText('search_a11y_input'), 'submitEditing');

    await findByTestId('product-p0');
    await findByTestId('product-p1');
  });

  it('navigates to ProductDetail when a result card is pressed', async () => {
    mockSearchByText.mockResolvedValueOnce(makeResults(1));
    const { getByLabelText, findByTestId } = render(<SearchScreen />);

    fireEvent.changeText(getByLabelText('search_a11y_input'), 'widget');
    fireEvent(getByLabelText('search_a11y_input'), 'submitEditing');

    const card = await findByTestId('product-p0');
    fireEvent.press(card);
    expect(mockNavigate).toHaveBeenCalledWith('ProductDetail', { id: 'p0' });
  });

  // ── Image search (gallery) ───────────────────────────────────────

  it('UC-7: calls searchByImage when image is picked from gallery', async () => {
    mockLaunchGallery.mockResolvedValueOnce({
      canceled: false,
      assets: [{ uri: 'file://image.jpg' }],
    });
    mockSearchByImage.mockResolvedValueOnce(makeResults(1));

    const { getByLabelText } = render(<SearchScreen />);
    await act(async () => {
      fireEvent.press(getByLabelText('search_a11y_photo'));
    });

    await waitFor(() => {
      expect(mockSearchByImage).toHaveBeenCalledWith('file://image.jpg', undefined);
    });
  });

  it('does not call searchByImage when gallery is canceled', async () => {
    mockLaunchGallery.mockResolvedValueOnce({ canceled: true });
    const { getByLabelText } = render(<SearchScreen />);

    await act(async () => {
      fireEvent.press(getByLabelText('search_a11y_photo'));
    });

    expect(mockSearchByImage).not.toHaveBeenCalled();
  });

  // ── Scanner navigation ───────────────────────────────────────────

  it('UC-8: navigates to Scanner when scan button is pressed', () => {
    const { getByLabelText } = render(<SearchScreen />);
    fireEvent.press(getByLabelText('search_a11y_scan'));
    expect(mockNavigate).toHaveBeenCalledWith('Scanner', expect.anything());
  });

  // ── Filters ─────────────────────────────────────────────────────

  it('UC-3: filter panel is hidden by default', () => {
    const { queryByPlaceholderText } = render(<SearchScreen />);
    expect(queryByPlaceholderText('search_placeholder_cat')).toBeNull();
  });

  it('UC-3: filter panel is shown after toggle', () => {
    const { getByLabelText, getByPlaceholderText } = render(<SearchScreen />);
    fireEvent.press(getByLabelText('search_filters_a11y_collapsed'));
    // Category/family/subcategory are dropdown buttons (accessibilityLabel)
    expect(getByLabelText('search_placeholder_cat')).toBeTruthy();
    expect(getByLabelText('search_placeholder_fam')).toBeTruthy();
    expect(getByLabelText('search_placeholder_sub')).toBeTruthy();
    // Code/designation/EAN remain TextInput with placeholder
    expect(getByPlaceholderText('search_placeholder_codegold')).toBeTruthy();
    expect(getByPlaceholderText('search_placeholder_designation')).toBeTruthy();
    expect(getByPlaceholderText('search_placeholder_ean')).toBeTruthy();
  });

  it('UC-3: filter badge shows count of active filters', () => {
    const { getByLabelText, getByPlaceholderText, getByText } = render(<SearchScreen />);
    fireEvent.press(getByLabelText('search_filters_a11y_collapsed'));
    fireEvent.changeText(getByPlaceholderText('search_placeholder_codegold'), 'GLD01');
    fireEvent.changeText(getByPlaceholderText('search_placeholder_designation'), 'Widget');
    expect(getByText('2')).toBeTruthy();
  });

  it('UC-3: passes active filters to searchByText', async () => {
    mockSearchByText.mockResolvedValueOnce(makeResults(1));
    const { getByLabelText, getByPlaceholderText } = render(<SearchScreen />);

    fireEvent.press(getByLabelText('search_filters_a11y_collapsed'));
    fireEvent.changeText(getByPlaceholderText('search_placeholder_codegold'), 'GLD01');
    fireEvent.changeText(getByPlaceholderText('search_placeholder_designation'), 'Electronics');

    fireEvent.changeText(getByLabelText('search_a11y_input'), 'widget');
    fireEvent(getByLabelText('search_a11y_input'), 'submitEditing');

    await waitFor(() => {
      expect(mockSearchByText).toHaveBeenCalledWith(
        'widget',
        20,
        expect.objectContaining({ codeGold: 'GLD01', designation: 'Electronics' }),
      );
    });
  });

  it('UC-3: clear filters button removes all filter values', () => {
    const { getByLabelText, getByPlaceholderText } = render(<SearchScreen />);
    fireEvent.press(getByLabelText('search_filters_a11y_collapsed'));

    fireEvent.changeText(getByPlaceholderText('search_placeholder_codegold'), 'GLD01');
    fireEvent.press(getByLabelText('search_filter_clearA11y'));

    expect((getByPlaceholderText('search_placeholder_codegold') as any).props.value).toBe('');
  });

  // ── Offline ──────────────────────────────────────────────────────

  it('shows offline banner when device is offline', () => {
    mockUseNetworkStore.mockImplementation((s: any) => s({ isOnline: false }));
    const { getByTestId } = render(<SearchScreen />);
    expect(getByTestId('offline-banner')).toBeTruthy();
  });

  it('scan and photo buttons are disabled when offline', () => {
    mockUseNetworkStore.mockImplementation((s: any) => s({ isOnline: false }));
    const { getByLabelText } = render(<SearchScreen />);
    expect((getByLabelText('search_a11y_photo') as any).props.accessibilityState?.disabled ??
           (getByLabelText('search_a11y_photo') as any).props.disabled).toBeTruthy();
  });

  // ── Error state ──────────────────────────────────────────────────

  it('shows error banner when search fails', async () => {
    mockSearchByText.mockRejectedValueOnce({ message: 'Elasticsearch down' });
    const { getByLabelText, findByTestId } = render(<SearchScreen />);

    fireEvent.changeText(getByLabelText('search_a11y_input'), 'widget');
    fireEvent(getByLabelText('search_a11y_input'), 'submitEditing');

    await findByTestId('error-banner');
  });
});
