import { query } from '../../core/database/pg-client.mjs';

const seedCustomers = [
  {
    customerId: 'cli-001',
    rut: '76.123.456-7',
    normalizedRut: '76123456-7',
    businessName: 'Aguas del Valle SPA',
    serviceType: '', address: '', phone: '', email: '',
    contacts: [
      {
        contactId: 'con-001',
        name: 'Andrea Morales',
        email: 'andrea.morales@aguasdelvalle.cl',
        phone: '+56 9 8765 4321'
      }
    ]
  },
  {
    customerId: 'cli-002',
    rut: '96.555.440-2',
    normalizedRut: '96555440-2',
    businessName: 'Servicios Sanitarios del Norte Ltda.',
    serviceType: '', address: '', phone: '', email: '',
    contacts: [
      {
        contactId: 'con-002',
        name: 'Carlos Pizarro',
        email: 'cpizarro@ssnorte.cl',
        phone: '+56 2 2233 4455'
      }
    ]
  }
];

function normalizeRut(input = '') {
  return String(input).replace(/\./g, '').trim().toUpperCase();
}

function formatDisplayRut(value = '') {
  return String(value || '').trim().toUpperCase();
}

export async function listCustomers(rut = '') {
  const normalizedRut = normalizeRut(rut);
  const dbResult = await query(`
    select
      c.customer_id,
      c.display_rut,
      c.normalized_rut,
      c.business_name,
      c.service_type,
      c.address,
      c.phone as customer_phone,
      c.email as customer_email,
      cp.contact_id,
      cp.contact_name,
      cp.email,
      cp.phone,
      cp.is_primary,
      cp.contact_origin,
      cp.contact_role
    from lab.customer c
    left join lab.contact_person cp on cp.customer_id = c.customer_id
    where ($1 = '' or c.normalized_rut = $1)
    order by c.business_name, cp.is_primary desc, cp.contact_name
  `, [normalizedRut]).catch(() => query(`
    select
      c.customer_id,
      c.display_rut,
      c.normalized_rut,
      c.business_name,
      c.service_type,
      c.address,
      c.phone as customer_phone,
      c.email as customer_email,
      cp.contact_id,
      cp.contact_name,
      cp.email,
      cp.phone,
      cp.is_primary
    from lab.customer c
    left join lab.contact_person cp on cp.customer_id = c.customer_id
    where ($1 = '' or c.normalized_rut = $1)
    order by c.business_name, cp.is_primary desc, cp.contact_name
  `, [normalizedRut]).catch(() => query(`
    select
      c.customer_id,
      c.display_rut,
      c.normalized_rut,
      c.business_name,
      cp.contact_id,
      cp.contact_name,
      cp.email,
      cp.phone,
      cp.is_primary
    from lab.customer c
    left join lab.contact_person cp on cp.customer_id = c.customer_id
    where ($1 = '' or c.normalized_rut = $1)
    order by c.business_name, cp.is_primary desc, cp.contact_name
  `, [normalizedRut]).catch(() => null)));

  if (dbResult?.rows?.length) {
    const map = new Map();
    for (const row of dbResult.rows) {
      if (!map.has(row.customer_id)) {
        map.set(row.customer_id, {
          customerId: row.customer_id,
          rut: row.display_rut,
          normalizedRut: row.normalized_rut,
          businessName: row.business_name,
          serviceType: row.service_type || '',
          address: row.address || '',
          phone: row.customer_phone || '',
          email: row.customer_email || '',
          contacts: []
        });
      }
      if (row.contact_id) {
        map.get(row.customer_id).contacts.push({
          contactId: row.contact_id,
          name: row.contact_name,
          email: row.email,
          phone: row.phone,
          isPrimary: row.is_primary,
          contactOrigin: row.contact_origin || (row.is_primary ? 'primary' : 'manual'),
          contactRole: row.contact_role || 'general'
        });
      }
    }
    return Array.from(map.values());
  }

  if (!normalizedRut) return seedCustomers;
  return seedCustomers.filter((item) => item.normalizedRut === normalizedRut || normalizeRut(item.rut) === normalizedRut);
}

export async function deleteCustomer(customerId) {
  let dbResult = null;
  let pgError = null;
  try {
    dbResult = await query('DELETE FROM lab.customer WHERE customer_id = $1', [customerId]);
  } catch (err) {
    pgError = err;
    console.error(`[deleteCustomer] error PG code=${err?.code}: ${err.message}`);
  }

  if (dbResult?.rowCount > 0) return;

  if (pgError?.code === '23503') {
    throw new Error(
      'Este cliente tiene documentos o registros asociados y no puede eliminarse. ' +
      'Primero elimine o desvincule sus documentos y sesiones de trabajo.'
    );
  }

  // PG no disponible o cliente no estaba en PG → intentar en seed
  const index = seedCustomers.findIndex((c) => c.customerId === customerId);
  if (index >= 0) seedCustomers.splice(index, 1);
}

export async function saveCustomer(customer) {
  const payload = {
    customerId: customer.customerId || `cli-${Date.now()}`,
    normalizedRut: normalizeRut(customer.rut || customer.normalizedRut || ''),
    displayRut: formatDisplayRut(customer.rut || customer.displayRut || ''),
    businessName: String(customer.businessName || '').trim(),
    serviceType: String(customer.serviceType || '').trim(),
    address: String(customer.address || '').trim(),
    phone: String(customer.phone || '').trim(),
    email: String(customer.email || '').trim(),
  };

  if (!payload.businessName) {
    throw new Error('businessName es obligatorio');
  }

  const dbResult = await query(`
    insert into lab.customer (
      customer_id, normalized_rut, display_rut, business_name,
      service_type, address, phone, email
    )
    values ($1,$2,$3,$4,$5,$6,$7,$8)
    on conflict (customer_id) do update set
      normalized_rut = excluded.normalized_rut,
      display_rut = excluded.display_rut,
      business_name = excluded.business_name,
      service_type = excluded.service_type,
      address = excluded.address,
      phone = excluded.phone,
      email = excluded.email,
      updated_at = now()
    returning customer_id, normalized_rut, display_rut, business_name, service_type, address, phone, email
  `, [
    payload.customerId,
    payload.normalizedRut || null,
    payload.displayRut || payload.normalizedRut || null,
    payload.businessName,
    payload.serviceType || null,
    payload.address || null,
    payload.phone || null,
    payload.email || null
  ]).catch(() => null);

  // Siempre sincronizar el seed con los campos extra para mantenerlos en sesión
  const index = seedCustomers.findIndex((item) => item.customerId === payload.customerId);
  const next = {
    customerId: payload.customerId,
    rut: payload.displayRut || payload.normalizedRut,
    normalizedRut: payload.normalizedRut,
    businessName: payload.businessName,
    serviceType: payload.serviceType,
    address: payload.address,
    phone: payload.phone,
    email: payload.email,
    contacts: index >= 0 ? (seedCustomers[index].contacts || []) : [],
  };
  if (index >= 0) seedCustomers[index] = { ...seedCustomers[index], ...next };
  else seedCustomers.unshift(next);

  if (dbResult?.rows?.[0]) {
    return {
      customerId: dbResult.rows[0].customer_id,
      normalizedRut: dbResult.rows[0].normalized_rut,
      rut: dbResult.rows[0].display_rut,
      businessName: dbResult.rows[0].business_name,
      serviceType: dbResult.rows[0].service_type || '',
      address: dbResult.rows[0].address || '',
      phone: dbResult.rows[0].phone || '',
      email: dbResult.rows[0].email || '',
    };
  }

  return next;
}
