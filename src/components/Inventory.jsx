import { useState, useEffect, useCallback, useRef } from 'react'
import {
  Package, Plus, TrendingUp, TrendingDown, Edit2, Save, X,
  AlertTriangle, History, ShoppingCart, Truck, ClipboardList,
  RefreshCw, ImagePlus, Trash2, Camera, Pencil
} from 'lucide-react'
import { supabase } from '../supabaseClient'

const BUCKET = 'menu-images'
const PLACEHOLDER = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="80" height="80" viewBox="0 0 80 80"%3E%3Crect width="80" height="80" fill="%23f1f5f9"/%3E%3Ctext x="50%25" y="55%25" dominant-baseline="middle" text-anchor="middle" font-size="28" fill="%23cbd5e1"%3E%F0%9F%8D%BD%3C/text%3E%3C/svg%3E'

async function uploadMenuImage(file, menuId) {
  const ext  = file.name.split('.').pop()
  const path = `${menuId}.${ext}`
  const { error } = await supabase.storage.from(BUCKET).upload(path, file, { upsert: true, contentType: file.type })
  if (error) throw error
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path)
  return data.publicUrl
}

const fmt  = n => new Intl.NumberFormat('id-ID', { style:'currency', currency:'IDR', maximumFractionDigits:0 }).format(n||0)
const fmtD = d => d ? new Date(d).toLocaleDateString('id-ID',{ day:'2-digit', month:'short', year:'numeric' }) : '-'

const TABS = [
  {
    id:'stok', label:'Stok Saat Ini', icon: Package, color:'blue',
    tooltip:'Lihat posisi stok saat ini: stok awal, total masuk, total keluar, dan sisa per item. Tersedia tombol penyesuaian cepat untuk koreksi stok.',
  },
  {
    id:'masuk', label:'Catat Pembelian', icon: Truck, color:'green',
    tooltip:'Catat barang masuk dari supplier/pembelian. Isi item, jumlah, harga beli, nama supplier, dan tanggal. Stok otomatis bertambah setelah disimpan.',
  },
  {
    id:'riwayat', label:'Riwayat Arus', icon: History, color:'purple',
    tooltip:'Lihat semua riwayat pergerakan stok: barang masuk (pembelian), keluar (penjualan kasir), dan penyesuaian manual. Bisa difilter per item, tipe, dan rentang tanggal.',
  },
  {
    id:'menu', label:'Kelola Menu', icon: ClipboardList, color:'indigo',
    tooltip:'Tambah menu baru (inventory maupun non-inventory), lihat daftar semua menu beserta harga jual, tipe, dan stok saat ini.',
  },
]

const REF_TYPE_CFG = {
  purchase:   { label:'Pembelian',   color:'green',  icon: Truck },
  sale:       { label:'Penjualan',   color:'blue',   icon: ShoppingCart },
  adjustment: { label:'Penyesuaian', color:'amber',  icon: Edit2 },
  manual:     { label:'Manual',      color:'gray',   icon: Edit2 },
}

export default function Inventory({ menus, setMenus, inventory, setInventory, currentUser }) {
  const [tab,        setTab]        = useState('stok')
  const [movements,  setMovements]  = useState([])
  const [loadingMov, setLoadingMov] = useState(false)
  const [filterMenu, setFilterMenu] = useState('all')
  const [filterType, setFilterType] = useState('all')
  const [filterDate, setFilterDate] = useState({ from:'', to:'' })

  // ── form barang masuk ──────────────────────────────
  const emptyForm = { menu_id:'', qty:'', unit_cost:'', supplier:'', notes:'', movement_date: new Date().toISOString().slice(0,10) }
  const [form,    setForm]    = useState(emptyForm)
  const [fLoading,setFLoad]   = useState(false)
  const [fMsg,    setFMsg]    = useState({ type:'', text:'' })

  // ── form tambah / edit menu ────────────────────────
  const [showMenuModal, setShowMenuModal] = useState(false)
  const [editMenuId,    setEditMenuId]    = useState(null)   // null = tambah baru
  const [newMenu,       setNewMenu]       = useState({ name:'', price:'', type:'inventory', stock:'' })
  const [menuImgFile,   setMenuImgFile]   = useState(null)
  const [menuImgPreview,setMenuImgPreview]= useState(null)
  const [mLoading,      setMLoad]         = useState(false)
  const imgInputRef = useRef()

  // ── edit stok (adjustment) ─────────────────────────
  const [editId,  setEditId]  = useState(null)
  const [editVal, setEditVal] = useState({})

  const invMenus  = menus.filter(m => m.type === 'inventory')
  const allMenus  = menus

  function getInv(menuId) {
    return inventory.find(i => i.menu_id === menuId) || { stock_initial:0, stock_in:0, stock_out:0, current_stock:0 }
  }

  // ── Load riwayat ──────────────────────────────────
  const loadMovements = useCallback(async () => {
    setLoadingMov(true)
    try {
      let q = supabase
        .from('inventory_movements')
        .select('*, menus(name)')
        .order('movement_date', { ascending: false })
        .order('created_at',    { ascending: false })
        .limit(300)
      if (filterMenu !== 'all') q = q.eq('menu_id', filterMenu)
      if (filterType !== 'all') q = q.eq('type',    filterType)
      if (filterDate.from)      q = q.gte('movement_date', filterDate.from)
      if (filterDate.to)        q = q.lte('movement_date', filterDate.to)
      const { data } = await q
      setMovements(data || [])
    } catch { setMovements([]) }
    setLoadingMov(false)
  }, [filterMenu, filterType, filterDate])

  useEffect(() => {
    if (tab === 'riwayat') loadMovements()
  }, [tab, loadMovements])

  // ── Catat Barang Masuk ────────────────────────────
  async function submitPembelian(e) {
    e.preventDefault()
    if (!form.menu_id || !form.qty || parseInt(form.qty) <= 0) {
      setFMsg({ type:'error', text:'Pilih menu dan isi jumlah barang masuk' }); return
    }
    setFLoad(true); setFMsg({ type:'', text:'' })

    const qty = parseInt(form.qty)
    const inv = inventory.find(i => i.menu_id === form.menu_id)

    try {
      // 1. Insert movement record
      const { error: mErr } = await supabase.from('inventory_movements').insert({
        menu_id:       form.menu_id,
        type:          'in',
        qty,
        ref_type:      'purchase',
        supplier:      form.supplier || null,
        unit_cost:     form.unit_cost ? parseFloat(form.unit_cost) : null,
        notes:         form.notes    || null,
        movement_date: form.movement_date,
        created_by:    currentUser?.id || null,
      })
      if (mErr) throw mErr

      // 2. Update tabel inventory (stock_in += qty)
      if (inv?.id) {
        const newStockIn = (inv.stock_in || 0) + qty
        const { error: iErr } = await supabase.from('inventory')
          .update({ stock_in: newStockIn, updated_at: new Date().toISOString(), updated_by: currentUser?.id || null })
          .eq('id', inv.id)
        if (iErr) throw iErr
        setInventory(prev => prev.map(i =>
          i.menu_id === form.menu_id
            ? { ...i, stock_in: newStockIn, current_stock: i.stock_initial + newStockIn - i.stock_out }
            : i
        ))
      }

      setFMsg({ type:'success', text:`✓ ${qty} unit berhasil ditambahkan ke stok` })
      setForm(emptyForm)
    } catch (err) {
      // Fallback lokal jika Supabase belum ready
      setInventory(prev => prev.map(i => {
        if (i.menu_id !== form.menu_id) return i
        const newIn = (i.stock_in||0) + qty
        return { ...i, stock_in: newIn, current_stock: i.stock_initial + newIn - i.stock_out }
      }))
      setFMsg({ type:'success', text:`✓ ${qty} unit ditambahkan (mode lokal)` })
      setForm(emptyForm)
    }
    setFLoad(false)
  }

  // ── Adjustment stok ────────────────────────────────
  async function saveAdjustment(menuId) {
    const inv  = inventory.find(i => i.menu_id === menuId)
    const qty  = parseInt(editVal.adj_qty)  || 0
    const type = editVal.adj_type || 'in'
    if (!qty) { setEditId(null); return }

    try {
      await supabase.from('inventory_movements').insert({
        menu_id: menuId, type, qty,
        ref_type: 'adjustment',
        notes: editVal.adj_notes || 'Penyesuaian stok manual',
        movement_date: new Date().toISOString().slice(0,10),
        created_by: currentUser?.id || null,
      })
      if (inv?.id) {
        const newIn  = type === 'in'  ? (inv.stock_in  ||0) + qty : inv.stock_in  ||0
        const newOut = type === 'out' ? (inv.stock_out ||0) + qty : inv.stock_out ||0
        await supabase.from('inventory').update({ stock_in: newIn, stock_out: newOut, updated_at: new Date().toISOString() }).eq('id', inv.id)
        setInventory(prev => prev.map(i => i.menu_id === menuId
          ? { ...i, stock_in: newIn, stock_out: newOut, current_stock: i.stock_initial + newIn - newOut }
          : i))
      }
    } catch {
      setInventory(prev => prev.map(i => {
        if (i.menu_id !== menuId) return i
        const newIn  = type==='in'  ? (i.stock_in||0)+qty  : i.stock_in||0
        const newOut = type==='out' ? (i.stock_out||0)+qty : i.stock_out||0
        return { ...i, stock_in:newIn, stock_out:newOut, current_stock: i.stock_initial+newIn-newOut }
      }))
    }
    setEditId(null)
  }

  // ── Tambah / Edit Menu ─────────────────────────────
  function openAddMenu() {
    setEditMenuId(null)
    setNewMenu({ name:'', price:'', type:'inventory', stock:'' })
    setMenuImgFile(null); setMenuImgPreview(null)
    setShowMenuModal(true)
  }
  function openEditMenu(menu) {
    setEditMenuId(menu.id)
    setNewMenu({ name: menu.name, price: String(menu.price), type: menu.type, stock:'' })
    setMenuImgFile(null)
    setMenuImgPreview(menu.image_url || null)
    setShowMenuModal(true)
  }
  function onPickImage(e) {
    const file = e.target.files[0]
    if (!file) return
    setMenuImgFile(file)
    setMenuImgPreview(URL.createObjectURL(file))
  }

  async function saveMenu() {
    if (!newMenu.name || !newMenu.price) return
    setMLoad(true)

    try {
      if (editMenuId) {
        // ── UPDATE ──────────────────────────────────────────
        // Pertahankan image_url lama, ganti hanya jika ada file baru
        let image_url = menus.find(m => m.id === editMenuId)?.image_url || null

        if (menuImgFile) {
          try { image_url = await uploadMenuImage(menuImgFile, editMenuId) } catch(e) {
            console.warn('Upload gambar gagal:', e.message)
          }
        }

        const { data: m, error } = await supabase.from('menus')
          .update({ name: newMenu.name, price: parseFloat(newMenu.price), type: newMenu.type, image_url })
          .eq('id', editMenuId).select().single()
        if (error) throw error
        setMenus(prev => prev.map(x => x.id === editMenuId ? { ...x, ...m } : x))

      } else {
        // ── INSERT ──────────────────────────────────────────
        // Langkah 1: insert menu dulu TANPA image_url untuk dapat UUID asli
        const menuData = {
          name: newMenu.name, price: parseFloat(newMenu.price),
          type: newMenu.type, image_url: null,
          is_active: true, created_by: currentUser?.id || null
        }
        const { data: m, error } = await supabase.from('menus').insert(menuData).select().single()
        if (error) throw error

        // Langkah 2: upload gambar pakai UUID asli (bukan tmp ID)
        let image_url = null
        if (menuImgFile) {
          try {
            image_url = await uploadMenuImage(menuImgFile, m.id)
            await supabase.from('menus').update({ image_url }).eq('id', m.id)
            m.image_url = image_url
          } catch(e) {
            console.warn('Upload gambar gagal:', e.message)
          }
        }

        setMenus(prev => [...prev, m])

        // Langkah 3: buat record inventory jika tipe inventory
        if (newMenu.type === 'inventory') {
          const stockInit = parseInt(newMenu.stock) || 0
          const { data: inv } = await supabase.from('inventory')
            .insert({ menu_id: m.id, stock_initial: stockInit, stock_in:0, stock_out:0, updated_by: currentUser?.id||null })
            .select().single()
          setInventory(prev => [...prev, inv || { id:'local-'+Date.now(), menu_id: m.id, stock_initial: stockInit, stock_in:0, stock_out:0, current_stock: stockInit }])
          if (stockInit > 0)
            await supabase.from('inventory_movements').insert({ menu_id: m.id, type:'in', qty: stockInit, ref_type:'adjustment', notes:'Stok awal', movement_date: new Date().toISOString().slice(0,10), created_by: currentUser?.id||null })
        }
      }
    } catch(err) {
      console.error('saveMenu error:', err.message)
      if (!editMenuId) {
        // Fallback lokal jika Supabase gagal total
        const fakeId = 'local-'+Date.now()
        setMenus(prev => [...prev, { id: fakeId, name: newMenu.name, price: parseFloat(newMenu.price), type: newMenu.type, image_url: menuImgPreview, is_active: true }])
        if (newMenu.type==='inventory') {
          const s = parseInt(newMenu.stock)||0
          setInventory(prev => [...prev, { id: fakeId, menu_id: fakeId, stock_initial:s, stock_in:0, stock_out:0, current_stock:s }])
        }
      }
    }
    setNewMenu({ name:'', price:'', type:'inventory', stock:'' })
    setMenuImgFile(null); setMenuImgPreview(null)
    setShowMenuModal(false); setMLoad(false)
  }

  async function deleteMenu(menuId) {
    if (!confirm('Hapus menu ini? Stok terkait juga akan dihapus.')) return
    try { await supabase.from('menus').update({ is_active: false }).eq('id', menuId) } catch {}
    setMenus(prev => prev.filter(m => m.id !== menuId))
  }

  // ──────────────── RENDER TABS ──────────────────────
  const totalItems  = invMenus.length
  const lowStock    = invMenus.filter(m => { const i=getInv(m.id); return i.current_stock>0 && i.current_stock<=5 }).length
  const outOfStock  = invMenus.filter(m => getInv(m.id).current_stock<=0).length
  const totalStockIn  = movements.filter(v=>v.type==='in').reduce((s,v)=>s+v.qty,0)
  const totalStockOut = movements.filter(v=>v.type==='out').reduce((s,v)=>s+v.qty,0)

  return (
    <div className="p-4 md:p-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
        <div>
          <h2 className="text-xl font-bold text-gray-800">Manajemen Inventory</h2>
          <p className="text-sm text-gray-500 mt-0.5">Stok, arus barang masuk/keluar, dan riwayat transaksi</p>
        </div>
      </div>

      {/* Tab Navigation with Tooltips */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-xl mb-6 overflow-x-auto">
        {TABS.map(({ id, label, icon: Icon, color, tooltip }) => (
          <div key={id} className="relative group">
            <button
              onClick={() => setTab(id)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all
                ${tab===id
                  ? `bg-white text-${color}-600 shadow-sm border border-${color}-100 glow-${color==='indigo'?'purple':color}`
                  : 'text-gray-500 hover:text-gray-700 hover:bg-white/60'}`}
            >
              <Icon size={14} />
              {label}
            </button>

            {/* Tooltip */}
            <div className="
              absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-50
              w-64 px-3 py-2.5 rounded-xl text-xs text-white leading-relaxed
              bg-gray-800/95 backdrop-blur-sm shadow-xl
              opacity-0 invisible scale-95
              group-hover:opacity-100 group-hover:visible group-hover:scale-100
              transition-all duration-200 pointer-events-none
            ">
              {/* Arrow */}
              <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-gray-800/95" />
              <div className="flex items-start gap-2">
                <Icon size={13} className={`text-${color}-400 mt-0.5 shrink-0`} />
                <span>{tooltip}</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* ── TAB: STOK SAAT INI ── */}
      {tab === 'stok' && (
        <>
          <div className="grid grid-cols-3 gap-3 mb-5">
            {[
              { label:'Total Item',    val: totalItems,  color:'blue' },
              { label:'Stok Menipis',  val: lowStock,    color:'amber' },
              { label:'Stok Habis',    val: outOfStock,  color:'red' },
            ].map(({label,val,color}) => (
              <div key={label} className={`bg-${color}-50 border border-${color}-200 rounded-xl p-4 glow-${color==='amber'?'yellow':color}`}>
                <div className={`text-2xl font-bold text-${color}-700`}>{val}</div>
                <div className={`text-xs text-${color}-500 mt-0.5`}>{label}</div>
              </div>
            ))}
          </div>

          <div className="bg-white rounded-2xl border border-gray-100 glow-card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-100">
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Menu</th>
                    <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Stok Awal</th>
                    <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Total Masuk</th>
                    <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Total Keluar</th>
                    <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Sisa Stok</th>
                    <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Penyesuaian</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {invMenus.length === 0 && (
                    <tr><td colSpan={6} className="text-center py-12 text-gray-400">
                      <Package size={28} className="mx-auto mb-2 opacity-30"/>
                      <p>Belum ada item inventory</p>
                    </td></tr>
                  )}
                  {invMenus.map(menu => {
                    const inv = getInv(menu.id)
                    const isEmpty = inv.current_stock <= 0
                    const isLow   = !isEmpty && inv.current_stock <= 5
                    const isAdj   = editId === menu.id
                    return (
                      <tr key={menu.id} className="hover:bg-gray-50/50 transition-colors">
                        <td className="px-4 py-3">
                          <div className="font-medium text-gray-800">{menu.name}</div>
                          <div className="text-xs text-blue-500">{fmt(menu.price)}</div>
                        </td>
                        <td className="px-4 py-3 text-center text-gray-600">{inv.stock_initial}</td>
                        <td className="px-4 py-3 text-center">
                          <span className="flex items-center justify-center gap-1 text-green-600 font-medium">
                            <TrendingUp size={13}/>{inv.stock_in}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className="flex items-center justify-center gap-1 text-red-500 font-medium">
                            <TrendingDown size={13}/>{inv.stock_out}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold border
                            ${isEmpty ? 'bg-red-50 text-red-600 border-red-200'
                              : isLow  ? 'bg-amber-50 text-amber-600 border-amber-200'
                              : 'bg-green-50 text-green-600 border-green-200'}`}>
                            {isEmpty && <AlertTriangle size={11}/>}
                            {inv.current_stock}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          {isAdj ? (
                            <div className="flex items-center justify-center gap-1 flex-wrap">
                              <select value={editVal.adj_type||'in'} onChange={e=>setEditVal(v=>({...v,adj_type:e.target.value}))}
                                className="border border-gray-200 rounded-lg px-1.5 py-1 text-xs focus:outline-none focus:border-blue-400">
                                <option value="in">+ Masuk</option>
                                <option value="out">- Keluar</option>
                              </select>
                              <input type="number" min={1} value={editVal.adj_qty||''} onChange={e=>setEditVal(v=>({...v,adj_qty:e.target.value}))}
                                placeholder="Qty" className="w-14 border border-gray-200 rounded-lg px-1.5 py-1 text-xs text-center focus:outline-none focus:border-blue-400"/>
                              <input type="text" value={editVal.adj_notes||''} onChange={e=>setEditVal(v=>({...v,adj_notes:e.target.value}))}
                                placeholder="Catatan" className="w-24 border border-gray-200 rounded-lg px-1.5 py-1 text-xs focus:outline-none focus:border-blue-400"/>
                              <button onClick={()=>saveAdjustment(menu.id)} className="p-1.5 rounded-lg bg-green-50 text-green-600 border border-green-200 hover:bg-green-100"><Save size={12}/></button>
                              <button onClick={()=>setEditId(null)} className="p-1.5 rounded-lg bg-gray-50 text-gray-500 border border-gray-200 hover:bg-gray-100"><X size={12}/></button>
                            </div>
                          ) : (
                            <button onClick={()=>{setEditId(menu.id);setEditVal({adj_type:'in',adj_qty:'',adj_notes:''})}}
                              className="p-1.5 rounded-lg bg-purple-50 text-purple-600 border border-purple-200 hover:bg-purple-100 glow-purple" title="Penyesuaian stok">
                              <Edit2 size={13}/>
                            </button>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* ── TAB: CATAT PEMBELIAN ── */}
      {tab === 'masuk' && (
        <div className="max-w-xl mx-auto">
          <div className="bg-white rounded-2xl border border-gray-100 p-6 glow-card">
            <div className="flex items-center gap-2 mb-5">
              <div className="w-9 h-9 rounded-xl bg-green-50 border border-green-200 flex items-center justify-center">
                <Truck size={18} className="text-green-600"/>
              </div>
              <div>
                <h3 className="font-bold text-gray-800">Catat Barang Masuk / Pembelian</h3>
                <p className="text-xs text-gray-400">Stok akan otomatis bertambah setelah disimpan</p>
              </div>
            </div>

            {fMsg.text && (
              <div className={`mb-4 px-4 py-2.5 rounded-xl text-sm border
                ${fMsg.type==='success'
                  ? 'bg-green-50 border-green-200 text-green-700'
                  : 'bg-red-50 border-red-200 text-red-600'}`}>
                {fMsg.text}
              </div>
            )}

            <form onSubmit={submitPembelian} className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5 block">Item / Menu *</label>
                <select value={form.menu_id} onChange={e=>setForm(v=>({...v,menu_id:e.target.value}))} required
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-green-400 focus:ring-2 focus:ring-green-100">
                  <option value="">-- Pilih item inventory --</option>
                  {invMenus.map(m => {
                    const inv = getInv(m.id)
                    return <option key={m.id} value={m.id}>{m.name} (stok: {inv.current_stock})</option>
                  })}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5 block">Jumlah (Qty) *</label>
                  <input type="number" min={1} value={form.qty} onChange={e=>setForm(v=>({...v,qty:e.target.value}))} required
                    placeholder="0" className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-green-400 focus:ring-2 focus:ring-green-100"/>
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5 block">Harga Beli/Unit</label>
                  <input type="number" min={0} value={form.unit_cost} onChange={e=>setForm(v=>({...v,unit_cost:e.target.value}))}
                    placeholder="0" className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-green-400 focus:ring-2 focus:ring-green-100"/>
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5 block">Supplier / Pemasok</label>
                <input type="text" value={form.supplier} onChange={e=>setForm(v=>({...v,supplier:e.target.value}))}
                  placeholder="Nama supplier (opsional)" className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-green-400 focus:ring-2 focus:ring-green-100"/>
              </div>

              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5 block">Tanggal Pembelian</label>
                <input type="date" value={form.movement_date} onChange={e=>setForm(v=>({...v,movement_date:e.target.value}))}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-green-400 focus:ring-2 focus:ring-green-100"/>
              </div>

              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5 block">Catatan</label>
                <textarea value={form.notes} onChange={e=>setForm(v=>({...v,notes:e.target.value}))} rows={2}
                  placeholder="Keterangan tambahan..." className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm resize-none focus:outline-none focus:border-green-400 focus:ring-2 focus:ring-green-100"/>
              </div>

              {/* Preview total */}
              {form.menu_id && form.qty && (
                <div className="bg-green-50 border border-green-100 rounded-xl p-3 text-sm">
                  <div className="flex justify-between text-green-700">
                    <span>Item:</span>
                    <span className="font-medium">{invMenus.find(m=>m.id===form.menu_id)?.name}</span>
                  </div>
                  <div className="flex justify-between text-green-700 mt-1">
                    <span>Jumlah masuk:</span>
                    <span className="font-bold">+{form.qty} unit</span>
                  </div>
                  {form.unit_cost && (
                    <div className="flex justify-between text-green-700 mt-1 border-t border-green-100 pt-1">
                      <span>Total nilai:</span>
                      <span className="font-bold">{fmt(parseInt(form.qty||0)*parseFloat(form.unit_cost||0))}</span>
                    </div>
                  )}
                </div>
              )}

              <button type="submit" disabled={fLoading||!form.menu_id||!form.qty}
                className="w-full py-3 rounded-xl bg-green-600 text-white font-semibold text-sm flex items-center justify-center gap-2
                  hover:bg-green-700 disabled:opacity-40 transition-colors glow-green">
                {fLoading
                  ? <span className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full"/>
                  : <Truck size={16}/>}
                {fLoading ? 'Menyimpan...' : 'Simpan Barang Masuk'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ── TAB: RIWAYAT ARUS ── */}
      {tab === 'riwayat' && (
        <>
          {/* Filter bar */}
          <div className="bg-white rounded-2xl border border-gray-100 p-4 glow-card mb-4">
            <div className="flex flex-wrap gap-3 items-end">
              <div className="flex-1 min-w-36">
                <label className="text-xs text-gray-500 font-medium mb-1 block">Item</label>
                <select value={filterMenu} onChange={e=>setFilterMenu(e.target.value)}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-blue-400">
                  <option value="all">Semua Item</option>
                  {invMenus.map(m=><option key={m.id} value={m.id}>{m.name}</option>)}
                </select>
              </div>
              <div className="flex-1 min-w-32">
                <label className="text-xs text-gray-500 font-medium mb-1 block">Tipe</label>
                <select value={filterType} onChange={e=>setFilterType(e.target.value)}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-blue-400">
                  <option value="all">Semua</option>
                  <option value="in">Masuk</option>
                  <option value="out">Keluar</option>
                </select>
              </div>
              <div>
                <label className="text-xs text-gray-500 font-medium mb-1 block">Dari</label>
                <input type="date" value={filterDate.from} onChange={e=>setFilterDate(v=>({...v,from:e.target.value}))}
                  className="border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-blue-400"/>
              </div>
              <div>
                <label className="text-xs text-gray-500 font-medium mb-1 block">Sampai</label>
                <input type="date" value={filterDate.to} onChange={e=>setFilterDate(v=>({...v,to:e.target.value}))}
                  className="border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-blue-400"/>
              </div>
              <button onClick={loadMovements} disabled={loadingMov}
                className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white rounded-xl text-sm font-medium hover:bg-blue-700 glow-blue disabled:opacity-50">
                <RefreshCw size={13} className={loadingMov ? 'animate-spin' : ''}/>
                {loadingMov ? 'Memuat...' : 'Refresh'}
              </button>
            </div>
          </div>

          {/* Summary */}
          {movements.length > 0 && (
            <div className="grid grid-cols-2 gap-3 mb-4">
              <div className="bg-green-50 border border-green-200 rounded-xl p-4 glow-green">
                <div className="flex items-center gap-2 mb-1"><TrendingUp size={14} className="text-green-600"/><span className="text-xs text-green-500 font-medium">Total Masuk (filter)</span></div>
                <div className="text-2xl font-bold text-green-700">{totalStockIn} <span className="text-sm font-normal">unit</span></div>
              </div>
              <div className="bg-red-50 border border-red-200 rounded-xl p-4 glow-red">
                <div className="flex items-center gap-2 mb-1"><TrendingDown size={14} className="text-red-500"/><span className="text-xs text-red-400 font-medium">Total Keluar (filter)</span></div>
                <div className="text-2xl font-bold text-red-600">{totalStockOut} <span className="text-sm font-normal">unit</span></div>
              </div>
            </div>
          )}

          {/* Table */}
          <div className="bg-white rounded-2xl border border-gray-100 glow-card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-100">
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Tanggal</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Item</th>
                    <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Tipe</th>
                    <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Qty</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Supplier/Ref</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Nilai</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Catatan</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {movements.length === 0 && !loadingMov && (
                    <tr><td colSpan={7} className="text-center py-12 text-gray-400">
                      <History size={28} className="mx-auto mb-2 opacity-30"/>
                      <p>Belum ada riwayat arus inventory</p>
                      <p className="text-xs mt-1">Klik "Refresh" atau catat pembelian terlebih dahulu</p>
                    </td></tr>
                  )}
                  {loadingMov && (
                    <tr><td colSpan={7} className="text-center py-10 text-gray-400">
                      <RefreshCw size={20} className="mx-auto mb-2 animate-spin opacity-50"/>
                      <p className="text-xs">Memuat data...</p>
                    </td></tr>
                  )}
                  {!loadingMov && movements.map(mv => {
                    const refCfg = REF_TYPE_CFG[mv.ref_type] || REF_TYPE_CFG.manual
                    const isIn   = mv.type === 'in'
                    return (
                      <tr key={mv.id} className="hover:bg-gray-50/50 transition-colors">
                        <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">{fmtD(mv.movement_date)}</td>
                        <td className="px-4 py-3 font-medium text-gray-800">{mv.menus?.name || '—'}</td>
                        <td className="px-4 py-3 text-center">
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold
                            ${isIn
                              ? 'bg-green-50 text-green-700 border border-green-200'
                              : 'bg-red-50 text-red-600 border border-red-200'}`}>
                            {isIn ? <TrendingUp size={10}/> : <TrendingDown size={10}/>}
                            {isIn ? 'Masuk' : 'Keluar'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className={`font-bold text-sm ${isIn ? 'text-green-600' : 'text-red-500'}`}>
                            {isIn ? '+' : '-'}{mv.qty}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1">
                            <span className={`text-xs px-1.5 py-0.5 rounded bg-${refCfg.color}-50 text-${refCfg.color}-600 border border-${refCfg.color}-100`}>
                              {refCfg.label}
                            </span>
                            {mv.supplier && <span className="text-xs text-gray-500">{mv.supplier}</span>}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right text-xs text-gray-500">
                          {mv.unit_cost ? fmt(mv.qty * mv.unit_cost) : '—'}
                        </td>
                        <td className="px-4 py-3 text-xs text-gray-400 max-w-32 truncate">{mv.notes || '—'}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* ── TAB: KELOLA MENU ── */}
      {tab === 'menu' && (
        <>
          <div className="flex justify-between items-center mb-4">
            <p className="text-sm text-gray-500">Daftar semua menu ({allMenus.length} item)</p>
            <button onClick={openAddMenu}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-xl text-sm font-medium glow-blue hover:bg-blue-700 transition-colors">
              <Plus size={14}/>Tambah Menu
            </button>
          </div>
          <div className="bg-white rounded-2xl border border-gray-100 glow-card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-100">
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide w-12">Foto</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Nama Menu</th>
                    <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Harga</th>
                    <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Tipe</th>
                    <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Stok</th>
                    <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {allMenus.map(menu => {
                    const inv = getInv(menu.id)
                    return (
                      <tr key={menu.id} className="hover:bg-gray-50/50">
                        <td className="px-4 py-2">
                          <img
                            src={menu.image_url || PLACEHOLDER}
                            alt={menu.name}
                            className="w-10 h-10 rounded-xl object-cover border border-gray-100 shadow-sm"
                            onError={e => { e.target.src = PLACEHOLDER }}
                          />
                        </td>
                        <td className="px-4 py-3 font-medium text-gray-800">{menu.name}</td>
                        <td className="px-4 py-3 text-center text-blue-600 font-semibold">{fmt(menu.price)}</td>
                        <td className="px-4 py-3 text-center">
                          <span className={`text-xs px-2 py-0.5 rounded-full border font-medium
                            ${menu.type==='inventory'
                              ? 'bg-purple-50 text-purple-600 border-purple-200'
                              : 'bg-gray-50 text-gray-500 border-gray-200'}`}>
                            {menu.type==='inventory' ? 'Inventory' : 'Non-Inventory'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          {menu.type==='inventory'
                            ? <span className={`text-xs font-bold px-2 py-0.5 rounded-lg border
                                ${inv.current_stock<=0 ? 'bg-red-50 text-red-600 border-red-200'
                                  : inv.current_stock<=5 ? 'bg-amber-50 text-amber-600 border-amber-200'
                                  : 'bg-green-50 text-green-600 border-green-200'}`}>
                                {inv.current_stock}
                              </span>
                            : <span className="text-xs text-gray-400">—</span>}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            <button onClick={() => openEditMenu(menu)}
                              className="p-1.5 rounded-lg text-indigo-500 hover:bg-indigo-50 transition-colors" title="Edit menu">
                              <Pencil size={13}/>
                            </button>
                            <button onClick={() => deleteMenu(menu.id)}
                              className="p-1.5 rounded-lg text-red-400 hover:bg-red-50 transition-colors" title="Nonaktifkan menu">
                              <Trash2 size={13}/>
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Add / Edit Menu Modal */}
          {showMenuModal && (
            <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-50 p-4">
              <div className="bg-white rounded-2xl shadow-2xl glow-card w-full max-w-sm p-6 max-h-[90vh] overflow-y-auto">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-bold text-gray-800">{editMenuId ? 'Edit Menu' : 'Tambah Menu Baru'}</h3>
                  <button onClick={() => setShowMenuModal(false)} className="text-gray-400 hover:text-gray-600"><X size={18}/></button>
                </div>

                {/* Image Upload Area */}
                <div className="mb-4">
                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2 block">Foto Menu</label>
                  <div
                    onClick={() => imgInputRef.current?.click()}
                    className="relative w-full h-36 rounded-2xl border-2 border-dashed border-gray-200 bg-gray-50 flex flex-col items-center justify-center cursor-pointer hover:border-blue-400 hover:bg-blue-50/30 transition-all overflow-hidden">
                    {menuImgPreview
                      ? <img src={menuImgPreview} alt="preview" className="absolute inset-0 w-full h-full object-cover rounded-2xl"/>
                      : <>
                          <ImagePlus size={24} className="text-gray-300 mb-1"/>
                          <span className="text-xs text-gray-400">Klik untuk pilih gambar</span>
                          <span className="text-xs text-gray-300 mt-0.5">JPG, PNG, WebP · maks 2 MB</span>
                        </>
                    }
                    {menuImgPreview && (
                      <div className="absolute inset-0 bg-black/0 hover:bg-black/20 transition-all flex items-center justify-center">
                        <Camera size={20} className="text-white opacity-0 hover:opacity-100"/>
                      </div>
                    )}
                  </div>
                  <input ref={imgInputRef} type="file" accept="image/*" className="hidden" onChange={onPickImage}/>
                  {menuImgPreview && (
                    <button onClick={() => { setMenuImgFile(null); setMenuImgPreview(null) }}
                      className="text-xs text-red-400 hover:text-red-600 mt-1 flex items-center gap-1">
                      <X size={11}/> Hapus foto
                    </button>
                  )}
                </div>

                <div className="space-y-3">
                  <div>
                    <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1 block">Nama Menu *</label>
                    <input value={newMenu.name} onChange={e=>setNewMenu(v=>({...v,name:e.target.value}))}
                      className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100" placeholder="Nama menu"/>
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1 block">Harga Jual *</label>
                    <input type="number" value={newMenu.price} onChange={e=>setNewMenu(v=>({...v,price:e.target.value}))}
                      className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100" placeholder="0"/>
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1 block">Tipe</label>
                    <select value={newMenu.type} onChange={e=>setNewMenu(v=>({...v,type:e.target.value}))}
                      className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-blue-400">
                      <option value="inventory">Inventory (ada stok)</option>
                      <option value="non-inventory">Non-Inventory (tanpa stok)</option>
                    </select>
                  </div>
                  {newMenu.type==='inventory' && !editMenuId && (
                    <div>
                      <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1 block">Stok Awal</label>
                      <input type="number" value={newMenu.stock} onChange={e=>setNewMenu(v=>({...v,stock:e.target.value}))}
                        className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100" placeholder="0"/>
                    </div>
                  )}
                </div>
                <div className="flex gap-2 mt-5">
                  <button onClick={() => setShowMenuModal(false)} className="flex-1 py-2 rounded-xl border border-gray-200 text-sm text-gray-600 hover:bg-gray-50">Batal</button>
                  <button onClick={saveMenu} disabled={mLoading||!newMenu.name||!newMenu.price}
                    className="flex-1 py-2 rounded-xl bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 glow-blue disabled:opacity-40">
                    {mLoading ? 'Menyimpan...' : editMenuId ? 'Simpan Perubahan' : 'Tambah Menu'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
