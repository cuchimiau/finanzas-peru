# Finanzas Perú

**App:** <https://cuchimiau.github.io/finanzas-peru/> (ábrela en Safari y elige *Añadir a pantalla de inicio*).

Una app para tu iPhone que reparte tu sueldo en carpetas (presupuesto base cero) y registra los pagos que haces con Apple Pay. También incluye un plan para salir de tus deudas de tarjeta, métricas y un asesor con IA (Gemini). Tus datos se guardan en tu Google Drive, en la carpeta **Finanzas Perú**.

## Cómo funciona

```
iPhone · app instalada (GitHub Pages)  ──►  Apps Script en TU cuenta de Google
  guarda una copia en el teléfono           ├─ Drive › Finanzas Perú › datos.json + hoja "Movimientos"
  (abre sin señal)                          ├─ Gemini (tu clave queda en el script, no en el teléfono)
Atajo de iPhone (Wallet → Transacción) ──►  └─ bandeja.json (pagos de Apple Pay pendientes)
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

### 4. Pagos con Apple Pay (Atajo)
1. En el iPhone, abre **Atajos** › **Automatización** › **Nueva automatización** › **Transacción**.
2. Elige tus tarjetas de Wallet y marca **Ejecutar inmediatamente**.
3. Agrega la acción **Obtener contenido de URL**:
   - URL: la de tu aplicación web. Está en la app, en Ajustes › Pagos con Apple Pay › Copiar.
   - Método: **POST**. Cuerpo de la solicitud: **JSON** con estos campos:
     - `secret` (texto): el código secreto (Ajustes › Copiar)
     - `action` (texto): `addTx`
     - `amount`: variable **Importe**
     - `merchant`: variable **Comercio**
     - `card`: variable **Tarjeta**
4. Cada pago queda en la bandeja y entra a su carpeta la próxima vez que abras la app. Si una carpeta no es la correcta, tócala para cambiarla: la app lo recuerda para la próxima.

## Qué hace la app

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
npm test           # 33 pruebas: dominio, paridad con el prototipo, sincronización y el Apps Script (Code.gs) con Google simulado
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
