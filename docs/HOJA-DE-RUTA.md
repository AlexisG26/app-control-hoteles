# Hoja de ruta

## Listo en la versión 1

- Usuarios por correo con roles por hotel; huella o Face ID.
- Recepción: entradas por noche y por hora, extensiones, salidas, caja del día, órdenes de compra.
- Salida automática a la hora de salida del hotel y aviso push a limpieza.
- Limpieza: empezar y terminar; reportar problemas con foto.
- Contabilidad semanal, por recepcionista, órdenes de compra con avisos a 15 y 30 días, CSV.
- Panel global del dueño. Servidor MCP para Claude.
- Envío de avisos por Telegram si se configura `TELEGRAM_BOT_TOKEN` y el chat de cada usuario.

## Siguiente: Telegram completo

Hoy ya se pueden enviar avisos por Telegram: el dueño escribe el número de chat de cada persona en **Usuarios**. Falta:

1. **Vincular sin escribir números**: la persona abre el bot, toca *Iniciar* y la app la reconoce con un código de un solo uso.
2. **Responder desde Telegram**: botones "Empezar limpieza" y "Terminé" dentro del mensaje.
3. **Resumen diario** al dueño a las 8:00 p. m.: ocupación, caja del día y pendientes.

Pasos técnicos: crear el bot con @BotFather, agregar el secreto `TELEGRAM_BOT_TOKEN`, y una ruta `/telegram/webhook` en el Worker que valide el `secret_token` de Telegram.

## Delegación de tareas

Tabla de tareas con responsable, hotel, área (finanzas, contabilidad, operación, administración), fecha límite y estado. El dueño las asigna desde la app o desde Telegram; cada persona recibe aviso y las marca como hechas. Recordatorio automático el día del vencimiento.

## Otras ideas

- **Reservas futuras**: bloquear una habitación para una fecha y avisar a recepción el día de llegada.
- **Gastos**: registrar compras y pagos para tener utilidad, no solo ingresos.
- **Cierre de caja por turno** con firma de quien entrega y quien recibe.
- **Reporte mensual en PDF** para el contador.
- **Inventario de limpieza** (sábanas, toallas, productos) con alertas de reposición.
- **Agente de Claude programado**: un análisis semanal automático enviado al dueño los lunes.
