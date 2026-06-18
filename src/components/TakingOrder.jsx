import { useState, useRef } from 'react'
import { ShoppingCart, Plus, Minus, Trash2, Printer, X, Search, Filter, CreditCard, Banknote } from 'lucide-react'
import { supabase } from '../supabaseClient'

const PLACEHOLDER_IMG = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="80" height="80" viewBox="0 0 80 80"%3E%3Crect width="80" height="80" fill="%23f1f5f9"/%3E%3Ctext x="50%25" y="55%25" dominant-baseline="middle" text-anchor="middle" font-size="28" fill="%23cbd5e1"%3E🍽%3C/text%3E%3C/svg%3E'

function fmt(n) {
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(n)
}

export default function TakingOrder({ selectedTable, menus, inventory, setInventory, currentUser, onBack, onOrderComplete }) {
  const [cart, setCart] = useState([])
  const [filter, setFilter] = useState('all')
  const [search, setSearch] = useState('')
  const [showPayModal, setShowPayModal] = useState(false)
  const [showPrintModal, setShowPrintModal] = useState(false)
  const [payAmount, setPayAmount] = useState('')
  const [lastOrder, setLastOrder] = useState(null)
  const [loading, setLoading] = useState(false)
  const printRef = useRef()

  const filteredMenus = menus.filter(m => {
    if (!m.is_active) return false
    if (filter !== 'all' && m.type !== filter) return false
    if (search && !m.name.toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  function getStock(menuId) {
    const inv = inventory.find(i => i.menu_id === menuId)
    return inv ? inv.current_stock : 0
  }

  function addToCart(menu) {
    if (menu.type === 'inventory') {
      const stock = getStock(menu.id)
      const inCart = cart.find(c => c.menu_id === menu.id)?.qty || 0
      if (inCart >= stock) { alert(`Stok ${menu.name} hanya tersisa ${stock}`); return }
    }
    setCart(prev => {
      const existing = prev.find(c => c.menu_id === menu.id)
      if (existing) return prev.map(c => c.menu_id === menu.id ? { ...c, qty: c.qty + 1 } : c)
      return [...prev, { menu_id: menu.id, name: menu.name, price: menu.price, qty: 1, type: menu.type }]
    })
  }

  function updateQty(menuId, delta) {
    setCart(prev => prev
      .map(c => c.menu_id === menuId ? { ...c, qty: c.qty + delta } : c)
      .filter(c => c.qty > 0)
    )
  }

  const total = cart.reduce((s, c) => s + c.price * c.qty, 0)
  const change = parseFloat(payAmount) - total

  async function handlePay() {
    if (!payAmount || parseFloat(payAmount) < total) { alert('Jumlah bayar kurang!'); return }
    setLoading(true)
    try {
      const orderData = {
        table_number: selectedTable.table_number,
        total_amount: total,
        status: 'paid',
        paid_amount: parseFloat(payAmount),
        change_amount: change,
        created_by: currentUser?.id || null,
      }
      const { data: order, error: oErr } = await supabase.from('orders').insert(orderData).select().single()
      if (oErr) throw oErr

      const items = cart.map(c => ({
        order_id: order.id,
        menu_id: c.menu_id,
        menu_name: c.name,
        qty: c.qty,
        price: c.price,
        created_by: currentUser?.id || null,
      }))
      const { error: iErr } = await supabase.from('order_items').insert(items)
      if (iErr) throw iErr

      // Update inventory stock_out + catat movement
      const invUpdates = cart.filter(c => c.type === 'inventory')
      for (const item of invUpdates) {
        const inv = inventory.find(i => i.menu_id === item.menu_id)
        if (inv) {
          await supabase.from('inventory')
            .update({ stock_out: inv.stock_out + item.qty, updated_by: currentUser?.id || null, updated_at: new Date().toISOString() })
            .eq('id', inv.id)
          // Catat arus keluar ke inventory_movements
          await supabase.from('inventory_movements').insert({
            menu_id:       item.menu_id,
            type:          'out',
            qty:           item.qty,
            ref_type:      'sale',
            ref_id:        order.id,
            notes:         `Penjualan - Meja ${selectedTable.table_number}`,
            movement_date: new Date().toISOString().slice(0, 10),
            created_by:    currentUser?.id || null,
          })
          setInventory(prev => prev.map(i => i.menu_id === item.menu_id
            ? { ...i, stock_out: i.stock_out + item.qty, current_stock: i.stock_initial + i.stock_in - (i.stock_out + item.qty) }
            : i
          ))
        }
      }

      setLastOrder({ ...order, items: cart, tableNumber: selectedTable.table_number })
      setShowPayModal(false)
      setShowPrintModal(true)
    } catch (err) {
      // Fallback: simulate locally if Supabase not configured
      const mockOrder = {
        id: 'LOCAL-' + Date.now(),
        table_number: selectedTable.table_number,
        total_amount: total,
        paid_amount: parseFloat(payAmount),
        change_amount: change,
        created_at: new Date().toISOString(),
        items: cart,
        tableNumber: selectedTable.table_number,
      }
      setLastOrder(mockOrder)
      setShowPayModal(false)
      setShowPrintModal(true)
    }
    setLoading(false)
  }

  function handlePrint() {
    window.print()
  }

  function handleDone() {
    setShowPrintModal(false)
    setCart([])
    onOrderComplete && onOrderComplete(lastOrder)
    onBack()
  }

  return (
    <div className="flex flex-col lg:flex-row h-[calc(100vh-56px)] overflow-hidden">
      {/* Left: Menu Grid */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Subheader */}
        <div className="px-4 pt-4 pb-3 bg-white border-b border-gray-100">
          <div className="flex items-center justify-between mb-3">
            <div>
              <button onClick={onBack} className="text-xs text-gray-400 hover:text-gray-600 mb-1 block">← Kembali ke Denah Meja</button>
              <h2 className="text-lg font-bold text-gray-800">
                Meja {selectedTable?.table_number} — Pilih Menu
              </h2>
            </div>
          </div>
          <div className="flex gap-2 flex-wrap">
            <div className="relative flex-1 min-w-40">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                value={search} onChange={e => setSearch(e.target.value)}
                placeholder="Cari menu..."
                className="w-full pl-8 pr-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
              />
            </div>
            {['all','inventory','non-inventory'].map(f => (
              <button key={f}
                onClick={() => setFilter(f)}
                className={`px-3 py-2 rounded-xl text-xs font-medium border transition-all
                  ${filter === f
                    ? 'bg-blue-50 text-blue-600 border-blue-300 glow-blue'
                    : 'bg-white text-gray-500 border-gray-200 hover:bg-gray-50'}`}>
                {f === 'all' ? 'Semua' : f === 'inventory' ? 'Inventory' : 'Non-Inventory'}
              </button>
            ))}
          </div>
        </div>

        {/* Menu Cards */}
        <div className="flex-1 overflow-y-auto p-4">
          <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3">
            {filteredMenus.map(menu => {
              const stock = menu.type === 'inventory' ? getStock(menu.id) : null
              const inCart = cart.find(c => c.menu_id === menu.id)?.qty || 0
              const outOfStock = menu.type === 'inventory' && stock <= 0
              return (
                <button
                  key={menu.id}
                  onClick={() => !outOfStock && addToCart(menu)}
                  disabled={outOfStock}
                  className={`relative bg-white rounded-2xl border-2 p-3 flex flex-col items-center gap-2 text-left transition-all duration-200
                    ${outOfStock
                      ? 'border-gray-100 opacity-50 cursor-not-allowed'
                      : inCart > 0
                      ? 'border-blue-300 bg-blue-50 glow-blue hover:scale-105'
                      : 'border-gray-100 hover:border-blue-200 hover:bg-blue-50/50 hover:scale-105 glow-card'
                    }`}
                >
                  <img
                    src={menu.image_url || PLACEHOLDER_IMG}
                    alt={menu.name}
                    className="w-16 h-16 object-cover rounded-xl"
                    onError={e => { e.target.src = PLACEHOLDER_IMG }}
                  />
                  <div className="w-full text-center">
                    <div className="text-xs font-semibold text-gray-800 truncate">{menu.name}</div>
                    <div className="text-xs text-blue-600 font-bold mt-0.5">{fmt(menu.price)}</div>
                    {menu.type === 'inventory' && (
                      <div className={`text-xs mt-0.5 ${stock <= 5 ? 'text-red-500' : 'text-gray-400'}`}>
                        Stok: {stock}
                      </div>
                    )}
                  </div>
                  {inCart > 0 && (
                    <div className="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-blue-600 text-white text-xs flex items-center justify-center font-bold glow-blue">
                      {inCart}
                    </div>
                  )}
                  {outOfStock && (
                    <div className="absolute inset-0 rounded-2xl bg-gray-50/80 flex items-center justify-center">
                      <span className="text-xs font-bold text-gray-400">Habis</span>
                    </div>
                  )}
                </button>
              )
            })}
          </div>
          {filteredMenus.length === 0 && (
            <div className="text-center py-16 text-gray-400">
              <ShoppingCart size={32} className="mx-auto mb-2 opacity-30" />
              <p className="text-sm">Tidak ada menu ditemukan</p>
            </div>
          )}
        </div>
      </div>

      {/* Right: Cart */}
      <div className="w-full lg:w-80 bg-white border-t lg:border-t-0 lg:border-l border-gray-100 flex flex-col shadow-lg">
        <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-2">
          <ShoppingCart size={18} className="text-blue-600" />
          <h3 className="font-bold text-gray-800">Pesanan Meja {selectedTable?.table_number}</h3>
          {cart.length > 0 && (
            <span className="ml-auto text-xs bg-blue-100 text-blue-600 px-2 py-0.5 rounded-full font-medium">{cart.reduce((s,c)=>s+c.qty,0)} item</span>
          )}
        </div>

        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {cart.length === 0 ? (
            <div className="text-center py-10 text-gray-300">
              <ShoppingCart size={28} className="mx-auto mb-2" />
              <p className="text-sm">Keranjang kosong</p>
            </div>
          ) : cart.map(item => (
            <div key={item.menu_id} className="bg-gray-50 rounded-xl p-3 flex items-center gap-2">
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-gray-800 truncate">{item.name}</div>
                <div className="text-xs text-blue-600 font-semibold">{fmt(item.price)}</div>
              </div>
              <div className="flex items-center gap-1.5">
                <button onClick={() => updateQty(item.menu_id, -1)} className="w-6 h-6 rounded-lg bg-white border border-gray-200 flex items-center justify-center hover:bg-red-50 hover:border-red-300 transition-colors">
                  <Minus size={12} className="text-gray-600" />
                </button>
                <span className="text-sm font-bold w-5 text-center">{item.qty}</span>
                <button onClick={() => updateQty(item.menu_id, 1)} className="w-6 h-6 rounded-lg bg-white border border-gray-200 flex items-center justify-center hover:bg-blue-50 hover:border-blue-300 transition-colors">
                  <Plus size={12} className="text-gray-600" />
                </button>
              </div>
              <div className="text-xs font-bold text-gray-700 w-16 text-right">{fmt(item.price * item.qty)}</div>
            </div>
          ))}
        </div>

        <div className="p-4 border-t border-gray-100 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-500">Subtotal</span>
            <span className="text-sm font-medium text-gray-700">{fmt(total)}</span>
          </div>
          <div className="flex items-center justify-between border-t border-gray-100 pt-2">
            <span className="font-bold text-gray-800">Total</span>
            <span className="text-lg font-bold text-blue-600">{fmt(total)}</span>
          </div>
          <button
            onClick={() => cart.length > 0 && setShowPayModal(true)}
            disabled={cart.length === 0}
            className="w-full py-3 rounded-xl bg-blue-600 text-white font-bold text-sm flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-blue-700 transition-colors glow-blue"
          >
            <CreditCard size={16} />
            Bayar Sekarang
          </button>
        </div>
      </div>

      {/* Pay Modal */}
      {showPayModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl glow-card w-full max-w-sm p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-gray-800">Pembayaran</h3>
              <button onClick={() => setShowPayModal(false)} className="text-gray-400 hover:text-gray-600"><X size={18}/></button>
            </div>
            <div className="bg-blue-50 rounded-xl p-4 mb-4 text-center border border-blue-100">
              <div className="text-sm text-blue-500 mb-1">Total Pembayaran</div>
              <div className="text-3xl font-bold text-blue-700">{fmt(total)}</div>
            </div>
            <div className="mb-4">
              <label className="text-sm font-medium text-gray-600 mb-1 block">Jumlah Bayar</label>
              <div className="relative">
                <Banknote size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="number" value={payAmount} onChange={e => setPayAmount(e.target.value)}
                  placeholder="0"
                  className="w-full pl-9 pr-3 py-3 border border-gray-200 rounded-xl text-lg font-bold focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                  autoFocus
                />
              </div>
            </div>
            {/* Quick amounts */}
            <div className="grid grid-cols-3 gap-2 mb-4">
              {[total, Math.ceil(total/10000)*10000, Math.ceil(total/50000)*50000].filter((v,i,a)=>a.indexOf(v)===i).map(v => (
                <button key={v} onClick={() => setPayAmount(String(v))}
                  className="py-2 text-xs font-medium rounded-xl border border-blue-200 bg-blue-50 text-blue-600 hover:bg-blue-100 transition-colors">
                  {fmt(v)}
                </button>
              ))}
            </div>
            {payAmount && parseFloat(payAmount) >= total && (
              <div className="bg-green-50 border border-green-200 rounded-xl p-3 mb-4 text-center glow-green">
                <div className="text-sm text-green-600">Kembalian</div>
                <div className="text-xl font-bold text-green-700">{fmt(change)}</div>
              </div>
            )}
            <button
              onClick={handlePay}
              disabled={loading || !payAmount || parseFloat(payAmount) < total}
              className="w-full py-3 rounded-xl bg-green-600 text-white font-bold text-sm flex items-center justify-center gap-2 disabled:opacity-40 hover:bg-green-700 transition-colors glow-green"
            >
              {loading ? 'Memproses...' : '✓ Konfirmasi Bayar'}
            </button>
          </div>
        </div>
      )}

      {/* Print Modal */}
      {showPrintModal && lastOrder && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl glow-card w-full max-w-sm">
            <div className="p-4 border-b border-gray-100 flex items-center justify-between">
              <h3 className="font-bold text-gray-800">Struk Pembayaran</h3>
              <button onClick={handleDone} className="text-gray-400 hover:text-gray-600"><X size={18}/></button>
            </div>

            {/* Print Area */}
            <div id="print-area" ref={printRef} className="p-6 font-mono text-xs">
              <div className="text-center mb-4">
                <div className="text-lg font-bold">KASIR POS</div>
                <div className="text-gray-500">Struk Pembayaran</div>
                <div className="border-t border-dashed border-gray-300 mt-2 pt-2">
                  No: {String(lastOrder.id).slice(-8).toUpperCase()}<br/>
                  {new Date(lastOrder.created_at).toLocaleString('id-ID')}<br/>
                  Meja: {lastOrder.tableNumber}
                </div>
              </div>
              <div className="border-t border-dashed border-gray-300 my-2" />
              {lastOrder.items.map((item, i) => (
                <div key={i} className="flex justify-between mb-1">
                  <div>
                    <div>{item.name}</div>
                    <div className="text-gray-500">{item.qty} x {fmt(item.price)}</div>
                  </div>
                  <div className="font-bold">{fmt(item.price * item.qty)}</div>
                </div>
              ))}
              <div className="border-t border-dashed border-gray-300 my-2" />
              <div className="flex justify-between font-bold">
                <span>TOTAL</span><span>{fmt(lastOrder.total_amount)}</span>
              </div>
              <div className="flex justify-between">
                <span>Bayar</span><span>{fmt(lastOrder.paid_amount)}</span>
              </div>
              <div className="flex justify-between text-green-700 font-bold">
                <span>Kembali</span><span>{fmt(lastOrder.change_amount)}</span>
              </div>
              <div className="text-center mt-4 text-gray-500">
                Terima kasih atas kunjungan Anda!
              </div>
            </div>

            <div className="p-4 border-t border-gray-100 flex gap-2">
              <button onClick={handlePrint} className="flex-1 py-2.5 rounded-xl border border-blue-300 bg-blue-50 text-blue-600 text-sm font-medium flex items-center justify-center gap-2 hover:bg-blue-100 glow-blue">
                <Printer size={15} />Cetak Struk
              </button>
              <button onClick={handleDone} className="flex-1 py-2.5 rounded-xl bg-green-600 text-white text-sm font-medium hover:bg-green-700 glow-green">
                Selesai
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
