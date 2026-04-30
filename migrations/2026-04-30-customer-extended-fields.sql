-- ============================================================
-- LABORATORIO BACKEND
-- Campos extendidos para empresas cliente.
-- ============================================================

alter table lab.customer
  add column if not exists service_type text,
  add column if not exists address text,
  add column if not exists phone text,
  add column if not exists email text;

alter table lab.customer
  alter column normalized_rut drop not null,
  alter column display_rut drop not null;
