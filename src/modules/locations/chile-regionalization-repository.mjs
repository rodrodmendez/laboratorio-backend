import { existsSync } from 'node:fs';
import { join } from 'node:path';
import XlsxPopulate from 'xlsx-populate';

const SOURCE_FILE = 'RegionalizaciónActualizada.xlsx';
const SOURCE_PATH = join(process.cwd(), 'data', SOURCE_FILE);

const regionDefinitions = [
  { regionId: 'cl-ap', sortOrder: 1, regionCode: 'XV', regionNumber: 15, name: 'Arica y Parinacota', officialName: 'Región de Arica y Parinacota', sheetName: 'XV-Arica y Parinacota' },
  { regionId: 'cl-ta', sortOrder: 2, regionCode: 'I', regionNumber: 1, name: 'Tarapacá', officialName: 'Región de Tarapacá', sheetName: 'I-Región de Tarapacá' },
  { regionId: 'cl-an', sortOrder: 3, regionCode: 'II', regionNumber: 2, name: 'Antofagasta', officialName: 'Región de Antofagasta', sheetName: 'II-Región Antogasta' },
  { regionId: 'cl-at', sortOrder: 4, regionCode: 'III', regionNumber: 3, name: 'Atacama', officialName: 'Región de Atacama', sheetName: 'III-Región de Atacama' },
  { regionId: 'cl-co', sortOrder: 5, regionCode: 'IV', regionNumber: 4, name: 'Coquimbo', officialName: 'Región de Coquimbo', sheetName: 'IV-Región de Coquimbo' },
  { regionId: 'cl-va', sortOrder: 6, regionCode: 'V', regionNumber: 5, name: 'Valparaíso', officialName: 'Región de Valparaíso', sheetName: 'V-Región de Valparaíso' },
  { regionId: 'cl-rm', sortOrder: 7, regionCode: 'RM', regionNumber: 13, name: 'Metropolitana de Santiago', officialName: 'Región Metropolitana de Santiago', sheetName: 'Región Metropolitana' },
  { regionId: 'cl-li', sortOrder: 8, regionCode: 'VI', regionNumber: 6, name: "Libertador General Bernardo O'Higgins", officialName: "Región del Libertador General Bernardo O'Higgins", sheetName: 'VI-Regíon Lib. B. O´Higgins' },
  { regionId: 'cl-ml', sortOrder: 9, regionCode: 'VII', regionNumber: 7, name: 'Maule', officialName: 'Región del Maule', sheetName: 'VII-Región del Maule' },
  { regionId: 'cl-nb', sortOrder: 10, regionCode: 'XVI', regionNumber: 16, name: 'Ñuble', officialName: 'Región de Ñuble', sheetName: 'Región del Ñuble' },
  { regionId: 'cl-bi', sortOrder: 11, regionCode: 'VIII', regionNumber: 8, name: 'Biobío', officialName: 'Región del Biobío', sheetName: 'VIII-Región del Bío-Bío' },
  { regionId: 'cl-ar', sortOrder: 12, regionCode: 'IX', regionNumber: 9, name: 'La Araucanía', officialName: 'Región de La Araucanía', sheetName: 'Región de la Araucanía' },
  { regionId: 'cl-lr', sortOrder: 13, regionCode: 'XIV', regionNumber: 14, name: 'Los Ríos', officialName: 'Región de Los Ríos', sheetName: 'Región de Los Ríos' },
  { regionId: 'cl-ll', sortOrder: 14, regionCode: 'X', regionNumber: 10, name: 'Los Lagos', officialName: 'Región de Los Lagos', sheetName: 'Región de los Lagos' },
  { regionId: 'cl-ai', sortOrder: 15, regionCode: 'XI', regionNumber: 11, name: 'Aysén del General Carlos Ibáñez del Campo', officialName: 'Región de Aysén del General Carlos Ibáñez del Campo', sheetName: 'Reg. Aysén General C. Ibañez' },
  { regionId: 'cl-ma', sortOrder: 16, regionCode: 'XII', regionNumber: 12, name: 'Magallanes y la Antártica Chilena', officialName: 'Región de Magallanes y de la Antártica Chilena', sheetName: 'Reg. Magallanes y la Antártica ' },
];

const provinceNameCorrections = new Map([
  ['ARICA', 'Arica'],
  ['PARINACOTA', 'Parinacota'],
  ['IQUIQUE', 'Iquique'],
  ['TAMARUGAL', 'Tamarugal'],
  ['TOCOPILLA', 'Tocopilla'],
  ['EL LOA', 'El Loa'],
  ['ANTOFAGASTA', 'Antofagasta'],
  ['CHAÑARAL', 'Chañaral'],
  ['HUASCO', 'Huasco'],
  ['COPIAPO', 'Copiapó'],
  ['ELQUI', 'Elqui'],
  ['CHOAPA', 'Choapa'],
  ['LIMARI', 'Limarí'],
  ['SANTIAGO', 'Santiago'],
  ['CORDILLERA', 'Cordillera'],
  ['CHACABUCO', 'Chacabuco'],
  ['MAIPO', 'Maipo'],
  ['MELIPILLA', 'Melipilla'],
  ['TALAGANTE', 'Talagante'],
  ['PETORCA', 'Petorca'],
  ['LOS ANDES', 'Los Andes'],
  ['SAN FELIPE DE ACONCAGUA', 'San Felipe de Aconcagua'],
  ['SAN ANTONIO', 'San Antonio'],
  ['QUILLOTA', 'Quillota'],
  ['ISLA DE PASCUA', 'Isla de Pascua'],
  ['VALPARAISO', 'Valparaíso'],
  ['MARGA-MARGA', 'Marga Marga'],
  ['COLCHAGUA', 'Colchagua'],
  ['CARDENAL CARO', 'Cardenal Caro'],
  ['CACHAPOAL', 'Cachapoal'],
  ['CURICO', 'Curicó'],
  ['CAUQUENES', 'Cauquenes'],
  ['LINARES', 'Linares'],
  ['TALCA', 'Talca'],
  ['DIGUILLIN', 'Diguillín'],
  ['PUNILLA', 'Punilla'],
  ['ITATA', 'Itata'],
  ['CONCEPCIÓN', 'Concepción'],
  ['ARAUCO', 'Arauco'],
  ['BIO-BIO', 'Biobío'],
  ['MALLECO', 'Malleco'],
  ['CAUTÍN', 'Cautín'],
  ['VALDIVIA', 'Valdivia'],
  ['RANCO', 'Ranco'],
  ['OSORNO', 'Osorno'],
  ['LLANQUIHUE', 'Llanquihue'],
  ['CHILOE', 'Chiloé'],
  ['PALENA', 'Palena'],
  ['GENERAL CARRERA', 'General Carrera'],
  ['COYHAIQUE', 'Coyhaique'],
  ['CAPITAN PRAT', 'Capitán Prat'],
  ['AYSÉN', 'Aysén'],
  ['MAGALLANES', 'Magallanes'],
  ['ANTÁRTICA CHILENA', 'Antártica Chilena'],
  ['TIERRA DEL FUEGO', 'Tierra del Fuego'],
  ['ULTIMA ESPERANZA', 'Última Esperanza'],
]);

let cachedRegionalization = null;

function toText(value) {
  if (value === null || value === undefined) return '';
  if (typeof value === 'object' && typeof value.text === 'function') return String(value.text());
  return String(value);
}

function cleanText(value) {
  return toText(value)
    .normalize('NFC')
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeKey(value = '') {
  return cleanText(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function sameKey(left = '', right = '') {
  return normalizeKey(left) === normalizeKey(right);
}

function provinceDisplayName(sourceName) {
  const key = cleanText(sourceName).toUpperCase();
  return provinceNameCorrections.get(key) || cleanText(sourceName);
}

function findHeaderRow(rows) {
  return rows.findIndex((row) => row.map(cleanText).some((cell) => sameKey(cell, 'provincia')));
}

function groupProvinceRows(rows) {
  const groups = [];
  let current = [];

  for (const row of rows) {
    const values = row.values;
    if (values.some(Boolean)) {
      current.push(row);
      continue;
    }

    if (current.length) {
      groups.push(current);
      current = [];
    }
  }

  if (current.length) groups.push(current);
  return groups;
}

function collectUniquePlaces(group, startColumn, sourceKind) {
  const places = new Map();

  for (const row of group) {
    for (let columnIndex = startColumn; columnIndex < row.values.length; columnIndex += 1) {
      const name = row.values[columnIndex];
      if (!name) continue;

      const placeKey = normalizeKey(name);
      if (!places.has(placeKey)) {
        places.set(placeKey, {
          name,
          key: placeKey,
          sourceKind,
          sourceRow: row.rowNumber,
          sourceColumn: columnIndex + 1,
        });
      }
    }
  }

  return Array.from(places.values()).sort((left, right) => left.name.localeCompare(right.name, 'es'));
}

function collectCommuneCandidates(group, hasExplicitCommuneColumn) {
  const communes = new Map();
  const startColumn = hasExplicitCommuneColumn ? 1 : 1;
  const endColumn = hasExplicitCommuneColumn ? 2 : Number.POSITIVE_INFINITY;

  for (const row of group) {
    for (let columnIndex = startColumn; columnIndex < Math.min(row.values.length, endColumn); columnIndex += 1) {
      const name = row.values[columnIndex];
      if (!name) continue;

      const key = normalizeKey(name);
      if (!communes.has(key)) {
        communes.set(key, {
          name,
          key,
          sourceKind: hasExplicitCommuneColumn ? 'comuna' : 'localidad_comuna_sector',
          sourceRow: row.rowNumber,
          sourceColumn: columnIndex + 1,
        });
      }
    }
  }

  return Array.from(communes.values()).sort((left, right) => left.name.localeCompare(right.name, 'es'));
}

function parseRegionSheet(workbook, definition) {
  const sheet = workbook.sheet(definition.sheetName);
  if (!sheet) {
    return {
      ...definition,
      sourceSheet: definition.sheetName,
      sourceTitle: null,
      provinces: [],
      warnings: [`No se encontro la hoja ${definition.sheetName}`],
    };
  }

  const rawRows = sheet.usedRange()?.value() || [];
  const rows = rawRows.map((row, index) => ({
    rowNumber: index + 1,
    values: row.map(cleanText),
  }));

  const headerIndex = findHeaderRow(rawRows);
  const headerRow = rows[headerIndex]?.values || [];
  const hasExplicitCommuneColumn = sameKey(headerRow[1], 'comuna');
  const sourceTitle = rows.flatMap((row) => row.values).find((cell) => /^REGI[OÓ]N\b/i.test(cell)) || definition.officialName;
  const dataRows = rows.slice(headerIndex + 1);
  const groups = groupProvinceRows(dataRows);

  const provinces = groups.map((group, index) => {
    const sourceProvinceName = group.map((row) => row.values[0]).find(Boolean) || `Provincia ${index + 1}`;
    const provinceName = provinceDisplayName(sourceProvinceName);
    const provinceId = `${definition.regionId}-${normalizeKey(provinceName)}`;
    const places = collectUniquePlaces(group, 1, hasExplicitCommuneColumn ? 'localidad_sector' : 'localidad_comuna_sector');
    const communeCandidates = collectCommuneCandidates(group, hasExplicitCommuneColumn);

    return {
      provinceId,
      name: provinceName,
      sourceName: sourceProvinceName,
      order: index + 1,
      communeCandidates,
      places,
      counts: {
        communeCandidates: communeCandidates.length,
        places: places.length,
      },
    };
  });

  return {
    ...definition,
    sourceSheet: definition.sheetName,
    sourceTitle,
    hasExplicitCommuneColumn,
    provinces,
    counts: {
      provinces: provinces.length,
      communeCandidates: provinces.reduce((total, province) => total + province.counts.communeCandidates, 0),
      places: provinces.reduce((total, province) => total + province.counts.places, 0),
    },
    warnings: hasExplicitCommuneColumn ? [] : ['La hoja agrupa localidad, comuna y sector en una misma columna de origen.'],
  };
}

function mapRegionSummary(region) {
  return {
    regionId: region.regionId,
    regionCode: region.regionCode,
    regionNumber: region.regionNumber,
    sortOrder: region.sortOrder,
    name: region.name,
    officialName: region.officialName,
    sourceSheet: region.sourceSheet,
    counts: region.counts,
  };
}

function mapProvinceSummary(region, province) {
  return {
    regionId: region.regionId,
    regionCode: region.regionCode,
    regionName: region.name,
    provinceId: province.provinceId,
    name: province.name,
    order: province.order,
    counts: province.counts,
  };
}

function regionMatches(region, value = '') {
  if (!value) return true;
  return [
    region.regionId,
    region.regionCode,
    String(region.regionNumber),
    region.name,
    region.officialName,
  ].some((candidate) => sameKey(candidate, value));
}

function provinceMatches(province, value = '') {
  if (!value) return true;
  return [province.provinceId, province.name, province.sourceName].some((candidate) => sameKey(candidate, value));
}

function textMatches(name, query = '') {
  if (!query) return true;
  return normalizeKey(name).includes(normalizeKey(query));
}

function flattenCandidates(regionalization, { regionId = '', provinceId = '', query = '', listName = 'places', includePlaces = false } = {}) {
  const items = [];

  for (const region of regionalization.regions) {
    if (!regionMatches(region, regionId)) continue;

    for (const province of region.provinces) {
      if (!provinceMatches(province, provinceId)) continue;

      const sourceItems = listName === 'communeCandidates'
        ? includePlaces
          ? [...province.communeCandidates, ...province.places]
          : province.communeCandidates
        : province.places;

      const seen = new Set();
      for (const item of sourceItems) {
        const dedupeKey = `${region.regionId}:${province.provinceId}:${item.key}`;
        if (seen.has(dedupeKey) || !textMatches(item.name, query)) continue;
        seen.add(dedupeKey);

        items.push({
          ...item,
          regionId: region.regionId,
          regionCode: region.regionCode,
          regionSortOrder: region.sortOrder,
          regionName: region.name,
          provinceId: province.provinceId,
          provinceOrder: province.order,
          provinceName: province.name,
        });
      }
    }
  }

  return items.sort((left, right) =>
    left.regionSortOrder - right.regionSortOrder
    || left.provinceOrder - right.provinceOrder
    || left.name.localeCompare(right.name, 'es'));
}

export async function getChileRegionalization({ refresh = false } = {}) {
  if (cachedRegionalization && !refresh) return cachedRegionalization;
  if (!existsSync(SOURCE_PATH)) {
    throw new Error(`No se encontro ${SOURCE_PATH}`);
  }

  const workbook = await XlsxPopulate.fromFileAsync(SOURCE_PATH);
  const regions = regionDefinitions
    .map((definition) => parseRegionSheet(workbook, definition))
    .sort((left, right) => left.sortOrder - right.sortOrder);

  cachedRegionalization = {
    source: {
      fileName: SOURCE_FILE,
      path: SOURCE_PATH,
      parser: 'xlsx-populate',
    },
    counts: {
      regions: regions.length,
      provinces: regions.reduce((total, region) => total + region.counts.provinces, 0),
      communeCandidates: regions.reduce((total, region) => total + region.counts.communeCandidates, 0),
      places: regions.reduce((total, region) => total + region.counts.places, 0),
    },
    regions,
  };

  return cachedRegionalization;
}

export async function listChileRegions() {
  const regionalization = await getChileRegionalization();
  return regionalization.regions.map(mapRegionSummary);
}

export async function listChileProvinces({ regionId = '' } = {}) {
  const regionalization = await getChileRegionalization();
  return regionalization.regions
    .filter((region) => regionMatches(region, regionId))
    .flatMap((region) => region.provinces.map((province) => mapProvinceSummary(region, province)));
}

export async function listChileCommuneCandidates({ regionId = '', provinceId = '', query = '', includePlaces = false } = {}) {
  const regionalization = await getChileRegionalization();
  return flattenCandidates(regionalization, {
    regionId,
    provinceId,
    query,
    listName: 'communeCandidates',
    includePlaces,
  });
}

export async function listChilePlaces({ regionId = '', provinceId = '', query = '' } = {}) {
  const regionalization = await getChileRegionalization();
  return flattenCandidates(regionalization, {
    regionId,
    provinceId,
    query,
    listName: 'places',
  });
}
