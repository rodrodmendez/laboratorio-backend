import { query } from '../../core/database/pg-client.mjs';
import { listCustomers } from '../customers/customer-repository.mjs';

export async function listContacts(customerId = '') {
  const dbResult = await query(`
    select contact_id, customer_id, contact_name, email, phone, is_primary
    from lab.contact_person
    where ($1 = '' or customer_id = $1)
    order by is_primary desc, contact_name
  `, [customerId]).catch(() => null);

  if (dbResult?.rows?.length) {
    return dbResult.rows.map((row) => ({
      contactId: row.contact_id,
      customerId: row.customer_id,
      name: row.contact_name,
      email: row.email,
      phone: row.phone,
      isPrimary: row.is_primary,
    }));
  }

  const customers = await listCustomers();
  return customers
    .filter((item) => !customerId || item.customerId === customerId)
    .flatMap((customer) => (customer.contacts || []).map((contact) => ({
      customerId: customer.customerId,
      ...contact,
    })));
}

export async function saveContact(contact) {
  const payload = {
    contactId: contact.contactId || `con-${Date.now()}`,
    customerId: contact.customerId,
    contactName: String(contact.name || contact.contactName || '').trim(),
    email: String(contact.email || '').trim(),
    phone: String(contact.phone || '').trim(),
    isPrimary: contact.isPrimary === true,
  };

  if (!payload.customerId || !payload.contactName) {
    throw new Error('customerId y contactName son obligatorios');
  }

  const dbResult = await query(`
    insert into lab.contact_person (contact_id, customer_id, contact_name, email, phone, is_primary)
    values ($1,$2,$3,$4,$5,$6)
    on conflict (contact_id) do update set
      customer_id = excluded.customer_id,
      contact_name = excluded.contact_name,
      email = excluded.email,
      phone = excluded.phone,
      is_primary = excluded.is_primary,
      updated_at = now()
    returning contact_id, customer_id, contact_name, email, phone, is_primary
  `, [payload.contactId, payload.customerId, payload.contactName, payload.email || null, payload.phone || null, payload.isPrimary]).catch(() => null);

  if (dbResult?.rows?.[0]) {
    const row = dbResult.rows[0];
    return {
      contactId: row.contact_id,
      customerId: row.customer_id,
      name: row.contact_name,
      email: row.email,
      phone: row.phone,
      isPrimary: row.is_primary,
    };
  }

  const customers = await listCustomers();
  const customer = customers.find((item) => item.customerId === payload.customerId);
  if (!customer) return payload;
  customer.contacts = customer.contacts || [];
  const existing = customer.contacts.find((item) => item.contactId === payload.contactId);
  const next = { contactId: payload.contactId, name: payload.contactName, email: payload.email, phone: payload.phone, isPrimary: payload.isPrimary };
  if (existing) Object.assign(existing, next);
  else customer.contacts.unshift(next);
  return { customerId: payload.customerId, ...next };
}
