import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { existsSync } from 'node:fs';

// ── Paleta ────────────────────────────────────────────────────────────────────
const cBlue     = rgb(0.102, 0.227, 0.361);   // #1a3a5c
const cWhite    = rgb(1, 1, 1);
const cBlack    = rgb(0, 0, 0);
const cGray     = rgb(0.733, 0.733, 0.733);
const cDarkGray = rgb(0.40,  0.40,  0.40);
const cLightBg  = rgb(0.922, 0.937, 0.953);   // fondo claro subtotales

// ── Página A4 ─────────────────────────────────────────────────────────────────
const A4_W = 595.28;
const A4_H = 841.89;
const ML   = 36;              // margen izquierdo
const MR   = 36;              // margen derecho
const CW   = A4_W - ML - MR; // ancho de contenido ≈ 523pt

// ── Primitivas de dibujo ──────────────────────────────────────────────────────

function safe(v, max = 200) {
  const s = String(v ?? '');
  return s.length > max ? s.slice(0, max - 1) + '…' : s;
}

function fmtNum(n) {
  return Number(n || 0).toLocaleString('es-CL');
}

function fmtDate(str) {
  if (!str) return '';
  const [y, m, d] = String(str).split('-');
  return d && m && y ? `${d}-${m}-${y}` : str;
}

// Texto — coordenadas pdf-lib: origen bottom-left, y crece hacia arriba
function tx(page, font, text, x, y, size, color = cBlack, maxWidth) {
  const t = String(text ?? '');
  if (!t) return;
  page.drawText(t, { x, y, size, font, color, ...(maxWidth ? { maxWidth } : {}) });
}

// Rectángulo
function rect(page, x, y, w, h, { fill, stroke, sw = 0.5 } = {}) {
  page.drawRectangle({
    x, y, width: w, height: h,
    ...(fill   ? { color: fill }                          : {}),
    ...(stroke ? { borderColor: stroke, borderWidth: sw } : {}),
  });
}

// Línea
function line(page, x1, y1, x2, y2, color = cGray, thickness = 0.5) {
  page.drawLine({ start: { x: x1, y: y1 }, end: { x: x2, y: y2 }, thickness, color });
}

// Celda cabecera azul
function hdrCell(page, bf, x, y, w, h, text, { fill = cBlue, tc = cWhite, fs = 7 } = {}) {
  rect(page, x, y, w, h, { fill });
  if (text) tx(page, bf, text.toUpperCase(), x + 4, y + (h - fs) / 2, fs, tc);
}

// ── Generador principal ───────────────────────────────────────────────────────

export async function generateOcPdf(oc, labProfile = {}, signerInfo = {}) {
  const pdfDoc = await PDFDocument.create();
  pdfDoc.setTitle(`OC N° ${oc.orderNumber}`);
  pdfDoc.setAuthor(labProfile.businessName || 'Laboratorio');
  pdfDoc.setSubject('Orden de Compra');
  pdfDoc.setCreator('Sistema de gestión — Laboratorio');

  const page = pdfDoc.addPage([A4_W, A4_H]);
  const f    = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const bf   = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const items = Array.isArray(oc.items) ? oc.items : [];

  // cy = borde superior del próximo elemento
  let cy = A4_H - 36;

  // ══ 1. ENCABEZADO: Logo + DOCUMENTO CONTROLADO ════════════════════════════════
  const logoCandidates = [
    join(process.cwd(), '..', 'laboratorio-frontend', 'public', 'applabico.png'),
    join(process.cwd(), 'data', 'applabico.png'),
  ];
  for (const p of logoCandidates) {
    if (existsSync(p)) {
      try {
        const bytes = await readFile(p);
        const img   = await pdfDoc.embedPng(bytes);
        const lh    = 40;
        const lw    = lh * (img.width / img.height);
        page.drawImage(img, { x: ML, y: cy - lh, width: lw, height: lh });
      } catch (_) { /* sin logo */ }
      break;
    }
  }
  // "DOCUMENTO CONTROLADO" en gris, esquina superior derecha
  const dcRx = A4_W - MR;
  tx(page, bf, 'DOCUMENTO',   dcRx - bf.widthOfTextAtSize('DOCUMENTO',   7.5), cy - 12, 7.5, cGray);
  tx(page, bf, 'CONTROLADO',  dcRx - bf.widthOfTextAtSize('CONTROLADO',  7.5), cy - 22, 7.5, cGray);

  cy -= 50;

  // ══ 2. TÍTULO (centrado) ══════════════════════════════════════════════════════
  const t1 = oc.documentCode || 'PG06-R2';
  const t2 = 'REGISTRO SOLICITUD DE COMPRA O SERVICIO';
  tx(page, bf, t1, ML + (CW - bf.widthOfTextAtSize(t1, 9))   / 2, cy,      9, cBlue);
  tx(page, bf, t2, ML + (CW - bf.widthOfTextAtSize(t2, 8.5)) / 2, cy - 11, 8.5, cBlue);
  cy -= 24;

  // ══ 3. INFO LAB (izquierda) + ORDEN DE COMPRA (derecha) ══════════════════════
  const labW = CW * 0.58;
  const ocW  = CW - labW;
  const ocX  = ML + labW;

  // Datos del laboratorio — lado izquierdo
  const labRows = [
    ['Rut',          safe(labProfile.rut, 30)],
    ['Dirección:',   safe(labProfile.address, 42)],
    ['Ciudad:',      safe(labProfile.city, 25)],
    ['E-Mail:',      safe(labProfile.email, 38)],
    ['Código postal:', safe(labProfile.zipCode, 12)],
    ['Teléfono:',    safe((labProfile.phone || '').replace('+56 ', ''), 22)],
  ].filter(([, v]) => v); // oculta filas vacías

  const infoStartY = cy;
  labRows.forEach(([lbl, val], i) => {
    const ry = infoStartY - i * 11;
    tx(page, bf, lbl, ML, ry, 8, cBlue);
    tx(page, f,  val, ML + 68, ry, 8, cBlack, labW - 72);
  });

  // ORDEN DE COMPRA — lado derecho
  tx(page, bf, 'ORDEN DE COMPRA', ocX + 2, infoStartY, 8.5, cBlue);

  const ocRows = [
    ['Fecha Solicitud:',         fmtDate(oc.requestDate)],
    ['Numero Orden de Compra:',  String(oc.orderNumber || '')],
    ['N° Cotización Proveedor:', safe(oc.providerQuoteNumber, 22)],
  ];
  const ocLblW = 110; // ancho de la etiqueta OC
  const ocBoxW = ocW - ocLblW - 4;
  const ocBoxX = ocX + ocLblW + 2;

  ocRows.forEach(([lbl, val], i) => {
    const ry = infoStartY - 12 - i * 12;
    tx(page, bf, lbl, ocX + 2, ry, 7.5, cBlue);
    rect(page, ocBoxX, ry - 3, ocBoxW, 11, { stroke: cGray });
    tx(page, f, val, ocBoxX + 3, ry, 7.5, cBlack, ocBoxW - 6);
  });

  cy = infoStartY - Math.max(labRows.length * 11, 50) - 6;

  // ══ 4. PROVEEDOR | ATENCIÓN (caja única, divisor vertical central) ════════════
  const provW = CW * 0.57;
  const attnW = CW - provW;
  const attnX = ML + provW;
  const sHH   = 14; // alto cabecera
  const sBH   = 62; // alto cuerpo

  // Cabeceras
  hdrCell(page, bf, ML,    cy - sHH, provW, sHH, 'PROVEEDOR');
  hdrCell(page, bf, attnX, cy - sHH, attnW, sHH, 'ATENCION');
  cy -= sHH;

  // Borde exterior de toda la sección
  rect(page, ML, cy - sBH, CW, sBH, { stroke: cGray });
  // Divisor vertical interior
  line(page, attnX, cy, attnX, cy - sBH, cGray, 0.5);

  // Datos proveedor
  const provCellRows = [
    ['Empresa:',   safe(oc.providerName, 38)],
    ['RUT:',       safe(oc.providerRut, 22)],
    ['Dirección:', safe(oc.providerAddress, 38)],
    ['Teléfono:',  safe(oc.providerPhone, 25)],
    ['E-Mail:',    safe(oc.providerEmail, 38)],
  ];
  provCellRows.forEach(([lbl, val], i) => {
    const ry = cy - 10 - i * 11;
    tx(page, bf, lbl, ML + 4, ry, 7.5, cBlue);
    tx(page, f,  val, ML + 48, ry, 7.5, cBlack, provW - 52);
  });

  // Datos atención
  const attnCellRows = [
    ['Contacto:', safe(oc.contactName, 28)],
    ['Teléfono:', safe(oc.contactPhone, 22)],
    ['E-Mail:',   safe(oc.contactEmail, 32)],
  ];
  attnCellRows.forEach(([lbl, val], i) => {
    const ry = cy - 10 - i * 11;
    tx(page, bf, lbl, attnX + 4, ry, 7.5, cBlue);
    tx(page, f,  val, attnX + 48, ry, 7.5, cBlack, attnW - 52);
  });

  cy -= sBH + 2;

  // ══ 5. BARRA: SOLICITADO POR | TERMINOS DE PAGO | ANTICIPO | % | MONTO ($) ═══
  const barH   = 22;
  const barHH  = 9;   // alto sub-cabecera azul
  const bars   = [
    { lbl: 'SOLICITADO POR',   val: safe(oc.requestedBy, 24),    fw: 0.32 },
    { lbl: 'TERMINOS DE PAGO', val: safe(oc.paymentTerms, 20),   fw: 0.24 },
    { lbl: 'ANTICIPO',         val: '',                           fw: 0.18 },
    { lbl: '%',                val: oc.advancePercent ? String(oc.advancePercent) : '', fw: 0.10 },
    { lbl: 'MONTO ($)',        val: oc.advanceAmount ? `$ ${fmtNum(oc.advanceAmount)}` : '$ -', fw: 0.16 },
  ];

  // Borde exterior de la barra
  rect(page, ML, cy - barH, CW, barH, { stroke: cGray });

  let bx = ML;
  bars.forEach(({ lbl, val, fw }, idx) => {
    const bw = Math.round(CW * fw);
    // Sub-cabecera azul
    hdrCell(page, bf, bx, cy - barHH, bw, barHH, lbl, { fs: 6.5 });
    // Valor
    tx(page, f, val, bx + 3, cy - barH + 5, 8, cBlack, bw - 6);
    // Divisor vertical (excepto último)
    if (idx < bars.length - 1) {
      line(page, bx + bw, cy, bx + bw, cy - barH, cGray, 0.5);
    }
    bx += bw;
  });

  cy -= barH + 2;

  // ══ 6. TABLA DE ÍTEMS ════════════════════════════════════════════════════════
  const tHdrH  = 14;
  const tRowH  = 17;
  const MIN_ROWS = 10;

  // Anchos de columna (total = CW)
  const COL_CODE  = 58;
  const COL_QTY   = 70;
  const COL_PRICE = 100;
  const COL_TOTAL = 88;
  const COL_DESC  = CW - COL_CODE - COL_QTY - COL_PRICE - COL_TOTAL;

  const cols = [
    { lbl: 'CODIGO',          w: COL_CODE,  align: 'left'  },
    { lbl: 'PRODUCTO',        w: COL_DESC,  align: 'left'  },
    { lbl: 'CANTIDAD',        w: COL_QTY,   align: 'center'},
    { lbl: 'PRECIO UNITARIO', w: COL_PRICE, align: 'right' },
    { lbl: 'TOTAL',           w: COL_TOTAL, align: 'right' },
  ];

  // Cabecera de tabla
  let cx = ML;
  cols.forEach(({ lbl, w, align }) => {
    hdrCell(page, bf, cx, cy - tHdrH, w, tHdrH, lbl, { fs: 7.5 });
    cx += w;
  });
  cy -= tHdrH;

  // Borde exterior de las filas
  rect(page, ML, cy - tRowH * MIN_ROWS, CW, tRowH * MIN_ROWS, { stroke: cGray });

  // Divisores verticales a lo largo de todas las filas
  let divX = ML;
  cols.forEach(({ w }, i) => {
    divX += w;
    if (i < cols.length - 1) {
      line(page, divX, cy, divX, cy - tRowH * MIN_ROWS, cGray, 0.5);
    }
  });

  // Filas de ítems
  const displayRows = [...items];
  while (displayRows.length < MIN_ROWS) displayRows.push(null);

  displayRows.forEach((it, rowIdx) => {
    const ry = cy - rowIdx * tRowH;
    // Línea separadora horizontal entre filas
    if (rowIdx > 0) line(page, ML, ry, ML + CW, ry, cGray, 0.3);

    if (it) {
      cx = ML;
      cols.forEach(({ w, align }, i) => {
        let val = '';
        if (i === 0) val = safe(it.code, 12);
        else if (i === 1) val = safe(it.description, 55);
        else if (i === 2) val = String(it.quantity || '');
        else if (i === 3) val = it.unitPrice ? `$ ${fmtNum(it.unitPrice)}` : '';
        else              val = it.total      ? `$ ${fmtNum(it.total)}`      : '';

        const vw = f.widthOfTextAtSize(val, 8.5);
        let vx;
        if (align === 'right')  vx = cx + w - vw - 4;
        else if (align === 'center') vx = cx + (w - vw) / 2;
        else                    vx = cx + 4;

        tx(page, f, val, vx, ry - tRowH + 5, 8.5, cBlack);
        cx += w;
      });
    }
  });

  cy -= tRowH * MIN_ROWS + 4;

  // ══ 7. ESTADO APROBACIÓN | SUBTOTAL / IVA / TOTAL ════════════════════════════
  const totW  = 185;
  const estW  = CW - totW;
  const totX  = ML + estW;
  const botHH = 14;  // alto cabecera del bloque
  const botBH = 58;  // alto cuerpo

  // Cabeceras
  hdrCell(page, bf, ML,   cy - botHH, estW, botHH, 'ESTADO APROBACION');
  hdrCell(page, bf, totX, cy - botHH, totW, botHH, '');
  cy -= botHH;

  // Borde exterior de estado
  rect(page, ML, cy - botBH, estW, botBH, { stroke: cGray });

  // Campos de estado
  tx(page, bf, 'Fecha Prorroga:',  ML + 5, cy - 13, 8, cBlue);
  rect(page, ML + 85, cy - 17, estW - 90, 12, { stroke: cGray });
  tx(page, f, fmtDate(oc.extensionDate) || '', ML + 88, cy - 14, 8, cBlack);

  tx(page, bf, 'Observaciones:', ML + 5, cy - 31, 8, cBlue);
  rect(page, ML + 85, cy - 57, estW - 90, 28, { stroke: cGray });
  tx(page, f, safe(oc.observations, 80), ML + 88, cy - 34, 8, cBlack, estW - 95);

  // Borde exterior de totales
  rect(page, totX, cy - botBH, totW, botBH, { stroke: cGray });

  // Filas de totales — etiqueta | separador : | valor
  const totRows = [
    { lbl: 'SUBTOTAL', val: `$ ${fmtNum(oc.subtotal)}`, grand: false },
    { lbl: 'IVA',      val: `$ ${fmtNum(oc.vat)}`,      grand: false },
    { lbl: 'TOTAL',    val: `$ ${fmtNum(oc.total)}`,     grand: true  },
  ];

  const totLblW  = totW * 0.45;
  const totSepW  = 14;
  const totValW  = totW - totLblW - totSepW;
  const totRowH  = botBH / totRows.length;

  totRows.forEach(({ lbl, val, grand }, i) => {
    const ry = cy - i * totRowH;
    if (grand) {
      // Fondo azul para TOTAL
      rect(page, totX, ry - totRowH, totW, totRowH, { fill: cBlue });
      const lw = bf.widthOfTextAtSize(lbl, 9);
      const vw = bf.widthOfTextAtSize(val, 9);
      tx(page, bf, lbl, totX + totLblW / 2 - lw / 2, ry - totRowH + 6, 9, cWhite);
      tx(page, bf, ':',  totX + totLblW + 4, ry - totRowH + 6, 9, cWhite);
      tx(page, bf, val,  totX + totLblW + totSepW + totValW - vw - 4, ry - totRowH + 6, 9, cWhite);
    } else {
      // Fondo claro para SUBTOTAL / IVA
      rect(page, totX, ry - totRowH, totLblW, totRowH, { fill: cLightBg });
      line(page, totX, ry - totRowH, totX + totW, ry - totRowH, cGray, 0.4);
      const lw = bf.widthOfTextAtSize(lbl, 8.5);
      const vw = f.widthOfTextAtSize(val, 8.5);
      tx(page, bf, lbl, totX + totLblW / 2 - lw / 2, ry - totRowH + 5, 8.5, cBlue);
      tx(page, bf, ':',  totX + totLblW + 4, ry - totRowH + 5, 8.5, cBlue);
      tx(page, f,  val,  totX + totLblW + totSepW + totValW - vw - 4, ry - totRowH + 5, 8.5, cBlack);
    }
  });

  cy -= botBH + 10;

  // ══ 8. AUTORIZADO POR (con línea de firma) ════════════════════════════════════
  const lineStart = ML + 80;
  const lineEnd   = ML + CW * 0.55;

  tx(page, bf, 'Autorizado por :', ML, cy, 8.5, cBlue);
  line(page, lineStart, cy - 1, lineEnd, cy - 1, cBlack, 0.7);

  // Nombre del firmante (del campo authorizedBy o del signer)
  const signerName = signerInfo.name || oc.authorizedBy || '';
  if (signerName) {
    tx(page, f, signerName, lineStart + 2, cy + 1, 8, cBlack);
  }

  cy -= 14;

  // ══ 9. PIE DE PÁGINA ═════════════════════════════════════════════════════════
  tx(page, f, 'Revisión 2, marzo 2024', ML, cy, 7.5, cDarkGray);
  cy -= 11;

  // Texto legal — ajuste de línea manual, centrado, bold azul
  const legalWords = 'Se solicitarán antecedentes específicos (acreditación, certificación, antecedentes de competencias, etc.) que puedan ser requeridos por algún cliente del laboratorio para comprobar o verificar requisitos necesarios para el cumplimiento de la norma NCh 17025'.split(' ');
  let legalLine = '';
  const legalLines = [];
  for (const w of legalWords) {
    const test = legalLine ? `${legalLine} ${w}` : w;
    if (bf.widthOfTextAtSize(test, 7.5) > CW - 20) {
      legalLines.push(legalLine);
      legalLine = w;
    } else {
      legalLine = test;
    }
  }
  if (legalLine) legalLines.push(legalLine);

  legalLines.forEach((l) => {
    const lw = bf.widthOfTextAtSize(l, 7.5);
    tx(page, bf, l, ML + (CW - lw) / 2, cy, 7.5, cBlue);
    cy -= 9;
  });

  cy -= 4;
  line(page, ML, cy, A4_W - MR, cy, cGray, 0.5);
  cy -= 8;

  // Información de contacto centrada
  const phone   = (labProfile.phone || '').replace('+56 ', '');
  const email   = labProfile.email || '';
  const ctLine1 = 'Cualquier consulta sobre esta orden de compra comuníquese por nuestros siguientes canales de información';
  const ctLine2 = `Teléfono: ${phone}   E-Mail: ${email}`;

  const ct1w = f.widthOfTextAtSize(ctLine1, 7);
  const ct2w = f.widthOfTextAtSize(ctLine2, 7.5);
  tx(page, f, ctLine1, ML + (CW - ct1w) / 2, cy,      7,   cDarkGray, CW);
  tx(page, f, ctLine2, ML + (CW - ct2w) / 2, cy - 9,  7.5, cDarkGray);

  // Guardar con useObjectStreams:false (requerido por @signpdf)
  return await pdfDoc.save({ useObjectStreams: false });
}
