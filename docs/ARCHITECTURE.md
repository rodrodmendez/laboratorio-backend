# Arquitectura backend

Este backend es el servicio operativo del sistema documental del laboratorio. Expone una API HTTP local, mantiene catalogos y clientes, resuelve plantillas oficiales, genera artefactos XLSX/PDF y registra sesiones, trabajos de render y documentos emitidos.

## Vista general

```text
Frontend vanilla JS
  |
  | HTTP JSON /api/v1/*
  v
src/app/server.mjs
  |
  +-- customers / contacts / catalogs / products
  +-- auth / administration / providers
  +-- quotes / assay-records / domain catalogs
  +-- purchase-orders / documents / pdf-signing
  +-- document-sessions
  +-- document-render
  +-- delivery
  |
  v
PostgreSQL lab.* si PG_ENABLED=true
  |
  +-- fallback JSON / seeds cuando la BD no esta disponible
```

## Tecnologia aplicada

- Runtime: Node.js con modulos ES (`type: module`).
- HTTP: servidor nativo `node:http`, sin framework externo.
- Base de datos: PostgreSQL via `pg`, activable con `PG_ENABLED=true`.
- Excel: `xlsx-populate` para escribir plantillas oficiales.
- PDF: LibreOffice headless (`soffice.exe`) para convertir XLSX a PDF.
- PDF especifico: `pdf-lib` para construir ordenes de compra en PDF.
- Firma PDF: `@signpdf/*` y certificado `.p12/.pfx` asociado al usuario.
- Archivos auxiliares: `adm-zip` para inspeccionar assets de plantillas XLSX.
- Email: `nodemailer` en `src/modules/delivery/mailer-service.mjs`.

## Estructura de carpetas

```text
src/app/
  server.mjs                  Entrada HTTP, rutas y orquestacion.

src/core/database/
  config.mjs                  Lectura de variables PG_*.
  pg-client.mjs               Pool PostgreSQL lazy y helper query().

src/core/types/
  render-contracts.ts         Contratos TypeScript de referencia.

src/modules/
  administration/             Perfil del laboratorio, usuarios y proveedores.
  catalogs/                   Mantenedores genericos.
  contacts/                   Contactos por empresa.
  customers/                  Empresas/clientes.
  delivery/                   Envio email y registro de entregas.
  domain/                     Metodos analiticos y parametros de ensayo.
  documents/                  PDF de ordenes de compra y firma digital.
  document-render/            Plantillas, render, artefactos emitidos.
  document-sessions/          Sesiones documentales.
  locations/                  Regionalizacion chilena para campos dependientes.
  operations/                 Cotizaciones, seguimientos y registros de ensayo.
  products-groups/            Productos/servicios sugeridos.
  temporals/                  Perfiles temporales de trabajo.

src/shared/
  formatters/                 Formateo de fechas, UF y filas tecnicas.
  store/                      Persistencia JSON de respaldo.

data/
  imports/                    Plantillas importadas/convertidas.
  rendered/                   XLSX/PDF generados.
  *.json                      Persistencia fallback cuando no hay BD.

migrations/
  *.xls                       Plantillas historicas o base.

tools/
  audit-families.mjs          Utilidad de auditoria de familias.
```

## Configuracion

El backend se configura con `.env`.

```env
PORT=4010
PG_ENABLED=true
PGHOST=127.0.0.1
PGPORT=5434
PGDATABASE=laboratorio_catalog
PGUSER=laboratorio_app
PGPASSWORD=...
```

Si `PG_ENABLED=false` o la consulta a PostgreSQL falla, varios repositorios usan semillas o archivos JSON en `data/`. Esto permite desarrollar y probar sin bloquearse por la base de datos.

## Criterios de idioma y contrato

- Las rutas mantienen contratos JSON simples para que el frontend pueda mostrar mensajes en espanol.
- Los nombres publicos del API usan camelCase y deben mantenerse estables.
- Los mensajes nuevos de error deben incluir `message` claro y util para operadores o soporte.
- La documentacion tecnica, de desarrollo y de usuario se mantiene en espanol para continuidad del proyecto.

## Proceso HTTP

`src/app/server.mjs` concentra las rutas. Cada request se evalua por metodo y path:

- `GET /health`: estado del servicio y conectividad PostgreSQL.
- `POST /api/auth/login`: autenticacion local para el frontend.
- `GET/POST /api/v1/admin/laboratory`: perfil administrativo del laboratorio.
- `GET/POST /api/v1/admin/users`: usuarios, roles y permisos iniciales.
- `GET/POST /api/v1/catalogs?catalogType=user_department`: departamentos para usuarios de sistema.
- `GET/POST /api/v1/providers`: proveedores.
- `GET /api/v1/document-types`: tipos documentales.
- `GET /api/v1/document-codes`: codigos disponibles segun plantillas.
- `GET /api/v1/chile-regionalization`: arbol completo region > provincia > comuna/localidad.
- `GET /api/v1/chile-regionalization/regions`: regiones ordenadas segun Chile.
- `GET /api/v1/chile-regionalization/provinces`: provincias filtrables por region.
- `GET /api/v1/chile-regionalization/communes`: candidatas de comuna por region/provincia.
- `GET /api/v1/chile-regionalization/places`: ciudades/localidades/sectores por region/provincia.
- `GET /api/v1/templates`: catalogo de plantillas.
- `GET /api/v1/templates/resolve`: resolucion por codigo o slug.
- `GET/POST /api/v1/customers`: empresas.
- `GET/POST /api/v1/contacts`: contactos.
- `GET/POST /api/v1/catalogs`: mantenedores.
- `GET/POST /api/v1/domain/assay-parameters`: parametros o tipos de ensayo.
- `GET/POST /api/v1/domain/analytical-methods`: metodos y normas analiticas.
- `GET/POST /api/v1/quotes`: cotizaciones y cabecera comercial.
- `DELETE /api/v1/quotes/:quoteId`: eliminacion de cotizacion con dependencias operativas.
- `GET/POST /api/v1/quotes/:quoteId/follow-ups`: seguimientos comerciales.
- `GET/POST /api/v1/assay-records`: cabecera de registros BAC / informes.
- `DELETE /api/v1/assay-records/:assayRecordId`: eliminacion de registro BAC con resultados/preservantes.
- `GET/POST /api/v1/assay-records/:assayRecordId/results`: resultados analiticos.
- `POST /api/v1/purchase-orders/signed-pdf`: genera PDF de OC y lo firma con certificado del usuario.
- `GET/POST /api/v1/products`: productos o servicios.
- `POST /api/v1/template-intake/analyze`: analiza un Excel nuevo.
- `POST /api/v1/template-intake/register`: registra familia o variante.
- `GET/POST/DELETE /api/v1/temporals`: borradores temporales.
- `POST /api/v1/document-sessions`: guarda una sesion documental.
- `POST /api/v1/document-render-jobs`: emite artefactos.
- `GET /api/v1/artifacts/:fileName`: descarga artefactos generados.

Tambien existen rutas de compatibilidad `/api/catalogs` y `/api/documents/*` para pantallas o integraciones previas.

## Flujo de render

```text
1. Frontend envia POST /api/v1/document-render-jobs
2. server.mjs valida documentCode y documentTypeSlug
3. resolveTemplate() busca plantilla por templateSlug o documentCode
4. listCustomers() resuelve empresa/contacto si aplica
5. buildRenderBundle() decide formatos solicitados
6. renderTemplateWorkbook() abre XLSX oficial y escribe celdas
7. LibreOffice convierte a PDF cuando outputFormat=pdf
8. saveDocumentSession(), saveRenderJob() y saveIssuedDocument() registran trazabilidad
9. maybeSendEmail() envia correo si el payload lo pide
10. La API devuelve metadata, warnings y downloadUrl
```

## Estados principales

- Documento temporal: el frontend usa numeros `TMP-*` mientras el operador trabaja.
- Documento emitido: al renderizar, el frontend asigna un numero definitivo.
- Sesion documental: `draft` al guardar trabajo; `rendered` al emitir.
- Plantilla: `active`, `isRenderable`, `templateMode=master|variant`.
- Catalogo: entradas activas/inactivas por `catalogType`.
- Render job: estado `rendered` con request, resultado y artefactos.
- Email: `sent`, `pending` o no solicitado.

## Artefactos

- Entrada de plantillas: `data/imports/`.
- Salida renderizada: `data/rendered/`.
- PDF firmado de OC: respuesta directa `application/pdf` desde `/api/v1/purchase-orders/signed-pdf`.
- Descarga publica: `/api/v1/artifacts/:fileName`.
- Checksums: se calcula SHA-256 para controlar trazabilidad de archivos fuente y emitidos.

## Funciones especiales

- `resolveTemplatePath()` acepta rutas absolutas, rutas relativas historicas y archivos importados. Esto evita romper renders cuando una plantilla viene de migracion, importacion o ruta legacy.
- `template-intake-service.mjs` puede convertir `.xls` a `.xlsx`, inspeccionar hojas e imagenes embebidas y registrar una nueva familia/variante.
- `xlsx-renderer.mjs` contiene funciones de render por familia documental, por ejemplo PG04, FAS, piscina y arrastre de arena.
- `locations/chile-regionalization-repository.mjs` normaliza `data/RegionalizaciónActualizada.xlsx` y mantiene cache en memoria para poblar selects dependientes sin requerir PostgreSQL.
- `operations/operations-repository.mjs` agrega una capa transaccional compatible con el backend actual para cotizaciones, seguimientos, registros de ensayo y resultados.
- `documents/oc-pdf-generator.mjs` construye una orden de compra en PDF desde datos persistidos y perfil del laboratorio.
- `documents/pdf-signer.mjs` agrega placeholder de firma y firma con certificado P12/PFX cargado por usuario.
- Los repositorios intentan PostgreSQL primero y hacen fallback a datos locales para mantener continuidad de desarrollo.

## Como agregar una funcionalidad

1. Identificar el modulo propietario en `src/modules/`.
2. Agregar o extender el repositorio si hay persistencia.
3. Exponer una ruta en `src/app/server.mjs` si el frontend necesita consumirlo.
4. Mantener el contrato JSON simple y explicito.
5. Agregar fallback cuando la funcionalidad debe operar sin BD.
6. Probar con `npm start` y, si aplica, renderizar un documento real.

## Riesgos conocidos

- `server.mjs` concentra muchas rutas; si crece mucho conviene separar handlers por modulo.
- Las rutas de plantillas dependen de ubicaciones Windows historicas y de `data/imports`.
- La conversion PDF depende de LibreOffice instalado en la ruta configurada.
- Algunos datos pueden existir solo en semillas/fallback si PostgreSQL no esta activo.
- Los backups locales y certificados contienen informacion sensible; deben mantenerse fuera de Git.
- Los campos extendidos de cliente requieren columnas compatibles en PostgreSQL para no depender del fallback en memoria.

## Observaciones de continuidad

- 2026-04-23: se retoma el backend como fuente de API para frontend Vite en `C:\RODPROJECTS\laboratorio-frontend`.
- Mantener el backend en `http://127.0.0.1:4010` mientras no exista configuracion centralizada de ambientes.
- Toda mejora visual del frontend que requiera datos nuevos debe quedar reflejada aqui como contrato de API.
