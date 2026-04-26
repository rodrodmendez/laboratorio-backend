-- ============================================================
-- LABORATORIO BACKEND
-- Modelo transaccional base para cotizaciones y registros BAC.
-- Compatible con customer/contact_person y catalogos existentes.
-- ============================================================

create schema if not exists lab;

create table if not exists lab.quote_record (
  quote_id text primary key,
  quote_number integer,
  customer_id text not null,
  quote_status_key text not null,
  intake_channel_key text,
  issue_date date,
  amount_uf numeric(12,4),
  quote_year integer,
  week_label text,
  month_label text,
  observations text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint fk_quote_customer
    foreign key (customer_id) references lab.customer (customer_id)
);

create index if not exists idx_quote_record_customer on lab.quote_record (customer_id);
create index if not exists idx_quote_record_issue_date on lab.quote_record (issue_date);
create index if not exists idx_quote_record_status on lab.quote_record (quote_status_key);

create table if not exists lab.quote_analysis_package (
  quote_id text not null,
  analysis_package_key text not null,
  created_at timestamptz not null default now(),
  primary key (quote_id, analysis_package_key),
  constraint fk_quote_analysis_package_quote
    foreign key (quote_id) references lab.quote_record (quote_id) on delete cascade
);

create table if not exists lab.quote_follow_up (
  follow_up_id text primary key,
  quote_id text not null,
  sequence_no smallint not null,
  description text,
  follow_up_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint fk_quote_follow_up_quote
    foreign key (quote_id) references lab.quote_record (quote_id) on delete cascade
);

create index if not exists idx_quote_follow_up_quote on lab.quote_follow_up (quote_id, sequence_no);

create table if not exists lab.assay_record (
  assay_record_id text primary key,
  report_number text,
  lab_entry_number text,
  business_document_type_key text,
  customer_id text not null,
  sample_type_key text,
  origin_text text,
  sampled_at timestamptz,
  received_at timestamptz,
  analysis_started_at timestamptz,
  analysis_finished_at timestamptz,
  storage_hours numeric(6,2),
  sample_temperature_c numeric(5,2),
  sampling_type_key text,
  instruction_ref text,
  observations text,
  area_manager_name text,
  general_manager_name text,
  delivery_date date,
  accreditation_scope_key text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint fk_assay_record_customer
    foreign key (customer_id) references lab.customer (customer_id)
);

create index if not exists idx_assay_record_customer on lab.assay_record (customer_id);
create index if not exists idx_assay_record_received_at on lab.assay_record (received_at);
create index if not exists idx_assay_record_report_number on lab.assay_record (report_number);

create table if not exists lab.assay_record_preservative (
  assay_record_id text not null,
  preservative_key text not null,
  created_at timestamptz not null default now(),
  primary key (assay_record_id, preservative_key),
  constraint fk_assay_record_preservative_record
    foreign key (assay_record_id) references lab.assay_record (assay_record_id) on delete cascade
);

create table if not exists lab.assay_result (
  assay_result_id text primary key,
  assay_record_id text not null,
  assay_parameter_id text,
  method_id text,
  result_value text,
  result_numeric numeric(15,6),
  unit_key text,
  max_limit_text text,
  accreditation_pending boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint fk_assay_result_record
    foreign key (assay_record_id) references lab.assay_record (assay_record_id) on delete cascade,
  constraint fk_assay_result_parameter
    foreign key (assay_parameter_id) references lab.assay_parameter_catalog (assay_parameter_id),
  constraint fk_assay_result_method
    foreign key (method_id) references lab.analytical_method_catalog (method_id)
);

create index if not exists idx_assay_result_record on lab.assay_result (assay_record_id);
create index if not exists idx_assay_result_parameter on lab.assay_result (assay_parameter_id);
