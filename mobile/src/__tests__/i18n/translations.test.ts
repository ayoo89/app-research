import { en, fr } from '../../i18n/translations';

describe('translations', () => {
  it('FR has exactly the same keys as EN', () => {
    const enKeys = Object.keys(en).sort();
    const frKeys = Object.keys(fr).sort();
    const missingInFr = enKeys.filter((k) => !frKeys.includes(k));
    const extraInFr   = frKeys.filter((k) => !enKeys.includes(k));

    if (missingInFr.length > 0) {
      throw new Error(`Keys missing in FR: ${missingInFr.join(', ')}`);
    }
    if (extraInFr.length > 0) {
      throw new Error(`Extra keys in FR (not in EN): ${extraInFr.join(', ')}`);
    }
    expect(frKeys).toEqual(enKeys);
  });

  it('no empty or undefined values in EN', () => {
    const badKeys = Object.entries(en)
      .filter(([, v]) => typeof v !== 'string' || v.length === 0)
      .map(([k]) => k);
    expect(badKeys).toEqual([]);
  });

  it('no empty or undefined values in FR', () => {
    const badKeys = Object.entries(fr)
      .filter(([, v]) => typeof v !== 'string' || v.length === 0)
      .map(([k]) => k);
    expect(badKeys).toEqual([]);
  });

  it('interpolation placeholders are consistent between EN and FR', () => {
    const placeholderRegex = /\{[^}]+\}/g;
    const inconsistentKeys: string[] = [];

    Object.keys(en).forEach((key) => {
      const enVal = en[key as keyof typeof en];
      const frVal = fr[key as keyof typeof fr];
      const enPlaceholders = (enVal.match(placeholderRegex) ?? []).sort().join(',');
      const frPlaceholders = (frVal.match(placeholderRegex) ?? []).sort().join(',');
      if (enPlaceholders !== frPlaceholders) {
        inconsistentKeys.push(`${key}: EN="${enPlaceholders}" FR="${frPlaceholders}"`);
      }
    });

    if (inconsistentKeys.length > 0) {
      throw new Error(`Placeholder mismatch:\n${inconsistentKeys.join('\n')}`);
    }
  });

  it('interpolates {name} correctly', () => {
    const template = en.users_reset_confirm;
    const result = template.split('{name}').join('Alice');
    expect(result).toBe('Send new temporary credentials to Alice?');
  });

  it('FR interpolates {name} correctly', () => {
    const template = fr.users_reset_confirm;
    const result = template.split('{name}').join('Alice');
    expect(result).toContain('Alice');
    expect(result).not.toContain('{name}');
  });
});
