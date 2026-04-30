-- ============================================================
-- LABORATORIO BACKEND
-- Metadatos para identificar origen y funcion de contactos.
-- ============================================================

alter table lab.contact_person
  add column if not exists contact_origin text not null default 'manual',
  add column if not exists contact_role text not null default 'general';

update lab.contact_person
set contact_origin = 'primary',
    contact_role = 'general'
where is_primary = true;
