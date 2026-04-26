# Flujo del proceso backend

Este documento complementa el flujo del frontend desde el punto de vista del servicio `laboratorio-backend`.

## Flujo de arranque

```text
npm start
  |
  v
src/app/server.mjs
  |
  +-- lee .env
  +-- configura host 127.0.0.1 y puerto 4010
  +-- prepara rutas HTTP
  +-- consulta PostgreSQL solo cuando un repositorio lo necesita
```

## Flujo de carga inicial del frontend

1. Frontend llama `POST /api/auth/login`.
2. Backend valida usuario en `administration-repository.mjs`.
3. Frontend llama endpoints base:
   - `/api/v1/document-codes`
   - `/api/v1/templates?renderableOnly=false`
   - `/api/v1/customers`
   - `/api/v1/catalogs`
   - `/api/v1/products`
   - `/api/v1/admin/laboratory`
   - `/api/v1/admin/users`
   - `/api/v1/providers`
   - `/api/v1/quotes`
   - `/api/v1/assay-records`
   - `/api/v1/domain/assay-parameters`
   - `/api/v1/domain/analytical-methods`
4. Cada repositorio intenta PostgreSQL si esta habilitado y usa fallback local cuando corresponde.

## Flujo de mantenedores

```text
Frontend formulario
  |
  v
POST /api/v1/*
  |
  v
Repositorio propietario
  |
  +-- PostgreSQL lab.* cuando PG_ENABLED=true
  +-- data/*.json como respaldo local
  |
  v
Respuesta JSON normalizada para frontend
```

## Flujo de emision documental

```text
POST /api/v1/document-render-jobs
  |
  +-- valida documentCode y documentTypeSlug
  +-- resolveTemplate(documentCode, templateSlug)
  +-- listCustomers(rut)
  +-- buildRenderBundle()
        |
        +-- buildSingleRender() por formato solicitado
        +-- renderTemplateWorkbook() si la plantilla es renderizable
        +-- buildMockRender() si opera como respuesta fallback
  +-- saveDocumentSession()
  +-- saveRenderJob()
  +-- saveIssuedDocument()
  +-- maybeSendEmail()
  |
  v
JSON con artifacts, warnings, errors y emailResult
```

## Flujo de artefactos

1. El renderer escribe archivos en `data/rendered`.
2. El backend calcula checksum SHA-256.
3. La API devuelve `downloadUrl`.
4. El frontend descarga usando `GET /api/v1/artifacts/:fileName`.

## Flujo de alta de plantilla

1. `POST /api/v1/template-intake/analyze` recibe ruta del Excel.
2. `template-intake-service.mjs` inspecciona archivo, hojas, imagenes y metadatos.
3. `POST /api/v1/template-intake/register` registra familia o variante.
4. `template-repository.mjs` deja la plantilla visible para `/api/v1/templates`.

## Puntos de control

- `/health`: confirma servicio y conectividad PostgreSQL.
- `data/rendered`: salida de documentos emitidos.
- `data/imports`: plantillas importadas o convertidas.
- `data/*.json`: respaldo local si no hay BD.
- Logs de consola: errores de rutas, render o conversion PDF.
