# Consultar los hoteles desde Claude (MCP)

La API incluye un servidor MCP de **solo lectura**. Con él, Claude puede consultar los datos de los hoteles para hacer análisis más profundos: comparar semanas, detectar días flojos, revisar órdenes de compra atrasadas o resumir problemas de mantenimiento.

## Conectar

1. En la app: **Ajustes → Conexión con Claude → Crear token para Claude**. Copia la dirección que aparece; tiene esta forma:
   `https://control-hoteles-api.tu-cuenta.workers.dev/mcp/ch_xxxxxxxx`
2. En Claude: **Configuración → Conectores → Agregar conector personalizado**, y pega esa dirección.
3. Prueba preguntando: *"Usa Control de Hoteles y dame el resumen de hoy."*

Para Claude Code o Claude Desktop también puedes usar la dirección `/mcp` y enviar el token en la cabecera `Authorization: Bearer ch_xxxxxxxx`.

**El token da acceso a todos los datos del dueño.** No lo compartas. Si se filtra, revócalo en Ajustes y crea otro.

## Herramientas disponibles

| Herramienta | Qué devuelve |
|---|---|
| `resumen_hoteles` | Habitaciones por estado, ingresos de hoy/semana/mes, problemas y órdenes de compra con aviso, por hotel y en total. |
| `estado_habitaciones` | Cada habitación de un hotel con huésped, fecha de salida e incidencias. |
| `estado_financiero` | Total, promedio diario, ocupación en noches y desglose por día, forma de pago, tipo y recepcionista para un rango de fechas. |
| `movimientos` | Cada cobro y anulación de un rango de fechas. |
| `ordenes_compra_pendientes` | Órdenes sin cobrar con días transcurridos y estado. |
| `incidencias` | Problemas reportados, abiertos o resueltos. |

## Preguntas de ejemplo

- ¿Cuál fue la ocupación de ProKinto en octubre y qué días tuvo menos ingresos?
- Compara las ventas por forma de pago de Prado Alto entre esta semana y la anterior.
- ¿Qué órdenes de compra llevan más de 15 días sin facturar?
- ¿Qué habitaciones han tenido más problemas de mantenimiento este mes?
