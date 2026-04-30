-- ============================================================
-- LABORATORIO BACKEND
-- Catalogo base de departamentos para usuarios de sistema.
-- ============================================================

insert into lab.maintainer_catalog_entry (entry_id, catalog_type, entry_key, entry_label)
values
  ('user_department-adm', 'user_department', 'ADM', 'ADM'),
  ('user_department-ct', 'user_department', 'CT', 'CT'),
  ('user_department-microbiologia', 'user_department', 'MICROBIOLOGIA', 'MICROBIOLOGIA'),
  ('user_department-muestreo', 'user_department', 'MUESTREO', 'MUESTREO'),
  ('user_department-quimica', 'user_department', 'QUIMICA', 'QUIMICA'),
  ('user_department-otro', 'user_department', 'OTRO', 'OTRO')
on conflict (catalog_type, entry_key) do update set
  entry_label = excluded.entry_label,
  is_active = true,
  updated_at = now();
