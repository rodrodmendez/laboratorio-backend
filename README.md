# laboratorio-backend

Backend operativo para el sistema documental del laboratorio. Expone la API local, mantiene clientes/catalogos/productos, resuelve plantillas oficiales y genera artefactos XLSX/PDF. Tambien soporta operaciones comerciales/BAC, ordenes de compra y firma PDF con certificado cargado por usuario.

## Ejecucion rapida

```powershell
cd C:\RODPROJECTS\laboratorio-backend
npm install
npm start
```

Probar salud:

```powershell
Invoke-RestMethod http://127.0.0.1:4010/health
```

## Configuracion

Copiar `.env.example` a `.env` y ajustar:

- `PORT=4010`
- `PG_ENABLED=true`
- `PGHOST=127.0.0.1`
- `PGPORT=5434`
- `PGDATABASE=laboratorio_catalog`
- `PGUSER=laboratorio_app`
- `PGPASSWORD=...`

## Documentacion

- [Arquitectura backend](docs/ARCHITECTURE.md)
- [Guia para desarrolladores](docs/DEVELOPER_GUIDE.md)
- [Guia de usuario](docs/USER_GUIDE.md)
- [Alineacion del modelo de datos](docs/DOMAIN_MODEL_ALIGNMENT.md)
- [Flujo del proceso](docs/PROCESS_FLOW.md)

## Componentes principales

- `src/app/server.mjs`: rutas HTTP y orquestacion.
- `src/core/database`: configuracion y conexion PostgreSQL.
- `src/modules/document-render`: plantillas, intake, render y artefactos.
- `src/modules/administration`: laboratorio, usuarios, autenticacion local y proveedores.
- `src/modules/documents`: generacion PDF especifica y firma de ordenes de compra.
- `src/modules/operations`: cotizaciones, seguimientos, registros BAC y resultados.
- `src/modules/domain`: parametros de ensayo y metodos analiticos.
- `src/modules/catalogs`: mantenedores reutilizables.
- `src/modules/customers` y `src/modules/contacts`: empresas y contactos.
- `src/modules/products-groups`: productos/servicios sugeridos.
- `src/modules/locations`: regionalizacion chilena cargada desde `data/RegionalizaciónActualizada.xlsx`.
- `src/modules/delivery`: envio por email.

## Cambios operativos recientes

- Empresas admiten datos extendidos: rubro, direccion, telefono, email y contacto principal.
- Usuarios admiten datos extendidos: email, cargo, departamento y color de perfil.
- Departamentos de usuario se manejan como catalogo `user_department`.
- Contactos admiten metadatos de origen y funcion para distinguir principal/generico de contactos adicionales.
- Cotizaciones y registros BAC exponen eliminacion real mediante `DELETE /api/v1/quotes/:quoteId` y `DELETE /api/v1/assay-records/:assayRecordId`.
- Ordenes de compra pueden generar PDF firmado mediante `POST /api/v1/purchase-orders/signed-pdf` cuando el usuario tiene certificado `.p12/.pfx` cargado.
- Los backups locales, certificados y archivos generados son datos sensibles u operativos; no deben versionarse.

## Regionalizacion chilena

La data del archivo `data/RegionalizaciónActualizada.xlsx` queda disponible para formularios que necesiten completar region, provincia, comuna, ciudad, localidad o sector.

```powershell
Invoke-RestMethod http://127.0.0.1:4010/api/v1/chile-regionalization/regions
Invoke-RestMethod "http://127.0.0.1:4010/api/v1/chile-regionalization/provinces?regionId=RM"
Invoke-RestMethod "http://127.0.0.1:4010/api/v1/chile-regionalization/communes?regionId=XV&provinceId=Arica"
Invoke-RestMethod "http://127.0.0.1:4010/api/v1/chile-regionalization/places?regionId=RM&q=Pirque"
```

Para obtener la estructura completa usar `GET /api/v1/chile-regionalization`.

## Artefactos locales

- `data/imports`: plantillas importadas o convertidas.
- `data/rendered`: documentos generados.
- `data/*.json`: persistencia fallback si la BD no esta disponible.
- `data/backups`: respaldos locales con potenciales usuarios, passwords o certificados.

Estos archivos no deben subirse al repositorio.
