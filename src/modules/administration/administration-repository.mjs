import { join } from 'node:path';
import { readJsonFile, writeJsonFile } from '../../shared/store/json-file-store.mjs';

const labProfilePath = join(process.cwd(), 'data', 'laboratory-profile.json');
const usersPath = join(process.cwd(), 'data', 'laboratory-users.json');
const providersPath = join(process.cwd(), 'data', 'providers.json');

const defaultLabProfile = {
  laboratoryId: 'lab-carlos-latorre',
  businessName: 'Laboratorio Carlos Latorre S.A.',
  rut: '96.712.790-6',
  address: 'Jose Manuel Infante 620, Providencia, Santiago',
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
  const { password, ...safeUser } = user;
  return safeUser;
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
  const nextUser = {
    userId,
    username,
    password: user.password || users.find((item) => item.userId === userId)?.password || username,
    fullName: String(user.fullName || username).trim(),
    role: user.role === 'admin' ? 'admin' : 'operator',
    isActive: user.isActive !== false,
    permissions: Array.isArray(user.permissions) ? user.permissions : [],
    access: Array.isArray(user.access) ? user.access : [],
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
  return readJsonFile(providersPath, defaultProviders);
}

export async function saveProvider(provider) {
  const providers = await listProviders();
  const providerId = provider.providerId || `prov-${Date.now()}`;
  const nextProvider = {
    providerId,
    rut: String(provider.rut || '').trim(),
    businessName: String(provider.businessName || '').trim(),
    serviceType: String(provider.serviceType || '').trim(),
    contacts: Array.isArray(provider.contacts) ? provider.contacts.slice(0, 3) : [],
    isActive: provider.isActive !== false,
  };
  if (!nextProvider.businessName) throw new Error('businessName es obligatorio');
  const next = providers.filter((item) => item.providerId !== providerId).concat(nextProvider);
  await writeJsonFile(providersPath, next);
  return nextProvider;
}
