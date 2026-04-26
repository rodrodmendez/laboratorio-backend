import XlsxPopulate from 'xlsx-populate';
import AdmZip from 'adm-zip';
import { createHash } from 'node:crypto';
import { copyFile, mkdir, readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { basename, extname, isAbsolute, join, parse } from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { query } from '../../core/database/pg-client.mjs';

const execFileAsync = promisify(execFile);
const SOFFICE_PATH = 'C:\\Program Files\\LibreOffice\\program\\soffice.exe';
const IMPORT_ROOT = join(process.cwd(), 'data', 'imports');

function slugify(value, fallback = 'template') {
  const slug = String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return slug || fallback;
}

async function checksumFile(filePath) {
  const buffer = await readFile(filePath);
  return createHash('sha256').update(buffer).digest('hex');
}

async function ensureImportRoot() {
  await mkdir(IMPORT_ROOT, { recursive: true });
}

async function convertLegacyXls(sourcePath) {
  await ensureImportRoot();
  if (!existsSync(SOFFICE_PATH)) throw new Error(`LibreOffice no encontrado en ${SOFFICE_PATH}`);
  await execFileAsync(SOFFICE_PATH, ['--headless', '--convert-to', 'xlsx', '--outdir', IMPORT_ROOT, sourcePath]);
  const convertedPath = join(IMPORT_ROOT, `${parse(sourcePath).name}.xlsx`);
  if (!existsSync(convertedPath)) throw new Error(`No se genero el XLSX esperado desde ${sourcePath}`);
  return convertedPath;
}

async function prepareSourceFile(sourcePath) {
  if (!sourcePath || !existsSync(sourcePath)) throw new Error(`No existe el archivo fuente: ${sourcePath}`);
  const ext = extname(sourcePath).toLowerCase();
  await ensureImportRoot();

  if (ext === '.xlsx') {
    const importedPath = join(IMPORT_ROOT, basename(sourcePath));
    if (sourcePath !== importedPath) await copyFile(sourcePath, importedPath);
    return { sourceOriginalPath: sourcePath, sourceImportedPath: importedPath, sourceFileKind: 'xlsx', converted: false };
  }

  if (ext === '.xls') {
    const convertedPath = await convertLegacyXls(sourcePath);
    return { sourceOriginalPath: sourcePath, sourceImportedPath: convertedPath, sourceFileKind: 'xls', converted: true };
  }

  throw new Error(`Formato no soportado para alta automatizada: ${ext}`);
}

function inspectAssets(xlsxPath) {
  const zip = new AdmZip(xlsxPath);
  const drawingEntries = zip.getEntries().filter((entry) => entry.entryName.startsWith('xl/drawings/'));
  const mediaEntries = zip.getEntries().filter((entry) => entry.entryName.startsWith('xl/media/'));
  return {
    drawingCount: drawingEntries.length,
    imageCount: mediaEntries.length,
    drawingFiles: drawingEntries.map((entry) => entry.entryName),
    mediaFiles: mediaEntries.map((entry) => entry.entryName),
    fixedImages: mediaEntries.length > 0,
  };
}

async function inspectSheets(xlsxPath) {
  const workbook = await XlsxPopulate.fromFileAsync(xlsxPath);
  return workbook.sheets().map((sheet) => ({
    name: sheet.name(),
    usedRange: sheet.usedRange()?.address() || null,
  }));
}

function buildSuggestions({ sourcePath, registrationMode, baseTemplateSlug }) {
  const fileBase = parse(sourcePath).name;
  const baseSlug = slugify(fileBase, 'template');
  const familySlug = registrationMode === 'variant' && baseTemplateSlug
    ? `${slugify(baseTemplateSlug, 'template')}-variantes`
    : `${baseSlug}-familia`;
  return {
    suggestedTemplateSlug: `tpl-${baseSlug}`,
    suggestedFamilySlug: familySlug,
  };
}

export async function analyzeTemplateIntake(input) {
  const registrationMode = input.registrationMode === 'variant' ? 'variant' : 'family';
  const prepared = await prepareSourceFile(input.sourcePath);
  const sheets = await inspectSheets(prepared.sourceImportedPath);
  const assets = inspectAssets(prepared.sourceImportedPath);
  const suggestions = buildSuggestions({
    sourcePath: prepared.sourceOriginalPath,
    registrationMode,
    baseTemplateSlug: input.baseTemplateSlug,
  });

  return {
    registrationMode,
    ...prepared,
    sourceFileName: basename(prepared.sourceOriginalPath),
    sourceChecksumSha256: await checksumFile(prepared.sourceImportedPath),
    sheetInventory: sheets,
    assetInventory: assets,
    suggestedTemplateSlug: input.templateSlug || suggestions.suggestedTemplateSlug,
    suggestedFamilySlug: input.familySlug || suggestions.suggestedFamilySlug,
    suggestedSheetName: input.sourceSheetName || sheets[0]?.name || null,
    brandingMode: input.brandingMode || 'embedded',
    operatorSelectableBranding: input.operatorSelectableBranding === true,
    notes: assets.fixedImages
      ? 'La plantilla trae imagenes embebidas y se conservaran en sus posiciones originales.'
      : 'La plantilla no trae imagenes embebidas detectables; se puede configurar branding alternativo.'
  };
}

export async function registerTemplateIntake(input) {
  const analysis = await analyzeTemplateIntake(input);
  const templateSlug = input.templateSlug || analysis.suggestedTemplateSlug;
  const familySlug = input.familySlug || analysis.suggestedFamilySlug;
  const sourceSheetName = input.sourceSheetName || analysis.suggestedSheetName;
  const templateMode = analysis.registrationMode === 'variant' ? 'variant' : 'master';

  await query(`
    insert into lab.document_template_catalog (
      template_slug, document_type_slug, document_code, confidentiality_level, status,
      source_path, source_file_name, source_sheet_name, family_slug, is_renderable,
      template_mode, variant_of_template_slug, source_original_path, source_imported_path,
      source_file_kind, source_checksum_sha256, sheet_inventory_json, asset_inventory_json,
      branding_mode, operator_selectable_branding, updated_at
    ) values (
      $1,$2,$3,$4,$5,
      $6,$7,$8,$9,$10,
      $11,$12,$13,$14,
      $15,$16,$17::jsonb,$18::jsonb,
      $19,$20,now()
    )
    on conflict (template_slug) do update set
      document_type_slug = excluded.document_type_slug,
      document_code = excluded.document_code,
      confidentiality_level = excluded.confidentiality_level,
      status = excluded.status,
      source_path = excluded.source_path,
      source_file_name = excluded.source_file_name,
      source_sheet_name = excluded.source_sheet_name,
      family_slug = excluded.family_slug,
      is_renderable = excluded.is_renderable,
      template_mode = excluded.template_mode,
      variant_of_template_slug = excluded.variant_of_template_slug,
      source_original_path = excluded.source_original_path,
      source_imported_path = excluded.source_imported_path,
      source_file_kind = excluded.source_file_kind,
      source_checksum_sha256 = excluded.source_checksum_sha256,
      sheet_inventory_json = excluded.sheet_inventory_json,
      asset_inventory_json = excluded.asset_inventory_json,
      branding_mode = excluded.branding_mode,
      operator_selectable_branding = excluded.operator_selectable_branding,
      updated_at = now()
  `, [
    templateSlug,
    input.documentTypeSlug || 'informe-ensayo',
    input.documentCode || 'Q0',
    input.confidentialityLevel || 'regulated_confidential',
    input.status || 'active',
    analysis.sourceImportedPath,
    analysis.sourceFileName,
    sourceSheetName,
    familySlug,
    input.isRenderable !== false,
    templateMode,
    templateMode === 'variant' ? (input.baseTemplateSlug || null) : null,
    analysis.sourceOriginalPath,
    analysis.sourceImportedPath,
    analysis.sourceFileKind,
    analysis.sourceChecksumSha256,
    JSON.stringify(analysis.sheetInventory),
    JSON.stringify(analysis.assetInventory),
    analysis.brandingMode,
    analysis.operatorSelectableBranding,
  ]);

  return {
    templateSlug,
    familySlug,
    sourceSheetName,
    templateMode,
    variantOfTemplateSlug: templateMode === 'variant' ? (input.baseTemplateSlug || null) : null,
    ...analysis,
  };
}
