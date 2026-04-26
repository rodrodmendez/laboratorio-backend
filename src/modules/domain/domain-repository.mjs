import { query } from '../../core/database/pg-client.mjs';

const seedAssayParameters = [
  { assayParameterId: 'assay-cloro-residual-libre', name: 'Cloro residual libre', description: '' },
  { assayParameterId: 'assay-turbiedad-nefelometrico', name: 'Turbiedad - Nefelometrico', description: '' },
  { assayParameterId: 'assay-coliformes-totales', name: 'Coliformes Totales', description: '' },
  { assayParameterId: 'assay-coliformes-fecales', name: 'Coliformes Fecales', description: '' },
  { assayParameterId: 'assay-escherichia-coli-ec-mug', name: 'Escherichia Coli - EC MUG', description: '' },
  { assayParameterId: 'assay-recuento-heterotrofos', name: 'Recuento de Heterotrofos (bacterias aerobicas)', description: '' },
];

const seedAnalyticalMethods = [
  { methodId: 'method-siss-me-33-2007', code: 'SISS-ME-33-2007', name: 'Cloro Residual Libre', organization: 'SISS', kind: 'Metodo SISS' },
  { methodId: 'method-siss-me-03-2007', code: 'SISS-ME-03-2007', name: 'Turbiedad Nefelometrica', organization: 'SISS', kind: 'Metodo SISS' },
  { methodId: 'method-siss-me-01-2007', code: 'SISS-ME-01-2007', name: 'Escherichia Coli EC MUG (tubos multiples)', organization: 'SISS', kind: 'Metodo SISS' },
  { methodId: 'method-siss-me-02-2007', code: 'SISS-ME-02-2007', name: 'Escherichia Coli EC MUG (membrana filtrante)', organization: 'SISS', kind: 'Metodo SISS' },
  { methodId: 'method-nch1620-1-of84', code: 'NCH1620/1-OF84', name: 'Coliformes Totales - NMP', organization: 'INN', kind: 'Norma Chilena' },
  { methodId: 'method-nch1620-2-of84', code: 'NCH1620/2-OF84', name: 'Coliformes Totales - UFC', organization: 'INN', kind: 'Norma Chilena' },
  { methodId: 'method-nch2313-22-of95', code: 'NCH2313/22-OF95', name: 'Coliformes Fecales - NMP (tubos)', organization: 'INN', kind: 'Norma Chilena' },
  { methodId: 'method-nch2313-23-of95', code: 'NCH2313/23-OF95', name: 'Coliformes Fecales - NMP (confirmacion)', organization: 'INN', kind: 'Norma Chilena' },
  { methodId: 'method-nch409', code: 'NCH409', name: 'Agua Potable - Requisitos', organization: 'INN', kind: 'Norma Chilena' },
  { methodId: 'method-nch1333', code: 'NCH1333', name: 'Agua para Riego - Requisitos', organization: 'INN', kind: 'Norma Chilena' },
  { methodId: 'method-sm-ed23-2017-4500-cl-g', code: 'SM-ED23-2017-4500-CL-G', name: 'Cloro Residual Libre - Standard Methods 23ed', organization: 'APHA', kind: 'Norma Internacional' },
  { methodId: 'method-sm-ed23-2017-2130-b', code: 'SM-ED23-2017-2130-B', name: 'Turbiedad Nefelometrica - Standard Methods 23ed', organization: 'APHA', kind: 'Norma Internacional' },
  { methodId: 'method-sm-ed23-2017-9221-f', code: 'SM-ED23-2017-9221-F', name: 'E. Coli EC MUG - Standard Methods 23ed', organization: 'APHA', kind: 'Norma Internacional' },
  { methodId: 'method-sm-ed23-2017-9215-b', code: 'SM-ED23-2017-9215-B', name: 'Recuento Heterotrofos - Standard Methods 23ed', organization: 'APHA', kind: 'Norma Internacional' },
  { methodId: 'method-sm-ed22-2012-2130-b', code: 'SM-ED22-2012-2130-B', name: 'Turbiedad Nefelometrica - Standard Methods 22ed', organization: 'APHA', kind: 'Norma Internacional' },
  { methodId: 'method-sm-ed22-2012-9221-b', code: 'SM-ED22-2012-9221-B', name: 'Coliformes Totales NMP - Standard Methods 22ed', organization: 'APHA', kind: 'Norma Internacional' },
  { methodId: 'method-sm-ed22-2012-9221-e', code: 'SM-ED22-2012-9221-E', name: 'Coliformes Fecales NMP - Standard Methods 22ed', organization: 'APHA', kind: 'Norma Internacional' },
  { methodId: 'method-sm-ed22-2012-9221-f', code: 'SM-ED22-2012-9221-F', name: 'E. Coli EC MUG - Standard Methods 22ed', organization: 'APHA', kind: 'Norma Internacional' },
  { methodId: 'method-sm-ed22-2012-9215-b', code: 'SM-ED22-2012-9215-B', name: 'Recuento Heterotrofos - Standard Methods 22ed', organization: 'APHA', kind: 'Norma Internacional' },
];

function slugify(value = '') {
  return String(value || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function mapAssayParameterRow(row) {
  return {
    assayParameterId: row.assay_parameter_id,
    name: row.assay_name,
    description: row.assay_description || '',
    isActive: row.is_active,
  };
}

function mapAnalyticalMethodRow(row) {
  return {
    methodId: row.method_id,
    code: row.method_code,
    name: row.method_name,
    organization: row.organization_name,
    kind: row.method_kind,
    isActive: row.is_active,
  };
}

export async function listAssayParameters(search = '') {
  const dbResult = await query(`
    select assay_parameter_id, assay_name, assay_description, is_active
    from lab.assay_parameter_catalog
    where ($1 = '' or assay_name ilike '%' || $1 || '%')
    order by assay_name
  `, [String(search || '').trim()]).catch(() => null);

  const items = new Map();
  for (const item of seedAssayParameters) items.set(item.assayParameterId, { ...item, isActive: true });
  for (const row of dbResult?.rows || []) {
    const item = mapAssayParameterRow(row);
    items.set(item.assayParameterId, item);
  }
  return Array.from(items.values());
}

export async function saveAssayParameter(assay) {
  const payload = {
    assayParameterId: assay.assayParameterId || `assay-${slugify(assay.name || assay.assayName || '') || Date.now()}`,
    name: String(assay.name || assay.assayName || '').trim(),
    description: String(assay.description || assay.assayDescription || '').trim(),
  };

  if (!payload.name) {
    throw new Error('name es obligatorio');
  }

  const dbResult = await query(`
    insert into lab.assay_parameter_catalog (assay_parameter_id, assay_name, assay_description)
    values ($1,$2,$3)
    on conflict (assay_parameter_id) do update set
      assay_name = excluded.assay_name,
      assay_description = excluded.assay_description,
      updated_at = now()
    returning assay_parameter_id, assay_name, assay_description, is_active
  `, [payload.assayParameterId, payload.name, payload.description || null]).catch(() => null);

  if (dbResult?.rows?.[0]) {
    return mapAssayParameterRow(dbResult.rows[0]);
  }

  const existing = seedAssayParameters.find((item) => item.assayParameterId === payload.assayParameterId);
  if (existing) Object.assign(existing, payload);
  else seedAssayParameters.push(payload);
  return { ...payload, isActive: true };
}

export async function listAnalyticalMethods(search = '') {
  const term = String(search || '').trim();
  const dbResult = await query(`
    select method_id, method_code, method_name, organization_name, method_kind, is_active
    from lab.analytical_method_catalog
    where (
      $1 = ''
      or method_code ilike '%' || $1 || '%'
      or method_name ilike '%' || $1 || '%'
      or organization_name ilike '%' || $1 || '%'
    )
    order by method_code
  `, [term]).catch(() => null);

  const items = new Map();
  for (const item of seedAnalyticalMethods) items.set(item.methodId, { ...item, isActive: true });
  for (const row of dbResult?.rows || []) {
    const item = mapAnalyticalMethodRow(row);
    items.set(item.methodId, item);
  }
  return Array.from(items.values());
}

export async function saveAnalyticalMethod(method) {
  const payload = {
    methodId: method.methodId || `method-${slugify(method.code || method.name || '') || Date.now()}`,
    code: String(method.code || method.methodCode || '').trim(),
    name: String(method.name || method.methodName || '').trim(),
    organization: String(method.organization || method.organizationName || '').trim(),
    kind: String(method.kind || method.methodKind || '').trim(),
  };

  if (!payload.code) {
    throw new Error('code es obligatorio');
  }

  const dbResult = await query(`
    insert into lab.analytical_method_catalog (method_id, method_code, method_name, organization_name, method_kind)
    values ($1,$2,$3,$4,$5)
    on conflict (method_code) do update set
      method_name = excluded.method_name,
      organization_name = excluded.organization_name,
      method_kind = excluded.method_kind,
      updated_at = now()
    returning method_id, method_code, method_name, organization_name, method_kind, is_active
  `, [payload.methodId, payload.code, payload.name || null, payload.organization || null, payload.kind || null]).catch(() => null);

  if (dbResult?.rows?.[0]) {
    return mapAnalyticalMethodRow(dbResult.rows[0]);
  }

  const existing = seedAnalyticalMethods.find((item) => item.code === payload.code || item.methodId === payload.methodId);
  if (existing) Object.assign(existing, payload);
  else seedAnalyticalMethods.push(payload);
  return { ...payload, isActive: true };
}
