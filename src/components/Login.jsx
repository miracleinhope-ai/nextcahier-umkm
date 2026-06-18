import { useState } from 'react'
import { Store, Eye, EyeOff, LogIn, ShieldCheck } from 'lucide-react'
import { supabase } from '../supabaseClient'

export default function Login({ onLogin }) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState('')
  const [debugInfo, setDebugInfo] = useState('')

  async function handleLogin(e) {
    e.preventDefault()
    if (!username || !password) { setError('Username dan password wajib diisi'); return }
    setLoading(true)
    setError('')
    setDebugInfo('')

    const uname = username.trim().toLowerCase()

    try {
      // Step 1: Cari user berdasarkan username saja dulu
      const { data: rows, error: qErr } = await supabase
        .from('users')
        .select('*')
        .eq('username', uname)

      if (qErr) {
        // Kemungkinan besar RLS blocking atau tabel belum ada
        setError('Koneksi Supabase gagal: ' + qErr.message)
        setDebugInfo('Hint: Pastikan schema.sql sudah dijalankan di Supabase SQL Editor dan RLS sudah di-disable.')
        setLoading(false)
        return
      }

      if (!rows || rows.length === 0) {
        setError('Username tidak ditemukan')
        setDebugInfo(`Dicari username: "${uname}" — Pastikan sudah insert seed di schema.sql`)
        setLoading(false)
        return
      }

      const user = rows[0]

      if (!user.is_active) {
        setError('Akun ini dinonaktifkan. Hubungi administrator.')
        setLoading(false)
        return
      }

      // Step 2: Cek password
      if (user.password !== password) {
        setError('Password salah')
        setLoading(false)
        return
      }

      // Login berhasil
      onLogin(user)
    } catch (err) {
      setError('Error tidak terduga: ' + err.message)
    }
    setLoading(false)
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="absolute top-20 left-20 w-72 h-72 bg-blue-200/30 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-20 right-20 w-96 h-96 bg-purple-200/20 rounded-full blur-3xl pointer-events-none" />

      <div className="relative w-full max-w-sm">
        <div className="bg-white/90 backdrop-blur-sm rounded-3xl border border-white/60 p-8"
          style={{ boxShadow: '0 0 40px rgba(99,102,241,0.12), 0 20px 60px rgba(0,0,0,0.1)' }}>

          {/* Logo */}
          <div className="flex flex-col items-center mb-8">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center mb-3"
              style={{ boxShadow: '0 0 20px rgba(99,102,241,0.4)' }}>
              <Store size={30} className="text-white" />
            </div>
            <h1 className="text-2xl font-bold text-gray-800">KasirPOS</h1>
            <p className="text-sm text-gray-400 mt-1">Sistem Kasir Modern UMKM</p>
          </div>

          {/* Form */}
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5 block">Username</label>
              <input
                type="text"
                value={username}
                onChange={e => setUsername(e.target.value)}
                placeholder="Masukkan username"
                autoComplete="username"
                autoCapitalize="none"
                spellCheck={false}
                className="w-full border border-gray-200 bg-gray-50 rounded-xl px-4 py-3 text-sm text-gray-800 placeholder-gray-400
                  focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 focus:bg-white transition-all"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5 block">Password</label>
              <div className="relative">
                <input
                  type={showPass ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="Masukkan password"
                  autoComplete="current-password"
                  className="w-full border border-gray-200 bg-gray-50 rounded-xl px-4 py-3 pr-11 text-sm text-gray-800 placeholder-gray-400
                    focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 focus:bg-white transition-all"
                />
                <button type="button" onClick={() => setShowPass(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors">
                  {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-2.5 space-y-1">
                <div className="text-sm text-red-600 flex items-center gap-2">
                  <span>⚠</span>{error}
                </div>
                {debugInfo && (
                  <div className="text-xs text-red-400 border-t border-red-100 pt-1">{debugInfo}</div>
                )}
              </div>
            )}

            <button type="submit" disabled={loading}
              className="w-full py-3 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-semibold text-sm
                flex items-center justify-center gap-2 hover:from-blue-700 hover:to-indigo-700
                disabled:opacity-60 disabled:cursor-not-allowed transition-all duration-200 mt-2"
              style={{ boxShadow: '0 0 20px rgba(99,102,241,0.3)' }}>
              {loading
                ? <span className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
                : <LogIn size={16} />}
              {loading ? 'Memverifikasi...' : 'Masuk'}
            </button>
          </form>

          <div className="mt-5 flex items-center justify-center gap-2 text-xs text-gray-400">
            <ShieldCheck size={13} className="text-indigo-400" />
            <span>Akses dibatasi berdasarkan role pengguna</span>
          </div>
        </div>
        <p className="text-center text-xs text-gray-400 mt-4">v1.0.0 · KasirPOS UMKM</p>
      </div>
    </div>
  )
}
