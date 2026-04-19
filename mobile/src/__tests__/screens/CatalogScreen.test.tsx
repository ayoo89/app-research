import React from 'react';
import { render, waitFor, fireEvent } from '@testing-library/react-native';

const mockNavigate = jest.fn();

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: mockNavigate }),
}));

jest.mock('../../api/admin', () => ({
  listProducts: jest.fn(),
}));

jest.mock('../../store/authStore', () => ({
  useAuthStore: jest.fn(),
}));

jest.mock('../../i18n', () => {
  const t = (key: string) => key; // stable ref — prevents useCallback([t]) infinite loop
  return { useI18n: () => ({ t, lang: 'en', setLang: jest.fn() }) };
});

jest.mock('../../components/ProductCard', () => {
  const { TouchableOpacity, Text } = require('react-native');
  return ({ item, onPress }: any) => (
    <TouchableOpacity onPress={onPress} testID={`product-${item.id}`}>
      <Text>{item.name}</Text>
    </TouchableOpacity>
  );
});

import CatalogScreen from '../../screens/CatalogScreen';
import { listProducts } from '../../api/admin';
import { useAuthStore } from '../../store/authStore';

const mockListProducts = listProducts as unknown as jest.Mock;
const mockUseAuthStore = useAuthStore as unknown as jest.Mock;

const MOCK_PRODUCTS = {
  data: [
    { id: 'p1', name: 'Widget A', brand: null, codeGold: null, barcode: null,
      description: null, category: null, subcategory: null, family: null, images: [], createdAt: '' },
    { id: 'p2', name: 'Widget B', brand: null, codeGold: null, barcode: null,
      description: null, category: null, subcategory: null, family: null, images: [], createdAt: '' },
  ],
  total: 2, page: 1, limit: 20,
};

describe('CatalogScreen — UC-4: browse product catalog', () => {
  beforeEach(() => jest.clearAllMocks());

  it('loads and displays products on mount', async () => {
    mockListProducts.mockResolvedValueOnce(MOCK_PRODUCTS);
    mockUseAuthStore.mockImplementation((s: any) => s({ user: { role: 'user' } }));

    const { findByTestId } = render(<CatalogScreen />);
    await findByTestId('product-p1');
    await findByTestId('product-p2');
  });

  it('navigates to ProductDetail when a product card is pressed', async () => {
    mockListProducts.mockResolvedValueOnce(MOCK_PRODUCTS);
    mockUseAuthStore.mockImplementation((s: any) => s({ user: { role: 'user' } }));

    const { findByTestId } = render(<CatalogScreen />);
    const card = await findByTestId('product-p1');
    fireEvent.press(card);

    expect(mockNavigate).toHaveBeenCalledWith('ProductDetail', { id: 'p1' });
  });

  it('shows FAB for admin role', async () => {
    mockListProducts.mockResolvedValueOnce(MOCK_PRODUCTS);
    mockUseAuthStore.mockImplementation((s: any) => s({ user: { role: 'admin' } }));

    const { findByLabelText } = render(<CatalogScreen />);
    await findByLabelText('nav_add_product');
  });

  it('shows FAB for super_admin role', async () => {
    mockListProducts.mockResolvedValueOnce(MOCK_PRODUCTS);
    mockUseAuthStore.mockImplementation((s: any) => s({ user: { role: 'super_admin' } }));

    const { findByLabelText } = render(<CatalogScreen />);
    await findByLabelText('nav_add_product');
  });

  it('hides FAB for regular user role', async () => {
    mockListProducts.mockResolvedValueOnce(MOCK_PRODUCTS);
    mockUseAuthStore.mockImplementation((s: any) => s({ user: { role: 'user' } }));

    const { queryByLabelText, findByTestId } = render(<CatalogScreen />);
    await findByTestId('product-p1');
    expect(queryByLabelText('nav_add_product')).toBeNull();
  });

  it('FAB navigates to ProductForm when pressed (admin)', async () => {
    mockListProducts.mockResolvedValueOnce(MOCK_PRODUCTS);
    mockUseAuthStore.mockImplementation((s: any) => s({ user: { role: 'admin' } }));

    const { findByLabelText } = render(<CatalogScreen />);
    const fab = await findByLabelText('nav_add_product');
    fireEvent.press(fab);

    expect(mockNavigate).toHaveBeenCalledWith('ProductForm');
  });

  it('shows empty state when product list is empty', async () => {
    mockListProducts.mockResolvedValueOnce({ data: [], total: 0, page: 1, limit: 20 });
    mockUseAuthStore.mockImplementation((s: any) => s({ user: { role: 'user' } }));

    const { findByText } = render(<CatalogScreen />);
    await findByText('catalog_empty');
  });

  it('shows error message when listProducts fails', async () => {
    mockListProducts.mockRejectedValueOnce({ message: 'Network error' });
    mockUseAuthStore.mockImplementation((s: any) => s({ user: { role: 'user' } }));

    const { findByText } = render(<CatalogScreen />);
    await findByText(/Network error/);
  });
});
