import { join } from 'node:path';
import { query } from '../../core/database/pg-client.mjs';
import { readJsonFile, writeJsonFile } from '../../shared/store/json-file-store.mjs';

const filePath = join(process.cwd(), 'data', 'document-render-jobs.json');

export async function saveRenderJob(renderJob) {
  const dbResult = await query(`
    insert into lab.document_render_job (render_job_id, session_id, template_slug, document_type_slug, document_code, output_format, status, request_json, result_json)
    values ($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9::jsonb)
    on conflict (render_job_id) do update set
      session_id = excluded.session_id,
      template_slug = excluded.template_slug,
      document_type_slug = excluded.document_type_slug,
      document_code = excluded.document_code,
      output_format = excluded.output_format,
      status = excluded.status,
      request_json = excluded.request_json,
      result_json = excluded.result_json,
      updated_at = now()
  `, [
    renderJob.renderJobId,
    renderJob.sessionId || null,
    renderJob.templateSlug,
    renderJob.documentTypeSlug,
    renderJob.documentCode,
    renderJob.outputFormat,
    renderJob.status,
    JSON.stringify(renderJob.requestJson || {}),
    JSON.stringify(renderJob.resultJson || {})
  ]).catch(() => null);

  if (dbResult) return renderJob;

  const current = await readJsonFile(filePath, []);
  const next = current.filter((item) => item.renderJobId !== renderJob.renderJobId).concat(renderJob);
  await writeJsonFile(filePath, next);
  return renderJob;
}
