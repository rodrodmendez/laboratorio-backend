export type OutputFormat = 'print' | 'pdf' | 'json' | 'csv' | 'zip';

export interface RenderContext {
  customerId?: string;
  contactId?: string;
  quoteId?: string;
  sessionId?: string;
  issuedDocumentId?: string;
  confidentialityLevel?: string;
  timezone?: string;
}

export interface FieldValueMap {
  [fieldSlug: string]: string | number | boolean | null | Record<string, unknown> | Array<unknown>;
}

export interface RepeatRow {
  [columnSlug: string]: string | number | boolean | null | Record<string, unknown>;
}

export interface RepeatSectionMap {
  [sectionSlug: string]: RepeatRow[];
}

export interface RenderRequest {
  documentTypeSlug: string;
  documentCode: string;
  templateSlug?: string;
  outputFormat: OutputFormat;
  context: RenderContext;
  fieldValues: FieldValueMap;
  repeatSections?: RepeatSectionMap;
  metadata?: Record<string, unknown>;
}

export interface RenderWarning {
  code: string;
  message: string;
  fieldSlug?: string;
  cellRef?: string;
}

export interface RenderError {
  code: string;
  message: string;
  fieldSlug?: string;
  sectionSlug?: string;
}

export interface RenderArtifact {
  format: OutputFormat;
  fileName: string;
  storagePath: string;
  checksumSha256: string;
  pageCount?: number;
  mimeType?: string;
}

export interface RenderResponse {
  renderJobId: string;
  templateSlug: string;
  resolvedTemplateVersion?: string;
  status: 'queued' | 'rendered' | 'failed' | 'approved' | 'issued';
  artifact?: RenderArtifact;
  warnings: RenderWarning[];
  errors: RenderError[];
  createdAt: string;
}

export interface TemplateBinding {
  templateSlug: string;
  fieldSlug: string;
  cellRef?: string;
  repeatSectionSlug?: string;
  columnRef?: string;
  formatterSlug?: string;
  formatterOptions?: Record<string, unknown>;
  required?: boolean;
  maxLength?: number;
  writeMode?: 'replace' | 'append' | 'metadata_only';
}

export interface FormatterInput {
  value: unknown;
  options?: Record<string, unknown>;
  locale?: string;
  timezone?: string;
  metadata?: Record<string, unknown>;
}

export interface FormatterResult {
  renderedValue: string;
  warnings?: RenderWarning[];
}

export interface FormatterDefinition {
  slug: string;
  description: string;
  apply: (input: FormatterInput) => FormatterResult;
}
