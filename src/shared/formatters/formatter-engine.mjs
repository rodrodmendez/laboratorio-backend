const MONTHS_ES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

function toStringValue(value) {
  if (value === null || value === undefined) return '';
  return String(value).trim();
}

function parseNumber(value) {
  if (typeof value === 'number') return value;
  const text = toStringValue(value).replace(/UF/gi, '').replace(/\$/g, '').trim();
  if (!text) return 0;

  let normalized = text;
  if (text.includes(',') && text.includes('.')) {
    normalized = text.replace(/\./g, '').replace(',', '.');
  } else if (text.includes(',')) {
    normalized = text.replace(',', '.');
  }

  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatDecimal(value, decimals = 2) {
  return new Intl.NumberFormat('es-CL', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);
}

export function formatSpanishDate(value) {
  if (!value) return '';
  const date = new Date(`${value}T12:00:00`);
  if (Number.isNaN(date.getTime())) return '';
  const day = String(date.getDate()).padStart(2, '0');
  const month = MONTHS_ES[date.getMonth()] || '';
  const year = date.getFullYear();
  return `${day} de ${month} de ${year}`;
}

export function formatValue(formatterSlug, value, options = {}) {
  switch (formatterSlug) {
    case 'document_code_suffix':
      return toStringValue(value);
    case 'spanish_long_date_santiago':
      return formatSpanishDate(value);
    case 'label_value_atencion':
      return value ? `Atencion: ${toStringValue(value)}` : '';
    case 'label_value_email':
      return value ? `Correo: ${toStringValue(value)}` : '';
    case 'label_value_phone':
      return value ? `Telefono: ${toStringValue(value)}` : '';
    case 'label_value_rut':
      return value ? `RUT: ${toStringValue(value)}` : '';
    case 'joined_product_summary':
      if (Array.isArray(value)) return value.map(toStringValue).filter(Boolean).join(options.separator || ', ');
      return toStringValue(value);
    case 'detail_parameter_name':
      if (typeof value === 'object' && value) {
        return toStringValue(value.parameter_name || value.parameterName || value.name || value.service_product || value.serviceProduct);
      }
      return toStringValue(value);
    case 'detail_detection_limit':
      if (typeof value === 'object' && value) {
        return toStringValue(value.detection_limit || value.detectionLimit || value.limit || value.matrix || '');
      }
      return toStringValue(value);
    case 'detail_method_name':
      if (typeof value === 'object' && value) {
        return toStringValue(
          value.method_name ||
          value.methodName ||
          value.norma_metodo ||
          value.normaMetodo ||
          value.method_reference ||
          value.methodReference ||
          value.normative_reference ||
          value.normativeReference ||
          value.document_type ||
          value.documentType ||
          ''
        );
      }
      return toStringValue(value);
    case 'detail_price_uf': {
      const numberValue = typeof value === 'object' && value ? parseNumber(value.price_uf || value.priceUf || value.price || 0) : parseNumber(value);
      return `${formatDecimal(numberValue, options.decimals ?? 2)} UF`;
    }
    case 'summary_label':
      return toStringValue(value);
    case 'summary_total_neto':
    case 'summary_iva':
    case 'summary_total_final': {
      const numberValue = parseNumber(value);
      return `${formatDecimal(numberValue, options.decimals ?? 2)} UF`;
    }
    case 'append_after_existing': {
      const existing = toStringValue(options.existing || '');
      const incoming = toStringValue(value);
      if (!existing) return incoming;
      if (!incoming) return existing;
      return `${existing}${options.separator || ' '}${incoming}`;
    }
    case 'plain_text':
    default:
      return toStringValue(value);
  }
}

export function calculateSummaryFromDetailRows(rows = []) {
  const neto = rows.reduce((acc, row) => acc + parseNumber(row.price_uf || row.priceUf || row.price || 0), 0);
  const iva = neto * 0.19;
  const total = neto + iva;
  return { neto, iva, total };
}


