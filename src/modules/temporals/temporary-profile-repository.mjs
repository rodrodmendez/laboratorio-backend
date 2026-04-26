import { join } from 'node:path';
import { query } from '../../core/database/pg-client.mjs';
import { readJsonFile, writeJsonFile } from '../../shared/store/json-file-store.mjs';

const filePath = join(process.cwd(), 'data', 'temporary-document-profiles.json');

export async function saveTemporaryProfile(profile) {
  const dbResult = await query(`
    insert into lab.temporary_document_profile (profile_id, template_slug, owner_customer_id, profile_name, payload_json, is_session_temp)
    values ($1,$2,$3,$4,$5::jsonb,$6)
    on conflict (profile_id) do update set
      template_slug = excluded.template_slug,
      owner_customer_id = excluded.owner_customer_id,
      profile_name = excluded.profile_name,
      payload_json = excluded.payload_json,
      is_session_temp = excluded.is_session_temp,
      updated_at = now()
  `, [
    profile.profileId,
    profile.templateSlug,
    profile.ownerCustomerId || null,
    profile.profileName,
    JSON.stringify(profile.payload || {}),
    profile.isSessionTemp !== false
  ]).catch(() => null);

  if (dbResult) return profile;

  const current = await readJsonFile(filePath, []);
  const next = current.filter((item) => item.profileId !== profile.profileId).concat(profile);
  await writeJsonFile(filePath, next);
  return profile;
}

export async function listTemporaryProfiles() {
  const dbResult = await query(`
    select profile_id, template_slug, owner_customer_id, profile_name, payload_json, is_session_temp, created_at, updated_at
    from lab.temporary_document_profile
    order by updated_at desc
  `).catch(() => null);

  if (dbResult?.rows?.length) {
    return dbResult.rows.map((row) => ({
      profileId: row.profile_id,
      templateSlug: row.template_slug,
      ownerCustomerId: row.owner_customer_id,
      profileName: row.profile_name,
      payload: row.payload_json,
      isSessionTemp: row.is_session_temp,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));
  }

  return readJsonFile(filePath, []);
}

export async function deleteTemporaryProfile(profileId) {
  await query('delete from lab.temporary_document_profile where profile_id = $1', [profileId]).catch(() => null);
  const current = await readJsonFile(filePath, []);
  const next = current.filter((item) => item.profileId !== profileId);
  await writeJsonFile(filePath, next);
}
