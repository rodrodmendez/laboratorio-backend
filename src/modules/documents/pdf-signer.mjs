import { PDFDocument } from 'pdf-lib';
import { pdflibAddPlaceholder } from '@signpdf/placeholder-pdf-lib';
import { SignPdf } from '@signpdf/signpdf';
import { P12Signer } from '@signpdf/signer-p12';

/**
 * Añade un marcador de firma digital al PDF y lo firma con un certificado .p12.
 * @param {Uint8Array|Buffer} pdfBuffer - PDF generado por pdf-lib
 * @param {Buffer} p12Buffer - Contenido del archivo .p12/.pfx
 * @param {string} password - Contraseña del certificado
 * @param {{ name?: string, reason?: string, email?: string, location?: string }} signerInfo
 * @returns {Promise<Buffer>} PDF firmado
 */
export async function signPdf(pdfBuffer, p12Buffer, password, signerInfo = {}) {
  // 1. Cargar el PDF ya generado
  const pdfDoc = await PDFDocument.load(pdfBuffer);

  // 2. Agregar el marcador (placeholder) de firma en el PDF
  await pdflibAddPlaceholder({
    pdfDoc,
    reason:      signerInfo.reason   || 'Firma electrónica simple',
    contactInfo: signerInfo.email    || '',
    name:        signerInfo.name     || '',
    location:    signerInfo.location || 'Santiago, Chile',
    signatureLength: 16384, // espacio reservado para la firma PKCS#7
  });

  // 3. Volver a serializar con useObjectStreams:false (requerido por signpdf)
  const preparedBytes = await pdfDoc.save({ useObjectStreams: false });

  // 4. Firmar con el certificado P12
  const signer    = new P12Signer(Buffer.from(p12Buffer), { passphrase: password });
  const signpdf   = new SignPdf();
  const signed    = await signpdf.sign(Buffer.from(preparedBytes), signer);

  return signed;
}
