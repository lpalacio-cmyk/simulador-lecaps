# Simulador LECAP

Calculadora interactiva de Letras Capitalizables del Tesoro Nacional argentino con datos en vivo del mercado.

## Características

- **Datos en vivo** de LECAPS activas (ticker, fechas, VPV) via [ArgentinaDatos](https://argentinadatos.com)
- **Precios de mercado** en tiempo real via [Data912](https://data912.com)
- **Cotización USD MEP y CCL** en vivo via [DolarAPI](https://dolarapi.com)
- Cálculo automático de: nominales, arancel, ganancia, rendimiento directo, TNA, TEA, TEM
- Breakeven en dólares MEP y CCL
- Tabla resumen de todas las LECAPS activas
- Diseño responsive y profesional

## Desarrollo local

```bash
# Instalar dependencias
npm install

# Iniciar servidor de desarrollo
npm run dev
```

El servidor arranca en `http://localhost:5173`. El proxy de Vite redirige las llamadas `/api/*` a las APIs externas para evitar problemas de CORS.

## Deploy en Vercel

### Opción 1: Desde GitHub (recomendado)

1. Subí este proyecto a un repositorio en GitHub
2. Entrá a [vercel.com](https://vercel.com) y logueate con tu cuenta de GitHub
3. Hacé click en **"Add New Project"**
4. Seleccioná el repositorio
5. Vercel detecta automáticamente que es un proyecto Vite — no necesitás configurar nada
6. Click en **"Deploy"**

El archivo `vercel.json` ya está configurado con los rewrites necesarios para las APIs.

### Opción 2: Desde la CLI

```bash
# Instalar Vercel CLI
npm i -g vercel

# Deploy
vercel
```

## Estructura del proyecto

```
simulador-lecaps/
├── index.html          # Entry point HTML
├── package.json        # Dependencias y scripts
├── vite.config.js      # Config Vite + proxy para desarrollo
├── vercel.json         # Config Vercel (rewrites para APIs)
├── src/
│   ├── main.jsx        # Entry point React
│   ├── App.jsx         # Componente principal
│   └── index.css       # Estilos
└── README.md
```

## APIs utilizadas

| API | Endpoint | Datos |
|-----|----------|-------|
| ArgentinaDatos | `/v1/finanzas/letras` | Catálogo LECAPS: ticker, fechas, VPV, TEM |
| Data912 | `/live/arg_notes` | Precios live: último, bid, ask, variación |
| DolarAPI | `/v1/dolares/bolsa` | Cotización USD MEP |
| DolarAPI | `/v1/dolares/contadoconliqui` | Cotización USD CCL |

## Lógica de cálculo

La lógica replica fielmente un simulador Excel profesional de LECAPS:

- **Nominales** = round(Monto / Precio × 100)
- **Arancel + D.Mcdo** = max((Nominales × Precio / 100) × Arancel / 365 × Días, 100) + Monto × 0.01%
- **Monto a cobrar** = Nominales × VPV / 100
- **Rendimiento directo** = Cobro / Pago − 1
- **TNA** = Rendimiento × 365 / Días
- **TEA** = (1 + Rendimiento)^(365/Días) − 1
- **TEM** = (1 + TEA)^(30/365) − 1
- **Breakeven MEP/CCL** = Cotización × (1 + Rendimiento)

## Licencia

MIT
