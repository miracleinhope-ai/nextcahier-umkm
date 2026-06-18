import { useState } from 'react'
import { LayoutGrid, ShoppingCart, Package, BarChart2, Users, ChevronDown, Store, LogOut, Crown, Shield, User } from 'lucide-react'

const ALL_TABS = [
  { id: 'meja',      label: 'Denah Meja',     icon: LayoutGrid,  roles: ['superadmin','admin','kasir'] },
  { id: 'order',     label: 'Kasir/Order',    icon: ShoppingCart,roles: ['superadmin','admin','kasir'] },
  { id: 'inventory', label: 'Inventory',      icon: Package,     roles: ['superadmin','admin','kasir'] },
  { id: 'laporan',   label: 'Laporan',        icon: BarChart2,   roles: ['superadmin','admin'] },
  { id: 'users',     label: 'Manajemen User', icon: Users,       roles: ['superadmin','admin'] },
]

const ROLE_ICON = { superadmin: Crown, admin: Shield, kasir: User }
const ROLE_COLOR = { superadmin: 'from-indigo-400 to-indigo-600', admin: 'from-purple-400 to-purple-600', kasir: 'from-blue-400 to-blue-600' }

export default function Navbar({ activeTab, setActiveTab, currentUser, onLogout }) {
  const [open, setOpen] = useState(false)

  const tabs = ALL_TABS.filter(t => t.roles.includes(currentUser?.role))
  const active = tabs.find(t => t.id === activeTab) || tabs[0]
  const RoleIcon = ROLE_ICON[currentUser?.role] || User

  return (
    <nav className="bg-white border-b border-gray-100 shadow-sm sticky top-0 z-50">
      <div className="max-w-screen-2xl mx-auto px-4 flex items-center justify-between h-14">
        {/* Logo */}
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center glow-blue">
            <Store size={16} className="text-white" />
          </div>
          <span className="font-bold text-gray-800 text-sm hidden sm:block">KasirPOS</span>
        </div>

        {/* Desktop Nav */}
        <div className="hidden md:flex items-center gap-1">
          {tabs.map(({ id, label, icon: Icon }) => (
            <button key={id} onClick={() => setActiveTab(id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all duration-200
                ${activeTab === id
                  ? 'bg-blue-50 text-blue-600 border border-blue-200 glow-blue'
                  : 'text-gray-500 hover:bg-gray-50 hover:text-gray-700'}`}>
              <Icon size={15} />{label}
            </button>
          ))}
        </div>

        {/* Mobile Dropdown */}
        <div className="md:hidden relative">
          <button onClick={() => setOpen(o => !o)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium bg-blue-50 text-blue-600 border border-blue-200 glow-blue">
            {active?.icon && <active.icon size={15} />}
            {active?.label}
            <ChevronDown size={14} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
          </button>
          {open && (
            <div className="absolute right-0 top-10 bg-white border border-gray-100 rounded-xl shadow-lg overflow-hidden w-52 glow-card z-50">
              {tabs.map(({ id, label, icon: Icon }) => (
                <button key={id} onClick={() => { setActiveTab(id); setOpen(false) }}
                  className={`w-full flex items-center gap-2 px-4 py-2.5 text-sm transition-colors
                    ${activeTab === id ? 'bg-blue-50 text-blue-600 font-medium' : 'text-gray-600 hover:bg-gray-50'}`}>
                  <Icon size={15} />{label}
                </button>
              ))}
              <div className="border-t border-gray-100">
                <button onClick={onLogout}
                  className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-red-500 hover:bg-red-50 transition-colors">
                  <LogOut size={15} />Keluar
                </button>
              </div>
            </div>
          )}
        </div>

        {/* User Info + Logout */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2 px-3 py-1.5 bg-gray-50 rounded-lg border border-gray-100">
            <div className={`w-6 h-6 rounded-full bg-gradient-to-br ${ROLE_COLOR[currentUser?.role] || 'from-blue-400 to-purple-500'} flex items-center justify-center`}>
              <span className="text-white text-xs font-bold">{currentUser?.name?.[0] || 'A'}</span>
            </div>
            <div className="hidden sm:block">
              <div className="text-xs font-semibold text-gray-700 leading-none">{currentUser?.name}</div>
              <div className="flex items-center gap-0.5 mt-0.5">
                <RoleIcon size={10} className="text-gray-400" />
                <span className="text-xs text-gray-400 capitalize">{currentUser?.role}</span>
              </div>
            </div>
          </div>
          <button onClick={onLogout} title="Keluar"
            className="hidden md:flex p-2 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 border border-gray-100 transition-colors">
            <LogOut size={15} />
          </button>
        </div>
      </div>
    </nav>
  )
}
