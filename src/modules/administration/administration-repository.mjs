import { join } from 'node:path';
import { readJsonFile, writeJsonFile } from '../../shared/store/json-file-store.mjs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const forge = require('node-forge');

const labProfilePath = join(process.cwd(), 'data', 'laboratory-profile.json');
const usersPath = join(process.cwd(), 'data', 'laboratory-users.json');
const providersPath = join(process.cwd(), 'data', 'providers.json');
const purchaseOrdersPath = join(process.cwd(), 'data', 'purchase-orders.json');
const suppliesPath = join(process.cwd(), 'data', 'supplies.json');

const defaultLabProfile = {
  laboratoryId: 'lab-carlos-latorre',
  businessName: 'Laboratorio Carlos Latorre S.A.',
  rut: '96.712.790-6',
  address: 'Jose Manuel Infante 620',
  city: 'Santiago',
  commune: 'Providencia',
  zipCode: '7500800',
  phone: '+56 2 2696 1481',
  email: 'laboratorio@labclatorre.cl',
  website: 'labclatorre.cl',
  accreditation: 'Acreditacion LE 171 - LE 172',
};

const defaultUsers = [
  {
    userId: 'usr-adm',
    username: 'adm',
    password: 'adm',
    fullName: 'Administrador de laboratorio',
    email: 'administracion@labclatorre.cl',
    position: 'Administrador del sistema',
    departmentKey: 'ADM',
    profileColor: '#1d4ed8',
    role: 'admin',
    isActive: true,
    permissions: ['administration:manage', 'documents:render', 'catalogs:manage', 'users:manage'],
    access: ['workbench', 'administration', 'catalogs', 'advanced', 'architecture'],
  },
  {
    userId: 'usr-operator',
    username: 'usr',
    password: 'usr',
    fullName: 'Usuario operativo',
    email: '',
    position: 'Operador documental',
    departmentKey: 'OTRO',
    profileColor: '#2563eb',
    role: 'operator',
    isActive: true,
    permissions: ['documents:render', 'customers:read'],
    access: ['workbench', 'customers'],
  },
];

const defaultProviders = [
  {
    providerId: 'prov-001',
    rut: '77.777.777-7',
    businessName: 'Proveedor de insumos demo',
    serviceType: 'Insumos y servicios de laboratorio',
    contacts: [
      { name: 'Contacto proveedor', email: 'proveedor@demo.cl', phone: '+56 9 1111 2222' },
    ],
    isActive: true,
  },
];

function publicUser(user) {
  // Nunca se expone la contraseña ni el binario del certificado p12
  const { password, certificateP12Base64, ...safeUser } = user;
  return safeUser;
}

// ─── Certificados digitales ────────────────────────────────────────────────────

export function extractCertificateInfo(p12Base64, password) {
  const der   = forge.util.decode64(p12Base64);
  const asn1  = forge.asn1.fromDer(der);
  const p12   = forge.pkcs12.pkcs12FromAsn1(asn1, false, password);
  const bags  = p12.getBags({ bagType: forge.pki.oids.certBag });
  const bag   = (bags[forge.pki.oids.certBag] || [])[0];
  if (!bag?.cert) throw new Error('No se encontró certificado dentro del archivo .p12');
  const cert  = bag.cert;
  const get   = (attr) => cert.subject.getField(attr)?.value || '';
  return {
    commonName:   get('CN'),
    organization: get('O'),
    validFrom:    cert.validity.notBefore.toISOString().slice(0, 10),
    validTo:      cert.validity.notAfter.toISOString().slice(0, 10),
    serialNumber: cert.serialNumber,
  };
}

export async function saveUserCertificate(userId, p12Base64, certInfo) {
  const users = await readJsonFile(usersPath, defaultUsers);
  const idx   = users.findIndex((u) => u.userId === userId);
  if (idx === -1) throw new Error(`Usuario ${userId} no encontrado`);
  users[idx] = { ...users[idx], certificateP12Base64: p12Base64, certificateInfo: certInfo };
  await writeJsonFile(usersPath, users);
  return publicUser(users[idx]);
}

export async function removeUserCertificate(userId) {
  const users = await readJsonFile(usersPath, defaultUsers);
  const idx   = users.findIndex((u) => u.userId === userId);
  if (idx === -1) throw new Error(`Usuario ${userId} no encontrado`);
  const { certificateP12Base64, certificateInfo, ...rest } = users[idx];
  users[idx] = { ...rest, canAuthorize: false };
  await writeJsonFile(usersPath, users);
  return publicUser(users[idx]);
}

export async function getUserWithCertificate(userId) {
  const users = await readJsonFile(usersPath, defaultUsers);
  return users.find((u) => u.userId === userId) || null;
}

function normalizeUsername(value = '') {
  return String(value || '').trim().toLowerCase();
}

export async function getLaboratoryProfile() {
  return readJsonFile(labProfilePath, defaultLabProfile);
}

export async function saveLaboratoryProfile(profile) {
  const current = await getLaboratoryProfile();
  const next = {
    ...current,
    ...profile,
    laboratoryId: profile.laboratoryId || current.laboratoryId || 'lab-carlos-latorre',
  };
  await writeJsonFile(labProfilePath, next);
  return next;
}

export async function listLaboratoryUsers() {
  const users = await readJsonFile(usersPath, defaultUsers);
  return users.map(publicUser);
}

export async function saveLaboratoryUser(user) {
  const users = await readJsonFile(usersPath, defaultUsers);
  const username = normalizeUsername(user.username);
  if (!username) throw new Error('username es obligatorio');
  const userId = user.userId || `usr-${username}-${Date.now()}`;
  const existing = users.find((item) => item.userId === userId);
  const nextUser = {
    userId,
    username,
    password: user.password || existing?.password || username,
    fullName: String(user.fullName || username).trim(),
    email: String(user.email || existing?.email || '').trim(),
    position: String(user.position || existing?.position || '').trim(),
    departmentKey: String(user.departmentKey || existing?.departmentKey || 'OTRO').trim().toUpperCase(),
    profileColor: String(user.profileColor || existing?.profileColor || '#2563eb').trim(),
    role: user.role === 'admin' ? 'admin' : 'operator',
    isActive: user.isActive !== false,
    canRequest: user.canRequest === true,
    canAuthorize: user.canAuthorize === true,
    permissions: Array.isArray(user.permissions) ? user.permissions : [],
    access: Array.isArray(user.access) ? user.access : [],
    // Preservar certificado existente al guardar otros campos del usuario
    ...(existing?.certificateP12Base64 ? { certificateP12Base64: existing.certificateP12Base64 } : {}),
    ...(existing?.certificateInfo      ? { certificateInfo: existing.certificateInfo }           : {}),
  };
  const next = users.filter((item) => item.userId !== userId && normalizeUsername(item.username) !== username).concat(nextUser);
  await writeJsonFile(usersPath, next);
  return publicUser(nextUser);
}

export async function authenticateUser(username, password) {
  const users = await readJsonFile(usersPath, defaultUsers);
  const normalizedUsername = normalizeUsername(username);
  const user = users.find((item) => normalizeUsername(item.username) === normalizedUsername && item.isActive !== false);
  if (!user || String(user.password || '') !== String(password || '')) return null;
  return publicUser(user);
}

export async function listProviders() {
  const all = await readJsonFile(providersPath, defaultProviders);
  return all.filter((p) => p.isActive !== false);
}

export async function saveProvider(provider) {
  const all = await readJsonFile(providersPath, defaultProviders);
  const providerId = provider.providerId || `prov-${Date.now()}`;
  const nextProvider = {
    providerId,
    rut: String(provider.rut || '').trim(),
    businessName: String(provider.businessName || '').trim(),
    serviceType: String(provider.serviceType || '').trim(),
    address: String(provider.address || '').trim(),
    phone: String(provider.phone || '').trim(),
    email: String(provider.email || '').trim(),
    contacts: Array.isArray(provider.contacts) ? provider.contacts : [],
    isActive: provider.isActive !== false,
  };
  if (!nextProvider.businessName) throw new Error('businessName es obligatorio');
  const next = all.filter((item) => item.providerId !== providerId).concat(nextProvider);
  await writeJsonFile(providersPath, next);
  return nextProvider;
}

export async function deleteProvider(providerId) {
  const all = await readJsonFile(providersPath, defaultProviders);
  const next = all.filter((p) => p.providerId !== providerId);
  await writeJsonFile(providersPath, next);
}

// ─── Órdenes de compra ────────────────────────────────────────────────────────

export async function listPurchaseOrders() {
  const all = await readJsonFile(purchaseOrdersPath, []);
  return all.filter((o) => o.isActive !== false);
}

export async function savePurchaseOrder(oc) {
  const all = await readJsonFile(purchaseOrdersPath, []);
  const purchaseOrderId = oc.purchaseOrderId || `oc-${Date.now()}`;
  const maxNum = all.reduce((max, o) => Math.max(max, Number(o.orderNumber) || 0), 0);
  const orderNumber = oc.orderNumber || (maxNum + 1);

  const next = {
    purchaseOrderId,
    orderNumber,
    documentCode: 'PG06-R2',
    requestDate: String(oc.requestDate || '').trim(),
    providerQuoteNumber: String(oc.providerQuoteNumber || '').trim(),
    providerId: String(oc.providerId || '').trim(),
    providerName: String(oc.providerName || '').trim(),
    providerRut: String(oc.providerRut || '').trim(),
    providerAddress: String(oc.providerAddress || '').trim(),
    providerPhone: String(oc.providerPhone || '').trim(),
    providerEmail: String(oc.providerEmail || '').trim(),
    contactName: String(oc.contactName || '').trim(),
    contactPhone: String(oc.contactPhone || '').trim(),
    contactEmail: String(oc.contactEmail || '').trim(),
    requestedBy: String(oc.requestedBy || '').trim(),
    authorizedBy: String(oc.authorizedBy || '').trim(),
    paymentTerms: String(oc.paymentTerms || 'CONTADO').trim(),
    advancePercent: Number(oc.advancePercent) || 0,
    advanceAmount: Number(oc.advanceAmount) || 0,
    items: Array.isArray(oc.items) ? oc.items : [],
    includesVat: oc.includesVat !== false,
    subtotal: Number(oc.subtotal) || 0,
    vat: Number(oc.vat) || 0,
    total: Number(oc.total) || 0,
    approvalStatus: String(oc.approvalStatus || 'EN PROCESO').trim(),
    extensionDate: String(oc.extensionDate || '').trim(),
    observations: String(oc.observations || '').trim(),
    isActive: oc.isActive !== false,
  };

  const remaining = all.filter((o) => o.purchaseOrderId !== purchaseOrderId);
  await writeJsonFile(purchaseOrdersPath, remaining.concat(next));
  return next;
}

// ─── Insumos ──────────────────────────────────────────────────────────────────

export async function listSupplies() {
  const all = await readJsonFile(suppliesPath, []);
  return all.filter((s) => s.isActive !== false);
}

export async function saveSupply(supply) {
  const all = await readJsonFile(suppliesPath, []);
  const supplyId = supply.supplyId || `sup-${Date.now()}`;
  const existing = all.find((s) => s.supplyId === supplyId);

  const next = {
    supplyId,
    code: String(supply.code || '').trim(),
    description: String(supply.description || '').trim(),
    category: String(supply.category || 'otro').trim(),
    unit: String(supply.unit || 'unidad').trim(),
    currentPrice: supply.currentPrice !== undefined && supply.currentPrice !== '' ? Number(supply.currentPrice) : null,
    priceHistory: Array.isArray(supply.priceHistory)
      ? supply.priceHistory
      : (existing?.priceHistory || []),
    isActive: supply.isActive !== false,
  };

  if (!next.description) throw new Error('description es obligatorio');

  const remaining = all.filter((s) => s.supplyId !== supplyId);
  await writeJsonFile(suppliesPath, remaining.concat(next));
  return next;
}
