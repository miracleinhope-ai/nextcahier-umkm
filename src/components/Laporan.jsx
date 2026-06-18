import { useState } from 'react'
import { BarChart2, TrendingUp, DollarSign, ShoppingBag, Calendar, Search, Printer } from 'lucide-react'
import { supabase } from '../supabaseClient'

function fmt(n) {
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(n || 0)
}

const today = new Date().toISOString().slice(0, 10)

export default function Laporan({ orders: localOrders, menus, currentUser }) {
  const [dateFrom, setDateFrom] = useState(today)
  const [dateTo, setDateTo] = useState(today)
  const [orders, setOrders] = useState(null)
  const [loading, setLoading] = useState(false)

  async function fetchReport() {
    setLoading(true)
    try {
      const { data } = await supabase
        .from('orders')
        .select('*, order_items(*, menus(name, price, type))')
        .eq('status', 'paid')
        .gte('created_at', dateFrom + 'T00:00:00')
        .lte('created_at', dateTo + 'T23:59:59')
        .order('created_at', { ascending: false })
      setOrders(data || [])
    } catch {
      // fallback to local orders
      const filtered = (localOrders || []).filter(o => {
        const d = o.created_at?.slice(0, 10)
        return d >= dateFrom && d <= dateTo && o.status === 'paid'
      })
      setOrders(filtered)
    }
    setLoading(false)
  }

  const displayOrders = orders || []
  const totalRevenue = displayOrders.reduce((s, o) => s + (o.total_amount || 0), 0)
  const totalOrders = displayOrders.length
  const avgOrder = totalOrders > 0 ? totalRevenue / totalOrders : 0

  // Sales by menu (best sellers)
  const menuSales = {}
  displayOrders.forEach(o => {
    const items = o.order_items || o.items || []
    items.forEach(item => {
      const name = item.menu_name || item.name || (item.menus?.name)
      if (!name) return
      if (!menuSales[name]) menuSales[name] = { qty: 0, revenue: 0 }
      menuSales[name].qty += item.qty || 0
      menuSales[name].revenue += (item.subtotal || (item.qty * item.price)) || 0
    })
  })
  const topMenus = Object.entries(menuSales).sort((a, b) => b[1].qty - a[1].qty).slice(0, 5)

  // Daily breakdown
  const dailyMap = {}
  displayOrders.forEach(o => {
    const d = o.created_at?.slice(0, 10)
    if (!d) return
    if (!dailyMap[d]) dailyMap[d] = { revenue: 0, count: 0 }
    dailyMap[d].revenue += o.total_amount || 0
    dailyMap[d].count += 1
  })
  const daily = Object.entries(dailyMap).sort((a, b) => b[0].localeCompare(a[0]))

  // Estimated HPP (cost = 40% of revenue as simulation)
  const estimatedHPP = totalRevenue * 0.4
  const grossProfit = totalRevenue - estimatedHPP
  const operationalCost = totalRevenue * 0.15
  const netProfit = grossProfit - operationalCost

  function printReport() { window.print() }

  return (
    <div className="p-4 md:p-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div>
          <h2 className="text-xl font-bold text-gray-800">Laporan Keuangan</h2>
          <p className="text-sm text-gray-500 mt-0.5">Laporan penjualan dan laba rugi periodik</p>
        </div>
        {orders !== null && (
          <button onClick={printReport} className="flex items-center gap-2 px-4 py-2 bg-blue-50 text-blue-600 border border-blue-200 rounded-xl text-sm font-medium glow-blue hover:bg-blue-100">
            <Printer size={15}/> Cetak Laporan
          </button>
        )}
      </div>

      {/* Date Filter */}
      <div className="bg-white rounded-2xl border border-gray-100 p-4 glow-card mb-6">
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className="text-xs font-medium text-gray-500 mb-1 block">Dari Tanggal</label>
            <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
              className="border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100" />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-500 mb-1 block">Sampai Tanggal</label>
            <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
              className="border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100" />
          </div>
          <button onClick={fetchReport} disabled={loading}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-xl text-sm font-medium glow-blue hover:bg-blue-700 disabled:opacity-60 transition-colors">
            <Search size={14}/>{loading ? 'Memuat...' : 'Tampilkan Laporan'}
          </button>
        </div>
      </div>

      {orders === null ? (
        <div className="text-center py-20 text-gray-400">
          <BarChart2 size={40} className="mx-auto mb-3 opacity-30" />
          <p className="text-sm">Pilih rentang tanggal dan klik "Tampilkan Laporan"</p>
        </div>
      ) : (
        <div id="print-area">
          {/* KPI Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
            {[
              { label: 'Total Penjualan', value: fmt(totalRevenue), color: 'blue', icon: DollarSign },
              { label: 'Jumlah Transaksi', value: totalOrders, color: 'purple', icon: ShoppingBag },
              { label: 'Rata-rata Order', value: fmt(avgOrder), color: 'green', icon: TrendingUp },
              { label: 'Laba Bersih (Est.)', value: fmt(netProfit), color: netProfit >= 0 ? 'green' : 'red', icon: BarChart2 },
            ].map(({ label, value, color, icon: Icon }) => (
              <div key={label} className={`bg-${color}-50 border border-${color}-200 rounded-2xl p-4 glow-${color}`}>
                <div className="flex items-center gap-2 mb-2">
                  <div className={`w-7 h-7 rounded-lg bg-${color}-100 flex items-center justify-center`}>
                    <Icon size={14} className={`text-${color}-600`} />
                  </div>
                  <span className={`text-xs font-medium text-${color}-500`}>{label}</span>
                </div>
                <div className={`text-xl font-bold text-${color}-700`}>{value}</div>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
            {/* Laba Rugi */}
            <div className="bg-white rounded-2xl border border-gray-100 p-5 glow-card">
              <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
                <TrendingUp size={16} className="text-green-500" />
                Ringkasan Laba Rugi (Estimasi)
              </h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between py-2 border-b border-gray-50">
                  <span className="text-gray-600">Pendapatan Kotor</span>
                  <span className="font-semibold text-green-600">{fmt(totalRevenue)}</span>
                </div>
                <div className="flex justify-between py-2 border-b border-gray-50">
                  <span className="text-gray-600">HPP (Est. 40%)</span>
                  <span className="font-semibold text-red-500">({fmt(estimatedHPP)})</span>
                </div>
                <div className="flex justify-between py-2 border-b border-gray-50">
                  <span className="text-gray-600">Laba Kotor</span>
                  <span className="font-semibold text-blue-600">{fmt(grossProfit)}</span>
                </div>
                <div className="flex justify-between py-2 border-b border-gray-50">
                  <span className="text-gray-600">Biaya Operasional (Est. 15%)</span>
                  <span className="font-semibold text-red-500">({fmt(operationalCost)})</span>
                </div>
                <div className="flex justify-between py-2 bg-green-50 rounded-lg px-2 mt-2">
                  <span className="font-bold text-gray-800">Laba Bersih</span>
                  <span className={`font-bold text-lg ${netProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>{fmt(netProfit)}</span>
                </div>
              </div>
              <p className="text-xs text-gray-400 mt-3 italic">*Estimasi berdasarkan persentase umum industri F&B. Input HPP & biaya aktual di modul Inventory.</p>
            </div>

            {/* Top Menu */}
            <div className="bg-white rounded-2xl border border-gray-100 p-5 glow-card">
              <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
                <ShoppingBag size={16} className="text-purple-500" />
                Menu Terlaris
              </h3>
              {topMenus.length === 0 ? (
                <div className="text-center py-8 text-gray-300 text-sm">Belum ada data penjualan</div>
              ) : (
                <div className="space-y-2">
                  {topMenus.map(([name, data], i) => (
                    <div key={name} className="flex items-center gap-3">
                      <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold
                        ${i === 0 ? 'bg-yellow-100 text-yellow-700' : i === 1 ? 'bg-gray-100 text-gray-600' : 'bg-orange-50 text-orange-500'}`}>
                        {i + 1}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-gray-800 truncate">{name}</div>
                        <div className="text-xs text-gray-400">{data.qty} porsi</div>
                      </div>
                      <div className="text-sm font-semibold text-green-600">{fmt(data.revenue)}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Daily Breakdown */}
          <div className="bg-white rounded-2xl border border-gray-100 p-5 glow-card mb-6">
            <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
              <Calendar size={16} className="text-blue-500" />
              Rincian Harian
            </h3>
            {daily.length === 0 ? (
              <div className="text-center py-8 text-gray-300 text-sm">Tidak ada transaksi pada periode ini</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead><tr className="bg-gray-50">
                    <th className="text-left px-3 py-2 text-xs text-gray-500 font-semibold rounded-l-lg">Tanggal</th>
                    <th className="text-center px-3 py-2 text-xs text-gray-500 font-semibold">Transaksi</th>
                    <th className="text-right px-3 py-2 text-xs text-gray-500 font-semibold rounded-r-lg">Pendapatan</th>
                  </tr></thead>
                  <tbody className="divide-y divide-gray-50">
                    {daily.map(([date, data]) => (
                      <tr key={date} className="hover:bg-gray-50">
                        <td className="px-3 py-2.5 text-gray-700 font-medium">
                          {new Date(date).toLocaleDateString('id-ID', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}
                        </td>
                        <td className="px-3 py-2.5 text-center">
                          <span className="bg-blue-50 text-blue-600 px-2 py-0.5 rounded-lg text-xs font-medium">{data.count} transaksi</span>
                        </td>
                        <td className="px-3 py-2.5 text-right font-semibold text-green-600">{fmt(data.revenue)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 border-gray-100 bg-blue-50">
                      <td className="px-3 py-2.5 font-bold text-gray-800">TOTAL</td>
                      <td className="px-3 py-2.5 text-center font-bold text-blue-600">{totalOrders} transaksi</td>
                      <td className="px-3 py-2.5 text-right font-bold text-green-700 text-base">{fmt(totalRevenue)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </div>

          {/* Transaction List */}
          <div className="bg-white rounded-2xl border border-gray-100 p-5 glow-card">
            <h3 className="font-bold text-gray-800 mb-4">Detail Transaksi ({displayOrders.length})</h3>
            {displayOrders.length === 0 ? (
              <div className="text-center py-8 text-gray-300 text-sm">Tidak ada transaksi</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead><tr className="bg-gray-50">
                    <th className="text-left px-3 py-2 text-xs text-gray-500 font-semibold">ID Order</th>
                    <th className="text-center px-3 py-2 text-xs text-gray-500 font-semibold">Meja</th>
                    <th className="text-left px-3 py-2 text-xs text-gray-500 font-semibold">Waktu</th>
                    <th className="text-right px-3 py-2 text-xs text-gray-500 font-semibold">Total</th>
                    <th className="text-center px-3 py-2 text-xs text-gray-500 font-semibold">Status</th>
                  </tr></thead>
                  <tbody className="divide-y divide-gray-50">
                    {displayOrders.map(o => (
                      <tr key={o.id} className="hover:bg-gray-50">
                        <td className="px-3 py-2.5 text-gray-500 font-mono text-xs">{String(o.id).slice(-8).toUpperCase()}</td>
                        <td className="px-3 py-2.5 text-center">
                          <span className="bg-purple-50 text-purple-600 px-2 py-0.5 rounded-lg text-xs font-medium">Meja {o.table_number}</span>
                        </td>
                        <td className="px-3 py-2.5 text-gray-600 text-xs">{new Date(o.created_at).toLocaleString('id-ID')}</td>
                        <td className="px-3 py-2.5 text-right font-semibold text-gray-800">{fmt(o.total_amount)}</td>
                        <td className="px-3 py-2.5 text-center">
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${o.status === 'paid' ? 'bg-green-50 text-green-600 border border-green-200' : 'bg-amber-50 text-amber-600 border border-amber-200'}`}>
                            {o.status === 'paid' ? 'Lunas' : 'Pending'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
