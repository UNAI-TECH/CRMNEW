export interface CarBrandCatalog {
  brand: string;
  models: string[];
}

export const DEFAULT_CAR_CATALOG: CarBrandCatalog[] = [
  {
    brand: 'Maruti Suzuki',
    models: [
      'Alto K10',
      'S-Presso',
      'Celerio',
      'Wagon R',
      'Swift',
      'Dzire',
      'Baleno',
      'Fronx',
      'Ignis',
      'Brezza',
      'Ertiga',
      'XL6',
      'Ciaz',
      'Grand Vitara',
      'Jimny',
      'Invicto',
      'Eeco',
      'e Vitara',
    ],
  },
  {
    brand: 'Hyundai',
    models: [
      'Grand i10 Nios',
      'i20',
      'i20 N Line',
      'Aura',
      'Exter',
      'Venue',
      'Venue N Line',
      'Verna',
      'Creta',
      'Creta N Line',
      'Creta Electric',
      'Alcazar',
      'Tucson',
      'IONIQ 5',
    ],
  },
  {
    brand: 'Tata Motors',
    models: [
      'Tiago',
      'Tiago EV',
      'Tigor',
      'Tigor EV',
      'Altroz',
      'Altroz Racer',
      'Punch',
      'Punch EV',
      'Nexon',
      'Nexon EV',
      'Curvv',
      'Curvv EV',
      'Harrier',
      'Harrier EV',
      'Safari',
      'Sierra EV',
    ],
  },
  {
    brand: 'Mahindra',
    models: [
      'Bolero',
      'Bolero Neo',
      'Bolero Neo Plus',
      'XUV 3XO',
      'XUV400 EV',
      'Thar',
      'Thar ROXX',
      'Scorpio Classic',
      'Scorpio-N',
      'XUV700',
      'Marazzo',
      'BE 6',
      'XEV 9e',
    ],
  },
  {
    brand: 'Toyota',
    models: [
      'Glanza',
      'Urban Cruiser Taisor',
      'Rumion',
      'Urban Cruiser Hyryder',
      'Innova Crysta',
      'Innova Hycross',
      'Hilux',
      'Fortuner',
      'Fortuner Legender',
      'Camry',
      'Vellfire',
      'Land Cruiser 300',
    ],
  },
  {
    brand: 'Kia',
    models: [
      'Sonet',
      'Syros',
      'Seltos',
      'Carens',
      'Carnival',
      'EV6',
      'EV9',
    ],
  },
  {
    brand: 'Honda',
    models: [
      'Amaze',
      'City',
      'City e:HEV Hybrid',
      'Elevate',
    ],
  },
  {
    brand: 'MG Motor',
    models: [
      'Comet EV',
      'Windsor EV',
      'Astor',
      'ZS EV',
      'Hector',
      'Hector Plus',
      'Gloster',
      'Cyberster',
    ],
  },
  {
    brand: 'Skoda',
    models: [
      'Kylaq',
      'Kushaq',
      'Slavia',
      'Kodiaq',
      'Superb',
      'Octavia RS',
    ],
  },
  {
    brand: 'Volkswagen',
    models: [
      'Taigun',
      'Virtus',
      'Tiguan',
      'Golf GTI',
    ],
  },
  {
    brand: 'Renault',
    models: [
      'Kwid',
      'Triber',
      'Kiger',
      'Duster',
    ],
  },
  {
    brand: 'Nissan',
    models: [
      'Magnite',
      'X-Trail',
    ],
  },
  {
    brand: 'Citroen',
    models: [
      'C3',
      'eC3',
      'C3 Aircross',
      'Basalt',
      'C5 Aircross',
    ],
  },
  {
    brand: 'Jeep',
    models: [
      'Compass',
      'Meridian',
      'Wrangler',
      'Grand Cherokee',
    ],
  },
  {
    brand: 'BYD',
    models: [
      'Atto 3',
      'eMAX 7',
      'Seal',
      'Sealion 7',
    ],
  },
  {
    brand: 'Force Motors',
    models: [
      'Gurkha 3-Door',
      'Gurkha 5-Door',
      'Urbania',
    ],
  },
  {
    brand: 'Mercedes-Benz',
    models: [
      'A-Class Limousine',
      'C-Class',
      'E-Class LWB',
      'S-Class',
      'GLA',
      'GLB',
      'GLC',
      'GLE',
      'GLS',
      'EQA',
      'EQB',
      'EQE SUV',
      'EQS',
      'G-Class',
      'AMG GT',
      'Maybach S-Class',
      'Maybach GLS',
    ],
  },
  {
    brand: 'BMW',
    models: [
      '2 Series Gran Coupe',
      '3 Series Gran Limousine',
      '5 Series LWB',
      '7 Series',
      'X1',
      'X3',
      'X5',
      'X7',
      'XM',
      'iX1',
      'i4',
      'i5',
      'i7',
      'iX',
      'Z4',
      'M340i',
      'M4',
    ],
  },
  {
    brand: 'Audi',
    models: [
      'A4',
      'A6',
      'A8 L',
      'Q3',
      'Q3 Sportback',
      'Q5',
      'Q7',
      'Q8',
      'Q8 e-tron',
      'e-tron GT',
      'RS5',
      'RS Q8',
    ],
  },
  {
    brand: 'Volvo',
    models: [
      'XC40 Recharge',
      'EX40',
      'C40 Recharge',
      'XC60',
      'XC90',
      'S90',
    ],
  },
  {
    brand: 'Land Rover',
    models: [
      'Defender 90',
      'Defender 110',
      'Defender 130',
      'Discovery Sport',
      'Discovery',
      'Range Rover Evoque',
      'Range Rover Velar',
      'Range Rover Sport',
      'Range Rover',
    ],
  },
  {
    brand: 'Lexus',
    models: [
      'ES 300h',
      'NX 350h',
      'RX 350h',
      'RX 500h',
      'LX 500d',
      'LM 350h',
    ],
  },
  {
    brand: 'Porsche',
    models: [
      'Macan',
      'Macan Electric',
      'Cayenne',
      'Cayenne Coupe',
      'Panamera',
      'Taycan',
      '718 Cayman',
      '911 Carrera',
    ],
  },
  {
    brand: 'MINI',
    models: [
      'Cooper S',
      'Countryman Electric',
    ],
  },
];

export const ALL_CAR_BRANDS: string[] = DEFAULT_CAR_CATALOG.map((c) => c.brand);

export function getModelsForBrand(brand: string): string[] {
  const found = DEFAULT_CAR_CATALOG.find(
    (c) => c.brand.toLowerCase() === brand.trim().toLowerCase()
  );
  return found ? found.models : [];
}

export function getAllCarOptions(): string[] {
  const options: string[] = [];
  for (const entry of DEFAULT_CAR_CATALOG) {
    for (const model of entry.models) {
      options.push(`${entry.brand} ${model}`);
    }
  }
  return options;
}

/**
 * Builds deduplicated showroom stock labels from saved inventory vehicles for `SearchableCarSelect`.
 */
export function buildInventoryCarOptions(
  vehicles: ReadonlyArray<{ year?: number | string; make?: string; model?: string; variant?: string }>,
  options: { includeYear?: boolean } = {}
): string[] {
  const seen = new Set<string>();
  const list: string[] = [];
  for (const v of vehicles) {
    const parts = options.includeYear
      ? [v.year, v.make, v.model, v.variant]
      : [v.make, v.model, v.variant];
    const label = parts.filter(Boolean).join(' ').trim();
    const key = label.toLowerCase();
    if (label && !seen.has(key)) {
      seen.add(key);
      list.push(label);
    }
  }
  return list;
}

/**
 * Extracts unique vehicle makes/brands currently stored in the dealership inventory.
 */
export function buildInventoryBrands(
  vehicles: ReadonlyArray<{ make?: string }>
): string[] {
  const seen = new Set<string>();
  const brands: string[] = [];
  for (const v of vehicles) {
    const brand = String(v.make || '').trim();
    const key = brand.toLowerCase();
    if (brand && !seen.has(key)) {
      seen.add(key);
      brands.push(brand);
    }
  }
  return brands;
}

/**
 * Extracts unique models currently stored in the dealership inventory for a given make/brand.
 */
export function buildInventoryModelsForBrand(
  vehicles: ReadonlyArray<{ make?: string; model?: string; variant?: string }>,
  brand: string
): string[] {
  const targetBrand = brand.trim().toLowerCase();
  if (!targetBrand) return [];
  const seen = new Set<string>();
  const models: string[] = [];
  for (const v of vehicles) {
    if (String(v.make || '').trim().toLowerCase() !== targetBrand) continue;
    const modelLabel = [v.model, v.variant].filter(Boolean).join(' ').trim();
    const key = modelLabel.toLowerCase();
    if (modelLabel && !seen.has(key)) {
      seen.add(key);
      models.push(modelLabel);
    }
  }
  return models;
}

