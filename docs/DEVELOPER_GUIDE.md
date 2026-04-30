# Guia para desarrolladores backend

Esta guia esta pensada para que una persona nueva pueda levantar, entender y modificar el backend sin depender de conocimiento oral del equipo.

## Levantar localmente

```powershell
cd C:\RODPROJECTS\laboratorio-backend
npm install
npm start
```

Verificar:

```powershell
Invoke-RestMethod http://127.0.0.1:4010/health
```

El frontend espera el backend en `http://127.0.0.1:4010`.

## Variables de entorno

Usar `.env.example` como base. No subir `.env`.

- `PORT`: puerto HTTP, por defecto `4010`.
- `PG_ENABLED`: `true` para usar PostgreSQL.
- `PGHOST`, `PGPORT`, `PGDATABASE`, `PGUSER`, `PGPASSWORD`: conexion a PostgreSQL.

## Convenciones del codigo

- Archivos runtime en `.mjs`.
- Contratos de referencia en `.ts`.
- Funciones de repositorio devuelven objetos ya normalizados para frontend.
- Los nombres publicos usan camelCase (`customerId`, `templateSlug`).
- Los nombres SQL se mapean desde snake_case (`customer_id`, `template_slug`).
- Errores de API devuelven `{ error, message }`.
- Mantener respuestas, documentacion y mensajes operativos en espanol cuando sean visibles para usuario o soporte.

## Mapa de responsabilidades

| Area | Archivo principal | Responsabilidad |
| --- | --- | --- |
| Entrada HTTP | `src/app/server.mjs` | Rutas, validacion inicial, respuesta JSON |
| Conexion BD | `src/core/database/*` | Configuracion y pool PostgreSQL |
| Administracion | `src/modules/administration/administration-repository.mjs` | Laboratorio, usuarios y proveedores |
| Clientes | `src/modules/customers/customer-repository.mjs` | Empresas, RUT normalizado y contactos embebidos |
| Contactos | `src/modules/contacts/contact-repository.mjs` | Personas de contacto por cliente |
| Catalogos | `src/modules/catalogs/catalog-repository.mjs` | Mantenedores genericos y fallback |
| Dominio analitico | `src/modules/domain/domain-repository.mjs` | Parametros de ensayo y metodos analiticos |
| Operacion | `src/modules/operations/operations-repository.mjs` | Cotizaciones, seguimientos, registros y resultados |
| Documentos PDF | `src/modules/documents/*` | PDF de ordenes de compra y firma con P12/PFX |
| Productos | `src/modules/products-groups/product-repository.mjs` | Servicios/productos sugeridos |
| Plantillas | `src/modules/document-render/template-repository.mjs` | Catalogo y resolucion |
| Alta de Excel | `src/modules/document-render/template-intake-service.mjs` | Analisis, conversion y registro |
| Render | `src/modules/document-render/xlsx-renderer.mjs` | Escritura XLSX/PDF por familia |
| Sesiones | `src/modules/document-sessions/document-session-repository.mjs` | Borradores y trazabilidad |
| Entrega | `src/modules/delivery/*` | Email y registro de envio |

## Contrato de render

El endpoint principal es `POST /api/v1/document-render-jobs`.

Campos minimos:

```json
{
  "documentTypeSlug": "cotizacion",
  "documentCode": "PG04-R1/26",
  "templateSlug": "tpl-pg04-r5-cotizacion",
  "outputFormat": "pdf",
  "context": {
    "customerId": "cli-001",
    "timezone": "America/Santiago"
  },
  "fieldValues": {
    "document_number": "260422-120000",
    "cliente_nombre": "Empresa Demo",
    "fecha_emision": "2026-04-22"
  },
  "repeatSections": {
    "pg04-detalle-parametros": []
  },
  "metadata": {
    "outputFormats": ["pdf", "xlsx"]
  }
}
```

Respuesta esperada:

```json
{
  "renderJobId": "rj-...",
  "sessionId": "ses-...",
  "templateSlug": "tpl-pg04-r5-cotizacion",
  "status": "rendered",
  "artifact": {
    "format": "pdf",
    "fileName": "...pdf",
    "downloadUrl": "/api/v1/artifacts/...pdf"
  },
  "warnings": [],
  "emailResult": {
    "sent": false
  }
}
```

## Agregar un mantenedor

1. Agregar el tipo en `fallbackCatalogs` de `catalog-repository.mjs`.
2. Si debe aparecer en el frontend legacy, agregarlo tambien en `compatCatalogDefinitions` de `server.mjs`.
3. Consumirlo desde el frontend con `GET /api/v1/catalogs?catalogType=...`.
4. Guardarlo con `POST /api/v1/catalogs`.

Si el mantenedor necesita metadata propia, no conviene forzarlo al catalogo generico. En ese caso se debe crear un modulo dedicado, como ya ocurre con:

- `domain-repository.mjs` para metodos y parametros
- `operations-repository.mjs` para cotizaciones y registros

## Nuevas rutas transaccionales

- `POST /api/auth/login`
- `GET/POST /api/v1/admin/laboratory`
- `GET/POST /api/v1/admin/users`
- `GET/POST /api/v1/providers`
- `GET/POST /api/v1/quotes`
- `DELETE /api/v1/quotes/:quoteId`
- `GET/POST /api/v1/quotes/:quoteId/follow-ups`
- `GET/POST /api/v1/assay-records`
- `DELETE /api/v1/assay-records/:assayRecordId`
- `GET/POST /api/v1/assay-records/:assayRecordId/results`
- `POST /api/v1/purchase-orders/signed-pdf`
- `GET/POST /api/v1/domain/assay-parameters`
- `GET/POST /api/v1/domain/analytical-methods`

Estas rutas siguen el mismo patron del proyecto:

1. intentan PostgreSQL
2. si la BD no responde, usan JSON fallback en `data/`
3. devuelven objetos ya listos para frontend

## Agregar una plantilla o familia

Opcion A: desde UI

1. Activar "Nueva familia" en el workbench.
2. Informar ruta del Excel.
3. Analizar plantilla.
4. Registrar familia o variante.

Opcion B: por codigo

1. Agregar metadata en `familyMetaMap`.
2. Agregar seed en `seedTemplates`.
3. Implementar render si es necesario en `xlsx-renderer.mjs`.
4. Probar `GET /api/v1/templates?renderableOnly=false`.

## Agregar un render especifico

1. Crear funcion `renderMiFamilia(sheet, payload)` en `xlsx-renderer.mjs`.
2. Mapear celdas fijas con `applyHeaderCommon()`.
3. Leer filas desde `payload.repeatSections`.
4. Usar `writeNumeric()` para celdas numericas.
5. Agregar la familia en el switch/selector interno del renderer.
6. Ejecutar un render real y descargar el XLSX/PDF.

## Persistencia y fallback

El patron de repositorios es:

1. Intentar SQL con `query(...)`.
2. Si PostgreSQL esta desactivado o falla, devolver seeds o JSON local.
3. En operaciones de escritura, usar `data/*.json` si no hay BD.

Esto es util para desarrollo, pero en produccion se debe operar con PostgreSQL activo.

## Clientes extendidos

El frontend puede enviar empresas con `serviceType`, `address`, `phone`, `email` y un contacto principal. PostgreSQL debe tener columnas equivalentes en `lab.customer` para persistir esos campos; si no existen, el repositorio puede continuar con fallback local, pero los datos no quedan garantizados al reiniciar.

El RUT puede venir vacio para permitir carga inicial de empresas incompletas. La base debe aceptar `normalized_rut` y `display_rut` nulos, o el alta caera al fallback.

## Usuarios extendidos

`src/modules/administration/administration-repository.mjs` mantiene usuarios de sistema con datos de cuenta, permisos y perfil. Los campos operativos de perfil son `email`, `position`, `departmentKey` y `profileColor`.

Los departamentos no deben quedar hardcodeados en la vista. Se exponen como catalogo generico `user_department`, con valores base `ADM`, `CT`, `MICROBIOLOGIA`, `MUESTREO`, `QUIMICA` y `OTRO`, ampliables desde el mantenedor de catalogos.

## Firma PDF de ordenes de compra

El flujo de firma usa un certificado `.p12/.pfx` guardado en el usuario como `certificateP12Base64`. El endpoint `POST /api/v1/purchase-orders/signed-pdf` recibe `purchaseOrderId`, `userId` y `password`, genera el PDF de la OC y devuelve `application/pdf`.

No versionar certificados, backups ni archivos con passwords. Revisar especialmente `data/backups/`, `data/laboratory-users.json`, `.env` y extensiones `.p12/.pfx`.

## Checklist antes de subir cambios

- `git status --short` para revisar archivos modificados.
- `node --check src/app/server.mjs` si se toca el servidor.
- `node --check src/modules/...` si se toca un modulo `.mjs`.
- Render manual con al menos una plantilla afectada.
- Confirmar que `data/rendered`, `data/imports`, `.env` y `node_modules` no queden staged.
- Confirmar que `data/backups`, certificados `.p12/.pfx` y archivos con passwords no queden staged.

## Bitacora de desarrollo

### 2026-04-30

- Se documentan clientes extendidos, eliminacion real de cotizaciones/registros BAC y firma PDF de ordenes de compra.
- Se agrega criterio explicito para no versionar backups locales, certificados ni archivos con passwords.

### 2026-04-26

- Se documento el flujo operativo completo frontend-backend.
- Se consolido la vista actual de administracion, dominio analitico, cotizaciones y registros BAC.
- Se deja constancia de que el frontend activo vive en `src/main.js`, mientras la estructura modular sigue como destino de refactor.

### 2026-04-23

- Se retomo el backend junto al frontend operativo.
- Se confirmo que el backend debe permanecer disponible en `http://127.0.0.1:4010`.
- Se documento el criterio de idioma y continuidad para nuevas rutas, errores y contratos JSON.
