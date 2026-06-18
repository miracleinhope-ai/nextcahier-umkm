import { useState } from 'react'
import { Users, Plus, Edit2, Trash2, Save, X, Shield, User, Crown, Eye, EyeOff } from 'lucide-react'
import { supabase } from '../supabaseClient'

const ROLE_CFG = {
  superadmin: { label: 'Super Admin', color: 'indigo', icon: Crown,
    desc: 'Akses penuh termasuk hapus data & konfigurasi sistem' },
  admin:      { label: 'Admin',       color: 'purple', icon: Shield,
    desc: 'Semua modul: laporan, inventory, manajemen user' },
  kasir:      { label: 'Kasir',       color: 'blue',   icon: User,
    desc: 'Kasir/Order & Inventory saja' },
}

export default function UserManagement({ users, setUsers, currentUser }) {
  const [showAdd, setShowAdd]   = useState(false)
  const [editId, setEditId]     = useState(null)
  const [form, setForm]         = useState({ username: '', name: '', role: 'kasir', password: '' })
  const [editForm, setEditForm] = useState({})
  const [showPw, setShowPw]     = useState(false)
  const [loading, setLoading]   = useState(false)
  const [msg, setMsg]           = useState('')

  const isSuperAdmin = currentUser?.role === 'superadmin'

  async function addUser() {
    if (!form.username || !form.name || !form.password) {
      setMsg('Username, nama, dan password wajib diisi'); return
    }
    setLoading(true); setMsg('')
    const data = {
      username: form.username.trim().toLowerCase(),
      name: form.name.trim(),
      role: form.role,
      password: form.password,
      is_active: true,
      created_by: currentUser?.id || null,
    }
    try {
      const { data: u, error } = await supabase.from('users').insert(data).select().single()
      if (error) throw error
      setUsers(prev => [...prev, u])
    } catch (err) {
      setMsg(err.message?.includes('unique') ? 'Username sudah digunakan' : 'Gagal: ' + err.message)
      setLoading(false); return
    }
    setForm({ username: '', name: '', role: 'kasir', password: '' })
    setShowAdd(false); setLoading(false)
  }

  async function saveEdit(id) {
    setLoading(true)
    const payload = { name: editForm.name, role: editForm.role }
    if (editForm.password) payload.password = editForm.password
    try {
      const { error } = await supabase.from('users').update(payload).eq('id', id)
      if (error) throw error
    } catch {}
    setUsers(prev => prev.map(u => u.id === id ? { ...u, ...payload } : u))
    setEditId(null); setLoading(false)
  }

  async function toggleActive(u) {
    const val = !u.is_active
    try { await supabase.from('users').update({ is_active: val }).eq('id', u.id) } catch {}
    setUsers(prev => prev.map(x => x.id === u.id ? { ...x, is_active: val } : x))
  }

  async function deleteUser(id) {
    if (!confirm('Hapus user ini secara permanen?')) return
    try { await supabase.from('users').delete().eq('id', id) } catch {}
    setUsers(prev => prev.filter(u => u.id !== id))
  }

  const counts = { superadmin: 0, admin: 0, kasir: 0 }
  users.forEach(u => { if (counts[u.role] !== undefined) counts[u.role]++ })

  return (
    <div className="p-4 md:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div>
          <h2 className="text-xl font-bold text-gray-800">Manajemen User</h2>
          <p className="text-sm text-gray-500 mt-0.5">Kelola akun dan hak akses pengguna sistem</p>
        </div>
        {isSuperAdmin && (
          <button onClick={() => { setShowAdd(true); setMsg('') }}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-xl text-sm font-medium glow-purple hover:bg-indigo-700 transition-colors">
            <Plus size={15} /> Tambah User
          </button>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        {[
          { key: 'superadmin', label: 'Super Admin', color: 'indigo', icon: Crown },
          { key: 'admin',      label: 'Admin',       color: 'purple', icon: Shield },
          { key: 'kasir',      label: 'Kasir',       color: 'blue',   icon: User },
        ].map(({ key, label, color, icon: Icon }) => (
          <div key={key} className={`bg-${color}-50 border border-${color}-200 rounded-xl p-4 glow-${color === 'indigo' ? 'purple' : color}`}>
            <div className="flex items-center gap-2 mb-1">
              <Icon size={14} className={`text-${color}-600`} />
              <span className={`text-xs text-${color}-500 font-medium`}>{label}</span>
            </div>
            <div className={`text-2xl font-bold text-${color}-700`}>{counts[key]}</div>
          </div>
        ))}
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-gray-100 glow-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Nama</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Username</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Role</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Status</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {users.length === 0 && (
                <tr><td colSpan={5} className="text-center py-12 text-gray-400">
                  <Users size={28} className="mx-auto mb-2 opacity-30" />
                  <p>Belum ada data user</p>
                </td></tr>
              )}
              {users.map(u => {
                const rc = ROLE_CFG[u.role] || ROLE_CFG.kasir
                const isEditing = editId === u.id
                const isMe = currentUser?.id === u.id
                const isSA = u.role === 'superadmin'
                return (
                  <tr key={u.id} className={`transition-colors ${isMe ? 'bg-blue-50/40' : 'hover:bg-gray-50/50'} ${!u.is_active ? 'opacity-50' : ''}`}>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold
                          ${isSA ? 'bg-gradient-to-br from-indigo-400 to-indigo-600'
                            : u.role === 'admin' ? 'bg-gradient-to-br from-purple-400 to-purple-600'
                            : 'bg-gradient-to-br from-blue-400 to-blue-600'}`}>
                          {u.name?.[0]?.toUpperCase()}
                        </div>
                        {isEditing ? (
                          <input value={editForm.name} onChange={e => setEditForm(v => ({ ...v, name: e.target.value }))}
                            className="border border-gray-200 rounded-lg px-2 py-1 text-sm focus:outline-none focus:border-blue-400 w-32" />
                        ) : (
                          <span className="font-medium text-gray-800">
                            {u.name}
                            {isMe && <span className="ml-1 text-xs text-blue-500 bg-blue-50 px-1.5 py-0.5 rounded">(Anda)</span>}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="font-mono text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded-lg">{u.username}</span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      {isEditing && !isSA ? (
                        <select value={editForm.role} onChange={e => setEditForm(v => ({ ...v, role: e.target.value }))}
                          className="border border-gray-200 rounded-lg px-2 py-1 text-xs focus:outline-none focus:border-blue-400">
                          <option value="admin">Admin</option>
                          <option value="kasir">Kasir</option>
                        </select>
                      ) : (
                        <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium border
                          ${isSA ? 'bg-indigo-50 text-indigo-700 border-indigo-200'
                            : u.role === 'admin' ? 'bg-purple-50 text-purple-600 border-purple-200'
                            : 'bg-blue-50 text-blue-600 border-blue-200'}`}>
                          <rc.icon size={11} />{rc.label}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium border
                        ${u.is_active ? 'bg-green-50 text-green-600 border-green-200' : 'bg-gray-100 text-gray-400 border-gray-200'}`}>
                        {u.is_active ? 'Aktif' : 'Nonaktif'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      {isEditing ? (
                        <div className="flex items-center justify-center gap-1">
                          <input type="password" value={editForm.password || ''} placeholder="Password baru"
                            onChange={e => setEditForm(v => ({ ...v, password: e.target.value }))}
                            className="border border-gray-200 rounded-lg px-2 py-1 text-xs w-28 focus:outline-none focus:border-blue-400" />
                          <button onClick={() => saveEdit(u.id)} disabled={loading}
                            className="p-1.5 rounded-lg bg-green-50 text-green-600 border border-green-200 hover:bg-green-100 glow-green">
                            <Save size={13} />
                          </button>
                          <button onClick={() => setEditId(null)}
                            className="p-1.5 rounded-lg bg-gray-50 text-gray-500 border border-gray-200 hover:bg-gray-100">
                            <X size={13} />
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center justify-center gap-1">
                          {(isSuperAdmin || (!isSA && currentUser?.role === 'admin')) && (
                            <button onClick={() => { setEditId(u.id); setEditForm({ name: u.name, role: u.role, password: '' }) }}
                              className="p-1.5 rounded-lg bg-blue-50 text-blue-600 border border-blue-200 hover:bg-blue-100 glow-blue">
                              <Edit2 size={13} />
                            </button>
                          )}
                          {isSuperAdmin && !isMe && (
                            <button onClick={() => toggleActive(u)} title={u.is_active ? 'Nonaktifkan' : 'Aktifkan'}
                              className={`p-1.5 rounded-lg border text-xs font-bold transition-colors
                                ${u.is_active ? 'bg-amber-50 text-amber-600 border-amber-200 hover:bg-amber-100'
                                  : 'bg-green-50 text-green-600 border-green-200 hover:bg-green-100'}`}>
                              {u.is_active ? '⏸' : '▶'}
                            </button>
                          )}
                          {isSuperAdmin && !isMe && !isSA && (
                            <button onClick={() => deleteUser(u.id)}
                              className="p-1.5 rounded-lg bg-red-50 text-red-500 border border-red-200 hover:bg-red-100 glow-red">
                              <Trash2 size={13} />
                            </button>
                          )}
                        </div>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Modal */}
      {showAdd && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl glow-card w-full max-w-sm p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-gray-800">Tambah User Baru</h3>
              <button onClick={() => setShowAdd(false)} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
            </div>
            {msg && <div className="mb-3 text-xs text-red-600 bg-red-50 border border-red-200 rounded-xl px-3 py-2">{msg}</div>}
            <div className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1 block">Username *</label>
                <input value={form.username} onChange={e => setForm(v => ({ ...v, username: e.target.value }))}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                  placeholder="contoh: kasir01" />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1 block">Nama Lengkap *</label>
                <input value={form.name} onChange={e => setForm(v => ({ ...v, name: e.target.value }))}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                  placeholder="Nama lengkap" />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1 block">Role</label>
                <select value={form.role} onChange={e => setForm(v => ({ ...v, role: e.target.value }))}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-blue-400">
                  <option value="kasir">Kasir</option>
                  <option value="admin">Admin</option>
                </select>
                <p className="text-xs text-gray-400 mt-1">{ROLE_CFG[form.role]?.desc}</p>
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1 block">Password *</label>
                <div className="relative">
                  <input type={showPw ? 'text' : 'password'} value={form.password}
                    onChange={e => setForm(v => ({ ...v, password: e.target.value }))}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2 pr-9 text-sm focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                    placeholder="Min. 6 karakter" />
                  <button type="button" onClick={() => setShowPw(v => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                    {showPw ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </div>
              </div>
            </div>
            <div className="flex gap-2 mt-5">
              <button onClick={() => setShowAdd(false)}
                className="flex-1 py-2 rounded-xl border border-gray-200 text-sm text-gray-600 hover:bg-gray-50">Batal</button>
              <button onClick={addUser} disabled={loading || !form.username || !form.name || !form.password}
                className="flex-1 py-2 rounded-xl bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 glow-purple disabled:opacity-40">
                {loading ? 'Menyimpan...' : 'Simpan'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
