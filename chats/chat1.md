# Aplicación de finanzas personales

_Started 2026-10-13 00:57 UTC_

---

## User

Diseña una app  para cel que me ayude a llevar mis finanzas personales, que despues  del plan financiero mas optimo, tenga carpetas con mi dinero presupuestado a cada sector, se conecta a apple pay, targetas y todas las formas de reconocer mis gastos para categorizarlos y darme consejos, metricas y un financiero personal que me ayuda a optimizar mis planes financieros

## Assistant



## User

Answered — country: EE.UU. (USD); plan_method: Que la IA proponga según mis datos; screens: Onboarding + creación del plan, Inicio / resumen, Carpetas de presupuesto, Conectar Apple Pay / tarjetas, Asesor financiero (chat), Metas de ahorro; advisor: Chat con IA real (responde de verdad); folders_feel: Lista compacta con barras de progreso; research: Sí, y fundamenta el plan; variations: 2–3 direcciones; income: 2600

## Assistant

_[tool: ask_user]_

_[tool: list_files]_

_[tool: grep]_

_[tool: read_file]_

_[tool: dc_write]_

_[tool: read_skill_prompt]_

_[tool: web_search]_

_[tool: web_search]_

_[tool: web_search]_

_[tool: web_search]_

_[tool: web_search]_

_[tool: dc_write]_

_[tool: web_search]_

_[tool: dc_js_str_replace]_

_[tool: dc_write]_

_[tool: ready_for_verification]_

Tu app está en **Finanzas Direcciones**, con tres teléfonos interactivos uno al lado del otro:

- **1a, Carpetas primero:** muestra cuánto puedes gastar hoy y tus carpetas con barras de progreso.
- **1b, Asesor primero:** abre con un resumen diario del asesor y acciones concretas.
- **1c, Onboarding:** pide tu ingreso ($2,600 USD) y tus prioridades, calcula el plan y conecta Apple Pay y tus tarjetas.

Qué puedes hacer en las tres:
- **Carpetas:** abres cada una para ver su detalle y subes o bajas su presupuesto. La diferencia siempre sale de "Libre" o vuelve a "Libre", así que todo el ingreso queda asignado.
- **Movimientos:** tocas uno para cambiarle la carpeta, y la app lo recuerda para la próxima vez.
- **Gastos en efectivo:** los registras a mano o escaneando el ticket (el escaneo está simulado).
- **Metas:** fondo de emergencia, pagar la Amex, retiro y viaje a Japón, cada una con su fecha estimada.
- **Asesor:** responde con IA real. Conoce tus carpetas, tus metas y tu deuda, y te propone mover dinero entre carpetas con un botón "Aplicar".

Cosas a tener en cuenta:
- **Las bases del plan no están verificadas en esta sesión.** Me falló casi toda la búsqueda web; solo pude leer la documentación de Plaid. Lo del plan sale de lo que ya sé, así que conviene revisarlo antes de publicar: el 33% del ingreso que se va a vivienda en promedio (BLS), un APR de tarjeta de alrededor de 21%, pagar primero la deuda más cara, ahorrar de 3 a 6 meses de gastos esenciales y la regla 50/30/20.
- **Apple Pay tiene un límite real.** Apple solo deja leer directamente Apple Card, Apple Cash y Ahorros con Apple. Las demás tarjetas que tengas en Apple Pay se leen a través de su banco (por ejemplo, con Plaid), y así lo explica la app.
- **Las métricas y los gastos con deudas** no los pediste, así que no los incluí.

Dime cuál dirección prefieres, 1a o 1b, y la sigo puliendo.

## User

Usemos 1a, me refiero a apple pay, por q cuando compro, pago con el celu, pero con las targetas de los bancos de mi pais (la app puede leer los gastos para representarlos en la app).
cambiamos pais a Perú y moneda sol con los requerimientos peruanos Asi que puedes buescar nuevamente.
agrega Las métricas y los gastos con deudas

## Assistant

_[tool: dc_write]_

_[tool: web_search]_

_[tool: web_search]_

_[tool: web_search]_

_[tool: web_search]_

_[tool: web_search]_

_[tool: web_search]_

_[tool: web_search]_

_[tool: snip]_

_[tool: ready_for_verification]_

La versión peruana está lista en **Finanzas Perú**, sobre el diseño 1a. Se está verificando en segundo plano.

**Cómo lee tus gastos sin conexión al banco.** En Perú todavía no hay una conexión oficial entre apps y bancos: la SBS publicó el borrador del reglamento de Finanzas Abiertas el 5 de octubre. Por eso la app usa cuatro vías:
- **Apple Pay:** el iPhone tiene una automatización de Atajos que se activa cada vez que pagas con una tarjeta de Wallet, y pasa a la app el monto, el comercio y la tarjeta. Funciona con BCP, BBVA, Interbank, Scotiabank y los demás bancos peruanos compatibles. En la demo, a los 5 segundos llega un pago en vivo.
- **Correos de "consumo realizado"** de tus tarjetas, para lo que pagas con la tarjeta física o en línea.
- **Constancias de Yape y Plin** que compartes a la app.
- **Estado de cuenta en PDF** al cierre, para cuadrar cuotas, intereses y comisiones.

**Adaptado a Perú:**
- Montos en soles, con ingreso neto de S/ 2,600 (después de AFP u ONP).
- Comercios locales: Plaza Vea, Wong, Tambo+, Cabify, Luz del Sur, Cineplanet.
- La gratificación (julio y diciembre, más el 9%) y la CTS (mayo y noviembre) se planifican aparte del sueldo.

**Nueva pestaña Deudas:**
- Total que debes y fecha en que quedas libre.
- Tres formas de pagar para comparar: primero la más cara, primero la más chica, o solo el mínimo. Ves cuántos intereses pagas con cada una.
- Cada tarjeta con su TCEA, fecha de pago y compras en cuotas.
- Una lista de todo lo que cargaste a crédito este mes.

**Nueva pestaña Métricas:**
- Tasa de ahorro, deuda frente a sueldo, meses de fondo de emergencia y uso del crédito.
- Gasto de los últimos seis meses frente a tu sueldo.
- Tu gasto comparado con el hogar peruano promedio (datos del INEI 2024).
- Cuánto pagas con Apple Pay, Yape, tarjeta física y efectivo.
- Tus metas y la gratificación y CTS que vienen.

**Qué verificar:** las tarjetas, sus tasas (CMR al 92% y BBVA al 58%) y los montos de gratificación y CTS son ejemplos. Los montos se estiman a partir del sueldo neto, así que reemplázalos con tus datos reales.

## User

Found issues — fixing…

## User

Found issues — fixing…

