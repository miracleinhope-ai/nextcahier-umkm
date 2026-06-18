import { useState } from 'react'
import { Plus, Trash2, Settings, CheckCircle, Clock, Circle } from 'lucide-react'

const STATUS_CONFIG = {
  available: { label: 'Tersedia', color: 'green', icon: Circle },
  occupied: { label: 'Terisi', color: 'red', icon: Clock },
  reserved: { label: 'Reserved', color: 'yellow', icon: CheckCircle },
}

export default function MejaGrid({ tables, setTables, onSelectTable, currentUser }) {
  const [cols, setCols] = useState(4)
  const [showConfig, setShowConfig] = useState(false)
  const [newCount, setNewCount] = useState(tables.length || 8)

  function applyConfig() {
    const count = parseInt(newCount) || 8
    const updated = Array.from({ length: count }, (_, i) => {
      const existing = tables.find(t => t.table_number === i + 1)
      return existing || {
        id: `t${i + 1}`,
        table_number: i + 1,
        row_position: Math.floor(i / cols),
        col_position: i % cols,
        status: 'available',
      }
    })
    setTables(updated)
    setShowConfig(false)
  }

  function cycleStatus(tableNum) {
    const cycle = ['available', 'occupied', 'reserved']
    setTables(prev => prev.map(t => {
      if (t.table_number !== tableNum) return t
      const next = cycle[(cycle.indexOf(t.status) + 1) % cycle.length]
      return { ...t, status: next }
    }))
  }

  const stats = {
    available: tables.filter(t => t.status === 'available').length,
    occupied: tables.filter(t => t.status === 'occupied').length,
    reserved: tables.filter(t => t.status === 'reserved').length,
  }

  return (
    <div className="p-4 md:p-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div>
          <h2 className="text-xl font-bold text-gray-800">Denah Meja</h2>
          <p className="text-sm text-gray-500 mt-0.5">Klik meja untuk mulai order • Klik kanan untuk ganti status</p>
        </div>
        <button
          onClick={() => setShowConfig(true)}
          className="flex items-center gap-2 px-4 py-2 bg-purple-50 text-purple-600 border border-purple-200 rounded-xl text-sm font-medium glow-purple hover:bg-purple-100 transition-colors"
        >
          <Settings size={15} />
          Konfigurasi Meja
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        {[
          { key: 'available', label: 'Tersedia', color: 'green' },
          { key: 'occupied', label: 'Terisi', color: 'red' },
          { key: 'reserved', label: 'Reserved', color: 'yellow' },
        ].map(({ key, label, color }) => (
          <div key={key} className={`bg-${color}-50 border border-${color}-200 rounded-xl p-3 text-center glow-${color === 'yellow' ? 'yellow' : color}`}>
            <div className={`text-2xl font-bold text-${color}-600`}>{stats[key]}</div>
            <div className={`text-xs text-${color}-500 mt-0.5`}>{label}</div>
          </div>
        ))}
      </div>

      {/* Grid */}
      <div
        className="grid gap-3"
        style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
      >
        {tables.map(table => {
          const cfg = STATUS_CONFIG[table.status] || STATUS_CONFIG.available
          const colorMap = { green: 'emerald', red: 'red', yellow: 'amber' }
          const c = colorMap[cfg.color] || cfg.color

          return (
            <button
              key={table.id}
              onClick={() => table.status === 'available' ? onSelectTable(table) : cycleStatus(table.table_number)}
              onContextMenu={e => { e.preventDefault(); cycleStatus(table.table_number) }}
              className={`relative rounded-2xl border-2 p-4 flex flex-col items-center gap-2 transition-all duration-200 cursor-pointer
                ${table.status === 'available'
                  ? 'bg-white border-emerald-300 hover:bg-emerald-50 glow-green hover:scale-105'
                  : table.status === 'occupied'
                  ? 'bg-red-50 border-red-300 glow-red'
                  : 'bg-amber-50 border-amber-300 glow-yellow'
                }`}
            >
              <div className={`w-10 h-10 rounded-full flex items-center justify-center
                ${table.status === 'available' ? 'bg-emerald-100' : table.status === 'occupied' ? 'bg-red-100' : 'bg-amber-100'}`}>
                <span className={`font-bold text-sm
                  ${table.status === 'available' ? 'text-emerald-600' : table.status === 'occupied' ? 'text-red-600' : 'text-amber-600'}`}>
                  {table.table_number}
                </span>
              </div>
              <div className="text-center">
                <div className="text-xs font-semibold text-gray-700">Meja {table.table_number}</div>
                <div className={`text-xs mt-0.5
                  ${table.status === 'available' ? 'text-emerald-500' : table.status === 'occupied' ? 'text-red-500' : 'text-amber-500'}`}>
                  {cfg.label}
                </div>
              </div>
              {table.status === 'available' && (
                <div className="absolute top-1.5 right-1.5">
                  <Plus size={12} className="text-emerald-400" />
                </div>
              )}
            </button>
          )
        })}
      </div>

      {/* Config Modal */}
      {showConfig && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl glow-card w-full max-w-sm p-6">
            <h3 className="text-lg font-bold text-gray-800 mb-4">Konfigurasi Meja</h3>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-gray-600 mb-1 block">Jumlah Meja</label>
                <input
                  type="number" min={1} max={50}
                  value={newCount}
                  onChange={e => setNewCount(e.target.value)}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-600 mb-1 block">Jumlah Kolom Grid</label>
                <select
                  value={cols}
                  onChange={e => setCols(Number(e.target.value))}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                >
                  {[2,3,4,5,6].map(n => <option key={n} value={n}>{n} Kolom</option>)}
                </select>
              </div>
            </div>
            <div className="flex gap-2 mt-5">
              <button onClick={() => setShowConfig(false)} className="flex-1 py-2 rounded-xl border border-gray-200 text-sm text-gray-600 hover:bg-gray-50">Batal</button>
              <button onClick={applyConfig} className="flex-1 py-2 rounded-xl bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 glow-blue">Terapkan</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
