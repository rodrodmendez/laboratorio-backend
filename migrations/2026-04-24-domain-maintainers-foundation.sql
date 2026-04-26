-- ============================================================
-- LABORATORIO BACKEND
-- Integracion inicial del modelo de mantenedores segun
-- levantamiento de cotizaciones + BAC bacteriologico.
--
-- Esta migracion se adapta a la estructura actual del backend:
-- - usa lab.maintainer_catalog_entry para catalogos simples
-- - crea tablas dedicadas para metodos analiticos y parametros
-- - no reemplaza customer/contact_person ni document_template_catalog
-- ============================================================

create schema if not exists lab;

create table if not exists lab.maintainer_catalog_entry (
  entry_id text primary key,
  catalog_type text not null,
  entry_key text not null,
  entry_label text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (catalog_type, entry_key)
);

create index if not exists idx_maintainer_catalog_entry_type
  on lab.maintainer_catalog_entry (catalog_type, entry_label);

create table if not exists lab.assay_parameter_catalog (
  assay_parameter_id text primary key,
  assay_name text not null unique,
  assay_description text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists lab.analytical_method_catalog (
  method_id text primary key,
  method_code text not null unique,
  method_name text,
  organization_name text,
  method_kind text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into lab.maintainer_catalog_entry (entry_id, catalog_type, entry_key, entry_label)
values
  ('quote_status-aceptada', 'quote_status', 'Aceptada', 'Aceptada'),
  ('quote_status-anulada', 'quote_status', 'Anulada', 'Anulada'),
  ('quote_status-rechazada', 'quote_status', 'Rechazada', 'Rechazada'),
  ('quote_status-pendiente', 'quote_status', 'Pendiente', 'Pendiente'),
  ('quote_status-a-la-espera', 'quote_status', 'A la espera', 'A la espera'),

  ('analysis_package-microbiologico', 'analysis_package', 'Microbiologico', 'Microbiologico'),
  ('analysis_package-fisico-quimico', 'analysis_package', 'Fisico-Quimico', 'Fisico-Quimico'),
  ('analysis_package-analisis-parcial', 'analysis_package', 'Analisis Parcial', 'Analisis Parcial'),
  ('analysis_package-nch409-completo', 'analysis_package', 'NCh 409 - Agua Potable Completo', 'NCh 409 - Agua Potable Completo'),
  ('analysis_package-nch1333-riego', 'analysis_package', 'NCh 1333 - Agua para Riego', 'NCh 1333 - Agua para Riego'),
  ('analysis_package-muestreo', 'analysis_package', 'Servicio de Muestreo', 'Servicio de Muestreo'),
  ('analysis_package-caudal', 'analysis_package', 'Medicion de Caudal', 'Medicion de Caudal'),
  ('analysis_package-monitoreo', 'analysis_package', 'Monitoreo Periodico', 'Monitoreo Periodico'),
  ('analysis_package-envio', 'analysis_package', 'Envio de Resultados', 'Envio de Resultados'),
  ('analysis_package-blanco', 'analysis_package', 'Blanco de Campo', 'Blanco de Campo'),
  ('analysis_package-nch409-micro', 'analysis_package', 'NCh 409 + Microbiologico', 'NCh 409 + Microbiologico'),

  ('sample_type-agua-potable', 'sample_type', 'Agua Potable', 'Agua Potable'),
  ('sample_type-agua-potable-rural', 'sample_type', 'Agua Potable Rural (APR)', 'Agua Potable Rural (APR)'),
  ('sample_type-agua-mineral-envasada', 'sample_type', 'Agua Mineral Envasada', 'Agua Mineral Envasada'),
  ('sample_type-agua-envasada', 'sample_type', 'Agua Envasada', 'Agua Envasada'),
  ('sample_type-agua-canal-riego', 'sample_type', 'Agua de Canal para Riego', 'Agua de Canal para Riego'),
  ('sample_type-agua-pozo', 'sample_type', 'Agua de Pozo', 'Agua de Pozo'),
  ('sample_type-agua-piscina', 'sample_type', 'Agua de Piscina', 'Agua de Piscina'),
  ('sample_type-hielo', 'sample_type', 'Hielo', 'Hielo'),
  ('sample_type-agua-proceso-industrial', 'sample_type', 'Agua de Proceso Industrial', 'Agua de Proceso Industrial'),

  ('preservative-tiosulfato', 'preservative', 'Tiosulfato de Sodio', 'Tiosulfato de Sodio'),
  ('preservative-edta', 'preservative', 'EDTA', 'EDTA'),
  ('preservative-sin-preservante', 'preservative', 'Sin preservante', 'Sin preservante'),
  ('preservative-acido-nitrico', 'preservative', 'Acido nitrico', 'Acido nitrico'),
  ('preservative-acido-sulfurico', 'preservative', 'Acido sulfurico', 'Acido sulfurico'),

  ('sampling_type-cliente', 'sampling_type', 'Cliente', 'Cliente'),
  ('sampling_type-laboratorio', 'sampling_type', 'Laboratorio', 'Laboratorio'),
  ('sampling_type-mixto', 'sampling_type', 'Mixto', 'Mixto'),

  ('accreditation_scope-le171', 'accreditation_scope', 'LE 171', 'LE 171'),
  ('accreditation_scope-le172', 'accreditation_scope', 'LE 172', 'LE 172'),

  ('business_document_type-cotizacion', 'business_document_type', 'Cotizacion', 'Cotizacion'),
  ('business_document_type-orden-compra', 'business_document_type', 'Orden de Compra', 'Orden de Compra'),
  ('business_document_type-factura', 'business_document_type', 'Factura', 'Factura'),
  ('business_document_type-informe-ensayo', 'business_document_type', 'Informe de Ensayo', 'Informe de Ensayo'),
  ('business_document_type-registro-ensayo', 'business_document_type', 'Registro de Ensayo', 'Registro de Ensayo'),
  ('business_document_type-nota-credito', 'business_document_type', 'Nota de Credito', 'Nota de Credito'),
  ('business_document_type-guia-despacho', 'business_document_type', 'Guia de Despacho', 'Guia de Despacho'),

  ('intake_channel-directo', 'intake_channel', 'Directo (No landing)', 'Directo (No landing)'),
  ('intake_channel-landing-web', 'intake_channel', 'Landing Web', 'Landing Web'),
  ('intake_channel-referido', 'intake_channel', 'Referido', 'Referido'),
  ('intake_channel-licitacion', 'intake_channel', 'Licitacion', 'Licitacion'),

  ('unit-unt', 'unit', 'UNT', 'UNT'),
  ('unit-nmp-100-ml', 'unit', 'NMP/100 ml', 'NMP/100 ml'),
  ('unit-ufc-100-ml', 'unit', 'UFC/100 ml', 'UFC/100 ml'),
  ('unit-ufc-ml', 'unit', 'UFC/ml', 'UFC/ml'),
  ('unit-presencia-ausencia', 'unit', 'Presencia/Ausencia', 'Presencia/Ausencia'),
  ('unit-celsius', 'unit', '°C', '°C')
on conflict (catalog_type, entry_key) do update set
  entry_label = excluded.entry_label,
  is_active = true,
  updated_at = now();

insert into lab.assay_parameter_catalog (assay_parameter_id, assay_name, assay_description)
values
  ('assay-cloro-residual-libre', 'Cloro residual libre', null),
  ('assay-turbiedad-nefelometrico', 'Turbiedad - Nefelometrico', null),
  ('assay-coliformes-totales', 'Coliformes Totales', null),
  ('assay-coliformes-fecales', 'Coliformes Fecales', null),
  ('assay-escherichia-coli-ec-mug', 'Escherichia Coli - EC MUG', null),
  ('assay-recuento-heterotrofos', 'Recuento de Heterotrofos (bacterias aerobicas)', null)
on conflict (assay_name) do update set
  assay_description = excluded.assay_description,
  is_active = true,
  updated_at = now();

insert into lab.analytical_method_catalog (method_id, method_code, method_name, organization_name, method_kind)
values
  ('method-siss-me-33-2007', 'SISS-ME-33-2007', 'Cloro Residual Libre', 'SISS', 'Metodo SISS'),
  ('method-siss-me-03-2007', 'SISS-ME-03-2007', 'Turbiedad Nefelometrica', 'SISS', 'Metodo SISS'),
  ('method-siss-me-01-2007', 'SISS-ME-01-2007', 'Escherichia Coli EC MUG (tubos multiples)', 'SISS', 'Metodo SISS'),
  ('method-siss-me-02-2007', 'SISS-ME-02-2007', 'Escherichia Coli EC MUG (membrana filtrante)', 'SISS', 'Metodo SISS'),
  ('method-nch1620-1-of84', 'NCH1620/1-OF84', 'Coliformes Totales - NMP', 'INN', 'Norma Chilena'),
  ('method-nch1620-2-of84', 'NCH1620/2-OF84', 'Coliformes Totales - UFC', 'INN', 'Norma Chilena'),
  ('method-nch2313-22-of95', 'NCH2313/22-OF95', 'Coliformes Fecales - NMP (tubos)', 'INN', 'Norma Chilena'),
  ('method-nch2313-23-of95', 'NCH2313/23-OF95', 'Coliformes Fecales - NMP (confirmacion)', 'INN', 'Norma Chilena'),
  ('method-nch409', 'NCH409', 'Agua Potable - Requisitos', 'INN', 'Norma Chilena'),
  ('method-nch1333', 'NCH1333', 'Agua para Riego - Requisitos', 'INN', 'Norma Chilena'),
  ('method-sm-ed23-2017-4500-cl-g', 'SM-ED23-2017-4500-CL-G', 'Cloro Residual Libre - Standard Methods 23ed', 'APHA', 'Norma Internacional'),
  ('method-sm-ed23-2017-2130-b', 'SM-ED23-2017-2130-B', 'Turbiedad Nefelometrica - Standard Methods 23ed', 'APHA', 'Norma Internacional'),
  ('method-sm-ed23-2017-9221-f', 'SM-ED23-2017-9221-F', 'E. Coli EC MUG - Standard Methods 23ed', 'APHA', 'Norma Internacional'),
  ('method-sm-ed23-2017-9215-b', 'SM-ED23-2017-9215-B', 'Recuento Heterotrofos - Standard Methods 23ed', 'APHA', 'Norma Internacional'),
  ('method-sm-ed22-2012-2130-b', 'SM-ED22-2012-2130-B', 'Turbiedad Nefelometrica - Standard Methods 22ed', 'APHA', 'Norma Internacional'),
  ('method-sm-ed22-2012-9221-b', 'SM-ED22-2012-9221-B', 'Coliformes Totales NMP - Standard Methods 22ed', 'APHA', 'Norma Internacional'),
  ('method-sm-ed22-2012-9221-e', 'SM-ED22-2012-9221-E', 'Coliformes Fecales NMP - Standard Methods 22ed', 'APHA', 'Norma Internacional'),
  ('method-sm-ed22-2012-9221-f', 'SM-ED22-2012-9221-F', 'E. Coli EC MUG - Standard Methods 22ed', 'APHA', 'Norma Internacional'),
  ('method-sm-ed22-2012-9215-b', 'SM-ED22-2012-9215-B', 'Recuento Heterotrofos - Standard Methods 22ed', 'APHA', 'Norma Internacional')
on conflict (method_code) do update set
  method_name = excluded.method_name,
  organization_name = excluded.organization_name,
  method_kind = excluded.method_kind,
  is_active = true,
  updated_at = now();
