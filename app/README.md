# Finanzas Perú

**App:** <https://cuchimiau.github.io/finanzas-peru/> (ábrela en Safari y elige *Añadir a pantalla de inicio*).

Una app para tu iPhone que reparte tu sueldo en carpetas (presupuesto base cero) y registra los pagos que haces con Apple Pay. También incluye un plan para salir de tus deudas de tarjeta, métricas y un asesor con IA (Gemini). Tus datos se guardan en tu Google Drive, en la carpeta **Finanzas Perú**.

## Cómo funciona

```
iPhone · app instalada (GitHub Pages)  ──►  Apps Script en TU cuenta de Google
  guarda una copia en el teléfono           ├─ Drive › Finanzas Perú › datos.json + hoja "Movimientos"
  (abre sin señal)                          ├─ Gemini (tu clave queda en el script, no en el teléfono)
Atajos: Siri · Wallet · Yape ──────────►  └─ bandeja.json (pagos de Apple Pay pendientes)
```

En iPhone, una app instalada en la pantalla de inicio no puede iniciar sesión con Google de forma confiable. Por eso la app no inicia sesión: habla con un Apps Script que corre en tu propia cuenta y se protege con un código secreto.

## Instalación (una sola vez, unos 15 minutos)

### 1. Clave de Gemini
1. Entra a <https://aistudio.google.com/apikey> y crea una clave.
2. **Recomendado:** activa la facturación del proyecto. En el plan gratuito, Google puede usar y revisar tus consultas, y estas incluyen tus montos. Con facturación no las usa, y el uso de esta app cuesta céntimos al mes.

### 2. Apps Script (conviene hacerlo en una computadora)
1. Entra a <https://script.google.com> y crea un **Proyecto nuevo**. Ponle de nombre "Finanzas Perú".
2. Borra el contenido de `Código.gs` y pega todo el contenido de [`apps-script/Code.gs`](apps-script/Code.gs). También hay una copia en tu carpeta de Drive "Finanzas Perú".
3. Entra a ⚙️ **Configuración del proyecto** › **Propiedades del script** › **Agregar propiedad**: `GEMINI_API_KEY` = tu clave.
4. Elige **Implementar** › **Nueva implementación** › tipo **Aplicación web**, con **Ejecutar como: Yo** y **Quién tiene acceso: Cualquier persona**. Luego toca **Implementar** y autoriza el acceso. Google mostrará "Google no verificó esta app": entra a *Configuración avanzada* › *Ir a Finanzas Perú*. Es tu propio script.
5. En el editor, elige la función **`configurar`** y presiona **Ejecutar**. En el registro aparece:
   - ✅ la carpeta de Drive y la prueba de Gemini;
   - 📱 el **código de conexión** (empieza con `FP1.`). Cópialo; por ejemplo, mándatelo por Notas o WhatsApp.

> **Para actualizar el script después:** entra a Implementar › Administrar implementaciones › ✏️ › Versión: **Nueva versión**. Así la URL no cambia.
> **Si compartiste el código por error:** ejecuta `rotarSecreto()` y vuelve a conectar la app y el Atajo.

### 3. La app en tu iPhone
1. Abre en **Safari** <https://cuchimiau.github.io/finanzas-peru/>.
2. Toca **Compartir** › **Añadir a pantalla de inicio**.
3. Abre la app desde el ícono, crea tu plan con tu nombre, sueldo y tarjetas, y pega el **código de conexión** en el último paso. También puedes pegarlo después en **Ajustes**.
4. Si cambias de teléfono o reinstalas la app, pega el mismo código y tus datos vuelven desde Drive.

### 4. Registrar gastos con Siri (Atajo, sirve para cualquier iPhone)
1. Pega en script.google.com la versión nueva de `Code.gs` (Implementar › Administrar implementaciones › ✏️ › Nueva versión).
2. En la app, entra a **Ajustes › Registrar gastos con Siri** y toca **Copiar URL del Atajo**.
3. **Con Siri (Apple Intelligence):** toca **Copiar** en *Prompt para Siri*, abre Atajos › **+** y pídele a Siri que lo cree con ese texto. Después revisa que la URL de "Obtener contenido de URL" termine en `&a=voz&t=` seguida de la variable **URL codificada**.
   **A mano:** en la app Atajos, crea un atajo nuevo llamado **Gasto** con estas tres acciones:
   - **Solicitar entrada**, con la pregunta "¿Qué gastaste?".
   - **Codificar URL**.
   - **Obtener contenido de URL**: pega la URL que copiaste y, al final, inserta la variable **URL codificada**.
4. Di *"Oye Siri, Gasto"* → *"25 soles en Tambo con BBVA"*. Si no dices el monto, la app te lo pide.

### 5. Pagos con Wallet, automáticos
En iOS 18 o posterior, el disparador se llama **Wallet** (en iOS 17 se llamaba "Transacción").
1. En **Ajustes › Registrar solo cada pago con Wallet**, copia el prompt y pídele a Siri en Atajos que cree **"Pago Wallet"**. El atajo hace un POST con JSON: `secret`, `action: addTx`, `kind: wallet`, `amount`, `merchant` y `card`.
2. Entra a **Automatización › + › Wallet**, elige tus tarjetas, marca **Ejecutar inmediatamente** y elige "Pago Wallet".

Si el mismo gasto llega también por Siri (mismo monto, ±30 min), Inicio lo muestra como **¿Duplicado?**.

### 6. Yape y Plin con 2 toques
iOS no deja leer notificaciones de otras apps. En su lugar:
1. En **Ajustes › Registrar Yape o Plin**, copia el prompt para que Siri cree **"Registrar Yape"**. Aparece en la hoja de Compartir: extrae el texto de la imagen y lo manda con `kind: yape`.
2. Después de yapear, entra a **Compartir › Registrar Yape**. El número de operación evita registrar la misma constancia dos veces.

## Qué hace la app

- **Personalización:**
  - Carpetas propias: crear, renombrar, cambiar ícono o tipo, y borrar.
  - **Editar plan**, para poner todos los montos de una vez.
  - Registrar gastos con fecha (hoy, ayer u otra) e **ingresos extra** que suman solo al mes.
- **Deudas no bancarias:** préstamos de familia, caja, cooperativa o tienda, con cuota, interés opcional y día de pago.
- **Optimizar:**
  - Para el resto del mes: cuánto puedes gastar por día, qué carpetas se van a pasar y cuánto puedes ahorrar todavía. Ese ahorro va a la deuda más cara o al fondo de emergencia.
  - Para el **próximo mes**: un plan con tu gasto real + 10%.
- **Cierre de mes:** el día 1, un resumen del mes anterior y el plan para empezar el nuevo.

- **Plan base cero:** cada sol tiene carpeta. Al ajustar una carpeta, la diferencia sale de **Libre** o vuelve a Libre. Los mínimos de tus tarjetas siempre caben en el plan.
- **Puedes gastar hoy:** lo libre en tus carpetas de gasto dividido entre los días que quedan del mes. Usa la fecha real y el mes se reinicia solo.
- **Deudas:** tus tarjetas de crédito, con su saldo, TCEA, mínimo y día de pago. La app compara tres formas de pagar: primero la más cara (avalancha), primero la más chica (bola de nieve) o solo el mínimo. Muestra la fecha en que quedas libre y los intereses de cada una. Las compras con crédito que registras después se suman al saldo.
- **Métricas:**
  - Tasa de ahorro, deuda frente a sueldo, meses de fondo de emergencia y uso de crédito.
  - Gasto mensual, con tu plan comparado con el hogar peruano promedio (INEI 2024).
  - Cómo pagas: Apple Pay, Yape, tarjeta o efectivo.
  - Metas editables, gratificación y CTS.
- **Asesor (Gemini):** conoce tus carpetas, deudas y metas, y propone mover dinero entre carpetas con un botón **Aplicar**.
- **Drive:** el estado completo queda en `datos.json`, con historial de versiones de Drive. La hoja **Finanzas Perú – Movimientos** sirve para ver y filtrar tus gastos. Si usas dos dispositivos, gana el último guardado y no se pierde ningún movimiento.

**Pendiente** (aparece como "Pronto" en la app): leer correos de consumo, constancias de Yape/Plin, PDF del estado de cuenta y Finanzas Abiertas de la SBS. Por ahora, lo que no paga Apple Pay se registra con **+**.

## Desarrollo

```bash
cd app
npm install
npm run dev        # http://localhost:5173
npm test           # 54 pruebas: dominio, paridad con el prototipo, sincronización y el Apps Script (Code.gs) con Google simulado
npm run build      # BASE_PATH=/<repo>/ para GitHub Pages
```

Prueba de punta a punta con el `Code.gs` real y Drive y Gemini simulados:

```bash
node e2e/fake-gas-server.ts &           # Apps Script local en :8790
npx vite --port 5173 &
node e2e/flujo.cjs /tmp/capturas         # requiere Playwright
```

Recorre la creación del plan con una tarjeta, el guardado en Drive y en la hoja, un pago de Apple Pay por el Atajo, el modo sin señal y la reconexión, el asesor con su propuesta aplicada y la recuperación de datos en otro teléfono.

### Estructura

```
apps-script/Code.gs     Backend en tu cuenta de Google (Drive, Gemini, bandeja). gas-mock.ts lo prueba en Node.
src/domain/             Lógica pura: plan (plan.ts), tarjetas y deudas (cards.ts, debts.ts), fechas, asesor (advisor.ts)
src/sync/               Cliente del Apps Script y combinación de versiones
src/state/              Estado de la app, guardado en el teléfono y sincronización con Drive
src/screens/            Creación del plan, Inicio, Carpetas, Deudas, Métricas, Asesor y hojas (tarjeta, meta, ajustes…)
public/                 Manifiesto, íconos y service worker (app instalable, abre sin señal)
../.github/workflows/   Publicación automática en GitHub Pages
```
