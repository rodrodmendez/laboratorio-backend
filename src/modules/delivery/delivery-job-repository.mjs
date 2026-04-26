import { join } from 'node:path';
import { query } from '../../core/database/pg-client.mjs';
import { readJsonFile, writeJsonFile } from '../../shared/store/json-file-store.mjs';

const filePath = join(process.cwd(), 'data', 'document-delivery-jobs.json');

export async function saveDeliveryJob(job) {
  const dbResult = await query(`
    insert into lab.document_delivery_job (delivery_job_id, render_job_id, delivery_type, recipients, payload_json, status)
    values ($1,$2,$3,$4,$5::jsonb,$6)
    on conflict (delivery_job_id) do update set
      render_job_id = excluded.render_job_id,
      delivery_type = excluded.delivery_type,
      recipients = excluded.recipients,
      payload_json = excluded.payload_json,
      status = excluded.status,
      updated_at = now()
  `, [
    job.deliveryJobId,
    job.renderJobId || null,
    job.deliveryType,
    job.recipients || [],
    JSON.stringify(job.payload || {}),
    job.status || 'pending'
  ]).catch(() => null);

  if (dbResult) return job;

  const current = await readJsonFile(filePath, []);
  const next = current.filter((item) => item.deliveryJobId !== job.deliveryJobId).concat(job);
  await writeJsonFile(filePath, next);
  return job;
}
