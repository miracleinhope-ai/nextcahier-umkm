import { useState, useEffect } from 'react'
import './index.css'
import { supabase } from './supabaseClient'
import Login from './components/Login'
import Navbar from './components/Navbar'
import MejaGrid from './components/MejaGrid'
import TakingOrder from './components/TakingOrder'
import Inventory from './components/Inventory'
import Laporan from './components/Laporan'
import UserManagement from './components/UserManagement'

const DEFAULT_MENUS = [
  { id: 'm1', name: 'Nasi Goreng', price: 25000, type: 'inventory', is_active: true, image_url: null },
  { id: 'm2', name: 'Mie Goreng',  price: 22000, type: 'inventory', is_active: true, image_url: null },
  { id: 'm3', name: 'Ayam Bakar',  price: 35000, type: 'inventory', is_active: true, image_url: null },
  { id: 'm4', name: 'Es Teh Manis',price:  5000, type: 'non-inventory', is_active: true, image_url: null },
  { id: 'm5', name: 'Kopi Hitam',  price:  8000, type: 'non-inventory', is_active: true, image_url: null },
  { id: 'm6', name: 'Jus Jeruk',   price: 12000, type: 'non-inventory', is_active: true, image_url: null },
  { id: 'm7', name: 'Soto Ayam',   price: 20000, type: 'inventory', is_active: true, image_url: null },
  { id: 'm8', name: 'Gado-Gado',   price: 18000, type: 'inventory', is_active: true, image_url: null },
]
const DEFAULT_INVENTORY = [
  { id: 'i1', menu_id: 'm1', stock_initial: 50, stock_in: 0, stock_out: 0, current_stock: 50 },
  { id: 'i2', menu_id: 'm2', stock_initial: 50, stock_in: 0, stock_out: 0, current_stock: 50 },
  { id: 'i3', menu_id: 'm3', stock_initial: 30, stock_in: 0, stock_out: 0, current_stock: 30 },
  { id: 'i4', menu_id: 'm7', stock_initial: 40, stock_in: 0, stock_out: 0, current_stock: 40 },
  { id: 'i5', menu_id: 'm8', stock_initial: 35, stock_in: 0, stock_out: 0, current_stock: 35 },
]
const DEFAULT_TABLES = Array.from({ length: 8 }, (_, i) => ({
  id: `t${i+1}`, table_number: i+1,
  row_position: Math.floor(i/4), col_position: i%4, status: 'available',
}))

export default function App() {
  const [currentUser, setCurrentUser] = useState(null)
  const [activeTab, setActiveTab]     = useState('meja')
  const [tables, setTables]           = useState(DEFAULT_TABLES)
  const [menus, setMenus]             = useState(DEFAULT_MENUS)
  const [inventory, setInventory]     = useState(DEFAULT_INVENTORY)
  const [users, setUsers]             = useState([])
  const [orders, setOrders]           = useState([])
  const [selectedTable, setSelectedTable] = useState(null)

  useEffect(() => {
    if (!currentUser) return
    async function load() {
      try {
        const [{ data: m }, { data: inv }, { data: t }, { data: u }, { data: o }] = await Promise.all([
          supabase.from('menus').select('*').eq('is_active', true),
          supabase.from('inventory').select('*'),
          supabase.from('tables_layout').select('*').order('table_number'),
          supabase.from('users').select('id,username,name,role,is_active,created_at').order('created_at'),
          supabase.from('orders').select('*').order('created_at', { ascending: false }).limit(200),
        ])
        if (m?.length)   setMenus(m)
        if (inv?.length) setInventory(inv)
        if (t?.length)   setTables(t)
        if (u?.length)   setUsers(u)
        if (o?.length)   setOrders(o)
      } catch { /* pakai data default */ }
    }
    load()
  }, [currentUser])

  function handleLogin(user) {
    setCurrentUser(user)
    setActiveTab(user.role === 'kasir' ? 'order' : 'meja')
  }

  function handleLogout() {
    setCurrentUser(null)
    setActiveTab('meja')
    setSelectedTable(null)
  }

  function handleSelectTable(table) {
    setSelectedTable(table)
    setActiveTab('order')
  }

  function handleOrderComplete(order) {
    if (order) setOrders(prev => [order, ...prev])
    setSelectedTable(null)
    setActiveTab('meja')
  }

  if (!currentUser) return <Login onLogin={handleLogin} />

  const renderContent = () => {
    switch (activeTab) {
      case 'meja':
        return <MejaGrid tables={tables} setTables={setTables} onSelectTable={handleSelectTable} currentUser={currentUser} />
      case 'order':
        if (!selectedTable) return (
          <div className="p-6">
            <div className="bg-white rounded-2xl border border-gray-100 p-8 glow-card text-center max-w-md mx-auto mt-8">
              <div className="text-4xl mb-3">🪑</div>
              <h3 className="font-bold text-gray-700 mb-2">Pilih Meja Terlebih Dahulu</h3>
              <p className="text-sm text-gray-400 mb-4">Klik meja yang tersedia di Denah Meja untuk mulai order.</p>
              <button onClick={() => setActiveTab('meja')}
                className="px-5 py-2 bg-blue-600 text-white rounded-xl text-sm font-medium glow-blue hover:bg-blue-700">
                Ke Denah Meja
              </button>
            </div>
          </div>
        )
        return (
          <TakingOrder
            selectedTable={selectedTable} menus={menus}
            inventory={inventory} setInventory={setInventory}
            currentUser={currentUser}
            onBack={() => { setSelectedTable(null); setActiveTab('meja') }}
            onOrderComplete={handleOrderComplete}
          />
        )
      case 'inventory':
        return <Inventory menus={menus} setMenus={setMenus} inventory={inventory} setInventory={setInventory} currentUser={currentUser} />
      case 'laporan':
        return <Laporan orders={orders} menus={menus} currentUser={currentUser} />
      case 'users':
        return <UserManagement users={users} setUsers={setUsers} currentUser={currentUser} />
      default:
        return null
    }
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar
        activeTab={activeTab}
        setActiveTab={tab => { if (tab !== 'order') setSelectedTable(null); setActiveTab(tab) }}
        currentUser={currentUser}
        onLogout={handleLogout}
      />
      <main className="max-w-screen-2xl mx-auto">
        {renderContent()}
      </main>
    </div>
  )
}
