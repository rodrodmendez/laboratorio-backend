# Alineacion del Modelo de Datos

Este documento aterriza el script funcional levantado desde cotizaciones y BAC a la estructura real del backend actual.

## Idea central

El backend ya opera con tres estilos de persistencia:

1. Catalogos genericos en `lab.maintainer_catalog_entry`
2. Entidades operativas con tabla propia, por ejemplo `lab.customer`, `lab.contact_person`, `lab.service_product_catalog`
3. Fallback local en JSON cuando PostgreSQL no esta disponible

Por eso la integracion no conviene hacerse creando todo de cero con nombres nuevos, sino mapeando cada grupo al lugar correcto.

## Mapeo recomendado

| Modelo levantado | Integracion actual |
| --- | --- |
| `estado_cotizacion` | `catalogType = quote_status` |
| `tipo_analisis` | `catalogType = analysis_package` |
| `unidad_medida` | `catalogType = unit` |
| `tipo_muestra` | `catalogType = sample_type` |
| `preservante` | `catalogType = preservative` |
| `tipo_muestreo` | `catalogType = sampling_type` |
| `acreditacion` | `catalogType = accreditation_scope` |
| `tipo_documento` | `catalogType = business_document_type` |
| `canal_ingreso` | `catalogType = intake_channel` |
| `cliente` | `lab.customer` |
| contactos de cliente | `lab.contact_person` |
| `tipo_ensayo` entendido como parametro analitico | `lab.assay_parameter_catalog` |
| `metodo_analitico` | `lab.analytical_method_catalog` |

## Lo que ya se agrego

- Migracion base: [migrations/2026-04-24-domain-maintainers-foundation.sql](C:/RODPROJECTS/laboratorio-backend/migrations/2026-04-24-domain-maintainers-foundation.sql)
- Migracion transaccional: [migrations/2026-04-26-operations-transaction-foundation.sql](C:/RODPROJECTS/laboratorio-backend/migrations/2026-04-26-operations-transaction-foundation.sql)
- Repositorio de dominio:
  - [src/modules/domain/domain-repository.mjs](C:/RODPROJECTS/laboratorio-backend/src/modules/domain/domain-repository.mjs)
- Repositorio operacional:
  - [src/modules/operations/operations-repository.mjs](C:/RODPROJECTS/laboratorio-backend/src/modules/operations/operations-repository.mjs)
- Endpoints nuevos:
  - `GET/POST /api/v1/domain/assay-parameters`
  - `GET/POST /api/v1/domain/analytical-methods`
  - `GET/POST /api/v1/quotes`
  - `GET/POST /api/v1/quotes/:quoteId/follow-ups`
  - `GET/POST /api/v1/assay-records`
  - `GET/POST /api/v1/assay-records/:assayRecordId/results`

## Siguiente capa sugerida

1. Pasar `administration` desde JSON a PostgreSQL.
2. Crear mantenedores visuales en frontend para:
   - estados de cotizacion
   - paquetes de analisis
   - tipos de muestra
   - preservantes
   - tipos de muestreo
   - acreditaciones
   - metodos analiticos
   - parametros de ensayo
3. Modelar negocio transaccional:
   - cotizacion
   - cotizacion_seguimiento
   - registro_ensayo
   - resultado_ensayo

## Criterio

Si un grupo solo necesita `clave + nombre + activo`, va al mantenedor generico.

Si necesita mas metadata propia, va en tabla dedicada.
