import { query } from '../../core/database/pg-client.mjs';

const familyMetaMap = {
  cotizacion_maestra_pg04: {
    groupTitle: 'Cotizaciones fisico-quimicas',
    operationalUse: 'Cotizacion base parcial para analisis de agua con fidelidad exacta.',
    printMode: 'exacto',
    sourceDocumentType: 'normativo',
    requiresExactCopy: true,
    fixedTexts: {
      documentLabel: 'COTIZACION FISICO QUIMICA',
      serviceHeader: 'Servicios considerados',
    },
  },
  cotizacion_normativa_piscina: {
    groupTitle: 'Cotizaciones piscina D.209',
    operationalUse: 'Cotizacion normativa para piscina con estructura oficial.',
    printMode: 'exacto',
    sourceDocumentType: 'normativo',
    requiresExactCopy: true,
    fixedTexts: {
      documentLabel: 'COTIZACION PISCINA D.S. 209',
      serviceHeader: 'Parametros considerados',
    },
  },
  cotizacion_fas: {
    groupTitle: 'Cotizaciones FAS',
    operationalUse: 'Contrastacion y cotizacion FAS con formato oficial.',
    printMode: 'exacto',
    sourceDocumentType: 'normativo',
    requiresExactCopy: true,
    fixedTexts: {
      documentLabel: 'COTIZACION CONTRASTACION FAS',
      serviceHeader: 'Ensayos considerados',
    },
  },
  cotizacion_arrastre_arena: {
    groupTitle: 'Cotizaciones arrastre de arena',
    operationalUse: 'Documento comercial no acreditado con estructura historica.',
    printMode: 'exacto',
    sourceDocumentType: 'normativo',
    requiresExactCopy: true,
    fixedTexts: {
      documentLabel: 'COTIZACION ARRASTRE DE ARENA',
      serviceHeader: 'Analisis considerados',
    },
  },
  informe_fq_409: {
    groupTitle: 'Informes NCh 409',
    operationalUse: 'Informe de ensayo fisico quimico NCh 409 por tablas.',
    printMode: 'exacto',
    sourceDocumentType: 'normativo',
    requiresExactCopy: true,
    fixedTexts: {
      documentLabel: 'INFORME DE ENSAYO NCh 409',
      serviceHeader: 'Parametros informados',
    },
  },
  orden_compra_laboratorio: {
    groupTitle: 'Ordenes de compra',
    operationalUse: 'Solicitud de compra o servicio administrativo.',
    printMode: 'ligero',
    sourceDocumentType: 'interno',
    requiresExactCopy: false,
    fixedTexts: {
      documentLabel: 'ORDEN DE COMPRA',
      serviceHeader: 'Items solicitados',
    },
  },
  registro_toma_muestras: {
    groupTitle: 'Registros de muestra',
    operationalUse: 'Registro operacional de toma y observacion de muestras.',
    printMode: 'ligero',
    sourceDocumentType: 'interno',
    requiresExactCopy: false,
    fixedTexts: {
      documentLabel: 'REGISTRO DE TOMA DE MUESTRAS',
      serviceHeader: 'Observaciones registradas',
    },
  },
  documento_administrativo: {
    groupTitle: 'Documentos administrativos',
    operationalUse: 'Documentos internos de gestion, control y seguimiento.',
    printMode: 'ligero',
    sourceDocumentType: 'interno',
    requiresExactCopy: false,
    fixedTexts: {
      documentLabel: 'DOCUMENTO ADMINISTRATIVO',
      serviceHeader: 'Detalle administrativo',
    },
  },
};

const seedTemplates = [
  {
    templateSlug: 'tpl-pg04-r5-cotizacion',
    documentTypeSlug: 'cotizacion',
    documentCode: 'PG04-R1/26',
    confidentialityLevel: 'confidential',
    status: 'active',
    sourcePath: 'A TIPOS DE COTIZACIONES\PG04-R5-PARAMETROS PARA COTIZAR (CREAR PARCIAL) - 2026.xlsx',
    sourceFileName: 'PG04-R5-PARAMETROS PARA COTIZAR (CREAR PARCIAL) - 2026.xlsx',
    sourceSheetName: 'crear cotiz',
    familySlug: 'cotizacion_maestra_pg04',
    isRenderable: true,
    templateMode: 'master',
    variantOfTemplateSlug: null,
    brandingMode: 'embedded',
    operatorSelectableBranding: false,
  },
  {
    templateSlug: 'tpl-piscina-209-cotizacion',
    documentTypeSlug: 'cotizacion',
    documentCode: 'PG04-R1/26',
    confidentialityLevel: 'regulated_confidential',
    status: 'active',
    sourcePath: 'A TIPOS DE COTIZACIONES\PISCINA DECRETO N°209.xlsx',
    sourceFileName: 'PISCINA DECRETO N°209.xlsx',
    sourceSheetName: 'crear cotiz',
    familySlug: 'cotizacion_normativa_piscina',
    isRenderable: true,
    templateMode: 'master',
    variantOfTemplateSlug: null,
    brandingMode: 'embedded',
    operatorSelectableBranding: false,
  },
  {
    templateSlug: 'tpl-tipo-fas-cotizacion',
    documentTypeSlug: 'cotizacion',
    documentCode: 'PG04-R1/26',
    confidentialityLevel: 'regulated_confidential',
    status: 'active',
    sourcePath: 'A TIPOS DE COTIZACIONES\TIPO FAS.xlsx',
    sourceFileName: 'TIPO FAS.xlsx',
    sourceSheetName: 'crear cotiz',
    familySlug: 'cotizacion_fas',
    isRenderable: true,
    templateMode: 'master',
    variantOfTemplateSlug: null,
    brandingMode: 'embedded',
    operatorSelectableBranding: false,
  },
  {
    templateSlug: 'tpl-arrastre-arena-no-acreditado',
    documentTypeSlug: 'cotizacion',
    documentCode: 'PG04-R1/26',
    confidentialityLevel: 'confidential',
    status: 'active',
    sourcePath: 'A TIPOS DE COTIZACIONES\ARRASTRE DE ARENA (No Acreditado).xlsx',
    sourceFileName: 'ARRASTRE DE ARENA (No Acreditado).xlsx',
    sourceSheetName: 'tipo',
    familySlug: 'cotizacion_arrastre_arena',
    isRenderable: true,
    templateMode: 'master',
    variantOfTemplateSlug: null,
    brandingMode: 'embedded',
    operatorSelectableBranding: false,
  },
  {
    templateSlug: 'tpl-q0-informe-fq-409-t1-t2-t7',
    documentTypeSlug: 'informe-ensayo',
    documentCode: 'Q0',
    confidentialityLevel: 'regulated_confidential',
    status: 'active',
    sourcePath: 'migrations\Q0 - I de Ensayo FQ 409 T1, 2 y 7 (Cliente) (Rev 09 - Sept 2021).xls',
    sourceFileName: 'Q0 - I de Ensayo FQ 409 T1, 2 y 7 (Cliente) (Rev 09 - Sept 2021).xls',
    sourceSheetName: 'Tipo 409',
    familySlug: 'informe_fq_409',
    isRenderable: false,
    templateMode: 'master',
    variantOfTemplateSlug: null,
    brandingMode: 'embedded',
    operatorSelectableBranding: true,
  },
  {
    templateSlug: 'tpl-orden-compra-pg06',
    documentTypeSlug: 'orden-compra',
    documentCode: 'PG06-R2',
    confidentialityLevel: 'internal',
    status: 'active',
    sourcePath: 'legacy://ordenes-compra/pg06-r2',
    sourceFileName: 'Orden de compra / solicitud de compra o servicio',
    sourceSheetName: '',
    familySlug: 'orden_compra_laboratorio',
    isRenderable: false,
    templateMode: 'master',
    variantOfTemplateSlug: null,
    brandingMode: 'embedded',
    operatorSelectableBranding: false,
  },
  {
    templateSlug: 'tpl-registro-toma-muestras',
    documentTypeSlug: 'registro-muestras',
    documentCode: 'QP23',
    confidentialityLevel: 'internal',
    status: 'active',
    sourcePath: 'legacy://registros-muestras/qp23',
    sourceFileName: 'Registro de toma de muestras',
    sourceSheetName: '',
    familySlug: 'registro_toma_muestras',
    isRenderable: false,
    templateMode: 'master',
    variantOfTemplateSlug: null,
    brandingMode: 'embedded',
    operatorSelectableBranding: false,
  },
  {
    templateSlug: 'tpl-documento-administrativo-base',
    documentTypeSlug: 'documento-administrativo',
    documentCode: 'ADM-BASE',
    confidentialityLevel: 'internal',
    status: 'active',
    sourcePath: 'legacy://administracion/documento-base',
    sourceFileName: 'Documento administrativo base',
    sourceSheetName: '',
    familySlug: 'documento_administrativo',
    isRenderable: false,
    templateMode: 'master',
    variantOfTemplateSlug: null,
    brandingMode: 'embedded',
    operatorSelectableBranding: false,
  },
];

function enrichTemplate(template) {
  const familyMeta = familyMetaMap[template.familySlug] || {
    groupTitle: template.familySlug,
    operationalUse: 'Documento operativo del laboratorio.',
    printMode: template.isRenderable ? 'exacto' : 'ligero',
    sourceDocumentType: template.isRenderable ? 'normativo' : 'interno',
    requiresExactCopy: Boolean(template.isRenderable),
    fixedTexts: {
      documentLabel: template.documentTypeSlug,
      serviceHeader: 'Detalle',
    },
  };

  return {
    ...template,
    groupTitle: familyMeta.groupTitle,
    operationalUse: familyMeta.operationalUse,
    printMode: familyMeta.printMode,
    sourceDocumentType: familyMeta.sourceDocumentType,
    requiresExactCopy: familyMeta.requiresExactCopy,
    fixedTexts: familyMeta.fixedTexts,
  };
}

function mapRow(row) {
  return enrichTemplate({
    templateSlug: row.template_slug,
    documentTypeSlug: row.document_type_slug,
    documentCode: row.document_code,
    confidentialityLevel: row.confidentiality_level,
    status: row.status,
    sourcePath: row.source_path,
    sourceFileName: row.source_file_name,
    sourceSheetName: row.source_sheet_name,
    familySlug: row.family_slug,
    isRenderable: row.is_renderable,
    templateMode: row.template_mode || 'master',
    variantOfTemplateSlug: row.variant_of_template_slug,
    brandingMode: row.branding_mode || 'embedded',
    operatorSelectableBranding: row.operator_selectable_branding === true,
    sourceOriginalPath: row.source_original_path,
    sourceImportedPath: row.source_imported_path,
    sourceFileKind: row.source_file_kind,
    sourceChecksumSha256: row.source_checksum_sha256,
    sheetInventory: row.sheet_inventory_json || [],
    assetInventory: row.asset_inventory_json || {},
  });
}

export async function listTemplates({ renderableOnly = false } = {}) {
  const dbResult = await query(`
    select template_slug, document_type_slug, document_code, confidentiality_level, status,
           source_path, source_file_name, source_sheet_name, family_slug, is_renderable,
           template_mode, variant_of_template_slug, branding_mode, operator_selectable_branding,
           source_original_path, source_imported_path, source_file_kind, source_checksum_sha256,
           sheet_inventory_json, asset_inventory_json
    from lab.document_template_catalog
    order by template_slug
  `).catch(() => null);

  const dbTemplates = dbResult?.rows?.length ? dbResult.rows.map(mapRow) : [];
  const templateMap = new Map(seedTemplates.map((item) => [item.templateSlug, enrichTemplate(item)]));
  for (const item of dbTemplates) templateMap.set(item.templateSlug, item);
  const templates = Array.from(templateMap.values()).sort((left, right) => left.templateSlug.localeCompare(right.templateSlug));
  return renderableOnly ? templates.filter((item) => item.isRenderable) : templates;
}

export async function resolveTemplate(documentCode, templateSlug = '') {
  const templates = await listTemplates({ renderableOnly: false });
  if (templateSlug) {
    return templates.find((item) => item.templateSlug === templateSlug) || null;
  }
  return templates.find((item) => item.documentCode === documentCode && item.isRenderable) || templates.find((item) => item.documentCode === documentCode) || null;
}
