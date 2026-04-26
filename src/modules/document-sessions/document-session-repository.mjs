import { join } from 'node:path';
import { query } from '../../core/database/pg-client.mjs';
import { readJsonFile, writeJsonFile } from '../../shared/store/json-file-store.mjs';

const filePath = join(process.cwd(), 'data', 'document-sessions.json');

export async function saveDocumentSession(session) {
  const dbResult = await query(`
    insert into lab.document_session (session_id, document_type_slug, document_code, customer_id, contact_id, status, confidentiality_level, payload_json)
    values ($1,$2,$3,$4,$5,$6,$7,$8::jsonb)
    on conflict (session_id) do update set
      document_type_slug = excluded.document_type_slug,
      document_code = excluded.document_code,
      customer_id = excluded.customer_id,
      contact_id = excluded.contact_id,
      status = excluded.status,
      confidentiality_level = excluded.confidentiality_level,
      payload_json = excluded.payload_json,
      updated_at = now()
  `, [
    session.sessionId,
    session.documentTypeSlug,
    session.documentCode,
    session.customerId || null,
    session.contactId || null,
    session.status || 'draft',
    session.confidentialityLevel || 'internal',
    JSON.stringify(session.payload || {})
  ]).catch(() => null);

  if (dbResult) return session;

  const current = await readJsonFile(filePath, []);
  const next = current.filter((item) => item.sessionId !== session.sessionId).concat(session);
  await writeJsonFile(filePath, next);
  return session;
}
