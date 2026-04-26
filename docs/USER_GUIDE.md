# Guia de usuario backend

Esta guia explica el rol operativo del backend para personas que administran o dan soporte al sistema.

## Servicio local

El backend debe estar iniciado antes de usar el frontend.

```powershell
cd C:\RODPROJECTS\laboratorio-backend
npm start
```

La API queda disponible en `http://127.0.0.1:4010`.

## Verificacion rapida

```powershell
Invoke-RestMethod http://127.0.0.1:4010/health
```

Una respuesta correcta confirma que el servicio esta activo. Si PostgreSQL esta desactivado o no responde, varios modulos usan datos locales de respaldo.

## Funciones que entrega al frontend

- Autenticacion local para ingreso inicial.
- Perfil del laboratorio, usuarios y proveedores.
- Plantillas y tipos documentales.
- Empresas, contactos, catalogos y productos.
- Cotizaciones, seguimientos, registros BAC y resultados analiticos.
- Parametros de ensayo y metodos analiticos.
- Regionalizacion chilena para completar ubicaciones.
- Registro de temporales y sesiones documentales.
- Generacion de XLSX/PDF/JSON.
- Descarga de artefactos emitidos.
- Envio de correo cuando el payload lo solicita.

## Archivos importantes para soporte

- `data/rendered`: documentos generados.
- `data/imports`: plantillas importadas.
- `data/*.json`: persistencia local cuando no se usa PostgreSQL.
- `.env`: configuracion local, no debe compartirse ni subirse al repositorio.

## Recomendaciones operativas

- Mantener LibreOffice instalado si se requiere conversion PDF.
- Revisar `/health` cuando el frontend no cargue datos.
- No borrar archivos de `data/rendered` si se requiere trazabilidad de documentos emitidos.
- Registrar en la documentacion cualquier nuevo endpoint consumido por el frontend.
- Revisar `docs/PROCESS_FLOW.md` cuando se necesite explicar el ciclo completo desde ingreso hasta artefacto emitido.
