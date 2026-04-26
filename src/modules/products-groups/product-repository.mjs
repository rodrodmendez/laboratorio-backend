import { query } from '../../core/database/pg-client.mjs';

const seedProducts = [
  { productId: 'prd-micro-001', groupKey: 'microbiologia', productSlug: 'coliformes-totales', productName: 'Coliformes Totales', suggestedMatrix: 'Agua potable', documentTypeSlug: 'cotizacion' },
  { productId: 'prd-fq-001', groupKey: 'fisico-quimica', productSlug: 'analisis-parcial', productName: 'Analisis Parcial', suggestedMatrix: 'Agua residual', documentTypeSlug: 'cotizacion' },
  { productId: 'prd-norm-001', groupKey: 'nch-409', productSlug: 'informe-fq-409-t1-t2-t7', productName: 'Informe FQ 409 T1 T2 T7', suggestedMatrix: 'Agua potable', documentTypeSlug: 'informe-ensayo' },
  { productId: 'prd-ds609-001', groupKey: 'ds-609', productSlug: 'informe-ds609-t1', productName: 'Informe DS 609 Tabla 1', suggestedMatrix: 'Agua residual', documentTypeSlug: 'informe-ensayo' },
  { productId: 'prd-oc-001', groupKey: 'compras', productSlug: 'solicitud-compra-servicio', productName: 'Solicitud de compra o servicio', suggestedMatrix: 'Proceso interno', documentTypeSlug: 'orden-compra' },
  { productId: 'prd-adm-001', groupKey: 'administracion', productSlug: 'documento-administrativo-base', productName: 'Documento administrativo base', suggestedMatrix: 'Documento administrativo', documentTypeSlug: 'documento-administrativo' },
  { productId: 'prd-reg-001', groupKey: 'registros-operativos', productSlug: 'registro-toma-muestras', productName: 'Registro de toma de muestras', suggestedMatrix: 'Proceso interno', documentTypeSlug: 'registro-muestras' },
];

function slugify(value = '') {
  return String(value || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function mapRow(row) {
  return {
    productId: row.product_id,
    groupKey: row.group_key,
    productSlug: row.product_slug,
    productName: row.product_name,
    suggestedMatrix: row.suggested_matrix,
    documentTypeSlug: row.document_type_slug,
    isActive: row.is_active,
  };
}

export async function listProducts(groupKey = '') {
  const dbResult = await query(`
    select product_id, group_key, product_slug, product_name, suggested_matrix, document_type_slug, is_active
    from lab.service_product_catalog
    where ($1 = '' or group_key = $1)
    order by group_key, product_name
  `, [groupKey]).catch(() => null);

  const productMap = new Map();
  for (const item of seedProducts) {
    if (!groupKey || item.groupKey === groupKey) {
      productMap.set(item.productSlug || item.productId, item);
    }
  }
  for (const row of dbResult?.rows || []) {
    const item = mapRow(row);
    productMap.set(item.productSlug || item.productId, item);
  }

  return Array.from(productMap.values()).sort((left, right) => `${left.groupKey}:${left.productName}`.localeCompare(`${right.groupKey}:${right.productName}`));
}

export async function saveProduct(product) {
  const payload = {
    productId: product.productId || `prd-${Date.now()}`,
    groupKey: String(product.groupKey || '').trim(),
    productName: String(product.productName || '').trim(),
    suggestedMatrix: String(product.suggestedMatrix || '').trim(),
    documentTypeSlug: String(product.documentTypeSlug || '').trim(),
  };
  payload.productSlug = String(product.productSlug || slugify(payload.productName));

  if (!payload.groupKey || !payload.productName) {
    throw new Error('groupKey y productName son obligatorios');
  }

  const dbResult = await query(`
    insert into lab.service_product_catalog (product_id, group_key, product_slug, product_name, suggested_matrix, document_type_slug)
    values ($1,$2,$3,$4,$5,$6)
    on conflict (product_slug) do update set
      group_key = excluded.group_key,
      product_name = excluded.product_name,
      suggested_matrix = excluded.suggested_matrix,
      document_type_slug = excluded.document_type_slug,
      updated_at = now()
    returning product_id, group_key, product_slug, product_name, suggested_matrix, document_type_slug, is_active
  `, [payload.productId, payload.groupKey, payload.productSlug, payload.productName, payload.suggestedMatrix || null, payload.documentTypeSlug || null]).catch(() => null);

  if (dbResult?.rows?.[0]) {
    return mapRow(dbResult.rows[0]);
  }

  const existing = seedProducts.find((item) => item.productSlug === payload.productSlug);
  if (existing) Object.assign(existing, payload);
  else seedProducts.push(payload);
  return payload;
}
