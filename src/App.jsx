import { useState, useEffect, useMemo, useCallback } from 'react'

const ARANCELES = {
  estandar: { label: 'Estándar', rate: 0.012 },
  preferente: { label: 'Preferente', rate: 0.01 },
  personalizada: { label: 'Personalizada', rate: null },
}

const fmt = {
  ars: (n, d = 2) =>
    n == null ? '—' : n.toLocaleString('es-AR', { style: 'currency', currency: 'ARS', minimumFractionDigits: d, maximumFractionDigits: d }),
  num: (n, d = 0) =>
    n == null ? '—' : n.toLocaleString('es-AR', { minimumFractionDigits: d, maximumFractionDigits: d }),
  pct: (n, d = 2) =>
    n == null ? '—' : (n * 100).toFixed(d) + '%',
  date: (s) => {
    if (!s) return '—'
    const d = new Date(s)
    return d.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' })
  },
}

function daysBetween(d1, d2) {
  const a = new Date(d1); a.setHours(0,0,0,0)
  const b = new Date(d2); b.setHours(0,0,0,0)
  return Math.round((b - a) / 86400000)
}

function LiveDot({ ok }) {
  return <span className={`live-dot ${ok ? 'live' : 'off'}`} />
}

function InputField({ label, value, onChange, prefix, suffix, type = 'text', disabled, small }) {
  return (
    <div className={`input-field ${small ? 'small' : ''}`}>
      <label>{label}</label>
      <div className="input-wrap">
        {prefix && <span className="input-prefix">{prefix}</span>}
        <input
          type={type}
          value={value}
          onChange={e => onChange(e.target.value)}
          disabled={disabled}
        />
        {suffix && <span className="input-suffix">{suffix}</span>}
      </div>
    </div>
  )
}

function ResultRow({ label, value, highlight, sub }) {
  return (
    <div className={`result-row ${highlight || ''}`}>
      <span className="result-label">{label}</span>
      <span className="result-value">{value}</span>
      {sub && <span className="result-sub">{sub}</span>}
    </div>
  )
}

export default function App() {
  const [lecaps, setLecaps] = useState([])
  const [precios, setPrecios] = useState([])
  const [dolarMep, setDolarMep] = useState(null)
  const [dolarCcl, setDolarCcl] = useState(null)
  const [loading, setLoading] = useState(true)
  const [apiStatus, setApiStatus] = useState({ letras: null, precios: null, mep: null, ccl: null })

  const [selectedTicker, setSelectedTicker] = useState('')
  const [monto, setMonto] = useState('10000000')
  const [precioInput, setPrecioInput] = useState('')
  const [tipoCartera, setTipoCartera] = useState('estandar')
  const [arancelCustom, setArancelCustom] = useState('0.50')
  const [cotMep, setCotMep] = useState('')
  const [cotCcl, setCotCcl] = useState('')
  const [lastUpdate, setLastUpdate] = useState(null)

  const fetchData = useCallback(async () => {
    setLoading(true)
    const status = { letras: null, precios: null, mep: null, ccl: null }

    const [letrasRes, preciosRes, mepRes, cclRes] = await Promise.allSettled([
      fetch('/api/letras').then(r => { if (!r.ok) throw new Error(); return r.json() }),
      fetch('/api/precios').then(r => { if (!r.ok) throw new Error(); return r.json() }),
      fetch('/api/dolar-mep').then(r => { if (!r.ok) throw new Error(); return r.json() }),
      fetch('/api/dolar-ccl').then(r => { if (!r.ok) throw new Error(); return r.json() }),
    ])

    if (letrasRes.status === 'fulfilled') { setLecaps(letrasRes.value); status.letras = true }
    else status.letras = false

    if (preciosRes.status === 'fulfilled') { setPrecios(preciosRes.value); status.precios = true }
    else status.precios = false

    if (mepRes.status === 'fulfilled') {
      setDolarMep(mepRes.value)
      setCotMep(String(mepRes.value.venta ?? ''))
      status.mep = true
    } else status.mep = false

    if (cclRes.status === 'fulfilled') {
      setDolarCcl(cclRes.value)
      setCotCcl(String(cclRes.value.venta ?? ''))
      status.ccl = true
    } else status.ccl = false

    setApiStatus(status)
    setLastUpdate(new Date())
    setLoading(false)
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  const lecapsActivas = useMemo(() => {
    const hoy = new Date()
    hoy.setHours(0, 0, 0, 0)

    return lecaps
      .map(l => {
        const p = precios.find(pr => pr.symbol === l.ticker)
        const dias = daysBetween(hoy, l.fechaVencimiento)
        return { ...l, precioMercado: p?.c ?? null, pxBid: p?.px_bid ?? null, pxAsk: p?.px_ask ?? null, pctChange: p?.pct_change ?? null, dias }
      })
      .filter(l => l.dias > 0)
      .sort((a, b) => a.dias - b.dias)
  }, [lecaps, precios])

  useEffect(() => {
    if (lecapsActivas.length > 0 && !selectedTicker) {
      const first = lecapsActivas[0]
      setSelectedTicker(first.ticker)
      if (first.precioMercado) setPrecioInput(String(first.precioMercado))
    }
  }, [lecapsActivas, selectedTicker])

  const handleTickerChange = (ticker) => {
    setSelectedTicker(ticker)
    const lecap = lecapsActivas.find(l => l.ticker === ticker)
    if (lecap?.precioMercado) setPrecioInput(String(lecap.precioMercado))
  }

  const selected = lecapsActivas.find(l => l.ticker === selectedTicker)

  const resultados = useMemo(() => {
    const precio = parseFloat(precioInput)
    const montoNum = parseFloat(monto)
    if (!selected || !precio || !montoNum || precio <= 0 || montoNum <= 0) return null
    const { dias, vpv } = selected
    if (!vpv || dias <= 0) return null

    const arancelRate = tipoCartera === 'personalizada'
      ? parseFloat(arancelCustom) / 100
      : ARANCELES[tipoCartera].rate

    const nominales = Math.round(montoNum / precio * 100)
    const costoArancel = Math.max((nominales * precio / 100) * arancelRate / 365 * dias, 100) + montoNum * 0.0001
    const totalPagar = montoNum + costoArancel
    const montoCobrar = nominales * vpv / 100
    const ganancia = montoCobrar - totalPagar
    const rendimiento = montoCobrar / totalPagar - 1
    const tna = rendimiento * 365 / dias
    const tea = Math.pow(1 + rendimiento, 365 / dias) - 1
    const tem = Math.pow(1 + tea, 30 / 365) - 1

    const mepVal = parseFloat(cotMep) || 0
    const cclVal = parseFloat(cotCcl) || 0

    return {
      dias, nominales, costoArancel, totalPagar, vpv, montoCobrar,
      ganancia, rendimiento, tna, tea, tem,
      mepBreakeven: mepVal ? mepVal * (1 + rendimiento) : null,
      cclBreakeven: cclVal ? cclVal * (1 + rendimiento) : null,
    }
  }, [selected, precioInput, monto, tipoCartera, arancelCustom, cotMep, cotCcl])

  if (loading) {
    return (
      <div className="loading-screen">
        <div className="loading-spinner" />
        <p>Conectando con el mercado...</p>
      </div>
    )
  }

  return (
    <div className="app">
      <header className="header">
        <div className="header-left">
          <h1>Simulador <span className="accent">LECAP</span></h1>
          <p className="subtitle">Calculadora de Letras Capitalizables del Tesoro</p>
        </div>
        <div className="header-right">
          <div className="api-badges">
            <span className="badge"><LiveDot ok={apiStatus.letras} /> Letras</span>
            <span className="badge"><LiveDot ok={apiStatus.precios} /> Precios</span>
            <span className="badge"><LiveDot ok={apiStatus.mep} /> MEP</span>
            <span className="badge"><LiveDot ok={apiStatus.ccl} /> CCL</span>
          </div>
          {lastUpdate && (
            <p className="last-update">
              Actualizado: {lastUpdate.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}
              <button className="refresh-btn" onClick={fetchData} title="Actualizar datos">↻</button>
            </p>
          )}
        </div>
      </header>

      <div className="ticker-bar">
        <div className="ticker-item">
          <span className="ticker-label">USD MEP</span>
          <span className="ticker-value">{dolarMep ? fmt.ars(dolarMep.venta, 0) : '—'}</span>
        </div>
        <div className="ticker-item">
          <span className="ticker-label">USD CCL</span>
          <span className="ticker-value">{dolarCcl ? fmt.ars(dolarCcl.venta, 0) : '—'}</span>
        </div>
        <div className="ticker-item">
          <span className="ticker-label">LECAPS activas</span>
          <span className="ticker-value">{lecapsActivas.length}</span>
        </div>
        <div className="ticker-item">
          <span className="ticker-label">Fecha liquidación</span>
          <span className="ticker-value">{fmt.date(new Date())}</span>
        </div>
      </div>

      <main className="main-grid">
        {/* Panel izquierdo: Inputs */}
        <section className="card inputs-card">
          <h2>Parámetros de inversión</h2>

          <div className="input-field">
            <label>LECAP (ticker)</label>
            <select value={selectedTicker} onChange={e => handleTickerChange(e.target.value)}>
              {lecapsActivas.map(l => (
                <option key={l.ticker} value={l.ticker}>
                  {l.ticker} — Vto. {fmt.date(l.fechaVencimiento)} ({l.dias}d)
                </option>
              ))}
            </select>
          </div>

          {selected && (
            <div className="lecap-info">
              <div className="info-row">
                <span>Emisión</span>
                <span>{fmt.date(selected.fechaEmision)}</span>
              </div>
              <div className="info-row">
                <span>Vencimiento</span>
                <span>{fmt.date(selected.fechaVencimiento)}</span>
              </div>
              <div className="info-row">
                <span>Días al vto.</span>
                <span className="mono">{selected.dias}</span>
              </div>
              <div className="info-row">
                <span>VPV (pago final c/100 VN)</span>
                <span className="mono">{fmt.num(selected.vpv, 4)}</span>
              </div>
              {selected.precioMercado && (
                <div className="info-row">
                  <span>Precio de mercado</span>
                  <span className="mono">
                    {fmt.ars(selected.precioMercado)}
                    {selected.pctChange != null && (
                      <span className={`pct ${selected.pctChange >= 0 ? 'up' : 'down'}`}>
                        {selected.pctChange >= 0 ? '+' : ''}{selected.pctChange.toFixed(2)}%
                      </span>
                    )}
                  </span>
                </div>
              )}
              {selected.tem && (
                <div className="info-row">
                  <span>TEM (emisión)</span>
                  <span className="mono">{fmt.pct(selected.tem)}</span>
                </div>
              )}
            </div>
          )}

          <div className="separator" />

          <InputField
            label="Monto a invertir"
            value={monto}
            onChange={setMonto}
            prefix="$"
            type="number"
          />

          <InputField
            label="Precio de compra (c/100 VN)"
            value={precioInput}
            onChange={setPrecioInput}
            prefix="$"
            type="number"
          />

          <div className="input-field">
            <label>Tipo de cartera</label>
            <select value={tipoCartera} onChange={e => setTipoCartera(e.target.value)}>
              {Object.entries(ARANCELES).map(([key, { label, rate }]) => (
                <option key={key} value={key}>
                  {label}{rate != null ? ` (${(rate * 100).toFixed(1)}%)` : ''}
                </option>
              ))}
            </select>
          </div>

          {tipoCartera === 'personalizada' && (
            <InputField
              label="Arancel personalizado"
              value={arancelCustom}
              onChange={setArancelCustom}
              suffix="%"
              type="number"
              small
            />
          )}

          <div className="separator" />

          <div className="dolar-inputs">
            <InputField
              label="Cotización MEP"
              value={cotMep}
              onChange={setCotMep}
              prefix="$"
              type="number"
              small
            />
            <InputField
              label="Cotización CCL"
              value={cotCcl}
              onChange={setCotCcl}
              prefix="$"
              type="number"
              small
            />
          </div>
        </section>

        {/* Panel derecho: Resultados */}
        <section className="card results-card">
          <h2>Resultado de la inversión</h2>

          {resultados ? (
            <>
              <div className="results-section">
                <h3>Operación</h3>
                <ResultRow label="Días al vencimiento" value={resultados.dias} />
                <ResultRow label="Cantidad (nominales)" value={fmt.num(resultados.nominales)} />
                <ResultRow label="Arancel + D.Mcdo." value={fmt.ars(resultados.costoArancel)} />
                <ResultRow label="Total a pagar" value={fmt.ars(resultados.totalPagar)} highlight="dim" />
              </div>

              <div className="results-section">
                <h3>Al vencimiento</h3>
                <ResultRow label="VPV (c/100 VN)" value={fmt.num(resultados.vpv, 4)} />
                <ResultRow label="Monto a cobrar" value={fmt.ars(resultados.montoCobrar)} highlight="dim" />
                <ResultRow
                  label="Ganancia"
                  value={fmt.ars(resultados.ganancia)}
                  highlight={resultados.ganancia >= 0 ? 'positive' : 'negative'}
                />
              </div>

              <div className="results-section">
                <h3>Rendimientos</h3>
                <ResultRow label="Rendimiento directo" value={fmt.pct(resultados.rendimiento)} />
                <ResultRow label="TNA" value={fmt.pct(resultados.tna)} highlight="accent" />
                <ResultRow label="TEA" value={fmt.pct(resultados.tea)} highlight="accent" />
                <ResultRow label="TEM" value={fmt.pct(resultados.tem)} />
              </div>

              <div className="results-section">
                <h3>Breakeven en dólares</h3>
                <p className="section-note">
                  Tipo de cambio al cual el rendimiento en pesos iguala mantener dólares
                </p>
                {resultados.mepBreakeven && (
                  <ResultRow
                    label="MEP Breakeven"
                    value={fmt.ars(resultados.mepBreakeven, 2)}
                    sub={`Actual: ${fmt.ars(parseFloat(cotMep), 0)}`}
                  />
                )}
                {resultados.cclBreakeven && (
                  <ResultRow
                    label="CCL Breakeven"
                    value={fmt.ars(resultados.cclBreakeven, 2)}
                    sub={`Actual: ${fmt.ars(parseFloat(cotCcl), 0)}`}
                  />
                )}
              </div>
            </>
          ) : (
            <div className="no-results">
              <p>Completá los parámetros de inversión para ver los resultados</p>
            </div>
          )}
        </section>
      </main>

      {/* Tabla resumen de todas las LECAPS */}
      <section className="card table-card">
        <h2>LECAPS activas en el mercado</h2>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Ticker</th>
                <th>Vencimiento</th>
                <th className="r">Días</th>
                <th className="r">VPV</th>
                <th className="r">Precio</th>
                <th className="r">Var. %</th>
                <th className="r">TEM</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {lecapsActivas.map(l => (
                <tr key={l.ticker} className={l.ticker === selectedTicker ? 'selected' : ''}>
                  <td className="mono ticker-cell">{l.ticker}</td>
                  <td>{fmt.date(l.fechaVencimiento)}</td>
                  <td className="r mono">{l.dias}</td>
                  <td className="r mono">{fmt.num(l.vpv, 2)}</td>
                  <td className="r mono">{l.precioMercado ? fmt.ars(l.precioMercado) : '—'}</td>
                  <td className={`r mono ${l.pctChange >= 0 ? 'up' : 'down'}`}>
                    {l.pctChange != null ? `${l.pctChange >= 0 ? '+' : ''}${l.pctChange.toFixed(2)}%` : '—'}
                  </td>
                  <td className="r mono">{l.tem ? fmt.pct(l.tem) : '—'}</td>
                  <td>
                    <button className="select-btn" onClick={() => handleTickerChange(l.ticker)}>
                      Simular
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <footer className="footer">
        <p>
          Datos: <a href="https://argentinadatos.com" target="_blank" rel="noopener">ArgentinaDatos</a> ·{' '}
          <a href="https://data912.com" target="_blank" rel="noopener">Data912</a> ·{' '}
          <a href="https://dolarapi.com" target="_blank" rel="noopener">DolarAPI</a>
        </p>
        <p className="disclaimer">
          Esta herramienta es informativa. No constituye asesoramiento financiero.
          Los datos pueden tener demora. Verificá siempre con tu agente de bolsa.
        </p>
      </footer>
    </div>
  )
}
