import XlsxPopulate from 'xlsx-populate';
import AdmZip from 'adm-zip';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { basename, isAbsolute, join, parse } from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { calculateSummaryFromDetailRows, formatValue, formatSpanishDate } from '../../shared/formatters/formatter-engine.mjs';

const execFileAsync = promisify(execFile);
const TEMPLATE_ROOT = 'C:\\RODPROJECTS\\denu_pen_lab\\applab\\laboratorio-app\\frontend\\laboratorio';
const OUTPUT_ROOT = 'C:\\RODPROJECTS\\laboratorio-backend\\data\\rendered';
const SOFFICE_PATH = 'C:\\Program Files\\LibreOffice\\program\\soffice.exe';
const LOGO_INN_PATH = 'C:\\RODPROJECTS\\laboratorio-frontend\\src\\assets\\LogoINN.png';

function safeName(value) {
  return String(value || 'documento').replace(/[^A-Za-z0-9_-]/g, '_');
}

function resolveTemplatePath(template) {
  if (!template?.sourcePath) throw new Error('La plantilla no tiene sourcePath configurado.');
  const sourceValues = [
    template.sourceImportedPath,
    template.sourcePath,
    template.sourceOriginalPath,
  ].filter(Boolean);

  const candidates = [];
  for (const sourceValue of sourceValues) {
    const sourcePath = String(sourceValue);
    candidates.push(isAbsolute(sourcePath) ? sourcePath : join(TEMPLATE_ROOT, sourcePath));
    if (!isAbsolute(sourcePath)) candidates.push(join(process.cwd(), sourcePath));
  }

  if (template.sourceFileName) {
    const parsed = parse(template.sourceFileName);
    candidates.push(join(TEMPLATE_ROOT, 'A TIPOS DE COTIZACIONES', template.sourceFileName));
    candidates.push(join(TEMPLATE_ROOT, 'A TIPOS DE COTIZACIONES', `${parsed.name}.xlsx`));
    candidates.push(join(process.cwd(), 'data', 'imports', `${parsed.name}.xlsx`));
    candidates.push(join(process.cwd(), 'data', 'imports', template.sourceFileName));
    candidates.push(join(process.cwd(), 'migrations', template.sourceFileName));
  }

  const existing = candidates.find((candidate) => existsSync(candidate));
  if (existing) return existing;

  return candidates[0] || String(template.sourcePath);
}

function documentReference(payload) {
  const code = payload?.documentCode || 'DOCUMENTO';
  const number = payload?.fieldValues?.document_number || payload?.metadata?.documentNumber || '';
  return number ? `${code} - ${number}` : `${code} -`;
}

function buildOutputPath(documentCode, templateSlug, documentNumber = '') {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const refPart = documentNumber ? `${safeName(documentCode)}-${safeName(documentNumber)}` : safeName(documentCode);
  const baseName = `${refPart}-${safeName(templateSlug)}-${stamp}`;
  return {
    baseName,
    fileName: `${baseName}.xlsx`,
    absolutePath: join(OUTPUT_ROOT, `${baseName}.xlsx`),
  };
}

async function checksumFile(filePath) {
  const buffer = await readFile(filePath);
  return createHash('sha256').update(buffer).digest('hex');
}

async function convertWorkbookToPdf(xlsxPath) {
  if (!existsSync(SOFFICE_PATH)) throw new Error(`LibreOffice no encontrado en ${SOFFICE_PATH}`);
  await execFileAsync(SOFFICE_PATH, ['--headless', '--convert-to', 'pdf', '--outdir', OUTPUT_ROOT, xlsxPath]);
  const pdfPath = join(OUTPUT_ROOT, `${parse(xlsxPath).name}.pdf`);
  if (!existsSync(pdfPath)) throw new Error(`No se genero el PDF esperado para ${basename(xlsxPath)}`);
  return pdfPath;
}

function firstDetailRows(payload, count) {
  const rows = payload.repeatSections?.['pg04-detalle-parametros'];
  return Array.isArray(rows) ? rows.slice(0, count) : [];
}

function secondDetailRows(payload, skip, count) {
  const explicit = payload.repeatSections?.['piscina-micro'];
  if (Array.isArray(explicit) && explicit.length) return explicit.slice(0, count);
  const rows = payload.repeatSections?.['pg04-detalle-parametros'];
  return Array.isArray(rows) ? rows.slice(skip, skip + count) : [];
}

function rawNumeric(value) {
  const original = String(value ?? '').replace(/UF/gi, '').trim();
  if (!original) return 0;
  const normalized = original.includes(',') && original.includes('.')
    ? original.replace(/\./g, '').replace(',', '.')
    : original.replace(',', '.');
  const num = Number(normalized);
  return Number.isFinite(num) ? num : 0;
}

function writeNumeric(sheet, cell, value, decimals = 2) {
  sheet.cell(cell).value(Number(value.toFixed(decimals)));
}

function santiagoDate(value) {
  const date = formatSpanishDate(value);
  return date ? `Santiago, ${date}` : 'Santiago, ';
}

function getDescription(payload) {
  return payload.fieldValues?.detalle_descripcion || payload.fieldValues?.observaciones || payload.fieldValues?.service_product || '';
}

function addresseeName(payload) {
  return payload.fieldValues?.cliente_nombre || payload.fieldValues?.company_name || '';
}

function applyHeaderCommon(sheet, payload, cells) {
  cells.forEach(({ cell, value }) => {
    const rawValue = typeof value === 'function' ? value(payload) : value;
    sheet.cell(cell).value(rawValue ?? '');
  });
}

function applyInnAccreditation(sheet, columnLetter = 'G') {
  [3, 4, 5].forEach((row) => sheet.cell(`${columnLetter}${row}`).value(''));
  sheet.cell(`${columnLetter}6`)
    .value('Acreditación LE 171 - LE 172')
    .style({
      bold: true,
      fontSize: 9,
      horizontalAlignment: 'center',
      verticalAlignment: 'center',
      wrapText: true,
    });
}

function splitTextLines(value = '') {
  return String(value || '')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function writeTextLines(sheet, startRow, maxRows, value) {
  const lines = splitTextLines(value).slice(0, maxRows);
  for (let index = 0; index < maxRows; index += 1) {
    sheet.cell(`A${startRow + index}`).value(lines[index] || '');
  }
}

function renderPg04(sheet, payload) {
  applyHeaderCommon(sheet, payload, [
    { cell: 'G7', value: (p) => documentReference(p) },
    { cell: 'G8', value: (p) => santiagoDate(p.fieldValues?.fecha_emision) },
    { cell: 'A9', value: (p) => addresseeName(p) },
    { cell: 'F10', value: (p) => `Atención: ${p.fieldValues?.contacto_nombre || ''}` },
    { cell: 'G11', value: (p) => `correo: ${p.fieldValues?.contacto_email || ''}` },
    { cell: 'G12', value: (p) => `número de contacto: ${p.fieldValues?.contacto_telefono || ''}` },
    { cell: 'G13', value: (p) => `RUT: ${p.fieldValues?.cliente_rut || ''}` },
    { cell: 'A17', value: (p) => p.fieldValues?.service_product || 'Análisis Parcial' },
    { cell: 'E15', value: (p) => p.fieldValues?.matrix || '' },
  ]);
  applyInnAccreditation(sheet, 'G');

  const rows = firstDetailRows(payload, 18);
  for (let row = 20; row <= 37; row += 1) ['A', 'B', 'C', 'D', 'E'].forEach((col) => sheet.cell(`${col}${row}`).value(''));
  rows.forEach((row, index) => {
    const r = 20 + index;
    sheet.cell(`A${r}`).value(formatValue('detail_parameter_name', row));
    sheet.cell(`B${r}`).value(row.unidad_medida || '');
    sheet.cell(`C${r}`).value(formatValue('detail_detection_limit', row));
    sheet.cell(`D${r}`).value(formatValue('detail_method_name', row));
    writeNumeric(sheet, `E${r}`, rawNumeric(row.price_uf || row.priceUf || row.price || 0));
  });

  const summary = calculateSummaryFromDetailRows(rows);
  sheet.cell('A46').value('Costo Ensayos Análisis Parcial ');
  writeNumeric(sheet, 'E49', summary.neto);
  writeNumeric(sheet, 'E50', summary.iva);
  writeNumeric(sheet, 'E51', summary.total);
  return summary;
}

function renderFas(sheet, payload) {
  const firstRow = firstDetailRows(payload, 1)[0];
  const explicitUnit = rawNumeric(firstRow?.price_uf || firstRow?.priceUf || firstRow?.price || 0);
  const unit = explicitUnit > 0 ? explicitUnit : 3.32;
  const iva = unit * 0.19;
  const total = unit + iva;
  applyHeaderCommon(sheet, payload, [
    { cell: 'G7', value: (p) => documentReference(p) },
    { cell: 'G8', value: (p) => santiagoDate(p.fieldValues?.fecha_emision) },
    { cell: 'A9', value: (p) => addresseeName(p) },
    { cell: 'G10', value: (p) => `Atención: ${p.fieldValues?.contacto_nombre || ''}` },
    { cell: 'G11', value: (p) => `correo: ${p.fieldValues?.contacto_email || ''}` },
    { cell: 'G12', value: (p) => `número de contacto: ${p.fieldValues?.contacto_telefono || ''}` },
    { cell: 'G13', value: (p) => `RUT: ${p.fieldValues?.cliente_rut || ''}` },
    { cell: 'A17', value: (p) => p.fieldValues?.service_product && p.fieldValues.service_product.toLowerCase().includes('fas') ? p.fieldValues.service_product : 'Contrastación - FAS' },
    { cell: 'A20', value: (p) => getDescription(p) || 'Contrastación según lo establecido en el procedimiento técnico PT-01-2024 de Manual de métodos de ensayo para agua potable versión 2024' },
    { cell: 'E19', value: unit },
    { cell: 'A31', value: () => 'Constractación - FAS' },
    { cell: 'B31', value: unit },
    { cell: 'D31', value: 1 },
    { cell: 'E31', value: unit },
    { cell: 'E33', value: Number(unit.toFixed(2)) },
    { cell: 'E34', value: Number(iva.toFixed(4)) },
    { cell: 'E35', value: Number(total.toFixed(4)) },
  ]);
  applyInnAccreditation(sheet, 'G');
  return { neto: unit, iva, total };
}

function renderPiscina(sheet, payload) {
  applyHeaderCommon(sheet, payload, [
    { cell: 'G7', value: (p) => documentReference(p) },
    { cell: 'G8', value: (p) => santiagoDate(p.fieldValues?.fecha_emision) },
    { cell: 'A9', value: (p) => addresseeName(p) },
    { cell: 'G10', value: (p) => `Atención: ${p.fieldValues?.contacto_nombre || ''}` },
    { cell: 'G11', value: (p) => `correo: ${p.fieldValues?.contacto_email || ''}` },
    { cell: 'G12', value: (p) => `número de contacto: ${p.fieldValues?.contacto_telefono || ''}` },
    { cell: 'G13', value: (p) => `RUT: ${p.fieldValues?.cliente_rut || ''}` },
    { cell: 'A17', value: (p) => (p.fieldValues?.service_product && p.fieldValues.service_product.toLowerCase().includes('piscina')) ? p.fieldValues.service_product : 'Análisis Parcial (Decreto 209 Piscina)' },
    { cell: 'E17', value: (p) => (p.fieldValues?.matrix && p.fieldValues.matrix.toLowerCase().includes('recre')) ? p.fieldValues.matrix : 'Agua de Recreación' },
  ]);
  applyInnAccreditation(sheet, 'G');

  const fisico = Array.isArray(payload.repeatSections?.['piscina-fq']) ? payload.repeatSections['piscina-fq'].slice(0, 6) : firstDetailRows(payload, 6);
  const micro = secondDetailRows(payload, fisico.length, 4);
  for (let row = 20; row <= 25; row += 1) ['A', 'B', 'C', 'D', 'E'].forEach((col) => sheet.cell(`${col}${row}`).value(''));
  for (let row = 35; row <= 38; row += 1) ['A', 'B', 'C', 'D', 'E'].forEach((col) => sheet.cell(`${col}${row}`).value(''));

  fisico.forEach((row, index) => {
    const r = 20 + index;
    sheet.cell(`A${r}`).value(formatValue('detail_parameter_name', row));
    sheet.cell(`B${r}`).value(row.unidad_medida || '');
    sheet.cell(`C${r}`).value(formatValue('detail_detection_limit', row));
    sheet.cell(`D${r}`).value(formatValue('detail_method_name', row));
  });
  micro.forEach((row, index) => {
    const r = 35 + index;
    sheet.cell(`A${r}`).value(formatValue('detail_parameter_name', row));
    sheet.cell(`B${r}`).value(row.unidad_medida || '');
    sheet.cell(`C${r}`).value(formatValue('detail_detection_limit', row));
    sheet.cell(`D${r}`).value(formatValue('detail_method_name', row));
  });

  const fqSummary = calculateSummaryFromDetailRows(fisico);
  const microSummary = calculateSummaryFromDetailRows(micro);
  const fqBundle = fisico.length ? rawNumeric(fisico[0].price_uf || fisico[0].priceUf || fisico[0].price || 0) : fqSummary.neto;
  const neto = fqBundle + microSummary.neto;
  const iva = neto * 0.19;
  const total = neto + iva;
  writeNumeric(sheet, 'E19', fisico.length ? rawNumeric(fisico[0].price_uf || fisico[0].priceUf || 0) : 0);
  sheet.cell('A32').value(payload.fieldValues?.service_product_micro || 'Análisis Microbiológico (Decreto 209 Piscina)');
  sheet.cell('D32').value((payload.fieldValues?.matrix && payload.fieldValues.matrix.toLowerCase().includes('recre')) ? payload.fieldValues.matrix : 'Agua de Recreación');
  writeNumeric(sheet, 'E32', microSummary.neto);
  sheet.cell('A49').value('Costo Ensayos Análisis Parcial + Microbiológico');
  writeNumeric(sheet, 'B49', neto);
  sheet.cell('D49').value(1);
  writeNumeric(sheet, 'E49', neto);
  writeNumeric(sheet, 'E52', neto);
  writeNumeric(sheet, 'E53', iva);
  writeNumeric(sheet, 'E54', total);
  return { neto, iva, total };
}

function renderArrastre(sheet, payload) {
  const row = firstDetailRows(payload, 1)[0] || { parameter_name: 'Arrastre de Arena (*)', unidad_medida: 'mg/L', detection_limit: '2', method_name: 'Gravimetria', price_uf: '0.68 UF' };
  const summary = calculateSummaryFromDetailRows([row]);
  applyHeaderCommon(sheet, payload, [
    { cell: 'F8', value: (p) => documentReference(p) },
    { cell: 'F9', value: (p) => santiagoDate(p.fieldValues?.fecha_emision) },
    { cell: 'A10', value: (p) => addresseeName(p) },
    { cell: 'F11', value: (p) => `Atención: ${p.fieldValues?.contacto_nombre || ''}` },
    { cell: 'F12', value: (p) => `correo: ${p.fieldValues?.contacto_email || ''}` },
    { cell: 'F13', value: (p) => `número de contacto: ${p.fieldValues?.contacto_telefono || ''}` },
    { cell: 'F14', value: (p) => `Rut: ${p.fieldValues?.cliente_rut || ''}` },
    { cell: 'A20', value: (p) => (p.fieldValues?.service_product && p.fieldValues.service_product.toLowerCase().includes('arrastre')) ? p.fieldValues.service_product : 'Análisis Químico Parcial ' },
    { cell: 'E20', value: (p) => (p.fieldValues?.matrix && p.fieldValues.matrix.toLowerCase().includes('capt')) ? p.fieldValues.matrix : 'Fuente de Captación' },
  ]);
  applyInnAccreditation(sheet, 'F');
  sheet.cell('A22').value(formatValue('detail_parameter_name', row));
  sheet.cell('B22').value(row.unidad_medida || '');
  sheet.cell('C22').value(formatValue('detail_detection_limit', row));
  sheet.cell('D22').value(formatValue('detail_method_name', row));
  writeNumeric(sheet, 'E22', summary.neto);
  sheet.cell('A33').value('Costo Ensayos Análisis Quimico Parcial');
  writeNumeric(sheet, 'B33', summary.neto);
  sheet.cell('D33').value(1);
  writeNumeric(sheet, 'E33', summary.neto);
  writeNumeric(sheet, 'E36', summary.neto);
  writeNumeric(sheet, 'E37', summary.iva, 4);
  writeNumeric(sheet, 'E38', summary.total, 4);
  if (payload.fieldValues?.references_text) writeTextLines(sheet, 26, 5, payload.fieldValues.references_text);
  if (payload.fieldValues?.normative_conditions) writeTextLines(sheet, 43, 7, payload.fieldValues.normative_conditions);
  if (payload.fieldValues?.operation_conditions) writeTextLines(sheet, 52, 17, payload.fieldValues.operation_conditions);
  if (payload.fieldValues?.commercial_conditions) writeTextLines(sheet, 71, 6, payload.fieldValues.commercial_conditions);
  return summary;
}

function renderByFamily(sheet, payload, template) {
  switch (template.familySlug) {
    case 'cotizacion_fas': return renderFas(sheet, payload);
    case 'cotizacion_normativa_piscina': return renderPiscina(sheet, payload);
    case 'cotizacion_arrastre_arena': return renderArrastre(sheet, payload);
    case 'cotizacion_maestra_pg04':
    default: return renderPg04(sheet, payload);
  }
}

function flattenRows(payload) {
  const rows = [];
  Object.entries(payload.repeatSections || {}).forEach(([section, items]) => {
    if (!Array.isArray(items)) return;
    items.forEach((item, index) => {
      rows.push({
        section,
        index: index + 1,
        parameter_name: item.parameter_name || '',
        unidad_medida: item.unidad_medida || '',
        detection_limit: item.detection_limit || '',
        method_name: item.method_name || '',
        price_uf: item.price_uf || item.priceUf || item.price || '',
      });
    });
  });
  return rows;
}

function csvEscape(value) {
  const text = String(value ?? '');
  return /[",\n;]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

async function buildJsonArtifact(output, payload, template, summary, warnings) {
  const filePath = join(OUTPUT_ROOT, `${output.baseName}.json`);
  const body = {
    documentCode: payload.documentCode,
    documentReference: documentReference(payload),
    documentTypeSlug: payload.documentTypeSlug,
    templateSlug: template.templateSlug,
    familySlug: template.familySlug,
    generatedAt: new Date().toISOString(),
    fieldValues: payload.fieldValues || {},
    repeatSections: payload.repeatSections || {},
    summary,
    warnings,
  };
  await writeFile(filePath, JSON.stringify(body, null, 2), 'utf8');
  return {
    fileName: basename(filePath),
    absolutePath: filePath,
    checksumSha256: await checksumFile(filePath),
    mimeType: 'application/json',
    artifactFormat: 'json',
    downloadUrl: `/api/v1/artifacts/${basename(filePath)}`,
  };
}

async function buildCsvArtifact(output, payload, template, summary, warnings) {
  const filePath = join(OUTPUT_ROOT, `${output.baseName}.csv`);
  const rows = flattenRows(payload);
  const header = ['section', 'index', 'parameter_name', 'unidad_medida', 'detection_limit', 'method_name', 'price_uf'];
  const lines = [header.join(';')]
    .concat(rows.map((row) => header.map((key) => csvEscape(row[key])).join(';')));
  lines.push('');
  lines.push(`# template=${template.templateSlug}`);
  lines.push(`# neto=${Number(summary.neto ?? 0).toFixed(2)}`);
  lines.push(`# iva=${Number(summary.iva ?? 0).toFixed(2)}`);
  lines.push(`# total=${Number(summary.total ?? 0).toFixed(2)}`);
  if (warnings.length) lines.push(`# warnings=${warnings.map((item) => item.code).join(',')}`);
  await writeFile(filePath, lines.join('\n'), 'utf8');
  return {
    fileName: basename(filePath),
    absolutePath: filePath,
    checksumSha256: await checksumFile(filePath),
    mimeType: 'text/csv; charset=utf-8',
    artifactFormat: 'csv',
    downloadUrl: `/api/v1/artifacts/${basename(filePath)}`,
  };
}

async function buildZipArtifact(output, payload, template, summary, warnings, xlsxPath) {
  const filePath = join(OUTPUT_ROOT, `${output.baseName}.zip`);
  const zip = new AdmZip();
  zip.addLocalFile(xlsxPath);
  const manifest = {
    documentCode: payload.documentCode,
    documentReference: documentReference(payload),
    templateSlug: template.templateSlug,
    familySlug: template.familySlug,
    summary,
    warnings,
    generatedAt: new Date().toISOString(),
  };
  zip.addFile('manifest.json', Buffer.from(JSON.stringify(manifest, null, 2), 'utf8'));
  try {
    const pdfPath = await convertWorkbookToPdf(xlsxPath);
    if (existsSync(pdfPath)) zip.addLocalFile(pdfPath);
  } catch (error) {
    warnings.push({ code: 'zip_without_pdf', message: `No se pudo incluir PDF dentro del ZIP: ${String(error?.message || error)}` });
  }
  zip.writeZip(filePath);
  return {
    fileName: basename(filePath),
    absolutePath: filePath,
    checksumSha256: await checksumFile(filePath),
    mimeType: 'application/zip',
    artifactFormat: 'zip',
    downloadUrl: `/api/v1/artifacts/${basename(filePath)}`,
  };
}

function xmlAttr(xml, name) {
  const match = xml.match(new RegExp(`${name}="([^"]*)"`, 'i'));
  return match?.[1] || '';
}

function maxNumber(matches, fallback = 0) {
  return matches.reduce((max, value) => Math.max(max, Number(value || 0)), fallback);
}

function drawingAnchorXml({ col, row, relId, pictureId }) {
  return `
  <xdr:twoCellAnchor editAs="oneCell">
    <xdr:from><xdr:col>${col}</xdr:col><xdr:colOff>0</xdr:colOff><xdr:row>${row}</xdr:row><xdr:rowOff>0</xdr:rowOff></xdr:from>
    <xdr:to><xdr:col>${col + 2}</xdr:col><xdr:colOff>0</xdr:colOff><xdr:row>${row + 3}</xdr:row><xdr:rowOff>0</xdr:rowOff></xdr:to>
    <xdr:pic>
      <xdr:nvPicPr>
        <xdr:cNvPr id="${pictureId}" name="Logo INN"/>
        <xdr:cNvPicPr><a:picLocks noChangeAspect="1"/></xdr:cNvPicPr>
      </xdr:nvPicPr>
      <xdr:blipFill>
        <a:blip xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" r:embed="${relId}" cstate="print"/>
        <a:stretch><a:fillRect/></a:stretch>
      </xdr:blipFill>
      <xdr:spPr>
        <a:xfrm><a:off x="0" y="0"/><a:ext cx="1371600" cy="685800"/></a:xfrm>
        <a:prstGeom prst="rect"><a:avLst/></a:prstGeom>
        <a:noFill/><a:ln><a:noFill/></a:ln>
      </xdr:spPr>
    </xdr:pic>
    <xdr:clientData/>
  </xdr:twoCellAnchor>`;
}

async function patchInnLogoIntoWorkbook(xlsxPath, sheetName, template) {
  if (!existsSync(LOGO_INN_PATH)) return false;
  const zip = new AdmZip(xlsxPath);
  const workbookXml = zip.readAsText('xl/workbook.xml');
  const workbookRelsXml = zip.readAsText('xl/_rels/workbook.xml.rels');
  const sheetTag = [...workbookXml.matchAll(/<sheet\b[^>]*>/g)]
    .map((item) => item[0])
    .find((tag) => xmlAttr(tag, 'name') === sheetName);
  const sheetRid = sheetTag ? xmlAttr(sheetTag, 'r:id') : '';
  if (!sheetRid) return false;

  const workbookRel = [...workbookRelsXml.matchAll(/<Relationship\b[^>]*>/g)]
    .map((item) => item[0])
    .find((tag) => xmlAttr(tag, 'Id') === sheetRid);
  const sheetTarget = workbookRel ? xmlAttr(workbookRel, 'Target') : '';
  if (!sheetTarget) return false;

  const sheetPath = sheetTarget.startsWith('xl/') ? sheetTarget : `xl/${sheetTarget}`;
  const sheetFile = basename(sheetPath);
  const sheetRelsPath = `xl/worksheets/_rels/${sheetFile}.rels`;
  const sheetRelsEntry = zip.getEntry(sheetRelsPath);
  if (!sheetRelsEntry) return false;
  const sheetRelsXml = sheetRelsEntry.getData().toString('utf8');
  const drawingRel = [...sheetRelsXml.matchAll(/<Relationship\b[^>]*>/g)]
    .map((item) => item[0])
    .find((tag) => xmlAttr(tag, 'Type').endsWith('/drawing'));
  const drawingTarget = drawingRel ? xmlAttr(drawingRel, 'Target') : '';
  if (!drawingTarget) return false;

  const drawingPath = drawingTarget.startsWith('../')
    ? `xl/${drawingTarget.replace(/^\.\.\//, '')}`
    : `xl/worksheets/${drawingTarget}`;
  const drawingRelsPath = drawingPath.replace('xl/drawings/', 'xl/drawings/_rels/') + '.rels';
  const drawingEntry = zip.getEntry(drawingPath);
  const drawingRelsEntry = zip.getEntry(drawingRelsPath);
  if (!drawingEntry || !drawingRelsEntry) return false;

  let drawingXml = drawingEntry.getData().toString('utf8');
  if (drawingXml.includes('name="Logo INN"')) return true;
  let drawingRelsXml = drawingRelsEntry.getData().toString('utf8');
  const contentTypesEntry = zip.getEntry('[Content_Types].xml');
  let contentTypesXml = contentTypesEntry?.getData().toString('utf8') || '';

  const imageNumbers = zip.getEntries()
    .map((entry) => entry.entryName.match(/^xl\/media\/image(\d+)\.png$/)?.[1])
    .filter(Boolean);
  const nextImageNumber = maxNumber(imageNumbers, 0) + 1;
  const mediaPath = `xl/media/image${nextImageNumber}.png`;
  zip.addFile(mediaPath, await readFile(LOGO_INN_PATH));

  const relNumbers = [...drawingRelsXml.matchAll(/Id="rId(\d+)"/g)].map((match) => match[1]);
  const nextRelId = `rId${maxNumber(relNumbers, 0) + 1}`;
  const pictureIds = [...drawingXml.matchAll(/<xdr:cNvPr id="(\d+)"/g)].map((match) => match[1]);
  const nextPictureId = maxNumber(pictureIds, 1) + 1;
  const anchorCol = template.familySlug === 'cotizacion_arrastre_arena' ? 5 : 6;
  const anchorXml = drawingAnchorXml({ col: anchorCol, row: 2, relId: nextRelId, pictureId: nextPictureId });

  drawingXml = drawingXml.replace('</xdr:wsDr>', `${anchorXml}\n</xdr:wsDr>`);
  drawingRelsXml = drawingRelsXml.replace(
    '</Relationships>',
    `<Relationship Id="${nextRelId}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="../media/image${nextImageNumber}.png"/></Relationships>`,
  );
  if (contentTypesXml && !contentTypesXml.includes('Extension="png"')) {
    contentTypesXml = contentTypesXml.replace('</Types>', '<Default Extension="png" ContentType="image/png"/></Types>');
    zip.updateFile('[Content_Types].xml', Buffer.from(contentTypesXml, 'utf8'));
  }
  zip.updateFile(drawingPath, Buffer.from(drawingXml, 'utf8'));
  zip.updateFile(drawingRelsPath, Buffer.from(drawingRelsXml, 'utf8'));
  zip.writeZip(xlsxPath);
  return true;
}

export async function renderTemplateWorkbook(payload, template) {
  const templatePath = resolveTemplatePath(template);
  if (!existsSync(templatePath)) throw new Error(`No existe la plantilla oficial: ${templatePath}`);
  await mkdir(OUTPUT_ROOT, { recursive: true });
  const workbook = await XlsxPopulate.fromFileAsync(templatePath);
  const sheetName = template.sourceSheetName || 'crear cotiz';
  const sheet = workbook.sheet(sheetName);
  if (!sheet) throw new Error(`La hoja ${sheetName} no existe en la plantilla ${template.templateSlug}.`);

  const warnings = [];
  const summary = renderByFamily(sheet, payload, template);
  const output = buildOutputPath(payload.documentCode, template.templateSlug, payload.fieldValues?.document_number || payload.metadata?.documentNumber || '');
  await workbook.toFileAsync(output.absolutePath);
  const innLogoApplied = await patchInnLogoIntoWorkbook(output.absolutePath, sheetName, template);
  if (!innLogoApplied) warnings.push({ code: 'inn_logo_not_embedded', message: 'No se pudo insertar LogoINN.png en el XLSX; se mantuvo texto de acreditacion.' });
  const xlsxChecksumSha256 = await checksumFile(output.absolutePath);

  if (payload.outputFormat === 'pdf' || payload.outputFormat === 'print') {
    const pdfPath = await convertWorkbookToPdf(output.absolutePath);
    return {
      fileName: basename(pdfPath),
      absolutePath: pdfPath,
      checksumSha256: await checksumFile(pdfPath),
      mimeType: 'application/pdf',
      artifactFormat: 'pdf',
      sourceWorkbookPath: output.absolutePath,
      sourceWorkbookChecksumSha256: xlsxChecksumSha256,
      summary,
      warnings,
      downloadUrl: `/api/v1/artifacts/${basename(pdfPath)}`,
    };
  }

  if (payload.outputFormat === 'json') {
    const jsonArtifact = await buildJsonArtifact(output, payload, template, summary, warnings);
    return {
      ...jsonArtifact,
      sourceWorkbookPath: output.absolutePath,
      sourceWorkbookChecksumSha256: xlsxChecksumSha256,
      summary,
      warnings,
    };
  }

  if (payload.outputFormat === 'csv') {
    const csvArtifact = await buildCsvArtifact(output, payload, template, summary, warnings);
    return {
      ...csvArtifact,
      sourceWorkbookPath: output.absolutePath,
      sourceWorkbookChecksumSha256: xlsxChecksumSha256,
      summary,
      warnings,
    };
  }

  if (payload.outputFormat === 'zip') {
    const zipArtifact = await buildZipArtifact(output, payload, template, summary, warnings, output.absolutePath);
    return {
      ...zipArtifact,
      checksumSha256: await checksumFile(zipArtifact.absolutePath),
      sourceWorkbookPath: output.absolutePath,
      sourceWorkbookChecksumSha256: xlsxChecksumSha256,
      summary,
      warnings,
    };
  }

  return {
    fileName: basename(output.absolutePath),
    absolutePath: output.absolutePath,
    checksumSha256: xlsxChecksumSha256,
    mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    artifactFormat: 'xlsx',
    sourceWorkbookPath: output.absolutePath,
    sourceWorkbookChecksumSha256: xlsxChecksumSha256,
    summary,
    warnings,
    downloadUrl: `/api/v1/artifacts/${basename(output.absolutePath)}`,
  };
}

