import React from 'react';
import { render, waitFor, fireEvent } from '@testing-library/react-native';

const mockNavigate = jest.fn();

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: mockNavigate }),
}));

jest.mock('../../api/search', () => ({
  getProduct: jest.fn(),
}));

jest.mock('../../i18n', () => {
  const t = (key: string) => key; // stable ref — prevents useCallback([t]) infinite loop
  return { useI18n: () => ({ t, lang: 'en', setLang: jest.fn() }) };
});

jest.mock('../../components/EmptyState', () => {
  const { View, Text, TouchableOpacity } = require('react-native');
  return ({ title, subtitle, actionLabel, onAction }: any) => (
    <View>
      <Text>{title}</Text>
      <Text>{subtitle}</Text>
      {actionLabel && <TouchableOpacity onPress={onAction}><Text>{actionLabel}</Text></TouchableOpacity>}
    </View>
  );
});

import ProductDetailScreen from '../../screens/ProductDetailScreen';
import { getProduct } from '../../api/search';

const mockGetProduct = getProduct as jest.Mock;

const FULL_PRODUCT = {
  id: 'prod-1',
  name: 'Premium Widget',
  brand: 'BrandCo',
  codeGold: 'GLD-001',
  barcode: '1234567890128',
  description: 'A high quality product.',
  category: 'Electronics',
  subcategory: 'Audio',
  family: 'Accessories',
  images: [],
  createdAt: '2025-01-01T00:00:00.000Z',
};

const routeProps = { params: { id: 'prod-1' } };

describe('ProductDetailScreen — UC-4: view product details', () => {
  beforeEach(() => jest.clearAllMocks());

  it('displays product name after loading', async () => {
    mockGetProduct.mockResolvedValueOnce(FULL_PRODUCT);
    const { findByText } = render(<ProductDetailScreen route={routeProps} />);
    await findByText('Premium Widget');
  });

  it('displays EAN barcode in info card', async () => {
    mockGetProduct.mockResolvedValueOnce(FULL_PRODUCT);
    const { findByText } = render(<ProductDetailScreen route={routeProps} />);
    await waitFor(async () => {
      await findByText('1234567890128');
    });
  });

  it('displays Code Gold in info card', async () => {
    mockGetProduct.mockResolvedValueOnce(FULL_PRODUCT);
    const { findByText } = render(<ProductDetailScreen route={routeProps} />);
    await findByText('GLD-001');
  });

  it('displays brand', async () => {
    mockGetProduct.mockResolvedValueOnce(FULL_PRODUCT);
    const { findAllByText } = render(<ProductDetailScreen route={routeProps} />);
    const brandItems = await findAllByText('BrandCo');
    expect(brandItems.length).toBeGreaterThan(0);
  });

  it('displays category', async () => {
    mockGetProduct.mockResolvedValueOnce(FULL_PRODUCT);
    const { findAllByText } = render(<ProductDetailScreen route={routeProps} />);
    const catItems = await findAllByText('Electronics');
    expect(catItems.length).toBeGreaterThan(0);
  });

  it('displays family', async () => {
    mockGetProduct.mockResolvedValueOnce(FULL_PRODUCT);
    const { findByText } = render(<ProductDetailScreen route={routeProps} />);
    await findByText('Accessories');
  });

  it('displays subcategory', async () => {
    mockGetProduct.mockResolvedValueOnce(FULL_PRODUCT);
    const { findByText } = render(<ProductDetailScreen route={routeProps} />);
    await findByText('Audio');
  });

  it('displays description', async () => {
    mockGetProduct.mockResolvedValueOnce(FULL_PRODUCT);
    const { findByText } = render(<ProductDetailScreen route={routeProps} />);
    await findByText('A high quality product.');
  });

  it('shows search similar button and navigates to Search when pressed', async () => {
    mockGetProduct.mockResolvedValueOnce(FULL_PRODUCT);
    const { findByLabelText } = render(<ProductDetailScreen route={routeProps} />);

    const btn = await findByLabelText('product_similarA11y');
    fireEvent.press(btn);
    expect(mockNavigate).toHaveBeenCalledWith('Search', {});
  });

  it('shows error state when getProduct fails', async () => {
    mockGetProduct.mockRejectedValueOnce({ message: 'Not found' });
    const { findByText } = render(<ProductDetailScreen route={routeProps} />);
    await findByText('product_error_title');
  });

  it('retries loading when retry is pressed from error state', async () => {
    mockGetProduct
      .mockRejectedValueOnce({ message: 'Not found' })
      .mockResolvedValueOnce(FULL_PRODUCT);

    const { findByText } = render(<ProductDetailScreen route={routeProps} />);
    const retryBtn = await findByText('product_retry');
    fireEvent.press(retryBtn);

    await findByText('Premium Widget');
    expect(mockGetProduct).toHaveBeenCalledTimes(2);
  });

  it('calls getProduct with the correct product id', async () => {
    mockGetProduct.mockResolvedValueOnce(FULL_PRODUCT);
    render(<ProductDetailScreen route={routeProps} />);
    await waitFor(() => expect(mockGetProduct).toHaveBeenCalledWith('prod-1'));
  });
});
