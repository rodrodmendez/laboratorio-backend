import { join } from 'node:path';
import { readJsonFile, writeJsonFile } from '../../shared/store/json-file-store.mjs';
import { getPgPool, query } from '../../core/database/pg-client.mjs';
import { listCustomers } from '../customers/customer-repository.mjs';

const quotesPath = join(process.cwd(), 'data', 'quotes.json');
const assayRecordsPath = join(process.cwd(), 'data', 'assay-records.json');

const seedQuotes = [
  {
    quoteId: 'quote-001',
    quoteNumber: 101,
    customerId: 'cli-001',
    customerName: 'Aguas del Valle SPA',
    quoteStatusKey: 'Aceptada',
    intakeChannelKey: 'Directo (No landing)',
    issueDate: '2026-04-10',
    amountUf: 4.65,
    quoteYear: 2026,
    weekLabel: 'Semana 15',
    monthLabel: 'ABR',
    observations: 'Cotizacion de referencia para arranque operacional.',
    analysisPackages: ['Analisis Parcial', 'Servicio de Muestreo'],
    followUps: [
      { followUpId: 'quote-follow-001', sequenceNo: 1, description: 'Cliente solicita ajuste por volumen.', followUpDate: '2026-04-11' },
      { followUpId: 'quote-follow-002', sequenceNo: 2, description: 'Se confirma aceptacion comercial.', followUpDate: '2026-04-12' },
    ],
  },
];

const seedAssayRecords = [
  {
    assayRecordId: 'assay-record-001',
    reportNumber: 'B26-192',
    labEntryNumber: 'ING-2026-00192',
    businessDocumentTypeKey: 'Informe de Ensayo',
    customerId: 'cli-001',
    customerName: 'Aguas del Valle SPA',
    sampleTypeKey: 'Agua Potable',
    originText: 'Red de agua potable sector norte',
    sampledAt: '2026-04-10T10:30:00.000Z',
    receivedAt: '2026-04-10T13:00:00.000Z',
    analysisStartedAt: '2026-04-10T14:00:00.000Z',
    analysisFinishedAt: '2026-04-11T09:30:00.000Z',
    storageHours: 2.5,
    sampleTemperatureC: 5.4,
    samplingTypeKey: 'Laboratorio',
    instructionRef: 'IT-MICRO-001',
    observations: 'Muestra conservada con cadena de frio.',
    areaManagerName: 'Jefatura Microbiologia',
    generalManagerName: 'Gerencia General',
    deliveryDate: '2026-04-12',
    accreditationScopeKey: 'LE 171',
    preservativeKeys: ['Tiosulfato de Sodio'],
    results: [
      {
        assayResultId: 'assay-result-001',
        assayParameterId: 'assay-coliformes-totales',
        methodId: 'method-nch1620-1-of84',
        resultValue: '< 1,8',
        resultNumeric: null,
        unitKey: 'NMP/100 ml',
        maxLimitText: 'AP <1,8 NMP/100 ml',
        accreditationPending: false,
      },
    ],
  },
];

function toNullableNumber(value) {
  if (value === '' || value == null) return null;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

function toNullableText(value) {
  const text = String(value ?? '').trim();
  return text || null;
}

function mapQuoteRow(row) {
  return {
    quoteId: row.quote_id,
    quoteNumber: row.quote_number,
    customerId: row.customer_id,
    customerName: row.customer_name || '',
    quoteStatusKey: row.quote_status_key,
    intakeChannelKey: row.intake_channel_key,
    issueDate: row.issue_date,
    amountUf: row.amount_uf == null ? null : Number(row.amount_uf),
    quoteYear: row.quote_year,
    weekLabel: row.week_label,
    monthLabel: row.month_label,
    observations: row.observations || '',
    analysisPackages: [],
    followUps: [],
  };
}

function mapAssayRecordRow(row) {
  return {
    assayRecordId: row.assay_record_id,
    reportNumber: row.report_number,
    labEntryNumber: row.lab_entry_number,
    businessDocumentTypeKey: row.business_document_type_key,
    customerId: row.customer_id,
    customerName: row.customer_name || '',
    sampleTypeKey: row.sample_type_key,
    originText: row.origin_text || '',
    sampledAt: row.sampled_at,
    receivedAt: row.received_at,
    analysisStartedAt: row.analysis_started_at,
    analysisFinishedAt: row.analysis_finished_at,
    storageHours: row.storage_hours == null ? null : Number(row.storage_hours),
    sampleTemperatureC: row.sample_temperature_c == null ? null : Number(row.sample_temperature_c),
    samplingTypeKey: row.sampling_type_key,
    instructionRef: row.instruction_ref || '',
    observations: row.observations || '',
    areaManagerName: row.area_manager_name || '',
    generalManagerName: row.general_manager_name || '',
    deliveryDate: row.delivery_date,
    accreditationScopeKey: row.accreditation_scope_key,
    preservativeKeys: [],
  };
}

async function loadQuotesFallback() {
  return readJsonFile(quotesPath, seedQuotes);
}

async function loadAssayRecordsFallback() {
  return readJsonFile(assayRecordsPath, seedAssayRecords);
}

async function resolveCustomerInfo(customerId) {
  if (!customerId) return null;
  const customers = await listCustomers('');
  return customers.find((item) => item.customerId === customerId) || null;
}

export async function listQuotes(filters = {}) {
  const customerId = String(filters.customerId || '').trim();
  const normalizedRut = String(filters.normalizedRut || '').trim();

  const dbResult = await query(`
    select
      q.quote_id,
      q.quote_number,
      q.customer_id,
      c.business_name as customer_name,
      q.quote_status_key,
      q.intake_channel_key,
      q.issue_date,
      q.amount_uf,
      q.quote_year,
      q.week_label,
      q.month_label,
      q.observations,
      qa.analysis_package_key,
      qf.follow_up_id,
      qf.sequence_no,
      qf.description as follow_up_description,
      qf.follow_up_date
    from lab.quote_record q
    left join lab.customer c on c.customer_id = q.customer_id
    left join lab.quote_analysis_package qa on qa.quote_id = q.quote_id
    left join lab.quote_follow_up qf on qf.quote_id = q.quote_id
    where (
      ($1 = '' and $2 = '')
      or q.customer_id = $1
      or c.normalized_rut = $2
    )
    order by q.issue_date desc nulls last, q.quote_number desc nulls last, qf.sequence_no asc nulls last
  `, [customerId, normalizedRut]).catch(() => null);

  if (dbResult?.rows?.length) {
    const map = new Map();
    for (const row of dbResult.rows) {
      if (!map.has(row.quote_id)) {
        map.set(row.quote_id, mapQuoteRow(row));
      }
      const quote = map.get(row.quote_id);
      if (row.analysis_package_key && !quote.analysisPackages.includes(row.analysis_package_key)) {
        quote.analysisPackages.push(row.analysis_package_key);
      }
      if (row.follow_up_id && !quote.followUps.some((item) => item.followUpId === row.follow_up_id)) {
        quote.followUps.push({
          followUpId: row.follow_up_id,
          sequenceNo: row.sequence_no,
          description: row.follow_up_description || '',
          followUpDate: row.follow_up_date,
        });
      }
    }
    return Array.from(map.values());
  }

  const quotes = await loadQuotesFallback();
  return quotes.filter((item) => {
    if (customerId && item.customerId === customerId) return true;
    if (normalizedRut && item.normalizedRut === normalizedRut) return true;
    return !customerId && !normalizedRut;
  });
}

export async function saveQuote(quote) {
  const payload = {
    quoteId: quote.quoteId || `quote-${Date.now()}`,
    quoteNumber: toNullableNumber(quote.quoteNumber),
    customerId: toNullableText(quote.customerId),
    quoteStatusKey: toNullableText(quote.quoteStatusKey) || 'Pendiente',
    intakeChannelKey: toNullableText(quote.intakeChannelKey),
    issueDate: toNullableText(quote.issueDate),
    amountUf: toNullableNumber(quote.amountUf),
    quoteYear: toNullableNumber(quote.quoteYear),
    weekLabel: toNullableText(quote.weekLabel),
    monthLabel: toNullableText(quote.monthLabel),
    observations: String(quote.observations || '').trim(),
    analysisPackages: Array.isArray(quote.analysisPackages) ? quote.analysisPackages.map((item) => String(item).trim()).filter(Boolean) : [],
    followUps: Array.isArray(quote.followUps) ? quote.followUps.map((item, index) => ({
      followUpId: item.followUpId || `quote-follow-${Date.now()}-${index + 1}`,
      sequenceNo: toNullableNumber(item.sequenceNo) || index + 1,
      description: String(item.description || '').trim(),
      followUpDate: toNullableText(item.followUpDate),
    })) : [],
  };

  if (!payload.customerId) throw new Error('customerId es obligatorio');

  const pool = await getPgPool().catch(() => null);
  if (pool) {
    const client = await pool.connect();
    try {
      await client.query('begin');
      await client.query(`
        insert into lab.quote_record (
          quote_id, quote_number, customer_id, quote_status_key, intake_channel_key,
          issue_date, amount_uf, quote_year, week_label, month_label, observations
        )
        values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
        on conflict (quote_id) do update set
          quote_number = excluded.quote_number,
          customer_id = excluded.customer_id,
          quote_status_key = excluded.quote_status_key,
          intake_channel_key = excluded.intake_channel_key,
          issue_date = excluded.issue_date,
          amount_uf = excluded.amount_uf,
          quote_year = excluded.quote_year,
          week_label = excluded.week_label,
          month_label = excluded.month_label,
          observations = excluded.observations,
          updated_at = now()
      `, [
        payload.quoteId,
        payload.quoteNumber,
        payload.customerId,
        payload.quoteStatusKey,
        payload.intakeChannelKey,
        payload.issueDate,
        payload.amountUf,
        payload.quoteYear,
        payload.weekLabel,
        payload.monthLabel,
        payload.observations || null,
      ]);

      await client.query('delete from lab.quote_analysis_package where quote_id = $1', [payload.quoteId]);
      for (const analysisPackageKey of payload.analysisPackages) {
        await client.query(`
          insert into lab.quote_analysis_package (quote_id, analysis_package_key)
          values ($1,$2)
          on conflict do nothing
        `, [payload.quoteId, analysisPackageKey]);
      }

      await client.query('delete from lab.quote_follow_up where quote_id = $1', [payload.quoteId]);
      for (const followUp of payload.followUps) {
        await client.query(`
          insert into lab.quote_follow_up (follow_up_id, quote_id, sequence_no, description, follow_up_date)
          values ($1,$2,$3,$4,$5)
        `, [followUp.followUpId, payload.quoteId, followUp.sequenceNo, followUp.description || null, followUp.followUpDate]);
      }

      await client.query('commit');
      const saved = await listQuotes({ customerId: payload.customerId });
      return saved.find((item) => item.quoteId === payload.quoteId) || payload;
    } catch (error) {
      await client.query('rollback').catch(() => null);
    } finally {
      client.release();
    }
  }

  const quotes = await loadQuotesFallback();
  const customer = await resolveCustomerInfo(payload.customerId);
  const existingIndex = quotes.findIndex((item) => item.quoteId === payload.quoteId);
  const next = {
    ...quotes[existingIndex],
    ...payload,
    customerName: quote.customerName || customer?.businessName || quotes[existingIndex]?.customerName || '',
    normalizedRut: customer?.normalizedRut || quotes[existingIndex]?.normalizedRut || null,
  };
  if (existingIndex >= 0) quotes[existingIndex] = next;
  else quotes.unshift(next);
  await writeJsonFile(quotesPath, quotes);
  return next;
}

export async function deleteQuote(quoteId) {
  const pool = await getPgPool().catch(() => null);
  if (pool) {
    const client = await pool.connect();
    try {
      await client.query('begin');
      await client.query('delete from lab.quote_analysis_package where quote_id = $1', [quoteId]);
      await client.query('delete from lab.quote_follow_up where quote_id = $1', [quoteId]);
      const result = await client.query('delete from lab.quote_record where quote_id = $1', [quoteId]);
      await client.query('commit');
      client.release();
      if (result.rowCount > 0) return;
    } catch (err) {
      await client.query('rollback').catch(() => null);
      client.release();
      console.error(`[deleteQuote] PG code=${err?.code} table=${err?.table} msg=${err?.message}`);
      if (err?.code === '23503') {
        throw new Error('Esta cotización tiene documentos asociados y no puede eliminarse.');
      }
      // 42P01 = tabla no existe en PG → caer al fallback JSON
      if (err?.code !== '42P01') throw err;
    }
  }
  // Fallback JSON
  const quotes = await loadQuotesFallback();
  await writeJsonFile(quotesPath, quotes.filter((q) => q.quoteId !== quoteId));
}

export async function listQuoteFollowUps(quoteId) {
  if (!quoteId) return [];
  const dbResult = await query(`
    select follow_up_id, quote_id, sequence_no, description, follow_up_date
    from lab.quote_follow_up
    where quote_id = $1
    order by sequence_no asc, follow_up_date asc nulls last
  `, [quoteId]).catch(() => null);

  if (dbResult?.rows?.length) {
    return dbResult.rows.map((row) => ({
      followUpId: row.follow_up_id,
      quoteId: row.quote_id,
      sequenceNo: row.sequence_no,
      description: row.description || '',
      followUpDate: row.follow_up_date,
    }));
  }

  const quotes = await loadQuotesFallback();
  return (quotes.find((item) => item.quoteId === quoteId)?.followUps || []).map((item) => ({
    quoteId,
    ...item,
  }));
}

export async function saveQuoteFollowUp(quoteId, followUp) {
  if (!quoteId) throw new Error('quoteId es obligatorio');
  const quoteList = await listQuotes({});
  const quote = quoteList.find((item) => item.quoteId === quoteId);
  if (!quote) throw new Error('quote no encontrado');
  const followUps = Array.isArray(quote.followUps) ? quote.followUps.slice() : [];
  const nextFollowUp = {
    followUpId: followUp.followUpId || `quote-follow-${Date.now()}`,
    sequenceNo: toNullableNumber(followUp.sequenceNo) || followUps.length + 1,
    description: String(followUp.description || '').trim(),
    followUpDate: toNullableText(followUp.followUpDate),
  };
  const index = followUps.findIndex((item) => item.followUpId === nextFollowUp.followUpId);
  if (index >= 0) followUps[index] = nextFollowUp;
  else followUps.push(nextFollowUp);
  return saveQuote({ ...quote, followUps });
}

export async function listAssayRecords(filters = {}) {
  const customerId = String(filters.customerId || '').trim();
  const normalizedRut = String(filters.normalizedRut || '').trim();

  const dbResult = await query(`
    select
      ar.assay_record_id,
      ar.report_number,
      ar.lab_entry_number,
      ar.business_document_type_key,
      ar.customer_id,
      c.business_name as customer_name,
      ar.sample_type_key,
      ar.origin_text,
      ar.sampled_at,
      ar.received_at,
      ar.analysis_started_at,
      ar.analysis_finished_at,
      ar.storage_hours,
      ar.sample_temperature_c,
      ar.sampling_type_key,
      ar.instruction_ref,
      ar.observations,
      ar.area_manager_name,
      ar.general_manager_name,
      ar.delivery_date,
      ar.accreditation_scope_key,
      arp.preservative_key
    from lab.assay_record ar
    left join lab.customer c on c.customer_id = ar.customer_id
    left join lab.assay_record_preservative arp on arp.assay_record_id = ar.assay_record_id
    where (
      ($1 = '' and $2 = '')
      or ar.customer_id = $1
      or c.normalized_rut = $2
    )
    order by ar.received_at desc nulls last, ar.report_number desc nulls last
  `, [customerId, normalizedRut]).catch(() => null);

  if (dbResult?.rows?.length) {
    const map = new Map();
    for (const row of dbResult.rows) {
      if (!map.has(row.assay_record_id)) {
        map.set(row.assay_record_id, mapAssayRecordRow(row));
      }
      const record = map.get(row.assay_record_id);
      if (row.preservative_key && !record.preservativeKeys.includes(row.preservative_key)) {
        record.preservativeKeys.push(row.preservative_key);
      }
    }
    return Array.from(map.values());
  }

  const records = await loadAssayRecordsFallback();
  return records.filter((item) => {
    if (customerId && item.customerId === customerId) return true;
    if (normalizedRut && item.normalizedRut === normalizedRut) return true;
    return !customerId && !normalizedRut;
  }).map(({ results, ...record }) => record);
}

export async function saveAssayRecord(record) {
  const payload = {
    assayRecordId: record.assayRecordId || `assay-record-${Date.now()}`,
    reportNumber: toNullableText(record.reportNumber),
    labEntryNumber: toNullableText(record.labEntryNumber),
    businessDocumentTypeKey: toNullableText(record.businessDocumentTypeKey),
    customerId: toNullableText(record.customerId),
    sampleTypeKey: toNullableText(record.sampleTypeKey),
    originText: String(record.originText || '').trim(),
    sampledAt: toNullableText(record.sampledAt),
    receivedAt: toNullableText(record.receivedAt),
    analysisStartedAt: toNullableText(record.analysisStartedAt),
    analysisFinishedAt: toNullableText(record.analysisFinishedAt),
    storageHours: toNullableNumber(record.storageHours),
    sampleTemperatureC: toNullableNumber(record.sampleTemperatureC),
    samplingTypeKey: toNullableText(record.samplingTypeKey),
    instructionRef: String(record.instructionRef || '').trim(),
    observations: String(record.observations || '').trim(),
    areaManagerName: String(record.areaManagerName || '').trim(),
    generalManagerName: String(record.generalManagerName || '').trim(),
    deliveryDate: toNullableText(record.deliveryDate),
    accreditationScopeKey: toNullableText(record.accreditationScopeKey),
    preservativeKeys: Array.isArray(record.preservativeKeys) ? record.preservativeKeys.map((item) => String(item).trim()).filter(Boolean) : [],
  };

  if (!payload.customerId) throw new Error('customerId es obligatorio');

  const pool = await getPgPool().catch(() => null);
  if (pool) {
    const client = await pool.connect();
    try {
      await client.query('begin');
      await client.query(`
        insert into lab.assay_record (
          assay_record_id, report_number, lab_entry_number, business_document_type_key,
          customer_id, sample_type_key, origin_text, sampled_at, received_at,
          analysis_started_at, analysis_finished_at, storage_hours, sample_temperature_c,
          sampling_type_key, instruction_ref, observations, area_manager_name,
          general_manager_name, delivery_date, accreditation_scope_key
        )
        values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20)
        on conflict (assay_record_id) do update set
          report_number = excluded.report_number,
          lab_entry_number = excluded.lab_entry_number,
          business_document_type_key = excluded.business_document_type_key,
          customer_id = excluded.customer_id,
          sample_type_key = excluded.sample_type_key,
          origin_text = excluded.origin_text,
          sampled_at = excluded.sampled_at,
          received_at = excluded.received_at,
          analysis_started_at = excluded.analysis_started_at,
          analysis_finished_at = excluded.analysis_finished_at,
          storage_hours = excluded.storage_hours,
          sample_temperature_c = excluded.sample_temperature_c,
          sampling_type_key = excluded.sampling_type_key,
          instruction_ref = excluded.instruction_ref,
          observations = excluded.observations,
          area_manager_name = excluded.area_manager_name,
          general_manager_name = excluded.general_manager_name,
          delivery_date = excluded.delivery_date,
          accreditation_scope_key = excluded.accreditation_scope_key,
          updated_at = now()
      `, [
        payload.assayRecordId,
        payload.reportNumber,
        payload.labEntryNumber,
        payload.businessDocumentTypeKey,
        payload.customerId,
        payload.sampleTypeKey,
        payload.originText || null,
        payload.sampledAt,
        payload.receivedAt,
        payload.analysisStartedAt,
        payload.analysisFinishedAt,
        payload.storageHours,
        payload.sampleTemperatureC,
        payload.samplingTypeKey,
        payload.instructionRef || null,
        payload.observations || null,
        payload.areaManagerName || null,
        payload.generalManagerName || null,
        payload.deliveryDate,
        payload.accreditationScopeKey,
      ]);

      await client.query('delete from lab.assay_record_preservative where assay_record_id = $1', [payload.assayRecordId]);
      for (const preservativeKey of payload.preservativeKeys) {
        await client.query(`
          insert into lab.assay_record_preservative (assay_record_id, preservative_key)
          values ($1,$2)
          on conflict do nothing
        `, [payload.assayRecordId, preservativeKey]);
      }

      await client.query('commit');
      const saved = await listAssayRecords({ customerId: payload.customerId });
      return saved.find((item) => item.assayRecordId === payload.assayRecordId) || payload;
    } catch (error) {
      await client.query('rollback').catch(() => null);
    } finally {
      client.release();
    }
  }

  const records = await loadAssayRecordsFallback();
  const customer = await resolveCustomerInfo(payload.customerId);
  const existingIndex = records.findIndex((item) => item.assayRecordId === payload.assayRecordId);
  const next = {
    ...records[existingIndex],
    ...payload,
    customerName: record.customerName || customer?.businessName || records[existingIndex]?.customerName || '',
    normalizedRut: customer?.normalizedRut || records[existingIndex]?.normalizedRut || null,
    results: records[existingIndex]?.results || [],
  };
  if (existingIndex >= 0) records[existingIndex] = next;
  else records.unshift(next);
  await writeJsonFile(assayRecordsPath, records);
  return next;
}

export async function listAssayResults(assayRecordId) {
  if (!assayRecordId) return [];
  const dbResult = await query(`
    select
      assay_result_id,
      assay_record_id,
      assay_parameter_id,
      method_id,
      result_value,
      result_numeric,
      unit_key,
      max_limit_text,
      accreditation_pending
    from lab.assay_result
    where assay_record_id = $1
    order by assay_result_id
  `, [assayRecordId]).catch(() => null);

  if (dbResult?.rows?.length) {
    return dbResult.rows.map((row) => ({
      assayResultId: row.assay_result_id,
      assayRecordId: row.assay_record_id,
      assayParameterId: row.assay_parameter_id,
      methodId: row.method_id,
      resultValue: row.result_value,
      resultNumeric: row.result_numeric == null ? null : Number(row.result_numeric),
      unitKey: row.unit_key,
      maxLimitText: row.max_limit_text,
      accreditationPending: row.accreditation_pending === true,
    }));
  }

  const records = await loadAssayRecordsFallback();
  return (records.find((item) => item.assayRecordId === assayRecordId)?.results || []).map((item) => ({
    assayRecordId,
    ...item,
  }));
}

export async function saveAssayResult(assayRecordId, result) {
  if (!assayRecordId) throw new Error('assayRecordId es obligatorio');
  const records = await loadAssayRecordsFallback();

  const payload = {
    assayResultId: result.assayResultId || `assay-result-${Date.now()}`,
    assayParameterId: toNullableText(result.assayParameterId),
    methodId: toNullableText(result.methodId),
    resultValue: String(result.resultValue || '').trim(),
    resultNumeric: toNullableNumber(result.resultNumeric),
    unitKey: toNullableText(result.unitKey),
    maxLimitText: String(result.maxLimitText || '').trim(),
    accreditationPending: result.accreditationPending === true,
  };

  if (!payload.assayParameterId) throw new Error('assayParameterId es obligatorio');

  const pool = await getPgPool().catch(() => null);
  if (pool) {
    const dbResult = await query(`
      insert into lab.assay_result (
        assay_result_id, assay_record_id, assay_parameter_id, method_id,
        result_value, result_numeric, unit_key, max_limit_text, accreditation_pending
      )
      values ($1,$2,$3,$4,$5,$6,$7,$8,$9)
      on conflict (assay_result_id) do update set
        assay_record_id = excluded.assay_record_id,
        assay_parameter_id = excluded.assay_parameter_id,
        method_id = excluded.method_id,
        result_value = excluded.result_value,
        result_numeric = excluded.result_numeric,
        unit_key = excluded.unit_key,
        max_limit_text = excluded.max_limit_text,
        accreditation_pending = excluded.accreditation_pending,
        updated_at = now()
    `, [
      payload.assayResultId,
      assayRecordId,
      payload.assayParameterId,
      payload.methodId,
      payload.resultValue || null,
      payload.resultNumeric,
      payload.unitKey,
      payload.maxLimitText || null,
      payload.accreditationPending,
    ]).catch(() => null);
    if (dbResult) {
      const results = await listAssayResults(assayRecordId);
      return results.find((item) => item.assayResultId === payload.assayResultId) || { assayRecordId, ...payload };
    }
  }

  const recordIndex = records.findIndex((item) => item.assayRecordId === assayRecordId);
  if (recordIndex < 0) throw new Error('registro_ensayo no encontrado');
  const existingResults = Array.isArray(records[recordIndex].results) ? records[recordIndex].results : [];
  const resultIndex = existingResults.findIndex((item) => item.assayResultId === payload.assayResultId);
  if (resultIndex >= 0) existingResults[resultIndex] = payload;
  else existingResults.push(payload);
  records[recordIndex].results = existingResults;
  await writeJsonFile(assayRecordsPath, records);
  return { assayRecordId, ...payload };
}

export async function deleteAssayRecord(assayRecordId) {
  const pool = await getPgPool().catch(() => null);
  if (pool) {
    const client = await pool.connect();
    try {
      await client.query('begin');
      await client.query('delete from lab.assay_result where assay_record_id = $1', [assayRecordId]);
      await client.query('delete from lab.assay_record_preservative where assay_record_id = $1', [assayRecordId]);
      const result = await client.query('delete from lab.assay_record where assay_record_id = $1', [assayRecordId]);
      await client.query('commit');
      client.release();
      if (result.rowCount > 0) return;
    } catch (err) {
      await client.query('rollback').catch(() => null);
      client.release();
      console.error(`[deleteAssayRecord] PG code=${err?.code} table=${err?.table} msg=${err?.message}`);
      if (err?.code === '23503') {
        throw new Error('Este registro tiene documentos asociados y no puede eliminarse.');
      }
      if (err?.code !== '42P01') throw err;
    }
  }
  const records = await loadAssayRecordsFallback();
  await writeJsonFile(assayRecordsPath, records.filter((r) => r.assayRecordId !== assayRecordId));
}
