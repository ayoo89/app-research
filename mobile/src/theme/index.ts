export const colors = {
  primary:       '#4f46e5',
  primaryDark:   '#3730a3',
  primaryLight:  '#ede9fe',
  accent:        '#06b6d4',
  success:       '#10b981',
  warning:       '#f59e0b',
  error:         '#ef4444',
  errorLight:    '#fef2f2',
  bg:            '#f8f9fa',
  surface:       '#ffffff',
  border:        '#e2e8f0',
  borderFocus:   '#4f46e5',
  text:          '#1e293b',
  textSecondary: '#64748b',
  textMuted:     '#94a3b8',
  placeholder:   '#cbd5e1',
  overlay:       'rgba(0,0,0,0.55)',
  scanBox:       '#4f46e5',
  badge: {
    barcode: { bg: '#dcfce7', text: '#166534' },
    text:    { bg: '#dbeafe', text: '#1e40af' },
    vector:  { bg: '#ede9fe', text: '#6d28d9' },
  },
};

export const spacing = {
  xs:  4,
  sm:  8,
  md:  12,
  lg:  16,
  xl:  20,
  xxl: 24,
  xxxl: 32,
};

export const radius = {
  sm:   6,
  md:   10,
  lg:   14,
  xl:   20,
  full: 999,
};

export const typography = {
  h1:      { fontSize: 28, fontWeight: '700' as const, color: colors.text },
  h2:      { fontSize: 22, fontWeight: '700' as const, color: colors.text },
  h3:      { fontSize: 17, fontWeight: '600' as const, color: colors.text },
  body:    { fontSize: 15, fontWeight: '400' as const, color: colors.text },
  small:   { fontSize: 13, fontWeight: '400' as const, color: colors.textSecondary },
  caption: { fontSize: 11, fontWeight: '500' as const, color: colors.textMuted },
  label:   { fontSize: 12, fontWeight: '600' as const, color: colors.textMuted, textTransform: 'uppercase' as const, letterSpacing: 0.5 },
};

export const shadow = {
  sm: {
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06, shadowRadius: 3, elevation: 2,
  },
  md: {
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.10, shadowRadius: 8, elevation: 4,
  },
};
