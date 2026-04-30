import 'dotenv/config';
import http from 'node:http';
import { createReadStream, existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { join, basename } from 'node:path';
import { listCustomers, saveCustomer, deleteCustomer } from '../modules/customers/customer-repository.mjs';
import { listTemplates, resolveTemplate } from '../modules/document-render/template-repository.mjs';
import { saveDocumentSession } from '../modules/document-sessions/document-session-repository.mjs';
import { saveRenderJob } from '../modules/document-render/render-job-repository.mjs';
import { saveIssuedDocument } from '../modules/document-render/document-issued-repository.mjs';
import { renderTemplateWorkbook } from '../modules/document-render/xlsx-renderer.mjs';
import { analyzeTemplateIntake, registerTemplateIntake } from '../modules/document-render/template-intake-service.mjs';
import { saveTemporaryProfile, listTemporaryProfiles, deleteTemporaryProfile } from '../modules/temporals/temporary-profile-repository.mjs';
import { saveDeliveryJob } from '../modules/delivery/delivery-job-repository.mjs';
import { listContacts, saveContact, deleteContact } from '../modules/contacts/contact-repository.mjs';
import { listCatalogEntries, saveCatalogEntry } from '../modules/catalogs/catalog-repository.mjs';
import { listProducts, saveProduct } from '../modules/products-groups/product-repository.mjs';
import { getChileRegionalization, listChileCommuneCandidates, listChilePlaces, listChileProvinces, listChileRegions } from '../modules/locations/chile-regionalization-repository.mjs';
import { sendDocumentEmail } from '../modules/delivery/mailer-service.mjs';
import { authenticateUser, getLaboratoryProfile, listLaboratoryUsers, listProviders, saveLaboratoryProfile, saveLaboratoryUser, saveProvider, deleteProvider, listPurchaseOrders, savePurchaseOrder, saveUserCertificate, removeUserCertificate, getUserWithCertificate, extractCertificateInfo, listSupplies, saveSupply } from '../modules/administration/administration-repository.mjs';
import { generateOcPdf } from '../modules/documents/oc-pdf-generator.mjs';
import { signPdf } from '../modules/documents/pdf-signer.mjs';
import { listAnalyticalMethods, listAssayParameters, saveAnalyticalMethod, saveAssayParameter } from '../modules/domain/domain-repository.mjs';
import { listAssayRecords, listAssayResults, listQuoteFollowUps, listQuotes, saveAssayRecord, saveAssayResult, saveQuote, saveQuoteFollowUp } from '../modules/operations/operations-repository.mjs';
import { getDbConfig } from '../core/database/config.mjs';
import { query } from '../core/database/pg-client.mjs';

const PORT = Number(process.env.PORT || 4010);
const HOST = '127.0.0.1';
const ARTIFACT_ROOT = join(process.cwd(), 'data', 'rendered');

function json(res, statusCode, payload) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,POST,DELETE,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type'
  });
  res.end(JSON.stringify(payload, null, 2));
}

function notFound(res) { json(res, 404, { error: 'not_found' }); }
function normalizeRut(input = '') { return String(input).replace(/\./g, '').trim().toUpperCase(); }
async function readBody(req) { const chunks = []; for await (const chunk of req) chunks.push(chunk); return Buffer.concat(chunks).toString('utf8'); }
function boolParam(value) { return ['1', 'true', 'yes', 'si', 'sí'].includes(String(value || '').trim().toLowerCase()); }

async function getDbHealth() {
  const dbConfig = getDbConfig();
  if (!dbConfig.enabled) return { enabled: false, connected: false };
  try {
    const result = await query('select current_database() as db, current_user as user, now() as server_time');
    return { enabled: true, connected: true, database: result.rows[0].db, user: result.rows[0].user, serverTime: result.rows[0].server_time, port: dbConfig.port };
  } catch (error) {
    return { enabled: true, connected: false, port: dbConfig.port, error: String(error?.message || error) };
  }
}

const compatCatalogDefinitions = [
  ['usuariosSistema', 'Usuarios', 'usuarios_sistema'],
  ['contactos', 'Contactos', 'contactos'],
  ['proveedoresCompra', 'Proveedores', 'proveedores_compra'],
  ['muestreadores', 'Colaboradores', 'muestreadores'],
  ['tablaPeriodica', 'Codigo Tabla Periodica', 'tabla_periodica'],
  ['estadoMuestra', 'Estado de Muestra', 'estado_muestra'],
  ['estadoProcesos', 'Estado de Procesos', 'estado_procesos'],
  ['historialCompras', 'Historial de Ordenes de Compra', 'historial_compras'],
  ['validezAdministrativos', 'Documentacion Administrativa', 'validez_administrativos'],
  ['subcontratistas', 'Subcontratistas', 'subcontratistas'],
  ['proveedoresExternalizados', 'Proveedores Externalizados', 'proveedores_externalizados'],
  ['metodosHidrolab', 'Metodos Hidrolab', 'metodos_hidrolab'],
  ['itemsPreciosExternalizados', 'Items y Precios Externalizados', 'items_precios_externalizados'],
  ['parametrosNorma', 'Norma', 'status'],
  ['datosMatriz', 'Datos de Matriz', 'matrix'],
  ['limitesDeteccion', 'Limites de Deteccion', 'unit'],
  ['tiposAnalisis', 'Tipos de Analisis', 'product_group'],
  ['estadoCotizacion', 'Estado de Cotizacion', 'quote_status'],
  ['paquetesAnalisis', 'Paquetes de Analisis', 'analysis_package'],
  ['sufijosEnsayo', 'Sufijos de Ensayo', 'assay_suffix'],
  ['tiposEnsayo', 'Tipos de Ensayo', 'assay_type'],
  ['postfijosEnsayo', 'Postfijos de Ensayo', 'assay_postfix'],
  ['subdescripcionesMatriz', 'Subdescripciones de Matriz', 'matrix_subdescription'],
  ['tiposMuestra', 'Tipos de Muestra', 'sample_type'],
  ['preservantes', 'Preservantes', 'preservative'],
  ['tiposMuestreo', 'Tipos de Muestreo', 'sampling_type'],
  ['acreditaciones', 'Acreditaciones', 'accreditation_scope'],
  ['tiposDocumentoComercial', 'Tipos de Documento Comercial', 'business_document_type'],
  ['canalesIngreso', 'Canales de Ingreso', 'intake_channel'],
  ['condicionesNormativas', 'Condiciones Normativas', 'document_type'],
  ['observacionesCotizacionParcial', 'Observaciones Cot. Parcial', 'observaciones_cotizacion_parcial'],
  ['estadosAprobacionCompra', 'Estados de Aprobacion OC', 'estado_aprobacion_compra'],
  ['parametrosCriticos', 'Parametros Criticos', 'parametros_criticos'],
  ['parametrosCriticosExternosFas', 'Criticos Externos FAS', 'parametros_criticos_externos_fas'],
  ['parametrosCriticosInternosFas', 'Criticos Internos FAS', 'parametros_criticos_internos_fas'],
  ['parametrosCotizacion2026', 'Parametros para Cotizar', 'parametros_cotizacion_2026'],
  ['externalizadosReferencias', 'Referencias Externalizadas', 'externalizados_referencias'],
  ['textosExternalizados', 'Textos de Externalizados', 'textos_externalizados'],
  ['tiposCosto', 'Tipos de Costo', 'tipos_costo'],
  ['costosAdicionales', 'Costos Adicionales', 'costos_adicionales'],
  ['costosExternos', 'Costos Externos', 'costos_externos'],
  ['tarifarioExternalizadoActualizado', 'Tarifario Ext. Actualizado', 'tarifario_externalizado_actualizado'],
  ['datosComerciales', 'Datos Comerciales', 'datos_comerciales'],
  ['tiposPago', 'Tipos de Pago', 'tipos_pago'],
  ['terminosPagoCompra', 'Terminos de Pago OC', 'terminos_pago_compra'],
  ['historialCotizaciones2026', 'Historial Cotizaciones 2026', 'historial_cotizaciones_2026'],
  ['resumenCotizacionesUf', 'Resumen Cotizaciones UF', 'resumen_cotizaciones_uf'],
  ['resumenCotizacionesCantidad', 'Resumen Cantidad Cotizaciones', 'resumen_cotizaciones_cantidad'],
  ['historialCostosHidrolab', 'Historial Costos Hidrolab', 'historial_costos_hidrolab'],
  ['historialTarifasExternalizadas', 'Historial Tarifas Ext.', 'historial_tarifas_externalizadas'],
  ['incidenciasTarifarias', 'Incidencias Tarifarias', 'incidencias_tarifarias'],
  ['canalesComunicacion', 'Canales de Comunicacion', 'canales_comunicacion'],
  ['entrega', 'Entrega', 'entrega'],
  ['productosInventario', 'Productos', 'productos_inventario'],
  ['parametrosTipoFas', 'Plantilla Tipo FAS', 'parametros_tipo_fas'],
].map(([key, title, catalogType]) => ({ key, title, catalogType }));

const compatCatalogMap = new Map(compatCatalogDefinitions.map((item) => [item.key, item]));

const compatCatalogFields = [
  { name: 'entryKey', label: 'Clave', type: 'text', required: true },
  { name: 'entryLabel', label: 'Nombre', type: 'text', required: true },
  { name: 'isActive', label: 'Activo', type: 'boolean' },
];

function mapCompatCatalogItem(entry) {
  return {
    id: entry.entryId,
    entryKey: entry.entryKey,
    entryLabel: entry.entryLabel,
    catalogType: entry.catalogType,
    isActive: entry.isActive !== false,
  };
}

async function getCompatCatalogPayload(key) {
  const definition = compatCatalogMap.get(key) || { key, title: key, catalogType: key };
  const entries = await listCatalogEntries(definition.catalogType);
  return {
    key: definition.key,
    meta: {
      title: definition.title,
      singular: 'registro',
      description: `Mantenedor operativo conectado al catalogo backend ${definition.catalogType}.`,
      source: 'laboratorio-backend',
      group: 'Backend',
      fields: compatCatalogFields,
      highlights: ['Datos servidos desde la capa de compatibilidad del backend.'],
    },
    items: entries.map(mapCompatCatalogItem),
  };
}

function buildCompatQuote(template) {
  return {
    id: template.templateSlug,
    title: template.groupTitle || template.sourceFileName || template.templateSlug,
    code: template.documentCode,
    format: template.documentTypeSlug === 'informe-ensayo' ? 'informe-ensayo' : 'fisico-quimica',
    documentLabel: template.fixedTexts?.documentLabel || template.documentTypeSlug,
    documentKindLabel: template.documentTypeSlug,
    issueDate: new Date().toISOString().slice(0, 10),
    city: 'Santiago',
    greeting: 'Estimados',
    addressee: 'Cliente laboratorio',
    contact: { nombre: '-', correo: '-', telefono: '-', rut: '-' },
    company: {
      name: 'LABORATORIO CARLOS LATORRE S.A.',
      address: 'Jose Manuel Infante 620, Providencia, Santiago',
      phone: '+56 2 2696 1481',
      email: 'laboratorio@labclatorre.cl',
      website: 'labclatorre.cl',
      accreditation: ['Laboratorio quimico sanitario', 'Gestion documental interna'],
      footerNote: 'Documento visualizado desde backend operativo.',
    },
    analysisType: { nombre: template.groupTitle || template.documentTypeSlug, valorUf: '-' },
    matrixName: template.familySlug || '-',
    lineDetails: [],
    references: [template.sourceFileName || template.sourcePath || 'Plantilla backend'],
    summaryRows: [],
    totals: { netoUf: '-', ivaUf: '-', totalUf: '-' },
    conditions: { normativas: [], operacion: [], comerciales: [] },
    observationGroups: {
      normativas: template.requiresExactCopy ? ['Requiere fidelidad visual exacta.'] : [],
      operacion: [template.operationalUse || 'Documento operativo del laboratorio.'],
      comerciales: [],
    },
    observations: template.sourcePath || '',
    notes: template.status || '',
    additionalNotes: template.printMode || '',
    initials: 'APP',
    legalFoot: 'Laboratorio Carlos Latorre S.A.',
    reportTitle: template.fixedTexts?.documentLabel || 'Documento',
    reportSubtitle: template.groupTitle || template.documentTypeSlug,
    sampleInfo: {},
    methodText: [],
    resolvedReportRows: [],
  };
}

async function getCompatQuotes() {
  const templates = await listTemplates({ renderableOnly: false });
  return templates.map(buildCompatQuote);
}

async function deleteCompatCatalogEntry(key, id) {
  const definition = compatCatalogMap.get(key) || { catalogType: key };
  await query(`
    update lab.maintainer_catalog_entry
    set is_active = false, updated_at = now()
    where catalog_type = $1 and entry_id = $2
  `, [definition.catalogType, id]).catch(() => null);
  return { deleted: true, id };
}

function buildMockRender(request, template, selectedCustomer) {
  const customerName = request.fieldValues?.cliente_nombre || selectedCustomer?.businessName || '';
  const outputFormat = request.outputFormat || 'json';
  const renderJobId = `rj-${Date.now()}`;
  const sessionId = request.context?.sessionId || `ses-${Date.now()}`;
  const fileExtension = outputFormat === 'print' ? 'txt' : outputFormat;
  return {
    renderJobId, sessionId, templateSlug: template?.templateSlug || 'tpl-no_resuelta', resolvedTemplateVersion: 'v1', status: 'rendered',
    artifact: { format: outputFormat, fileName: `${request.documentCode.replace(/[^A-Za-z0-9_-]/g, '_')}-${Date.now()}.${fileExtension}`, storagePath: `mock://render/${renderJobId}`, checksumSha256: 'demo-checksum-pendiente', pageCount: 1, mimeType: outputFormat === 'pdf' ? 'application/pdf' : 'application/json' },
    warnings: template ? [] : [{ code: 'template_not_resolved', message: 'No se encontro plantilla oficial, se devolvio respuesta mock.' }],
    errors: [], createdAt: new Date().toISOString(),
    previewData: { documentCode: request.documentCode, customerName, confidentialityLevel: template?.confidentialityLevel || request.context?.confidentialityLevel || 'internal', outputFormat, fieldValues: request.fieldValues, repeatSections: request.repeatSections || {} }
  };
}

async function buildSingleRender(payload, template, selectedCustomer, requestedFormat) {
  if (template?.isRenderable) {
    const artifact = await renderTemplateWorkbook({ ...payload, outputFormat: requestedFormat }, template);
    return {
      renderJobId: `rj-${Date.now()}-${requestedFormat}`,
      sessionId: payload.context?.sessionId || `ses-${Date.now()}`,
      templateSlug: template.templateSlug,
      resolvedTemplateVersion: 'v1',
      status: 'rendered',
      artifact: {
        format: artifact.artifactFormat,
        requestedFormat,
        fileName: artifact.fileName,
        storagePath: artifact.absolutePath,
        sourceWorkbookPath: artifact.sourceWorkbookPath,
        sourceWorkbookChecksumSha256: artifact.sourceWorkbookChecksumSha256,
        checksumSha256: artifact.checksumSha256,
        pageCount: 1,
        mimeType: artifact.mimeType,
        downloadUrl: artifact.downloadUrl,
      },
      warnings: artifact.warnings,
      errors: [],
      createdAt: new Date().toISOString(),
      previewData: {
        documentCode: payload.documentCode,
        customerName: payload.fieldValues?.cliente_nombre || selectedCustomer?.businessName || '',
        confidentialityLevel: template.confidentialityLevel,
        outputFormat: requestedFormat,
        fieldValues: payload.fieldValues,
        repeatSections: payload.repeatSections || {},
        summary: artifact.summary,
        familySlug: template.familySlug,
      }
    };
  }
  return buildMockRender({ ...payload, outputFormat: requestedFormat }, template, selectedCustomer);
}

async function buildRenderBundle(payload, template, selectedCustomer) {
  const requestedFormats = Array.isArray(payload.metadata?.outputFormats) && payload.metadata.outputFormats.length
    ? payload.metadata.outputFormats
    : [payload.outputFormat || 'pdf'];

  const results = [];
  for (const format of requestedFormats) {
    results.push(await buildSingleRender(payload, template, selectedCustomer, format));
  }

  const primary = results.find((item) => item.artifact?.format === 'pdf') || results[0];
  return {
    ...primary,
    artifacts: results.map((item) => item.artifact),
    warnings: results.flatMap((item) => item.warnings || []),
  };
}

async function maybeSendEmail(payload, renderBundle) {
  const recipientsRaw = payload.metadata?.emailRecipients || '';
  const recipients = String(recipientsRaw).split(/[;,]/).map((item) => item.trim()).filter(Boolean);
  if (!payload.metadata?.sendEmail || !recipients.length) {
    return { sent: false, reason: 'email_not_requested' };
  }

  const primaryArtifact = renderBundle.artifacts?.[0] || renderBundle.artifact;
  const result = await sendDocumentEmail({
    recipients,
    subject: `Documento ${payload.documentCode} - ${renderBundle.templateSlug}`,
    text: 'Se adjunta documento generado desde la plantilla oficial del laboratorio.',
    attachments: primaryArtifact?.storagePath ? [{ filename: basename(primaryArtifact.storagePath), path: primaryArtifact.storagePath }] : [],
  });

  await saveDeliveryJob({
    deliveryJobId: `del-${Date.now()}`,
    renderJobId: renderBundle.renderJobId,
    deliveryType: 'email',
    recipients,
    payload: result,
    status: result.sent ? 'sent' : 'pending',
  });

  return result;
}

const server = http.createServer(async (req, res) => {
  if (!req.url) return notFound(res);
  const url = new URL(req.url, `http://${req.headers.host}`);

  if (req.method === 'OPTIONS') {
    res.writeHead(204, { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET,POST,DELETE,OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type' });
    return res.end();
  }

  if (req.method === 'GET' && url.pathname === '/health') return json(res, 200, {
    ok: true,
    service: 'Laboratorio Carlos Latorre S.A.',
    name: 'laboratorio-backend',
    version: '0.1.0',
    tagline: 'Control, precisión y confianza en cada gota',
    date: new Date().toISOString(),
    pg: await getDbHealth()
  });
  if (req.method === 'GET' && url.pathname === '/api/info') return json(res, 200, {
    company: 'Carlos Latorre S.A.',
    service: 'Laboratorio Químico Sanitario',
    tagline: 'Control, precisión y confianza en cada gota',
    website: 'https://labclatorre.cl/',
    version: '0.1.0',
    endpoints: { auth: '/api/auth/login', admin: '/api/v1/admin' }
  });
  if (req.method === 'POST' && url.pathname === '/api/auth/login') {
    const payload = JSON.parse((await readBody(req)) || '{}');
    const user = await authenticateUser(payload.username, payload.password);
    if (!user) return json(res, 401, { error: 'invalid_credentials', message: 'Usuario o password incorrecto.' });
    return json(res, 200, {
      token: `local-${Date.now()}`,
      user,
    });
  }
  if (req.method === 'GET' && url.pathname === '/api/v1/admin/laboratory') return json(res, 200, await getLaboratoryProfile());
  if (req.method === 'POST' && url.pathname === '/api/v1/admin/laboratory') {
    try {
      const payload = JSON.parse((await readBody(req)) || '{}');
      return json(res, 200, await saveLaboratoryProfile(payload));
    } catch (error) {
      return json(res, 400, { error: 'laboratory_save_failed', message: String(error?.message || error) });
    }
  }
  if (req.method === 'GET' && url.pathname === '/api/v1/admin/users') return json(res, 200, await listLaboratoryUsers());
  if (req.method === 'POST' && url.pathname === '/api/v1/admin/users') {
    try {
      const payload = JSON.parse((await readBody(req)) || '{}');
      return json(res, 200, await saveLaboratoryUser(payload));
    } catch (error) {
      return json(res, 400, { error: 'user_save_failed', message: String(error?.message || error) });
    }
  }
  if (req.method === 'GET' && url.pathname === '/api/v1/providers') return json(res, 200, await listProviders());
  if (req.method === 'POST' && url.pathname === '/api/v1/providers') {
    try {
      const payload = JSON.parse((await readBody(req)) || '{}');
      return json(res, 200, await saveProvider(payload));
    } catch (error) {
      return json(res, 400, { error: 'provider_save_failed', message: String(error?.message || error) });
    }
  }
  if (req.method === 'DELETE' && url.pathname.startsWith('/api/v1/providers/')) {
    const providerId = decodeURIComponent(url.pathname.replace('/api/v1/providers/', ''));
    if (!providerId) return json(res, 400, { error: 'missing_id' });
    await deleteProvider(providerId);
    return json(res, 200, { deleted: true });
  }
  if (req.method === 'GET' && url.pathname === '/api/v1/supplies') return json(res, 200, await listSupplies());
  if (req.method === 'POST' && url.pathname === '/api/v1/supplies') {
    try {
      const payload = JSON.parse((await readBody(req)) || '{}');
      return json(res, 200, await saveSupply(payload));
    } catch (error) {
      return json(res, 400, { error: 'supply_save_failed', message: String(error?.message || error) });
    }
  }

  if (req.method === 'GET' && url.pathname === '/api/v1/purchase-orders') return json(res, 200, await listPurchaseOrders());
  if (req.method === 'POST' && url.pathname === '/api/v1/purchase-orders') {
    try {
      const payload = JSON.parse((await readBody(req)) || '{}');
      return json(res, 200, await savePurchaseOrder(payload));
    } catch (error) {
      return json(res, 400, { error: 'purchase_order_save_failed', message: String(error?.message || error) });
    }
  }

  // ── Cargar certificado digital en usuario ─────────────────────────────────────
  if (req.method === 'POST' && url.pathname === '/api/v1/admin/users/certificate') {
    try {
      const payload = JSON.parse((await readBody(req)) || '{}');
      const { userId, certificateP12Base64, password } = payload;
      if (!userId || !certificateP12Base64 || !password) {
        return json(res, 400, { error: 'missing_fields', message: 'userId, certificateP12Base64 y password son obligatorios.' });
      }
      const certInfo = extractCertificateInfo(certificateP12Base64, password);
      const saved    = await saveUserCertificate(userId, certificateP12Base64, certInfo);
      return json(res, 200, { user: saved, certificateInfo: certInfo });
    } catch (error) {
      return json(res, 400, { error: 'certificate_upload_failed', message: String(error?.message || error) });
    }
  }

  // ── Eliminar certificado digital de usuario ───────────────────────────────────
  if (req.method === 'POST' && url.pathname === '/api/v1/admin/users/certificate/remove') {
    try {
      const { userId } = JSON.parse((await readBody(req)) || '{}');
      if (!userId) return json(res, 400, { error: 'missing_fields', message: 'userId es obligatorio.' });
      const user = await removeUserCertificate(userId);
      return json(res, 200, { user });
    } catch (error) {
      return json(res, 400, { error: 'certificate_remove_failed', message: String(error?.message || error) });
    }
  }

  // ── Generar PDF firmado de una OC ─────────────────────────────────────────────
  if (req.method === 'POST' && url.pathname === '/api/v1/purchase-orders/signed-pdf') {
    try {
      const payload = JSON.parse((await readBody(req)) || '{}');
      const { purchaseOrderId, userId, password } = payload;
      if (!purchaseOrderId || !userId || !password) {
        return json(res, 400, { error: 'missing_fields', message: 'purchaseOrderId, userId y password son obligatorios.' });
      }
      const orders = await listPurchaseOrders();
      const oc     = orders.find((o) => o.purchaseOrderId === purchaseOrderId);
      if (!oc) return json(res, 404, { error: 'purchase_order_not_found' });
      const userWithCert = await getUserWithCertificate(userId);
      if (!userWithCert?.certificateP12Base64) {
        return json(res, 400, { error: 'no_certificate', message: 'El usuario no tiene un certificado digital cargado.' });
      }
      const labProfile = await getLaboratoryProfile();
      const certInfo   = userWithCert.certificateInfo || {};
      const signerInfo = {
        name:     certInfo.commonName || userWithCert.fullName || userId,
        reason:   `Orden de Compra N° ${oc.orderNumber}`,
        email:    certInfo.email || labProfile.email || '',
        location: `${labProfile.city || 'Santiago'}, Chile`,
      };
      const pdfBuffer  = await generateOcPdf(oc, labProfile, signerInfo);
      const p12Buffer  = Buffer.from(userWithCert.certificateP12Base64, 'base64');
      const signedPdf  = await signPdf(pdfBuffer, p12Buffer, password, signerInfo);
      const fileName   = `OC-${oc.orderNumber}-firmado.pdf`;
      res.writeHead(200, {
        'Content-Type':        'application/pdf',
        'Content-Disposition': `attachment; filename="${fileName}"`,
        'Content-Length':      String(signedPdf.length),
        'Access-Control-Allow-Origin': '*',
      });
      return res.end(signedPdf);
    } catch (error) {
      return json(res, 400, { error: 'signing_failed', message: String(error?.message || error) });
    }
  }
  if (req.method === 'GET' && url.pathname === '/api/catalogs') {
    const catalogs = await Promise.all(compatCatalogDefinitions.map(async (definition) => {
      const entries = await listCatalogEntries(definition.catalogType);
      return { key: definition.key, title: definition.title, count: entries.length };
    }));
    return json(res, 200, { catalogs });
  }
  if (req.method === 'GET' && url.pathname.startsWith('/api/catalogs/')) {
    const key = decodeURIComponent(url.pathname.replace('/api/catalogs/', ''));
    return json(res, 200, await getCompatCatalogPayload(key));
  }
  if (req.method === 'POST' && url.pathname.startsWith('/api/catalogs/')) {
    try {
      const key = decodeURIComponent(url.pathname.replace('/api/catalogs/', ''));
      const definition = compatCatalogMap.get(key) || { catalogType: key };
      const payload = JSON.parse((await readBody(req)) || '{}');
      const saved = await saveCatalogEntry({ ...payload, catalogType: definition.catalogType });
      return json(res, 200, mapCompatCatalogItem(saved));
    } catch (error) {
      return json(res, 400, { error: 'catalog_save_failed', message: String(error?.message || error) });
    }
  }
  if (req.method === 'PUT' && url.pathname.startsWith('/api/catalogs/')) {
    try {
      const parts = url.pathname.replace('/api/catalogs/', '').split('/');
      const key = decodeURIComponent(parts[0] || '');
      const id = decodeURIComponent(parts[1] || '');
      const definition = compatCatalogMap.get(key) || { catalogType: key };
      const payload = JSON.parse((await readBody(req)) || '{}');
      const saved = await saveCatalogEntry({ ...payload, entryId: id, catalogType: definition.catalogType });
      return json(res, 200, mapCompatCatalogItem(saved));
    } catch (error) {
      return json(res, 400, { error: 'catalog_update_failed', message: String(error?.message || error) });
    }
  }
  if (req.method === 'DELETE' && url.pathname.startsWith('/api/catalogs/')) {
    const parts = url.pathname.replace('/api/catalogs/', '').split('/');
    const key = decodeURIComponent(parts[0] || '');
    const id = decodeURIComponent(parts[1] || '');
    return json(res, 200, await deleteCompatCatalogEntry(key, id));
  }
  if (req.method === 'GET' && url.pathname === '/api/documents/dashboard') {
    const [catalogsResponse, quotes] = await Promise.all([
      Promise.all(compatCatalogDefinitions.map(async (definition) => {
        const entries = await listCatalogEntries(definition.catalogType);
        return { key: definition.key, title: definition.title, count: entries.length };
      })),
      getCompatQuotes(),
    ]);
    return json(res, 200, {
      kpis: [
        { label: 'Catalogos', value: catalogsResponse.length },
        { label: 'Plantillas', value: quotes.length },
        { label: 'Renderizables', value: quotes.filter((item) => item.format !== 'informe-ensayo').length },
      ],
      catalogs: catalogsResponse.slice(0, 12),
      documents: quotes.map((quote) => ({
        id: quote.id,
        title: quote.title,
        code: quote.code,
        format: quote.format,
      })),
      integrations: [
        { source: 'PostgreSQL', products: catalogsResponse.length, providers: quotes.length },
      ],
    });
  }
  if (req.method === 'GET' && url.pathname === '/api/documents/quotes') {
    const quotes = await getCompatQuotes();
    return json(res, 200, {
      items: quotes.map((quote) => ({
        id: quote.id,
        title: quote.title,
        code: quote.code,
        format: quote.format,
        documentLabel: quote.documentLabel,
      })),
    });
  }
  if (req.method === 'GET' && url.pathname.startsWith('/api/documents/quotes/')) {
    const id = decodeURIComponent(url.pathname.replace('/api/documents/quotes/', ''));
    const quotes = await getCompatQuotes();
    const quote = quotes.find((item) => item.id === id);
    if (!quote) return json(res, 404, { error: 'quote_not_found', id });
    return json(res, 200, quote);
  }
  if (req.method === 'GET' && url.pathname === '/api/documents/provider-report') {
    const quotes = await listQuotes({});
    if (quotes.length) {
      return json(res, 200, {
        generatedAt: new Date().toISOString(),
        total: quotes.length,
        rows: quotes.map((quote) => ({
          id: quote.quoteId,
          estado: quote.quoteStatusKey || '-',
          landing: quote.intakeChannelKey || '-',
          nombreProveedor: quote.customerName || '-',
          rut: quote.customerId || '-',
          fechaEmision: quote.issueDate || '-',
          montoUf: quote.amountUf ?? '-',
          correo: '-',
          contacto: '-',
          tipoAnalisis: (quote.analysisPackages || []).join(', ') || '-',
          seguimiento: quote.followUps?.length ? quote.followUps.map((item) => item.description).join(' | ') : 'Sin seguimiento',
        })),
      });
    }
    const customers = await listCustomers('');
    return json(res, 200, {
      generatedAt: new Date().toISOString(),
      total: customers.length,
      rows: customers.map((customer, index) => ({
        id: index + 1,
        estado: 'Aceptada',
        landing: 'Backend',
        nombreProveedor: customer.businessName,
        rut: customer.rut,
        fechaEmision: new Date().toISOString().slice(0, 10),
        montoUf: '-',
        correo: customer.contacts?.[0]?.email || '-',
        contacto: customer.contacts?.[0]?.name || '-',
        tipoAnalisis: 'Cliente',
        seguimiento: 'Registrado',
      })),
    });
  }
  if (req.method === 'GET' && url.pathname === '/api/documents/process-tracking') {
    const assayRecords = await listAssayRecords({});
    const rows = assayRecords.length
      ? assayRecords.map((record) => ({
          id: record.assayRecordId,
          codigoProceso: record.reportNumber || record.labEntryNumber || record.assayRecordId,
          muestra: record.sampleTypeKey || '-',
          cliente: record.customerName || record.customerId || '-',
          tipoAnalisis: record.businessDocumentTypeKey || '-',
          responsable: record.areaManagerName || 'APP',
          fechaIngreso: record.sampledAt ? String(record.sampledAt).slice(0, 10) : '',
          fechaRecepcion: record.receivedAt ? String(record.receivedAt).slice(0, 10) : '',
          fechaAnalisis: record.analysisStartedAt ? String(record.analysisStartedAt).slice(0, 10) : '',
          fechaValidacion: record.analysisFinishedAt ? String(record.analysisFinishedAt).slice(0, 10) : '',
          fechaCierre: record.deliveryDate || '',
          estadoActual: record.deliveryDate ? 'CERRADO' : 'EN PROCESO',
          historial: [
            record.sampledAt ? 'Muestreo' : '',
            record.receivedAt ? 'Recepcion' : '',
            record.analysisStartedAt ? 'Analisis' : '',
            record.analysisFinishedAt ? 'Validacion' : '',
            record.deliveryDate ? 'Entrega' : '',
          ].filter(Boolean).join(' > ') || 'Registrado',
        }))
      : (await getCompatQuotes()).slice(0, 8).map((quote, index) => ({
          id: quote.id,
          codigoProceso: quote.code,
          muestra: quote.title,
          cliente: 'Laboratorio Carlos Latorre S.A.',
          tipoAnalisis: quote.format,
          responsable: 'APP',
          fechaIngreso: new Date().toISOString().slice(0, 10),
          fechaRecepcion: '',
          fechaAnalisis: '',
          fechaValidacion: '',
          fechaCierre: '',
          estadoActual: index % 2 === 0 ? 'EN PROCESO' : 'REGISTRADO',
          historial: 'Ingreso > Revision > Pendiente de cierre',
        }));
    return json(res, 200, {
      generatedAt: new Date().toISOString(),
      total: rows.length,
      statusSummary: Array.from(rows.reduce((map, row) => {
        const key = row.estadoActual || 'SIN ESTADO';
        map.set(key, (map.get(key) || 0) + 1);
        return map;
      }, new Map()).entries()).map(([name, count]) => ({ name, count })),
      rows,
    });
  }
  if (req.method === 'GET' && url.pathname === '/api/v1/document-types') return json(res, 200, [
    { slug: 'cotizacion', label: 'Cotizacion' },
    { slug: 'informe-ensayo', label: 'Informe de Ensayo' },
    { slug: 'registro-parcial', label: 'Registro Parcial' },
    { slug: 'orden-compra', label: 'Orden de Compra' },
    { slug: 'registro-muestras', label: 'Registro de Muestras' },
    { slug: 'documento-administrativo', label: 'Documento Administrativo' },
  ]);
  if (req.method === 'GET' && url.pathname === '/api/v1/document-codes') {
    const templates = await listTemplates({ renderableOnly: false });
    const unique = new Map();
    for (const item of templates) if (!unique.has(item.documentCode)) unique.set(item.documentCode, { documentCode: item.documentCode, documentTypeSlug: item.documentTypeSlug });
    return json(res, 200, Array.from(unique.values()));
  }
  if (req.method === 'GET' && url.pathname === '/api/v1/chile-regionalization') {
    try {
      return json(res, 200, await getChileRegionalization({ refresh: boolParam(url.searchParams.get('refresh')) }));
    } catch (error) {
      return json(res, 500, { error: 'chile_regionalization_failed', message: String(error?.message || error) });
    }
  }
  if (req.method === 'GET' && url.pathname === '/api/v1/chile-regionalization/regions') {
    try {
      return json(res, 200, await listChileRegions());
    } catch (error) {
      return json(res, 500, { error: 'chile_regions_failed', message: String(error?.message || error) });
    }
  }
  if (req.method === 'GET' && url.pathname === '/api/v1/chile-regionalization/provinces') {
    try {
      return json(res, 200, await listChileProvinces({ regionId: url.searchParams.get('regionId') || '' }));
    } catch (error) {
      return json(res, 500, { error: 'chile_provinces_failed', message: String(error?.message || error) });
    }
  }
  if (req.method === 'GET' && url.pathname === '/api/v1/chile-regionalization/communes') {
    try {
      return json(res, 200, await listChileCommuneCandidates({
        regionId: url.searchParams.get('regionId') || '',
        provinceId: url.searchParams.get('provinceId') || '',
        query: url.searchParams.get('q') || '',
        includePlaces: boolParam(url.searchParams.get('includePlaces')),
      }));
    } catch (error) {
      return json(res, 500, { error: 'chile_communes_failed', message: String(error?.message || error) });
    }
  }
  if (req.method === 'GET' && url.pathname === '/api/v1/chile-regionalization/places') {
    try {
      return json(res, 200, await listChilePlaces({
        regionId: url.searchParams.get('regionId') || '',
        provinceId: url.searchParams.get('provinceId') || '',
        query: url.searchParams.get('q') || '',
      }));
    } catch (error) {
      return json(res, 500, { error: 'chile_places_failed', message: String(error?.message || error) });
    }
  }
  if (req.method === 'GET' && url.pathname === '/api/v1/templates') return json(res, 200, await listTemplates({ renderableOnly: url.searchParams.get('renderableOnly') !== 'false' }));
  if (req.method === 'GET' && url.pathname === '/api/v1/customers') return json(res, 200, await listCustomers(normalizeRut(url.searchParams.get('rut') || '')));
  if (req.method === 'POST' && url.pathname === '/api/v1/customers') {
    try {
      const payload = JSON.parse((await readBody(req)) || '{}');
      return json(res, 200, await saveCustomer(payload));
    } catch (error) {
      return json(res, 400, { error: 'customer_save_failed', message: String(error?.message || error) });
    }
  }
  if (req.method === 'DELETE' && url.pathname.startsWith('/api/v1/customers/')) {
    const customerId = decodeURIComponent(url.pathname.replace('/api/v1/customers/', ''));
    if (!customerId) return json(res, 400, { error: 'missing_id' });
    try {
      await deleteCustomer(customerId);
      return json(res, 200, { deleted: true });
    } catch (error) {
      return json(res, 409, { error: 'customer_delete_failed', message: String(error?.message || error) });
    }
  }
  if (req.method === 'GET' && url.pathname === '/api/v1/contacts') {
    return json(res, 200, await listContacts(url.searchParams.get('customerId') || ''));
  }
  if (req.method === 'POST' && url.pathname === '/api/v1/contacts') {
    try {
      const payload = JSON.parse((await readBody(req)) || '{}');
      return json(res, 200, await saveContact(payload));
    } catch (error) {
      return json(res, 400, { error: 'contact_save_failed', message: String(error?.message || error) });
    }
  }
  if (req.method === 'DELETE' && url.pathname.startsWith('/api/v1/contacts/')) {
    const contactId = decodeURIComponent(url.pathname.replace('/api/v1/contacts/', ''));
    if (!contactId) return json(res, 400, { error: 'missing_id' });
    try {
      await deleteContact(contactId);
      return json(res, 200, { deleted: true });
    } catch (error) {
      return json(res, 409, { error: 'contact_delete_failed', message: String(error?.message || error) });
    }
  }
  if (req.method === 'GET' && url.pathname === '/api/v1/catalogs') {
    return json(res, 200, await listCatalogEntries(url.searchParams.get('catalogType') || ''));
  }
  if (req.method === 'POST' && url.pathname === '/api/v1/catalogs') {
    try {
      const payload = JSON.parse((await readBody(req)) || '{}');
      return json(res, 200, await saveCatalogEntry(payload));
    } catch (error) {
      return json(res, 400, { error: 'catalog_save_failed', message: String(error?.message || error) });
    }
  }
  if (req.method === 'GET' && url.pathname === '/api/v1/domain/assay-parameters') {
    return json(res, 200, await listAssayParameters(url.searchParams.get('q') || ''));
  }
  if (req.method === 'POST' && url.pathname === '/api/v1/domain/assay-parameters') {
    try {
      const payload = JSON.parse((await readBody(req)) || '{}');
      return json(res, 200, await saveAssayParameter(payload));
    } catch (error) {
      return json(res, 400, { error: 'assay_parameter_save_failed', message: String(error?.message || error) });
    }
  }
  if (req.method === 'GET' && url.pathname === '/api/v1/domain/analytical-methods') {
    return json(res, 200, await listAnalyticalMethods(url.searchParams.get('q') || ''));
  }
  if (req.method === 'POST' && url.pathname === '/api/v1/domain/analytical-methods') {
    try {
      const payload = JSON.parse((await readBody(req)) || '{}');
      return json(res, 200, await saveAnalyticalMethod(payload));
    } catch (error) {
      return json(res, 400, { error: 'analytical_method_save_failed', message: String(error?.message || error) });
    }
  }
  if (req.method === 'GET' && url.pathname === '/api/v1/quotes') {
    return json(res, 200, await listQuotes({
      customerId: url.searchParams.get('customerId') || '',
      normalizedRut: normalizeRut(url.searchParams.get('rut') || ''),
    }));
  }
  if (req.method === 'POST' && url.pathname === '/api/v1/quotes') {
    try {
      const payload = JSON.parse((await readBody(req)) || '{}');
      return json(res, 200, await saveQuote(payload));
    } catch (error) {
      return json(res, 400, { error: 'quote_save_failed', message: String(error?.message || error) });
    }
  }
  if (req.method === 'GET' && url.pathname.startsWith('/api/v1/quotes/') && url.pathname.endsWith('/follow-ups')) {
    const quoteId = decodeURIComponent(url.pathname.replace('/api/v1/quotes/', '').replace('/follow-ups', ''));
    return json(res, 200, await listQuoteFollowUps(quoteId));
  }
  if (req.method === 'POST' && url.pathname.startsWith('/api/v1/quotes/') && url.pathname.endsWith('/follow-ups')) {
    try {
      const quoteId = decodeURIComponent(url.pathname.replace('/api/v1/quotes/', '').replace('/follow-ups', ''));
      const payload = JSON.parse((await readBody(req)) || '{}');
      return json(res, 200, await saveQuoteFollowUp(quoteId, payload));
    } catch (error) {
      return json(res, 400, { error: 'quote_follow_up_save_failed', message: String(error?.message || error) });
    }
  }
  if (req.method === 'GET' && url.pathname === '/api/v1/assay-records') {
    return json(res, 200, await listAssayRecords({
      customerId: url.searchParams.get('customerId') || '',
      normalizedRut: normalizeRut(url.searchParams.get('rut') || ''),
    }));
  }
  if (req.method === 'POST' && url.pathname === '/api/v1/assay-records') {
    try {
      const payload = JSON.parse((await readBody(req)) || '{}');
      return json(res, 200, await saveAssayRecord(payload));
    } catch (error) {
      return json(res, 400, { error: 'assay_record_save_failed', message: String(error?.message || error) });
    }
  }
  if (req.method === 'GET' && url.pathname.startsWith('/api/v1/assay-records/') && url.pathname.endsWith('/results')) {
    const assayRecordId = decodeURIComponent(url.pathname.replace('/api/v1/assay-records/', '').replace('/results', ''));
    return json(res, 200, await listAssayResults(assayRecordId));
  }
  if (req.method === 'POST' && url.pathname.startsWith('/api/v1/assay-records/') && url.pathname.endsWith('/results')) {
    try {
      const assayRecordId = decodeURIComponent(url.pathname.replace('/api/v1/assay-records/', '').replace('/results', ''));
      const payload = JSON.parse((await readBody(req)) || '{}');
      return json(res, 200, await saveAssayResult(assayRecordId, payload));
    } catch (error) {
      return json(res, 400, { error: 'assay_result_save_failed', message: String(error?.message || error) });
    }
  }
  if (req.method === 'GET' && url.pathname === '/api/v1/products') {
    return json(res, 200, await listProducts(url.searchParams.get('groupKey') || ''));
  }
  if (req.method === 'POST' && url.pathname === '/api/v1/products') {
    try {
      const payload = JSON.parse((await readBody(req)) || '{}');
      return json(res, 200, await saveProduct(payload));
    } catch (error) {
      return json(res, 400, { error: 'product_save_failed', message: String(error?.message || error) });
    }
  }
  if (req.method === 'GET' && url.pathname === '/api/v1/templates/resolve') {
    const documentCode = url.searchParams.get('documentCode') || '';
    const templateSlug = url.searchParams.get('templateSlug') || '';
    const template = await resolveTemplate(documentCode, templateSlug);
    if (!template) return json(res, 404, { error: 'template_not_found', documentCode, templateSlug });
    return json(res, 200, template);
  }
  if (req.method === 'POST' && url.pathname === '/api/v1/template-intake/analyze') {
    try {
      const payload = JSON.parse((await readBody(req)) || '{}');
      if (!payload.sourcePath) return json(res, 400, { error: 'invalid_request', message: 'sourcePath es obligatorio.' });
      const analysis = await analyzeTemplateIntake(payload);
      return json(res, 200, analysis);
    } catch (error) {
      return json(res, 400, { error: 'template_intake_analyze_failed', message: String(error?.message || error) });
    }
  }
  if (req.method === 'POST' && url.pathname === '/api/v1/template-intake/register') {
    try {
      const payload = JSON.parse((await readBody(req)) || '{}');
      if (!payload.sourcePath) return json(res, 400, { error: 'invalid_request', message: 'sourcePath es obligatorio.' });
      const result = await registerTemplateIntake(payload);
      return json(res, 200, result);
    } catch (error) {
      return json(res, 400, { error: 'template_intake_register_failed', message: String(error?.message || error) });
    }
  }
  if (req.method === 'GET' && url.pathname === '/api/v1/temporals') return json(res, 200, await listTemporaryProfiles());
  if (req.method === 'POST' && url.pathname === '/api/v1/temporals') {
    const payload = JSON.parse((await readBody(req)) || '{}');
    const profile = await saveTemporaryProfile({
      profileId: payload.profileId || `tmp-${Date.now()}`,
      templateSlug: payload.templateSlug,
      ownerCustomerId: payload.ownerCustomerId || null,
      profileName: payload.profileName || 'Temporal de sesion',
      payload: payload.payload || {},
      isSessionTemp: payload.isSessionTemp !== false,
    });
    return json(res, 200, profile);
  }
  if (req.method === 'DELETE' && url.pathname.startsWith('/api/v1/temporals/')) {
    const profileId = decodeURIComponent(url.pathname.replace('/api/v1/temporals/', ''));
    await deleteTemporaryProfile(profileId);
    return json(res, 200, { deleted: true, profileId });
  }
  if (req.method === 'GET' && url.pathname.startsWith('/api/v1/artifacts/')) {
    const fileName = decodeURIComponent(url.pathname.replace('/api/v1/artifacts/', ''));
    const filePath = join(ARTIFACT_ROOT, fileName);
    if (!existsSync(filePath)) return json(res, 404, { error: 'artifact_not_found', fileName });
    const lower = fileName.toLowerCase();
    const mimeType = lower.endsWith('.pdf')
      ? 'application/pdf'
      : lower.endsWith('.json')
        ? 'application/json; charset=utf-8'
        : lower.endsWith('.csv')
          ? 'text/csv; charset=utf-8'
          : lower.endsWith('.zip')
            ? 'application/zip'
            : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
    res.writeHead(200, { 'Content-Type': mimeType, 'Content-Disposition': `attachment; filename="${fileName}"`, 'Access-Control-Allow-Origin': '*' });
    return createReadStream(filePath).pipe(res);
  }
  if (req.method === 'POST' && url.pathname === '/api/v1/document-sessions') {
    try {
      const payload = JSON.parse((await readBody(req)) || '{}');
      if (!payload.documentCode || !payload.documentTypeSlug) return json(res, 400, { error: 'invalid_request', message: 'documentCode y documentTypeSlug son obligatorios.' });
      const session = { sessionId: payload.sessionId || `ses-${Date.now()}`, documentTypeSlug: payload.documentTypeSlug, documentCode: payload.documentCode, customerId: payload.customerId || null, contactId: payload.contactId || null, status: payload.status || 'draft', confidentialityLevel: payload.confidentialityLevel || 'internal', payload: payload.payload || {} };
      await saveDocumentSession(session);
      return json(res, 200, session);
    } catch (error) { return json(res, 400, { error: 'invalid_json', message: String(error?.message || error) }); }
  }
  if (req.method === 'POST' && url.pathname === '/api/v1/document-render-jobs') {
    try {
      const payload = JSON.parse((await readBody(req)) || '{}');
      if (!payload.documentCode || !payload.documentTypeSlug) return json(res, 400, { error: 'invalid_request', message: 'documentCode y documentTypeSlug son obligatorios.' });
      const template = await resolveTemplate(payload.documentCode, payload.templateSlug || '');
      if (!template) return json(res, 404, { error: 'template_not_found', documentCode: payload.documentCode, templateSlug: payload.templateSlug || null });
      const customers = await listCustomers(payload.fieldValues?.cliente_rut || '');
      const selectedCustomer = customers.find((item) => item.customerId === payload.context?.customerId) || customers[0] || null;
      const result = await buildRenderBundle(payload, template, selectedCustomer);
      await saveDocumentSession({ sessionId: result.sessionId, documentTypeSlug: payload.documentTypeSlug, documentCode: payload.documentCode, customerId: payload.context?.customerId || selectedCustomer?.customerId || null, contactId: payload.context?.contactId || null, status: 'rendered', confidentialityLevel: template.confidentialityLevel || payload.context?.confidentialityLevel || 'internal', payload });
      await saveRenderJob({ renderJobId: result.renderJobId, sessionId: result.sessionId, templateSlug: result.templateSlug, documentTypeSlug: payload.documentTypeSlug, documentCode: payload.documentCode, outputFormat: payload.outputFormat, status: result.status, requestJson: payload, resultJson: result });
      for (const artifact of result.artifacts || [result.artifact]) {
        if (artifact?.storagePath && artifact?.checksumSha256) {
          await saveIssuedDocument({ issuedDocumentId: `iss-${Date.now()}-${artifact.format}`, renderJobId: result.renderJobId, templateSlug: result.templateSlug, outputFormat: artifact.format, storagePath: artifact.storagePath, checksumSha256: artifact.checksumSha256 });
        }
      }
      const emailResult = await maybeSendEmail(payload, result);
      return json(res, 200, { ...result, emailResult });
    } catch (error) { return json(res, 400, { error: 'render_failed', message: String(error?.message || error) }); }
  }
  if (req.method === 'GET' && url.pathname === '/') {
    const filePath = join(process.cwd(), 'README.md');
    if (existsSync(filePath)) { const content = await readFile(filePath, 'utf8'); res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' }); return res.end(content); }
  }
  return notFound(res);
});

server.listen(PORT, HOST, () => { console.log(`laboratorio-backend escuchando en http://${HOST}:${PORT}`); });
