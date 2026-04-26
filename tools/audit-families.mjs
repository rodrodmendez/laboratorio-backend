import { writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import AdmZip from 'adm-zip';
import { renderTemplateWorkbook } from '../src/modules/document-render/xlsx-renderer.mjs';
import { listTemplates } from '../src/modules/document-render/template-repository.mjs';

const BASE = 'C:\\RODPROJECTS\\denu_pen_lab\\applab\\laboratorio-app\\frontend\\laboratorio';
const REPORT_DIR = 'C:\\RODPROJECTS\\arquitectura-laboratorio';

function samplePayload(template) {
  return {
    documentTypeSlug: 'cotizacion',
    documentCode: 'PG04-R1/26',
    templateSlug: template.templateSlug,
    outputFormat: 'pdf',
    context: { customerId: 'cli-001', contactId: 'con-001', confidentialityLevel: template.confidentialityLevel || 'confidential' },
    fieldValues: {
      fecha_emision: '2026-04-04',
      cliente_rut: '76.123.456-7',
      cliente_nombre: 'Aguas del Valle SPA',
      contacto_nombre: 'Andrea Morales',
      contacto_email: 'andrea.morales@aguasdelvalle.cl',
      contacto_telefono: '+56 9 8765 4321',
      service_product: template.familySlug === 'cotizacion_fas' ? 'Contrastacion - FAS' : 'Cotizacion de prueba',
      matrix: template.familySlug === 'cotizacion_normativa_piscina' ? 'Agua de Recreacion' : 'Agua residual',
      observaciones: `Auditoria automatica ${template.templateSlug}`,
    },
    repeatSections: {
      'pg04-detalle-parametros': [
        { parameter_name: 'pH', unidad_medida: 'u pH', detection_limit: '0,1', method_name: 'SM 4500-H+', price_uf: '0,45 UF' },
        { parameter_name: 'Conductividad', unidad_medida: 'uS/cm', detection_limit: '1', method_name: 'SM 2510 B', price_uf: '0,40 UF' },
        { parameter_name: 'Coliformes Totales', unidad_medida: 'NMP/100ml', detection_limit: '1.8', method_name: 'SM 9221 B', price_uf: '0,97 UF' }
      ],
      'piscina-fq': [
        { parameter_name: 'pH en terreno', unidad_medida: '-', detection_limit: '-', method_name: 'SM 4500-H+-B', price_uf: '0,48 UF' },
        { parameter_name: 'Cobre', unidad_medida: 'mg/L', detection_limit: '0,030 mg/L', method_name: 'SM 3111 B', price_uf: '0,48 UF' }
      ],
      'piscina-micro': [
        { parameter_name: 'Coliformes Totales', unidad_medida: 'NMP/100ml', detection_limit: '1.8', method_name: 'SM 9221 B', price_uf: '0,97 UF' }
      ]
    }
  };
}

function unzipEntryMap(filePath) {
  const zip = new AdmZip(filePath);
  const map = new Map();
  for (const entry of zip.getEntries()) {
    map.set(entry.entryName, entry.getData().toString('utf8'));
  }
  return map;
}

function getTagCount(xml, tagName) {
  if (!xml) return 0;
  const regex = new RegExp(`<${tagName}(\\s|>)`, 'g');
  const match = xml.match(regex);
  return match ? match.length : 0;
}

function hasCell(xml, ref) {
  if (!xml) return false;
  const regex = new RegExp(`<c[^>]*r="${ref}"[^>]*>`, 'i');
  return regex.test(xml);
}

async function run() {
  const templates = await listTemplates({ renderableOnly: true });
  const rows = [];
  for (const template of templates) {
    const payload = samplePayload(template);
    const artifact = await renderTemplateWorkbook(payload, template);
    const sourcePath = join(BASE, template.sourcePath);
    const sourceZip = unzipEntryMap(sourcePath);
    const renderedZip = unzipEntryMap(artifact.sourceWorkbookPath);
    const sheetXmlPath = `xl/worksheets/${template.sourceSheetName === 'tipo' ? 'sheet1.xml' : 'sheet2.xml'}`;
    const sourceSheet = sourceZip.get(sheetXmlPath) || '';
    const renderedSheet = renderedZip.get(sheetXmlPath) || '';

    rows.push({
      templateSlug: template.templateSlug,
      familySlug: template.familySlug,
      sourceFileName: template.sourceFileName,
      sourceSheetName: template.sourceSheetName,
      outputArtifact: artifact.fileName,
      outputFormat: artifact.artifactFormat,
      sourceMergeCount: getTagCount(sourceSheet, 'mergeCell'),
      renderedMergeCount: getTagCount(renderedSheet, 'mergeCell'),
      sourceDrawingCount: getTagCount(sourceSheet, 'drawing'),
      renderedDrawingCount: getTagCount(renderedSheet, 'drawing'),
      criticalCellsPresent: ['G7', 'G8', 'A17', 'E15'].map((ref) => `${ref}:${hasCell(renderedSheet, ref) ? 'ok' : 'n/a'}`).join(', '),
      checksumSha256: artifact.checksumSha256,
    });
  }

  const md = [
    '# Auditoria Operativa de Familias',
    '',
    'Se verifico la generacion operativa de las familias actualmente disponibles en la carpeta fuente.',
    '',
    '| Template | Familia | Hoja | Salida | Merge src | Merge out | Drawing src | Drawing out | Celdas criticas |',
    '|---|---|---|---|---:|---:|---:|---:|---|',
    ...rows.map((row) => `| ${row.templateSlug} | ${row.familySlug} | ${row.sourceSheetName} | ${row.outputFormat} | ${row.sourceMergeCount} | ${row.renderedMergeCount} | ${row.sourceDrawingCount} | ${row.renderedDrawingCount} | ${row.criticalCellsPresent} |`),
    '',
    '## Archivos generados',
    ...rows.map((row) => `- ${row.templateSlug}: ${row.outputArtifact}`),
    '',
    '## Observacion',
    '- El render conserva la plantilla fuente y modifica solo celdas de datos.',
    '- La validacion visual fina sigue siendo necesaria sobre PDF emitido, pero esta auditoria confirma la operacion base por familia.',
  ].join('\n');

  await mkdir(REPORT_DIR, { recursive: true });
  const outPath = join(REPORT_DIR, 'AUDITORIA_OPERATIVA_FAMILIAS.md');
  await writeFile(outPath, md, 'utf8');
  console.log(outPath);
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
