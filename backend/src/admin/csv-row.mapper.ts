/**
 * Mappe une ligne CSV export ERP (français / anglais) vers les champs `Product`.
 * Exemple colonnes : CODE GOLD, DESIGNATION, EAN, CATEGORIE, Famille, Sous-Famille, IMAGE
 */
export function normCsvHeader(k: string): string {
  return k
    .trim()
    .replace(/^\uFEFF/, '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ');
}

export function pickCsvField(row: Record<string, unknown>, aliases: string[]): string | undefined {
  const map = new Map<string, string>();
  for (const [k, raw] of Object.entries(row)) {
    const key = normCsvHeader(k);
    if (raw === undefined || raw === null) continue;
    const val = String(raw).trim();
    if (val) map.set(key, val);
  }
  for (const a of aliases) {
    const v = map.get(normCsvHeader(a));
    if (v) return v;
  }
  return undefined;
}

export function mapCsvRowToProduct(row: Record<string, unknown>): Partial<{
  codeGold: string;
  name: string;
  brand: string;
  barcode: string;
  description: string;
  category: string;
  family: string;
  subcategory: string;
  images: string[];
}> | null {
  const name = pickCsvField(row, [
    'designation', 'name', 'libelle', 'libellé', 'nom', 'produit', 'designation article',
  ]);
  if (!name) return null;

  const imageCell = pickCsvField(row, [
    'image', 'images', 'url image', 'photo', 'url', 'lien image',
  ]);
  const images = imageCell
    ? imageCell.split(/[|;]/).map((s) => s.trim()).filter(Boolean)
    : [];

  return {
    codeGold: pickCsvField(row, [
      'code gold', 'code_gold', 'codegold', 'sku interne', 'ref interne', 'reference interne',
    ]),
    name,
    brand: pickCsvField(row, ['brand', 'marque']),
    barcode: pickCsvField(row, ['ean', 'gtin', 'barcode', 'code barres', 'code-barres', 'code barre']),
    description: pickCsvField(row, ['description', 'descriptif']),
    category: pickCsvField(row, ['categorie', 'category', 'catégorie', 'categ']),
    family: pickCsvField(row, ['famille', 'family']),
    subcategory: pickCsvField(row, [
      'sous-famille', 'sous famille', 'sousfamille',
      'subcategory', 'sous-categorie', 'sous categorie', 'sous-catégorie',
    ]),
    images,
  };
}
