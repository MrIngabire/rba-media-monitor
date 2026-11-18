/**
 * RBA AI Media Monitoring & Fake News Detection Platform
 * Frontend matches prototype (rba_ai_media_monitoring_platform_prototype.html)
 * Screens: Fig 5.1–5.6. All data fetched from Django API (no hardcoded analytics).
 */
import React, { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { BrowserRouter, Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import axios from 'axios'
import {
  LayoutDashboard, LogOut, PlusCircle, RefreshCw, ShieldAlert, UserCheck,
  ChartPie, Sliders, FileDown, Search, TriangleAlert, CheckCircle, Clock,
  Rss, Bell, X, Trash2, UserPlus, Check,
} from 'lucide-react'

/* ---------------- API client (JWT interceptor + 401 auto-logout) ---------------- */
const API_BASE = 'http://localhost:8000/api'
const api = axios.create({ baseURL: API_BASE })
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('rba_access')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})
api.interceptors.response.use(
  (r) => r,
  (err) => {
    if (err.response && err.response.status === 401) {
      localStorage.removeItem('rba_access')
      localStorage.removeItem('rba_refresh')
      if (window.location.pathname !== '/login') window.location.href = '/login'
    }
    return Promise.reject(err)
  }
)

/* ---------------- Toasts ---------------- */
const ToastCtx = createContext()
function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])
  const show = (message, kind = 'info') => {
    const id = Date.now() + Math.random()
    setToasts((t) => [...t, { id, message, kind }])
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3500)
  }
  return (
    <ToastCtx.Provider value={show}>
      {children}
      <div className="fixed bottom-5 right-5 z-50 flex flex-col space-y-2 pointer-events-none">
        {toasts.map((t) => (
          <div key={t.id} className={`bg-slate-900 text-white text-xs px-4 py-2.5 rounded-lg shadow-xl border border-slate-700 fade-in ${
            t.kind === 'error' ? 'border-red-500' : ''
          }`}>
            {t.message}
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  )
}
const useToast = () => useContext(ToastCtx)

/* ---------------- Auth Context (BR-10: identity via /auth/me/) ---------------- */
const AuthCtx = createContext()
function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    const token = localStorage.getItem('rba_access')
    if (!token) { setLoading(false); return }
    api.get('/auth/me/')
      .then((r) => setUser(r.data))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])
  const login = async (email, password) => {
    const { data } = await api.post('/auth/login/', { email, password })
    localStorage.setItem('rba_access', data.access)
    localStorage.setItem('rba_refresh', data.refresh)
    setUser(data.user)
    return data.user
  }
  const logout = async () => {
    try { await api.post('/auth/logout/') } catch {}
    localStorage.removeItem('rba_access')
    localStorage.removeItem('rba_refresh')
    setUser(null)
  }
  return (
    <AuthCtx.Provider value={{ user, login, logout, loading }}>
      {children}
    </AuthCtx.Provider>
  )
}
const useAuth = () => useContext(AuthCtx)

/* ---------------- Shell (header + role-aware sidebar) ---------------- */
const NAV = [
  { to: '/dashboard', label: 'Analyst Dashboard', icon: LayoutDashboard, roles: ['ANALYST'] },
  { to: '/scan',      label: 'AI News Scanner',  icon: Rss,             roles: ['ANALYST'] },
  { to: '/editor',    label: 'Senior Editor Queue', icon: UserCheck,    roles: ['EDITOR'] },
  { to: '/analytics', label: 'Analytics & PDF',  icon: ChartPie,        roles: ['EDITOR', 'ADMIN'] },
  { to: '/admin',     label: 'System Admin',     icon: Sliders,         roles: ['ADMIN'] },
]
function Shell({ children }) {
  const { user, logout } = useAuth()
  const nav = useNavigate()
  const loc = useLocation()
  const [pending, setPending] = useState(0)
  useEffect(() => {
    if (!user) return
    api.get('/notifications/').then((r) => {
      setPending(r.data.filter((n) => !n.read).length)
    }).catch(() => {})
  }, [user, loc.pathname])
  if (!user) return children
  const visible = NAV.filter((n) => n.roles.includes(user.role))
  const initials = (user.name || 'U').split(' ').map((s) => s[0]).slice(0, 2).join('')
  return (
    <div className="min-h-screen flex flex-col bg-slate-100 text-slate-800 antialiased">
      <header className="bg-rba-600 text-white shadow-md sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between h-16">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-lg bg-white text-rba-600 font-extrabold flex items-center justify-center">RBA</div>
            <div>
              <h1 className="text-base font-bold leading-none">RBA AI Media Monitoring</h1>
              <p className="text-xs text-slate-300 mt-0.5">Rwanda Broadcasting Agency</p>
            </div>
          </div>
          <div className="flex items-center space-x-3">
            <div className="relative">
              <Bell className="w-5 h-5" />
              {pending > 0 && (
                <span className="absolute -top-2 -right-2 bg-red-500 text-white text-[10px] font-bold px-1.5 rounded-full">
                  {pending}
                </span>
              )}
            </div>
            <div className="text-right hidden sm:block">
              <p className="text-xs font-semibold">{user.name}</p>
              <p className="text-[11px] text-amber-300">{user.role}</p>
            </div>
            <div className="w-9 h-9 rounded-full bg-slate-200 border-2 border-amber-400 text-rba-600 font-bold flex items-center justify-center">
              {initials}
            </div>
            <button
              onClick={async () => { await logout(); nav('/login') }}
              className="ml-2 px-2 py-1 bg-rba-700 hover:bg-rba-500 rounded text-xs"
              title="Sign out"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>
      <div className="max-w-7xl w-full mx-auto flex-1 grid grid-cols-1 md:grid-cols-[220px_1fr] gap-4 p-4">
        <aside className="space-y-1">
          {visible.map((n) => {
            const Icon = n.icon
            const active = loc.pathname === n.to
            return (
              <button
                key={n.to}
                onClick={() => nav(n.to)}
                className={`w-full text-left px-3 py-2 rounded-lg text-xs font-semibold flex items-center space-x-2 transition ${
                  active ? 'bg-rba-600 text-white shadow' : 'bg-white text-slate-700 hover:bg-slate-50 border border-slate-200'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{n.label}</span>
              </button>
            )
          })}
        </aside>
        <main className="space-y-4">{children}</main>
      </div>
    </div>
  )
}

/* ---------------- Reusable UI atoms ---------------- */
function Card({ children, className = '' }) {
  return <div className={`bg-white rounded-xl border border-slate-200 shadow-sm ${className}`}>{children}</div>
}
function Stat({ label, value, icon: Icon, tone = 'slate' }) {
  const map = {
    slate: 'text-slate-700', red: 'text-red-600', green: 'text-emerald-600', amber: 'text-amber-600', blue: 'text-blue-600',
  }
  return (
    <Card className="p-4">
      <div className="flex items-center justify-between text-xs text-slate-500">
        <span>{label}</span>
        {Icon && <Icon className={`w-4 h-4 ${map[tone]}`} />}
      </div>
      <p className={`text-2xl font-extrabold mt-2 ${map[tone]}`}>{value}</p>
    </Card>
  )
}
function Skeleton({ lines = 3 }) {
  return (
    <Card className="p-4 space-y-2">
      {Array.from({ length: lines }).map((_, i) => (
        <div key={i} className="h-3 bg-slate-200 rounded animate-pulse" />
      ))}
    </Card>
  )
}
function Confirm({ open, title, message, onCancel, onConfirm }) {
  if (!open) return null
  return (
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <Card className="max-w-sm w-full p-5 space-y-3 fade-in">
        <h3 className="text-base font-bold">{title}</h3>
        <p className="text-xs text-slate-600">{message}</p>
        <div className="flex justify-end space-x-2 pt-2">
          <button onClick={onCancel} className="px-3 py-1.5 bg-slate-100 rounded text-xs">Cancel</button>
          <button onClick={onConfirm} className="px-3 py-1.5 bg-red-600 text-white rounded text-xs">Confirm</button>
        </div>
      </Card>
    </div>
  )
}

/* ---------------- Login (Fig 5.1) ---------------- */
function LoginPage() {
  const { login } = useAuth()
  const toast = useToast()
  const nav = useNavigate()
  const [email, setEmail] = useState('josue.rutayisire@rba.rw')
  const [password, setPassword] = useState('RbaDemo2026!')
  const [busy, setBusy] = useState(false)
  const personas = {
    Analyst: 'josue.rutayisire@rba.rw',
    'Senior Editor': 'jean.delacroix@rba.rw',
    Admin: 'admin@rba.rw',
  }
  const doLogin = async () => {
    try {
      setBusy(true)
      const u = await login(email, password)
      toast(`Signed in as ${u.name}`)
      if (u.role === 'ANALYST') nav('/dashboard')
      else if (u.role === 'EDITOR') nav('/editor')
      else nav('/admin')
    } catch (e) {
      toast(e?.response?.data?.detail || 'Login failed', 'error')
    } finally { setBusy(false) }
  }
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-100 p-4">
      <div className="bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden grid grid-cols-1 md:grid-cols-12 max-w-4xl w-full fade-in">
        <div className="md:col-span-5 bg-rba-600 p-8 text-white flex flex-col justify-between">
          <div>
            <div className="inline-flex items-center space-x-2 bg-white/10 px-3 py-1 rounded-full text-xs font-semibold mb-6 border border-white/20">
              <ShieldAlert className="w-3 h-3 text-amber-300" />
              <span>Rwanda Broadcasting Agency</span>
            </div>
            <h2 className="text-2xl font-bold tracking-tight">AI Media Monitoring & Fake News Platform</h2>
            <p className="text-xs text-slate-300 mt-3 leading-relaxed">
              Case Study: Rwanda Broadcasting Agency (RBA). Digitizing news integrity, continuous NLP credibility scoring, editorial verification.
            </p>
          </div>
          <div className="mt-8 pt-6 border-t border-white/20 text-xs text-slate-300">
            <p><strong className="text-white">Lead Analyst:</strong> Josue RUTAYISIRE</p>
            <p><strong className="text-white">Supervisor:</strong> Dr. Jean de la Croix</p>
          </div>
        </div>
        <div className="md:col-span-7 p-8">
          <h3 className="text-xl font-bold text-slate-900">Welcome Back</h3>
          <p className="text-xs text-slate-500 mt-1">Sign in to access your workspace</p>
          <div className="mt-5 bg-slate-100 p-2 rounded-lg border border-slate-200">
            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">Demo mode — Select persona</label>
            <div className="grid grid-cols-3 gap-1.5 text-xs">
              {Object.entries(personas).map(([label, em]) => (
                <button key={label} onClick={() => { setEmail(em); setPassword('RbaDemo2026!') }}
                  className="py-1.5 px-2 rounded bg-white font-medium text-slate-700 shadow-sm hover:bg-slate-50 border border-slate-200 text-center">
                  {label}
                </button>
              ))}
            </div>
          </div>
          <form onSubmit={(e) => { e.preventDefault(); doLogin() }} className="mt-4 space-y-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Email</label>
              <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 focus:ring-2 focus:ring-rba-500 focus:outline-none" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Password</label>
              <input type="password" required value={password} onChange={(e) => setPassword(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 focus:ring-2 focus:ring-rba-500 focus:outline-none" />
            </div>
            <button type="submit" disabled={busy}
              className="w-full py-2.5 bg-rba-600 hover:bg-rba-700 text-white font-semibold rounded-lg text-xs shadow flex justify-center">
              {busy ? 'Signing in…' : 'Sign In'}
            </button>
          </form>
          <p className="text-[11px] text-center text-slate-400 mt-4">Protected by Django REST Framework & RBAC</p>
        </div>
      </div>
    </div>
  )
}

/* ---------------- Dashboard (Fig 5.2) ---------------- */
function DashboardPage() {
  const toast = useToast()
  const [stats, setStats] = useState(null)
  const [articles, setArticles] = useState([])
  const [filter, setFilter] = useState('ALL')
  const [loading, setLoading] = useState(true)
  const nav = useNavigate()
  const load = async () => {
    setLoading(true)
    try {
      const [s, a] = await Promise.all([
        api.get('/dashboard/stats/'),
        api.get('/articles/', { params: filter !== 'ALL' ? { status: filter } : {} }),
      ])
      setStats(s.data)
      setArticles(a.data)
    } catch { toast('Failed to load dashboard', 'error') }
    setLoading(false)
  }
  useEffect(() => { load() }, [filter])
  return (
    <div className="space-y-4">
      <Card className="p-5 flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold">My Media Monitoring Dashboard</h2>
          <p className="text-xs text-slate-500 mt-0.5">Live feed credibility overview</p>
        </div>
        <div className="flex items-center space-x-2">
          <button onClick={() => nav('/scan')}
            className="px-3.5 py-2 bg-rba-600 hover:bg-rba-700 text-white text-xs font-semibold rounded-lg flex items-center space-x-1.5">
            <PlusCircle className="w-4 h-4" /><span>Scan New Article</span>
          </button>
          <button onClick={load} className="p-2 border border-slate-300 rounded-lg text-slate-600 hover:bg-slate-50">
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </Card>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Stat label="Total Streams Scanned" value={stats?.total_scanned ?? '—'} icon={Rss} tone="blue" />
        <Stat label="Verified Safe" value={stats?.verified_safe ?? '—'} icon={CheckCircle} tone="green" />
        <Stat label="Flagged Fake" value={stats?.flagged_fake ?? '—'} icon={TriangleAlert} tone="red" />
        <Stat label="Pending Review" value={stats?.pending_review ?? '—'} icon={Clock} tone="amber" />
      </div>
      <Card className="p-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-200">
          <div>
            <h3 className="text-base font-bold">Live Ingested Media Stream Grid</h3>
            <p className="text-xs text-slate-500">NLP credibility evaluation of RBA feeds</p>
          </div>
          <select value={filter} onChange={(e) => setFilter(e.target.value)}
            className="px-2.5 py-1.5 rounded-lg border border-slate-300 bg-slate-50 text-xs">
            <option value="ALL">All Statuses</option>
            <option value="VERIFIED_SAFE">Verified Safe</option>
            <option value="FLAGGED_FAKE">Flagged Fake</option>
            <option value="PENDING_REVIEW">Pending Review</option>
            <option value="DRAFT">Draft</option>
          </select>
        </div>
        <div className="pt-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {loading ? [0, 1, 2].map((i) => <Skeleton key={i} />) :
            articles.length === 0 ? (
              <p className="col-span-full text-center text-xs text-slate-400 py-6">No articles match filter.</p>
            ) : articles.map((a) => {
              const label = a.status === 'VERIFIED_SAFE' ? 'Verified Safe'
                : a.status === 'FLAGGED_FAKE' ? 'Flagged Fake'
                : a.status === 'PENDING_REVIEW' ? 'Pending Review' : 'Draft'
              const tone = a.status === 'VERIFIED_SAFE' ? 'bg-emerald-100 text-emerald-800'
                : a.status === 'FLAGGED_FAKE' ? 'bg-red-100 text-red-800'
                : a.status === 'PENDING_REVIEW' ? 'bg-amber-100 text-amber-800'
                : 'bg-slate-100 text-slate-700'
              return (
                <div key={a.id} className="bg-slate-50 rounded-xl p-4 border border-slate-200 flex flex-col justify-between space-y-3">
                  <div>
                    <div className="flex items-center justify-between text-[11px] mb-2">
                      <span className="font-semibold text-rba-600">{a.source_name}</span>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${tone}`}>{label}</span>
                    </div>
                    <h4 className="text-xs font-bold text-slate-900 line-clamp-2">{a.title}</h4>
                    {a.editorial_comment && (
                      <p className="text-[11px] text-slate-500 mt-1 italic">Note: {a.editorial_comment}</p>
                    )}
                  </div>
                  <div className="pt-2 border-t border-slate-200 flex items-center justify-between text-xs">
                    <div>
                      <span className="text-[10px] text-slate-400 block">Credibility</span>
                      <span className={`font-black text-sm ${a.credibility_score > 50 ? 'text-emerald-600' : 'text-red-600'}`}>
                        {a.credibility_score}%
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 block">Fake Prob.</span>
                      <span className="font-black text-slate-700 text-sm">{a.fake_probability}%</span>
                    </div>
                    <button onClick={() => nav('/editor')}
                      className="px-2.5 py-1 bg-white hover:bg-slate-100 border border-slate-300 rounded text-[11px] font-medium">
                      Details
                    </button>
                  </div>
                </div>
              )
            })}
        </div>
      </Card>
    </div>
  )
}

/* ---------------- Scan (Fig 5.3) ---------------- */
function ScanPage() {
  const toast = useToast()
  const nav = useNavigate()
  const [form, setForm] = useState({
    title: 'Breaking: Supposed Infrastructure Expansion in Eastern Province Announced Unofficial',
    content: 'Reports circulating online claim that major highway works in the Eastern Province are starting tomorrow without approval. Authorities have not posted any official notice.',
    source_name: 'X (Twitter) Viral News Feed',
    category: 'SOCIAL_MEDIA',
    keywords: 'infrastructure, Eastern Province, unverified, viral',
  })
  const [result, setResult] = useState(null)
  const [busy, setBusy] = useState(false)
  const submit = async (e) => {
    e.preventDefault()
    setBusy(true)
    try {
      const payload = {
        ...form,
        keywords: form.keywords.split(',').map((s) => s.trim()).filter(Boolean),
      }
      const { data } = await api.post('/articles/scan/', payload)
      setResult(data)
      toast('AI NLP scan complete')
    } catch (e) {
      toast(e?.response?.data?.detail || 'Scan failed', 'error')
    } finally { setBusy(false) }
  }
  const routeToEditor = async () => {
    if (!result) return
    try {
      await api.patch(`/articles/${result.id}/route/`)
      toast('Item routed to Editor queue')
      nav('/dashboard')
    } catch { toast('Routing failed', 'error') }
  }
  return (
    <Card className="p-6 space-y-6">
      <div className="border-b border-slate-200 pb-4">
        <div className="flex items-center space-x-2 text-rba-600">
          <Rss className="w-5 h-5" /><h2 className="text-lg font-bold text-slate-900">AI News Ingestion & Credibility Scanner</h2>
        </div>
        <p className="text-xs text-slate-500 mt-1">Input transcripts, posts, or URLs for NLP scoring.</p>
      </div>
      <form onSubmit={submit} className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Source Name *</label>
            <input required value={form.source_name} onChange={(e) => setForm({ ...form, source_name: e.target.value })}
              className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 focus:ring-2 focus:ring-rba-500 focus:outline-none" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Media Category</label>
            <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}
              className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 bg-white">
              <option value="SOCIAL_MEDIA">Social Media Broadcast</option>
              <option value="RADIO_TRANSCRIPT">Radio Audio Transcript</option>
              <option value="TV_NEWS">TV News Report</option>
              <option value="ONLINE_PORTAL">Online News Website</option>
            </select>
          </div>
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">Headline *</label>
          <input required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })}
            className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300" />
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">Raw Content *</label>
          <textarea required rows={5} value={form.content} onChange={(e) => setForm({ ...form, content: e.target.value })}
            className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300" />
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">Extracted Keyword Tags (comma separated)</label>
          <input value={form.keywords} onChange={(e) => setForm({ ...form, keywords: e.target.value })}
            className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300" />
        </div>
        <div className="flex justify-end">
          <button type="submit" disabled={busy}
            className="px-5 py-2.5 bg-rba-600 hover:bg-rba-700 text-white font-semibold text-xs rounded-lg shadow disabled:opacity-50">
            {busy ? 'Scanning…' : 'Run AI Credibility Scan'}
          </button>
        </div>
      </form>
      {result && (
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-5 space-y-3 fade-in">
          <div className="flex items-center justify-between border-b border-slate-200 pb-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700">AI Credibility Analysis</h4>
            <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${
              result.fake_probability > 50 ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'
            }`}>
              {result.status === 'VERIFIED_SAFE' ? 'VERIFIED SAFE' : 'PENDING REVIEW'}
            </span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white p-3 rounded-lg border text-center">
              <span className="text-[11px] text-slate-500">Credibility Score</span>
              <p className={`text-2xl font-black ${result.credibility_score > 50 ? 'text-emerald-600' : 'text-red-600'}`}>
                {result.credibility_score}%
              </p>
            </div>
            <div className="bg-white p-3 rounded-lg border text-center">
              <span className="text-[11px] text-slate-500">Fake News Probability</span>
              <p className={`text-2xl font-black ${result.fake_probability > 50 ? 'text-red-600' : 'text-emerald-600'}`}>
                {result.fake_probability}%
              </p>
            </div>
            <div className="bg-white p-3 rounded-lg border text-center">
              <span className="text-[11px] text-slate-500">Recommended Action</span>
              <p className="text-xs font-bold text-amber-700 mt-2">
                {result.fake_probability > 50 ? 'Escalate to Senior Editor' : 'Auto-cleared'}
              </p>
            </div>
          </div>
          <div className="text-right">
            <button onClick={routeToEditor}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-xs rounded-lg shadow">
              Save & Route to Editor Queue
            </button>
          </div>
        </div>
      )}
    </Card>
  )
}

/* ---------------- Editor Queue (Fig 5.4) ---------------- */
function EditorPage() {
  const toast = useToast()
  const [items, setItems] = useState([])
  const [comments, setComments] = useState({})
  const [loading, setLoading] = useState(true)
  const [confirm, setConfirm] = useState(null)
  const load = async () => {
    setLoading(true)
    try { const r = await api.get('/articles/editor_queue/'); setItems(r.data) }
    catch { toast('Failed to load queue', 'error') }
    setLoading(false)
  }
  useEffect(() => { load() }, [])
  const decide = async (id, action) => {
    try {
      const endpoint = action === 'DEBUNK' ? `/articles/${id}/debunk/` : `/articles/${id}/verify/`
      // Send editorial_comment matching Book Appendix A.1 schema
      await api.post(endpoint, { editorial_comment: comments[id] || '' })
      toast(action === 'DEBUNK' ? 'Debunking authorized' : 'Marked safe')
      load()
    } catch (e) { toast(e?.response?.data?.detail || 'Action failed', 'error') }
  }
  return (
    <div className="space-y-4">
      <Card className="p-5 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold">Senior Editor Review Queue</h2>
          <p className="text-xs text-slate-500 mt-0.5">{items.length} item(s) awaiting action</p>
        </div>
      </Card>
      <Card className="p-5 space-y-4">
        <h3 className="text-base font-bold border-b border-slate-200 pb-3">Flagged & Pending Content</h3>
        {loading ? <Skeleton lines={4} /> : items.length === 0 ? (
          <p className="text-center text-xs text-slate-400 py-6">All items verified.</p>
        ) : items.map((it) => (
          <div key={it.id} className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200 pb-2">
              <div>
                <span className="text-[11px] font-bold text-rba-600">{it.source_name}</span>
                <h4 className="text-xs font-bold text-slate-900 mt-0.5">{it.title}</h4>
              </div>
              <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-red-100 text-red-800">
                Fake Risk: {it.fake_probability}%
              </span>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">{it.content.slice(0, 220)}…</p>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-1">
              <input
                value={comments[it.id] || ''}
                onChange={(e) => setComments({ ...comments, [it.id]: e.target.value })}
                placeholder="Add editorial comment..."
                className="px-3 py-1.5 text-xs rounded-lg border border-slate-300 w-full sm:w-64"
              />
              <div className="flex items-center space-x-2">
                <button onClick={() => setConfirm({ id: it.id, action: 'DEBUNK' })}
                  className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white font-semibold text-xs rounded-lg">
                  Authorize Debunking
                </button>
                <button onClick={() => setConfirm({ id: it.id, action: 'VERIFY' })}
                  className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs rounded-lg">
                  Clear as Safe
                </button>
              </div>
            </div>
          </div>
        ))}
      </Card>
      <Confirm
        open={!!confirm}
        title={confirm?.action === 'DEBUNK' ? 'Authorize Debunking?' : 'Clear as Safe?'}
        message="This action will be logged in the audit trail, assign the editorial comment, and notify the author."
        onCancel={() => setConfirm(null)}
        onConfirm={() => { const c = confirm; setConfirm(null); decide(c.id, c.action) }}
      />
    </div>
  )
}

/* ---------------- Analytics (Fig 5.5) ---------------- */
function AnalyticsPage() {
  const toast = useToast()
  const [data, setData] = useState(null)
  useEffect(() => {
    api.get('/analytics/summary/').then((r) => setData(r.data))
      .catch(() => toast('Failed to load analytics', 'error'))
  }, [])
  const exportPDF = async () => {
    try {
      const res = await api.get('/analytics/export_pdf/', { responseType: 'blob' })
      const url = URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }))
      const a = document.createElement('a')
      a.href = url
      a.download = `RBA_Compliance_${new Date().toISOString().slice(0, 10)}.pdf`
      a.click()
      URL.revokeObjectURL(url)
      toast('Compliance PDF downloaded')
    } catch { toast('Export failed', 'error') }
  }
  return (
    <div className="space-y-4">
      <Card className="p-5 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold">Editorial Analytics & Compliance</h2>
          <p className="text-xs text-slate-500 mt-0.5">Misinformation tracking reports</p>
        </div>
        <button onClick={exportPDF}
          className="px-4 py-2 bg-rba-gold hover:bg-amber-700 text-white text-xs font-bold rounded-lg flex items-center space-x-2">
          <FileDown className="w-4 h-4" /><span>Export Compliance PDF</span>
        </button>
      </Card>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Stat label="Monthly Ingested Media" value={data ? `${data.total_ingested} Articles` : '—'} icon={Rss} tone="blue" />
        <Stat label="Fake News Debunked" value={data ? `${data.total_debunked} Confirmed` : '—'} icon={ShieldAlert} tone="red" />
        <Stat label="Avg Verification Time" value={data ? `${data.avg_verification_minutes} min` : '—'} icon={Clock} tone="green" />
      </div>
      <Card className="p-5">
        <h3 className="text-sm font-bold mb-3">Misinformation Vector Trend</h3>
        {data ? (
          <div className="space-y-2">
            {data.trend.map((row) => {
              const pct = row.total ? Math.min(100, (row.fake / row.total) * 100) : 0
              return (
                <div key={row.period} className="text-xs">
                  <div className="flex justify-between text-slate-600">
                    <span>{row.period}</span>
                    <span>{row.fake}/{row.total} flagged</span>
                  </div>
                  <div className="h-2 bg-slate-100 rounded">
                    <div className="h-2 bg-red-500 rounded" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              )
            })}
          </div>
        ) : <Skeleton lines={4} />}
      </Card>
    </div>
  )
}

/* ---------------- Admin (Fig 5.6 & Dynamic Sources) ---------------- */
function AdminPage() {
  const toast = useToast()
  const [users, setUsers] = useState([])
  const [logs, setLogs] = useState([])
  const [sources, setSources] = useState([])
  const [showModal, setShowModal] = useState(false)
  const [showSourceModal, setShowSourceModal] = useState(false)
  const [form, setForm] = useState({ name: '', email: '', reg_id: '', role: 'ANALYST' })
  const [sourceForm, setSourceForm] = useState({ name: '', platform: 'SOCIAL_MEDIA', active: true })
  const [confirm, setConfirm] = useState(null)
  const [loading, setLoading] = useState(true)

  const load = async () => {
    setLoading(true)
    try {
      const [u, l, s] = await Promise.all([
        api.get('/users/'),
        api.get('/audit-logs/'),
        api.get('/media-streams/')
      ])
      setUsers(u.data); setLogs(l.data); setSources(s.data)
    } catch { toast('Failed to load admin data', 'error') }
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  const createUser = async (e) => {
    e.preventDefault()
    try {
      await api.post('/users/', { ...form, password: 'RbaDemo2026!' })
      toast(`User ${form.name} provisioned`)
      setShowModal(false)
      setForm({ name: '', email: '', reg_id: '', role: 'ANALYST' })
      load()
    } catch (e) { toast(JSON.stringify(e?.response?.data || 'error'), 'error') }
  }

  const createSource = async (e) => {
    e.preventDefault()
    try {
      await api.post('/media-sources-crud/', sourceForm)
      toast(`Media source ${sourceForm.name} created`)
      setShowSourceModal(false)
      setSourceForm({ name: '', platform: 'SOCIAL_MEDIA', active: true })
      load()
    } catch (e) { toast(JSON.stringify(e?.response?.data || 'error'), 'error') }
  }

  const removeUser = async (id) => {
    try { await api.delete(`/users/${id}/`); toast('User removed'); load() }
    catch (e) { toast(e?.response?.data?.detail || 'Delete failed', 'error') }
  }

  return (
    <div className="space-y-4">
      <Card className="p-5 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold">System Administration</h2>
          <p className="text-xs text-slate-500 mt-0.5">RBAC, users, media sources, audit logs</p>
        </div>
        <div className="flex space-x-2">
          <button onClick={() => setShowSourceModal(true)}
            className="px-3.5 py-2 bg-rba-700 hover:bg-rba-600 text-white text-xs font-semibold rounded-lg flex items-center space-x-1.5">
            <Rss className="w-4 h-4" /><span>Add Media Source</span>
          </button>
          <button onClick={() => setShowModal(true)}
            className="px-3.5 py-2 bg-rba-600 hover:bg-rba-700 text-white text-xs font-semibold rounded-lg flex items-center space-x-1.5">
            <UserPlus className="w-4 h-4" /><span>Add User</span>
          </button>
        </div>
      </Card>
      
      {/* Users Table */}
      <Card className="p-5">
        <div className="flex items-center justify-between border-b border-slate-200 pb-2">
          <h3 className="text-sm font-bold">Active User Roles & Permissions</h3>
          <span className="text-xs text-slate-500">{users.length} users</span>
        </div>
        {loading ? <Skeleton lines={5} /> : (
          <div className="overflow-x-auto mt-3">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="bg-slate-50 text-slate-600 uppercase text-[11px]">
                  <th className="p-2">Name</th><th className="p-2">Reg ID</th>
                  <th className="p-2">Email</th><th className="p-2">Role</th>
                  <th className="p-2">Status</th><th className="p-2 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {users.map((u) => (
                  <tr key={u.id} className="hover:bg-slate-50">
                    <td className="p-2 font-semibold">{u.name}</td>
                    <td className="p-2 text-slate-500">{u.reg_id}</td>
                    <td className="p-2 text-slate-500">{u.email}</td>
                    <td className="p-2">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        u.role === 'EDITOR' ? 'bg-emerald-100 text-emerald-800'
                        : u.role === 'ADMIN' ? 'bg-purple-100 text-purple-800'
                        : 'bg-blue-100 text-blue-800'
                      }`}>{u.role}</span>
                    </td>
                    <td className="p-2 text-emerald-600 font-semibold">{u.status || 'Active'}</td>
                    <td className="p-2 text-right">
                      <button onClick={() => setConfirm(u)}
                        className="text-red-500 hover:text-red-700 font-medium text-xs flex justify-end items-center space-x-1">
                        <Trash2 className="w-3 h-3" /><span>Remove</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Media Sources Table */}
      <Card className="p-5">
        <div className="flex items-center justify-between border-b border-slate-200 pb-2">
          <h3 className="text-sm font-bold">Registered Media Sources (ERD Sources)</h3>
          <span className="text-xs text-slate-500">{sources.length} sources</span>
        </div>
        <div className="overflow-x-auto mt-3">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="bg-slate-50 text-slate-600 uppercase text-[11px]">
                <th className="p-2">Source Name</th>
                <th className="p-2">Platform / Category</th>
                <th className="p-2">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {sources.map((s) => (
                <tr key={s.id} className="hover:bg-slate-50">
                  <td className="p-2 font-semibold">{s.name}</td>
                  <td className="p-2 text-slate-500">{s.platform}</td>
                  <td className="p-2 text-emerald-600 font-semibold">{s.active ? 'Active' : 'Inactive'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Card className="p-4 bg-slate-900 text-slate-200 font-mono text-xs">
        <div className="flex items-center justify-between pb-2 border-b border-slate-800 text-slate-400">
          <span>Django API & Audit Logs</span>
          <span className="text-[10px] bg-slate-800 px-2 py-0.5 rounded text-emerald-400">ACTIVE</span>
        </div>
        <div className="max-h-32 overflow-y-auto pt-2 space-y-1 text-[11px]">
          {logs.length === 0 ? <p className="text-slate-500">No entries</p>
            : logs.slice(0, 30).map((l) => (
              <p key={l.id} className="text-slate-300">
                <span className="text-slate-500">[{new Date(l.timestamp).toISOString().slice(0, 19).replace('T', ' ')}]</span>{' '}
                <span className="text-blue-400">{l.method}</span> {l.path} {l.status_code} — {l.message}
              </p>
            ))}
        </div>
      </Card>

      {/* User Provision Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-slate-900/50 z-50 flex items-center justify-center p-4">
          <Card className="max-w-md w-full p-6 space-y-3 fade-in">
            <div className="flex items-center justify-between border-b border-slate-200 pb-2">
              <h3 className="text-base font-bold">Provision New User</h3>
              <button onClick={() => setShowModal(false)}><X className="w-4 h-4" /></button>
            </div>
            <form onSubmit={createUser} className="space-y-2 text-xs">
              <input required placeholder="Full name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-slate-300" />
              <input required type="email" placeholder="email@rba.rw" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-slate-300" />
              <input placeholder="Reg/Employee ID" value={form.reg_id} onChange={(e) => setForm({ ...form, reg_id: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-slate-300" />
              <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white">
                <option value="ANALYST">Media Analyst</option>
                <option value="EDITOR">Senior Editor</option>
                <option value="ADMIN">Administrator</option>
              </select>
              <div className="flex justify-end space-x-2 pt-2">
                <button type="button" onClick={() => setShowModal(false)} className="px-3 py-1.5 bg-slate-100 rounded">Cancel</button>
                <button type="submit" className="px-3 py-1.5 bg-rba-600 text-white rounded">Create</button>
              </div>
            </form>
          </Card>
        </div>
      )}

      {/* Media Source Modal */}
      {showSourceModal && (
        <div className="fixed inset-0 bg-slate-900/50 z-50 flex items-center justify-center p-4">
          <Card className="max-w-md w-full p-6 space-y-3 fade-in">
            <div className="flex items-center justify-between border-b border-slate-200 pb-2">
              <h3 className="text-base font-bold">Add New Media Source</h3>
              <button onClick={() => setShowSourceModal(false)}><X className="w-4 h-4" /></button>
            </div>
            <form onSubmit={createSource} className="space-y-2 text-xs">
              <input required placeholder="Source Name (e.g. RBA Local Desk)" value={sourceForm.name} onChange={(e) => setSourceForm({ ...sourceForm, name: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-slate-300" />
              <select value={sourceForm.platform} onChange={(e) => setSourceForm({ ...sourceForm, platform: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white">
                <option value="SOCIAL_MEDIA">Social Media Broadcast</option>
                <option value="RADIO_TRANSCRIPT">Radio Audio Transcript</option>
                <option value="TV_NEWS">TV News Report</option>
                <option value="ONLINE_PORTAL">Online News Website</option>
              </select>
              <div className="flex justify-end space-x-2 pt-2">
                <button type="button" onClick={() => setShowSourceModal(false)} className="px-3 py-1.5 bg-slate-100 rounded">Cancel</button>
                <button type="submit" className="px-3 py-1.5 bg-rba-600 text-white rounded">Create Source</button>
              </div>
            </form>
          </Card>
        </div>
      )}

      <Confirm
        open={!!confirm}
        title="Remove user?"
        message={`Remove ${confirm?.name}? This cannot be undone.`}
        onCancel={() => setConfirm(null)}
        onConfirm={() => { const u = confirm; setConfirm(null); removeUser(u.id) }}
      />
    </div>
  )
}

/* ---------------- Route guards ---------------- */
function RequireRole({ roles, children }) {
  const { user, loading } = useAuth()
  if (loading) return <div className="p-6 text-xs text-slate-500">Loading…</div>
  if (!user) return <Navigate to="/login" replace />
  if (!roles.includes(user.role)) return <Navigate to="/login" replace />
  return children
}

/* ---------------- Root App ---------------- */
export default function App() {
  return (
    <ToastProvider>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/" element={<Navigate to="/login" replace />} />
            <Route path="/dashboard" element={
              <RequireRole roles={['ANALYST']}>
                <Shell><DashboardPage /></Shell>
              </RequireRole>
            } />
            <Route path="/scan" element={
              <RequireRole roles={['ANALYST']}>
                <Shell><ScanPage /></Shell>
              </RequireRole>
            } />
            <Route path="/editor" element={
              <RequireRole roles={['EDITOR']}>
                <Shell><EditorPage /></Shell>
              </RequireRole>
            } />
            <Route path="/analytics" element={
              <RequireRole roles={['EDITOR', 'ADMIN']}>
                <Shell><AnalyticsPage /></Shell>
              </RequireRole>
            } />
            <Route path="/admin" element={
              <RequireRole roles={['ADMIN']}>
                <Shell><AdminPage /></Shell>
              </RequireRole>
            } />
            <Route path="*" element={<Navigate to="/login" replace />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </ToastProvider>
  )
}