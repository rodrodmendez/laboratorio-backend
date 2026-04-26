import { query } from '../../core/database/pg-client.mjs';

export async function saveIssuedDocument(issuedDocument) {
  const dbResult = await query(`
    insert into lab.document_issued (issued_document_id, render_job_id, template_slug, output_format, storage_path, checksum_sha256)
    values ($1,$2,$3,$4,$5,$6)
    on conflict (issued_document_id) do update set
      render_job_id = excluded.render_job_id,
      template_slug = excluded.template_slug,
      output_format = excluded.output_format,
      storage_path = excluded.storage_path,
      checksum_sha256 = excluded.checksum_sha256
  `, [
    issuedDocument.issuedDocumentId,
    issuedDocument.renderJobId,
    issuedDocument.templateSlug,
    issuedDocument.outputFormat,
    issuedDocument.storagePath,
    issuedDocument.checksumSha256,
  ]).catch(() => null);

  return dbResult ? issuedDocument : issuedDocument;
}
