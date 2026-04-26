import { query } from '../../core/database/pg-client.mjs';

const fallbackCatalogs = {
  status: ['draft', 'active', 'approved', 'archived'],
  quote_status: ['Aceptada', 'Anulada', 'Rechazada', 'Pendiente', 'A la espera'],
  analysis_package: [
    'Microbiologico',
    'Fisico-Quimico',
    'Analisis Parcial',
    'NCh 409 - Agua Potable Completo',
    'NCh 1333 - Agua para Riego',
    'Servicio de Muestreo',
    'Medicion de Caudal',
    'Monitoreo Periodico',
    'Envio de Resultados',
    'Blanco de Campo',
    'NCh 409 + Microbiologico',
  ],
  unit: ['mg/L', 'UNT', 'NMP/100 ml', 'UFC/100 ml', 'UFC/ml', 'Presencia/Ausencia', 'UF', 'CLP', 'Unidad', '°C'],
  sample_type: [
    'Agua Potable',
    'Agua Potable Rural (APR)',
    'Agua Mineral Envasada',
    'Agua Envasada',
    'Agua de Canal para Riego',
    'Agua de Pozo',
    'Agua de Piscina',
    'Hielo',
    'Agua de Proceso Industrial',
  ],
  preservative: [
    'Tiosulfato de Sodio',
    'EDTA',
    'Sin preservante',
    'Acido nitrico',
    'Acido sulfurico',
  ],
  sampling_type: ['Cliente', 'Laboratorio', 'Mixto'],
  accreditation_scope: ['LE 171', 'LE 172'],
  business_document_type: [
    'Cotizacion',
    'Orden de Compra',
    'Factura',
    'Informe de Ensayo',
    'Registro de Ensayo',
    'Nota de Credito',
    'Guia de Despacho',
  ],
  intake_channel: [
    'Directo (No landing)',
    'Landing Web',
    'Referido',
    'Licitacion',
  ],
  document_type: [
    'cotizacion',
    'informe-ensayo',
    'registro-parcial',
    'orden-compra',
    'registro-muestras',
    'documento-administrativo',
  ],
  product_group: [
    'fisico-quimica',
    'microbiologia',
    'nch-409',
    'nch-1333',
    'ds-609',
    'ds-90',
    'ds-46',
    'compras',
    'administracion',
    'registros-operativos',
    'servicios-complementarios',
  ],
  matrix: [
    'Agua potable',
    'Agua residual',
    'Agua de recreacion',
    'Agua de bebida',
    'Agua envasada',
    'Agua clorada',
    'Agua subterranea',
    'Agua superficial',
    'Fuente de captacion',
    'Fines industriales',
    'Piscina',
    'Proceso interno',
    'Documento administrativo',
    'Otros',
  ],
  assay_suffix: [
    'Muestra',
    'Muestreo',
    'Analisis',
    'Cliente',
    'Laboratorio',
  ],
  assay_type: [
    'Microbiologico',
    'Quimico',
    'Fisico',
    'Fisico-quimico',
    'Bacteriologico',
    'Legionella',
    'Arrastre de arena',
    'FAS',
  ],
  assay_postfix: [
    'NCh 409',
    'NCh 1333',
    'DS 46',
    'DS 90',
    'DS 609',
    'Decreto 209 Piscina',
    'Manual SISS 2024',
    'Standard Methods 24th 2023',
    'Fuente de Captacion',
    'Recreacional',
  ],
  matrix_subdescription: [
    'Parcial',
    'Completo',
    'Residual',
    'Potable',
    'Recreacion',
    'Fines industriales',
    'Subterraneas',
    'Superficial',
    'Fuente de captacion',
    'Agua de bebida',
    'Otros',
  ],
};

function fallbackEntries(catalogType = '') {
  if (catalogType) {
    return (fallbackCatalogs[catalogType] || []).map((item) => ({
      entryId: `${catalogType}-${item}`,
      catalogType,
      entryKey: item,
      entryLabel: item,
      isActive: true,
    }));
  }

  return Object.entries(fallbackCatalogs).flatMap(([type, values]) =>
    values.map((item) => ({
      entryId: `${type}-${item}`,
      catalogType: type,
      entryKey: item,
      entryLabel: item,
      isActive: true,
    })),
  );
}

export async function listCatalogEntries(catalogType = '') {
  const dbResult = await query(`
    select entry_id, catalog_type, entry_key, entry_label, is_active
    from lab.maintainer_catalog_entry
    where ($1 = '' or catalog_type = $1)
    order by catalog_type, entry_label
  `, [catalogType]).catch(() => null);

  const dbEntries = (dbResult?.rows || []).map((row) => ({
    entryId: row.entry_id,
    catalogType: row.catalog_type,
    entryKey: row.entry_key,
    entryLabel: row.entry_label,
    isActive: row.is_active,
  }));

  const merged = new Map();
  for (const item of fallbackEntries(catalogType)) merged.set(`${item.catalogType}:${item.entryKey}`, item);
  for (const item of dbEntries) merged.set(`${item.catalogType}:${item.entryKey}`, item);
  return Array.from(merged.values()).sort((left, right) => `${left.catalogType}:${left.entryLabel}`.localeCompare(`${right.catalogType}:${right.entryLabel}`));
}

export async function saveCatalogEntry(entry) {
  const payload = {
    entryId: entry.entryId || `cat-${entry.catalogType}-${Date.now()}`,
    catalogType: entry.catalogType,
    entryKey: String(entry.entryKey || entry.entryLabel || '').trim(),
    entryLabel: String(entry.entryLabel || entry.entryKey || '').trim(),
  };

  if (!payload.catalogType || !payload.entryKey) {
    throw new Error('catalogType y entryKey son obligatorios');
  }

  const dbResult = await query(`
    insert into lab.maintainer_catalog_entry (entry_id, catalog_type, entry_key, entry_label)
    values ($1,$2,$3,$4)
    on conflict (catalog_type, entry_key) do update set
      entry_label = excluded.entry_label,
      updated_at = now()
    returning entry_id, catalog_type, entry_key, entry_label, is_active
  `, [payload.entryId, payload.catalogType, payload.entryKey, payload.entryLabel]).catch(() => null);

  if (dbResult?.rows?.[0]) {
    const row = dbResult.rows[0];
    return {
      entryId: row.entry_id,
      catalogType: row.catalog_type,
      entryKey: row.entry_key,
      entryLabel: row.entry_label,
      isActive: row.is_active,
    };
  }

  if (!fallbackCatalogs[payload.catalogType]) fallbackCatalogs[payload.catalogType] = [];
  if (!fallbackCatalogs[payload.catalogType].includes(payload.entryKey)) fallbackCatalogs[payload.catalogType].push(payload.entryKey);
  return { ...payload, isActive: true };
}
