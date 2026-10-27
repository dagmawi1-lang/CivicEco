import { useEffect, useMemo, useRef, useState } from 'react'
import {
  AlertTriangle, BarChart3, Bell, CheckCircle2, ChevronRight,
  Droplets, Filter, Leaf, MapPin, Plus, Recycle, Search, ShieldCheck,
  Sparkles, TreePine, Trash2, Users, X, Zap, Download, Navigation,
  ClipboardCheck, TrendingUp, Clock3, ArrowUpRight, CloudSun, Waves, ExternalLink, RefreshCw, UserCircle, LogIn, LogOut, LockKeyhole, FileText, Heart, MessageCircle, Target, Award, CalendarDays, UserPlus, ListChecks
} from 'lucide-react'
import './App.css'

const CATEGORIES = [
  { id: 'litter', name: 'Litter', icon: Trash2, color: '#5b8def' },
  { id: 'dumping', name: 'Illegal dumping', icon: AlertTriangle, color: '#e66b5c' },
  { id: 'water', name: 'Water', icon: Droplets, color: '#38a3a5' },
  { id: 'trees', name: 'Trees & plants', icon: TreePine, color: '#52a675' },
  { id: 'recycling', name: 'Recycling', icon: Recycle, color: '#8b72d9' },
  { id: 'parks', name: 'Parks', icon: Leaf, color: '#d59a3a' },
]

const SEED_REPORTS = [
  { id: 1, lat: 38.9185, lng: -77.0295, title: 'Litter around park entrance', category: 'litter', severity: 3, x: 22, y: 32, reports: 8, status: 'Open', description: 'Repeated trash buildup near the main entrance.', location: 'Community Park', created: '2 days ago', createdAt: '2026-10-24T12:00:00Z' },
  { id: 2, lat: 38.932, lng: -77.012, title: 'Dumping near creek access', category: 'dumping', severity: 5, x: 67, y: 24, reports: 6, status: 'Open', description: 'Multiple reports of discarded household material.', location: 'Creek Road', created: '1 day ago', createdAt: '2026-10-25T12:00:00Z' },
  { id: 3, lat: 38.894, lng: -77.018, title: 'Water quality concern', category: 'water', severity: 5, x: 73, y: 67, reports: 4, status: 'Investigating', description: 'Residents noticed unusual water color after rainfall.', location: 'South Creek', created: '4 days ago', createdAt: '2026-10-22T12:00:00Z' },
  { id: 4, lat: 38.889, lng: -77.057, title: 'Damaged tree cluster', category: 'trees', severity: 2, x: 37, y: 72, reports: 3, status: 'Open', description: 'Several damaged trees beside a walking path.', location: 'Greenway Trail', created: '6 days ago', createdAt: '2026-10-20T12:00:00Z' },
  { id: 5, lat: 38.9075, lng: -77.048, title: 'Recycling access gap', category: 'recycling', severity: 2, x: 52, y: 47, reports: 5, status: 'Open', description: 'Few recycling bins serve a busy community area.', location: 'Main Street', created: '3 days ago', createdAt: '2026-10-23T12:00:00Z' },
  { id: 6, lat: 38.921, lng: -77.055, title: 'Park maintenance issue', category: 'parks', severity: 3, x: 82, y: 43, reports: 2, status: 'Planned', description: 'Park equipment and surrounding area need attention.', location: 'Neighborhood Park', created: '8 days ago', createdAt: '2026-10-18T12:00:00Z' },
]

const RESOURCES = [
  { name: 'Community recycling center', type: 'Recycling', x: 29, y: 58, lat: 38.9015, lng: -77.0600 },
  { name: 'Neighborhood park', type: 'Park', x: 59, y: 78, lat: 38.8870, lng: -77.0300 },
  { name: 'Community garden', type: 'Garden', x: 88, y: 29, lat: 38.9290, lng: -77.0000 },
]

const ACTIONS = {
  litter: ['Organize a cleanup around the hotspot.', 'Document the area before and after cleanup.', 'Ask for additional waste bins if the issue repeats.'],
  dumping: ['Document the location and repeated reports.', 'Escalate the pattern to the appropriate local authority.', 'Monitor the location for new reports.'],
  water: ['Collect repeated observations without disturbing the waterway.', 'Document dates and weather conditions.', 'Escalate persistent concerns to the appropriate environmental authority.'],
  trees: ['Document affected trees and the surrounding area.', 'Contact the relevant parks or property manager.', 'Track whether the damaged area expands.'],
  recycling: ['Identify where recycling access is missing.', 'Survey nearby residents or businesses.', 'Propose additional collection points.'],
  parks: ['Document the maintenance issue.', 'Group similar reports from the same park.', 'Share a concise request with the park manager.'],
}

function scoreReport(report, environment = null) {
  const intelligenceScore = environment?.intelligence?.scores?.[report.id]?.score
  if (Number.isFinite(intelligenceScore)) return intelligenceScore
  const base = report.severity * 13 + report.reports * 5
  const weatherPressure = environment?.signals?.weatherAlertPressure || 0
  const waterBoost = report.category === 'water' && environment?.waterStations?.length ? 5 : 0
  return Math.min(100, base + Math.round(weatherPressure * 0.35) + waterBoost)
}

function verificationFor(report, allReports = []) {
  const evidencePoints = Math.min(35, (report.evidence?.length || 0) * 25)
  const confirmationPoints = Math.min(35, Math.max(0, (report.reports || 0) - 1) * 5)
  const completeness = [report.title, report.description, report.location, report.category, report.createdAt].filter(Boolean).length * 4
  const locationPoints = Number.isFinite(Number(report.lat)) && Number.isFinite(Number(report.lng)) ? 10 : 0
  const score = Math.min(100, evidencePoints + confirmationPoints + Math.min(20, completeness) + locationPoints)
  const possibleDuplicate = allReports.some(other => {
    if (other.id === report.id || other.category !== report.category || !report.lat || !report.lng || !other.lat || !other.lng) return false
    const dLat = Number(report.lat) - Number(other.lat)
    const dLng = Number(report.lng) - Number(other.lng)
    return Math.sqrt(dLat * dLat + dLng * dLng) < 0.004 && String(other.title).toLowerCase() === String(report.title).toLowerCase()
  })
  const level = score >= 70 ? 'Strong evidence' : score >= 40 ? 'Moderate evidence' : 'Early report'
  return { score, level, possibleDuplicate }
}

function RealMap({ reports, resources, selected, onSelect, days }) {
  const mapRef = useRef(null)
  const mapInstance = useRef(null)
  const layersRef = useRef(null)

  useEffect(() => {
    if (!window.L || !mapRef.current || mapInstance.current) return
    const map = window.L.map(mapRef.current, { zoomControl: true, scrollWheelZoom: true })
    window.L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors',
      maxZoom: 19,
    }).addTo(map)
    map.setView([38.9072, -77.0369], 12)
    layersRef.current = window.L.layerGroup().addTo(map)
    mapInstance.current = map
    setTimeout(() => map.invalidateSize(), 100)
    return () => { map.remove(); mapInstance.current = null }
  }, [])

  useEffect(() => {
    const map = mapInstance.current
    const layers = layersRef.current
    if (!map || !layers || !window.L) return
    layers.clearLayers()
    const L = window.L
    const now = Date.now()
    const visibleReports = reports.filter(r => {
      if (days === 0 || !r.createdAt) return true
      const age = now - new Date(r.createdAt).getTime()
      return age <= days * 86400000
    })
    const fallback = r => [38.94 - (Number(r.y ?? 50) / 100) * 0.08, -77.10 + (Number(r.x ?? 50) / 100) * 0.13]

    // Geographic grid identifies areas where several reports are close together.
    const cells = new Map()
    visibleReports.forEach(r => {
      const [lat, lng] = r.lat && r.lng ? [Number(r.lat), Number(r.lng)] : fallback(r)
      const key = `${Math.round(lat * 100) / 100}|${Math.round(lng * 100) / 100}`
      if (!cells.has(key)) cells.set(key, { lat, lng, reports: [] })
      cells.get(key).reports.push(r)
    })
    cells.forEach(cell => {
      if (cell.reports.length < 2) return
      const severity = Math.round(cell.reports.reduce((sum, r) => sum + r.severity, 0) / cell.reports.length)
      const radius = Math.min(850, 250 + cell.reports.length * 180 + severity * 45)
      const score = Math.min(100, cell.reports.reduce((sum, r) => sum + scoreReport(r), 0) / cell.reports.length + cell.reports.length * 4)
      L.circle([cell.lat, cell.lng], {
        radius,
        color: '#f0a34a',
        weight: 1,
        fillColor: '#f0a34a',
        fillOpacity: 0.12,
        dashArray: '5 6'
      }).addTo(layers).bindTooltip(`<strong>Potential hotspot</strong><br>${cell.reports.length} nearby issues · ${Math.round(score)}/100`)
    })

    visibleReports.forEach(report => {
      const category = CATEGORIES.find(c => c.id === report.category)
      const [lat, lng] = report.lat && report.lng ? [Number(report.lat), Number(report.lng)] : fallback(report)
      const score = Math.round(scoreReport(report))
      const marker = L.circleMarker([lat, lng], {
        radius: selected?.id === report.id ? 11 : 8,
        color: '#06150d',
        weight: 2,
        fillColor: category?.color || '#6edb8b',
        fillOpacity: report.status === 'Resolved' ? 0.45 : 0.9,
      }).addTo(layers)
      marker.bindTooltip(`<strong>${report.title}</strong><br><small>${category?.name || 'Issue'} · impact ${score}/100</small>`)
      marker.on('click', () => onSelect(report))
    })

    resources.forEach(resource => {
      const [lat, lng] = resource.lat && resource.lng ? [Number(resource.lat), Number(resource.lng)] : fallback(resource)
      L.circleMarker([lat, lng], {
        radius: 6, color: '#b9f2c9', weight: 2, fillColor: '#2e9d5c', fillOpacity: 0.9,
      }).addTo(layers).bindTooltip(`${resource.name}<br><small>${resource.type} resource</small>`)
    })
  }, [reports, resources, selected, onSelect, days])

  return <div className="real-map" ref={mapRef} />
}

function CommunityCenter({ user, apiRequest, onSelect, onClose }) {
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    let active = true
    apiRequest('/api/profile').then(data => { if (active) setProfile(data) }).catch(() => {}).finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [])
  if (loading) return <div className="profile-loading"><RefreshCw size={20} className="spin"/>Loading your community center…</div>
  if (!profile) return <div className="empty-state"><UserCircle size={28}/><strong>Community profile unavailable</strong><span>Sign in again and try once more.</span></div>
  const statCards = [
    ['Reports', profile.stats.reports, FileText], ['Confirmed', profile.stats.confirmations, ShieldCheck], ['Following', profile.stats.following, Heart], ['Comments', profile.stats.comments, MessageCircle], ['Resolved', profile.stats.resolved, CheckCircle2], ['Responses', profile.stats.responses, Target]
  ]
  const milestoneIcons = { report: FileText, evidence: Navigation, verify: ShieldCheck, follow: Heart, comment: MessageCircle, response: Target, task: ListChecks, measure: ClipboardCheck }
  return <div className="community-center">
    <div className="profile-hero">
      <div className="profile-avatar"><UserCircle size={34}/></div>
      <div><span className="eyebrow">COMMUNITY MEMBER</span><h2>{profile.user.name}</h2><p>{profile.user.email}</p></div>
      <div className="member-since"><CalendarDays size={14}/> Member since {new Date(profile.user.createdAt).toLocaleDateString()}</div>
    </div>
    <div className="profile-stats">{statCards.map(([label,value,Icon]) => <div className="profile-stat" key={label}><Icon size={16}/><strong>{value}</strong><span>{label}</span></div>)}</div>
    <div className="profile-grid">
      <section className="profile-section"><div className="section-title"><div><span className="eyebrow">YOUR ACTIVITY</span><h3>Your reports</h3></div></div>{profile.reports.length ? <div className="profile-list">{profile.reports.map(r => <button className="profile-row" key={r.id} onClick={() => { onSelect(r); onClose() }}><span className="row-icon"><FileText size={15}/></span><span className="row-copy"><strong>{r.title}</strong><small>{r.category} · severity {r.severity} · {new Date(r.createdAt).toLocaleDateString()}</small></span><span className="row-status">{r.status}</span><ChevronRight size={15}/></button>)}</div> : <div className="empty-mini">You haven't submitted a community report yet.</div>}</section>
      <section className="profile-section"><div className="section-title"><div><span className="eyebrow">STAY CONNECTED</span><h3>Following</h3></div></div>{profile.following.length ? <div className="profile-list">{profile.following.map(r => <button className="profile-row" key={r.id} onClick={() => { onSelect(r); onClose() }}><span className="row-icon"><Heart size={15}/></span><span className="row-copy"><strong>{r.title}</strong><small>{r.category}</small></span><span className="row-status">{r.status}</span><ChevronRight size={15}/></button>)}</div> : <div className="empty-mini">Follow an issue to receive updates about it.</div>}</section>
    </div>
    <section className="profile-section response-history"><div className="section-title"><div><span className="eyebrow">ACT & MEASURE</span><h3>Your response participation</h3></div><span className="response-summary">{profile.stats.completedTasks || 0} tasks · {profile.stats.responseCheckIns || 0} check-ins</span></div>{profile.responses?.length ? <div className="response-cards">{profile.responses.map(r => <div className="response-card" key={r.id}><div className="response-card-top"><div><strong>{r.title}</strong><small>{r.owner} · {r.participantCount} participant{r.participantCount === 1 ? '' : 's'}</small></div><span className={`response-badge ${String(r.status).toLowerCase()}`}>{r.status}</span></div><div className="response-progress"><div className="response-progress-track"><span style={{width:`${Math.max(0,Math.min(100,r.progress))}%`}}/></div><strong>{r.progress}%</strong></div><div className="response-meta"><span><ListChecks size={13}/> {r.completedTasks}/{r.taskCount} tasks</span><span><ClipboardCheck size={13}/> {r.checkIns} check-ins</span>{r.dueDate && <span><CalendarDays size={13}/> Due {new Date(r.dueDate).toLocaleDateString()}</span>}</div><p>{r.goal}</p></div>)}</div> : <div className="empty-mini">Join a community response plan to see your participation and progress here.</div>}</section>
    <section className="profile-section contribution-section"><div className="section-title"><div><span className="eyebrow">CONTRIBUTION HISTORY</span><h3>Your CivicEco milestones</h3></div><span className="response-summary">{profile.contributionSummary?.earnedMilestones || 0}/{profile.milestones?.length || 0} earned</span></div><div className="milestone-grid">{(profile.milestones || []).map(m => { const Icon = milestoneIcons[m.icon] || Award; return <div className={`milestone ${m.earned ? 'earned' : ''}`} key={m.id}><span className="milestone-icon"><Icon size={16}/></span><div><strong>{m.title}</strong><p>{m.description}</p></div><span className="milestone-state">{m.earned ? 'Earned' : 'Not yet'}</span></div> })}</div></section>
    <section className="profile-section contribution-section"><div className="section-title"><div><span className="eyebrow">ACTIVITY TRAIL</span><h3>Your contribution history</h3></div><span className="response-summary">{profile.contributionSummary?.trackedActions || 0} tracked actions</span></div>{profile.timeline?.length ? <div className="timeline">{profile.timeline.map((item,i) => { const Icon = milestoneIcons[item.type] || Award; return <div className="timeline-item" key={`${item.type}-${item.createdAt}-${i}`}><span className="timeline-icon"><Icon size={14}/></span><div className="timeline-copy"><strong>{item.title}</strong><p>{item.text}</p><small>{new Date(item.createdAt).toLocaleString()}</small></div></div> })}</div> : <div className="empty-mini">Your contribution history will appear here as you participate.</div>}</section>
    <div className="profile-impact"><Award size={20}/><div><strong>Your community impact</strong><p>You have contributed {profile.contributionSummary?.trackedActions || 0} tracked community actions across CivicEco, including {profile.stats.completedTasks || 0} completed response tasks and {profile.stats.responseCheckIns || 0} measurement check-ins.</p></div></div>
  </div>
}

function App() {
  const [reports, setReports] = useState(() => {
    try { return JSON.parse(localStorage.getItem('civiceco-reports')) || SEED_REPORTS } catch { return SEED_REPORTS }
  })
  const [selected, setSelected] = useState(null)
  const [category, setCategory] = useState('all')
  const [mapDays, setMapDays] = useState(30)
  const [search, setSearch] = useState('')
  const [showReport, setShowReport] = useState(false)
  const [showPlanner, setShowPlanner] = useState(false)
  const [showTrends, setShowTrends] = useState(false)
  const [showInsights, setShowInsights] = useState(false)
  const [notice, setNotice] = useState('')
  const [environment, setEnvironment] = useState(null)
  const [environmentLoading, setEnvironmentLoading] = useState(false)
  const [environmentError, setEnvironmentError] = useState('')
  const [showHotspots, setShowHotspots] = useState(true)
  const [actions, setActions] = useState(() => { try { return JSON.parse(localStorage.getItem('civiceco-actions')) || [] } catch { return [] } })
  const [showActionBuilder, setShowActionBuilder] = useState(false)
  const [actionTarget, setActionTarget] = useState(null)
  const [actionForm, setActionForm] = useState({ owner: 'Community team', target: '', dueDate: '', baseline: '', goal: '' })
  const [form, setForm] = useState({ title: '', category: 'litter', severity: 3, description: '', location: '', lat: null, lng: null })
  const [user, setUser] = useState(null)
  const [showAuth, setShowAuth] = useState(false)
  const [authMode, setAuthMode] = useState('login')
  const [authForm, setAuthForm] = useState({ name: '', email: '', password: '' })
  const [authLoading, setAuthLoading] = useState(false)
  const [authError, setAuthError] = useState('')
  const [syncStatus, setSyncStatus] = useState('Local mode')
  const [communityData, setCommunityData] = useState({})
  const [commentText, setCommentText] = useState('')
  const [communityLoading, setCommunityLoading] = useState(false)
  const [notifications, setNotifications] = useState([])
  const [showNotifications, setShowNotifications] = useState(false)
  const [showCommunityCenter, setShowCommunityCenter] = useState(false)
  const [evidence, setEvidence] = useState(null)
  const DEMO_LOCATION = { lat: 38.9072, lon: -77.0369 }

  async function apiRequest(url, options = {}) {
    const token = localStorage.getItem('civiceco-token')
    const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) }
    if (token) headers.Authorization = `Bearer ${token}`
    const response = await fetch(url, { ...options, headers })
    const data = await response.json().catch(() => ({}))
    if (!response.ok) throw new Error(data.error || 'Request failed')
    return data
  }

  useEffect(() => {
    const token = localStorage.getItem('civiceco-token')
    if (!token) return
    apiRequest('/api/auth/me').then(data => { setUser(data.user); setSyncStatus('Cloud sync connected') }).catch(() => { localStorage.removeItem('civiceco-token'); setSyncStatus('Local mode') })
  }, [])

  useEffect(() => {
    if (!user) return
    apiRequest('/api/reports').then(data => {
      if (Array.isArray(data.reports) && data.reports.length) saveReports(data.reports)
    }).catch(() => {})
  }, [user])

  useEffect(() => {
    if (!selected) return
    let cancelled = false
    setCommunityLoading(true)
    apiRequest(`/api/reports/${selected.id}/community`).then(data => { if (!cancelled) setCommunityData(prev => ({ ...prev, [selected.id]: data })) }).catch(() => {}).finally(() => { if (!cancelled) setCommunityLoading(false) })
    return () => { cancelled = true }
  }, [selected?.id, user])

  async function submitAuth(e) {
    e.preventDefault(); setAuthLoading(true); setAuthError('')
    try {
      const endpoint = authMode === 'login' ? '/api/auth/login' : '/api/auth/signup'
      const data = await apiRequest(endpoint, { method: 'POST', body: JSON.stringify(authForm) })
      localStorage.setItem('civiceco-token', data.token); setUser(data.user); setSyncStatus('Cloud sync connected'); setShowAuth(false); setAuthForm({ name: '', email: '', password: '' }); notify(authMode === 'login' ? 'Welcome back to CivicEco.' : 'CivicEco account created.')
    } catch (error) { setAuthError(error.message) } finally { setAuthLoading(false) }
  }

  async function signOut() {
    try { await apiRequest('/api/auth/logout', { method: 'POST' }) } catch {}
    localStorage.removeItem('civiceco-token'); setUser(null); setSyncStatus('Local mode'); notify('Signed out. Your local reports remain on this device.')
  }

  async function loadNotifications() {
    if (!user) return
    try { const data = await apiRequest('/api/notifications'); setNotifications(data.notifications || []) } catch {}
  }

  useEffect(() => {
    if (!user) { setNotifications([]); return }
    loadNotifications()
    const timer = setInterval(loadNotifications, 30000)
    return () => clearInterval(timer)
  }, [user])

  async function loadActions() {
    if (!user) return
    try {
      const data = await apiRequest('/api/actions')
      setActions(data.actions || [])
      localStorage.setItem('civiceco-actions', JSON.stringify(data.actions || []))
    } catch {}
  }

  useEffect(() => {
    if (user) loadActions()
  }, [user])

  async function loadEnvironment() {
    setEnvironmentLoading(true)
    setEnvironmentError('')
    try {
      const response = await fetch(`/api/environment?lat=${DEMO_LOCATION.lat}&lon=${DEMO_LOCATION.lon}`)
      if (!response.ok) throw new Error('Environmental service unavailable')
      const baseEnvironment = await response.json()
      const intelligenceResponse = await fetch('/api/intelligence', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reports, environment: baseEnvironment })
      })
      if (!intelligenceResponse.ok) throw new Error('Intelligence service unavailable')
      const intelligence = await intelligenceResponse.json()
      setEnvironment({ ...baseEnvironment, intelligence })
    } catch (error) {
      setEnvironmentError('Live environmental data could not be loaded. The community reports still work offline.')
    } finally {
      setEnvironmentLoading(false)
    }
  }

  useEffect(() => { loadEnvironment() }, [])

  useEffect(() => {
    if (!environment) return
    let cancelled = false
    fetch('/api/intelligence', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reports, environment })
    }).then(r => r.ok ? r.json() : null).then(intelligence => {
      if (!cancelled && intelligence) setEnvironment(current => ({ ...current, intelligence }))
    }).catch(() => {})
    return () => { cancelled = true }
  }, [reports])

  const filtered = useMemo(() => reports.filter(r => {
    const matchesCategory = category === 'all' || r.category === category
    const q = search.trim().toLowerCase()
    return matchesCategory && (!q || `${r.title} ${r.description} ${r.location}`.toLowerCase().includes(q))
  }), [reports, category, search])

  const priorityReports = [...reports].sort((a, b) => scoreReport(b, environment) - scoreReport(a, environment)).slice(0, 4)
  const hotspots = environment?.intelligence?.hotspots || []
  const activeCount = reports.filter(r => r.status !== 'Resolved').length
  const highCount = reports.filter(r => scoreReport(r, environment) >= 70).length
  const totalReports = reports.reduce((sum, r) => sum + r.reports, 0)
  const resolvedCount = reports.filter(r => r.status === 'Resolved').length
  const averageImpact = reports.length ? Math.round(reports.reduce((sum, r) => sum + scoreReport(r, environment), 0) / reports.length) : 0

  function saveReports(next) {
    setReports(next)
    localStorage.setItem('civiceco-reports', JSON.stringify(next))
  }

  function notify(message) {
    setNotice(message)
    setTimeout(() => setNotice(''), 2800)
  }

  async function handleEvidence(file) {
    if (!file) return
    if (!file.type.startsWith('image/')) return notify('Please choose an image file.')
    if (file.size > 2 * 1024 * 1024) return notify('Please choose an image smaller than 2 MB.')
    const reader = new FileReader()
    reader.onload = () => setEvidence({ name: file.name, type: file.type, data: reader.result })
    reader.readAsDataURL(file)
  }

  async function submitReport(e) {
    e.preventDefault()
    const newReport = { ...form, x: 25 + Math.random() * 60, y: 25 + Math.random() * 55, evidence: evidence ? [evidence] : [] }
    if (user) {
      try {
        const data = await apiRequest('/api/reports', { method: 'POST', body: JSON.stringify(newReport) })
        saveReports([...reports, data.report]); setSyncStatus('Cloud sync connected')
      } catch (error) { notify(error.message); return }
    } else {
      saveReports([...reports, { ...newReport, id: Date.now(), reports: 1, status: 'Open', created: 'Just now', createdAt: new Date().toISOString() }])
    }
    setForm({ title: '', category: 'litter', severity: 3, description: '', location: '', lat: null, lng: null })
    setEvidence(null)
    setShowReport(false)
    notify(user ? 'Report saved to the CivicEco community database.' : 'Report saved locally. Sign in to sync it across devices.')
  }

  async function addConfirmation(report) {
    if (!user) { setShowAuth(true); notify('Sign in to add a unique community confirmation.'); return }
    try {
      const data = await apiRequest(`/api/reports/${report.id}/confirm`, { method: 'POST' })
      const next = reports.map(r => r.id === report.id ? data.report : r)
      saveReports(next); setSelected(data.report)
      setCommunityData(prev => ({ ...prev, [report.id]: { ...(prev[report.id] || {}), confirmedByMe: true, confirmations: data.confirmations } }))
      notify('Your unique confirmation was added.')
    } catch (error) { notify(error.message) }
  }

  async function toggleFollow(report) {
    if (!user) { setShowAuth(true); notify('Sign in to follow an issue.'); return }
    try {
      const data = await apiRequest(`/api/reports/${report.id}/follow`, { method: 'POST' })
      setCommunityData(prev => ({ ...prev, [report.id]: { ...(prev[report.id] || {}), following: data.following, followers: data.followers } }))
      notify(data.following ? 'You are now following this issue.' : 'You stopped following this issue.')
    } catch (error) { notify(error.message) }
  }

  async function addComment(report) {
    if (!user) { setShowAuth(true); notify('Sign in to join the discussion.'); return }
    const text = commentText.trim(); if (!text) return
    try {
      const data = await apiRequest(`/api/reports/${report.id}/comments`, { method: 'POST', body: JSON.stringify({ text }) })
      setCommunityData(prev => ({ ...prev, [report.id]: { ...(prev[report.id] || {}), comments: [data.comment, ...(prev[report.id]?.comments || [])] } }))
      setCommentText(''); notify('Comment added to the community discussion.')
    } catch (error) { notify(error.message) }
  }

  async function markResolved(report) {
    if (user) { try { const data = await apiRequest(`/api/reports/${report.id}`, { method: 'PATCH', body: JSON.stringify({ status: 'Resolved' }) }); const next = reports.map(r => r.id === report.id ? data.report : r); saveReports(next); setSelected(data.report) } catch (error) { notify(error.message); return } }
    else { const next = reports.map(r => r.id === report.id ? { ...r, status: 'Resolved' } : r); saveReports(next); setSelected({ ...report, status: 'Resolved' }) }
    notify('Issue marked as resolved.')
  }

  function saveActions(next) {
    setActions(next)
    localStorage.setItem('civiceco-actions', JSON.stringify(next))
  }

  function openActionBuilder(report = priorityReports[0]) {
    if (!report) return notify('There are no issues available for an action plan yet.')
    const suggested = (ACTIONS[report.category] || ACTIONS.litter)[0]
    setActionTarget(report)
    setActionForm({ owner: 'Community team', target: suggested, dueDate: '', baseline: `${report.reports} community confirmations`, goal: 'Reduce repeat reports and increase the resolved status.' })
    setShowActionBuilder(true)
  }

  async function createAction(e) {
    e.preventDefault()
    if (!actionTarget) return
    if (!user) { setShowAuth(true); notify('Sign in to create a community response.'); return }
    try {
      const data = await apiRequest('/api/actions', { method: 'POST', body: JSON.stringify({
        reportId: actionTarget.id, title: actionForm.target, owner: actionForm.owner,
        dueDate: actionForm.dueDate, baseline: actionForm.baseline, goal: actionForm.goal
      }) })
      const next = [data.action, ...actions]
      saveActions(next)
      setShowActionBuilder(false)
      notify('Community response plan created. You are a participant.')
    } catch (error) { notify(error.message) }
  }

  async function updateAction(id, patch) {
    if (!user) return
    if (patch.joinToggle) {
      try {
        const data = await apiRequest(`/api/actions/${id}/join`, { method: 'POST' })
        setActions(current => current.map(a => a.id === id ? { ...a, participants: data.participants, joinedByMe: data.joinedByMe } : a))
        notify(data.joinedByMe ? 'You joined the response plan.' : 'You left the response plan.')
      } catch (error) { notify(error.message) }
      return
    }
    setActions(current => current.map(a => a.id === id ? { ...a, ...patch } : a))
  }

  async function toggleTask(action, task) {
    if (!user) { setShowAuth(true); return }
    try {
      const data = await apiRequest(`/api/actions/${action.id}/tasks/${task.id}/toggle`, { method: 'POST' })
      setActions(current => current.map(a => a.id === action.id ? { ...data.action, joinedByMe: true } : a))
      notify(task.completed ? 'Task reopened.' : 'Task completed.')
    } catch (error) { notify(error.message) }
  }

  async function checkInAction(action) {
    if (!user) { setShowAuth(true); notify('Sign in to record response progress.'); return }
    try {
      const data = await apiRequest(`/api/actions/${action.id}/checkin`, { method: 'POST' })
      setActions(current => current.map(a => a.id === action.id ? { ...data.action, joinedByMe: true } : a))
      const outcome = data.action.checkIns?.at(-1)?.outcome
      notify(outcome?.percentChange != null ? `Check-in recorded: ${outcome.percentChange > 0 ? '+' : ''}${outcome.percentChange}% change in confirmations.` : 'Progress check-in recorded.')
    } catch (error) { notify(error.message) }
  }

  function exportReports() {
    const blob = new Blob([JSON.stringify(reports, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'civiceco-community-reports.json'
    a.click()
    URL.revokeObjectURL(url)
  }

  function useLocation() {
    if (!navigator.geolocation) return notify('Location is not available in this browser.')
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        setForm(f => ({ ...f, location: `Community location (${coords.latitude.toFixed(4)}, ${coords.longitude.toFixed(4)})`, lat: coords.latitude, lng: coords.longitude }))
        notify('Location added to your report.')
      },
      () => notify('Location permission was not granted.')
    )
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand"><div className="brand-mark"><Leaf size={20}/></div><div><strong>CivicEco</strong><span>Community intelligence</span></div></div>
        <nav>
          <button className="nav-item active"><BarChart3 size={18}/>Dashboard</button>
          <button className="nav-item" onClick={() => setShowInsights(true)}><TrendingUp size={18}/>Insights</button>
          <button className="nav-item" onClick={() => document.getElementById('map')?.scrollIntoView({ behavior: 'smooth' })}><MapPin size={18}/>Issue map</button>
          <button className="nav-item" onClick={() => document.getElementById('community')?.scrollIntoView({ behavior: 'smooth' })}><Users size={18}/>Community</button>
          <button className="nav-item" onClick={() => document.getElementById('resources')?.scrollIntoView({ behavior: 'smooth' })}><Recycle size={18}/>Resources</button>
        </nav>
        <div className="sidebar-bottom">
          <div className="mini-impact"><ShieldCheck size={18}/><div><strong>Community impact</strong><span>Turning reports into action</span></div></div>
          <button className="sidebar-report" onClick={() => setShowReport(true)}><Plus size={17}/>Report an issue</button>
        </div>
      </aside>

      <main className="main">
        <header className="topbar">
          <div><p className="eyebrow">LOCAL ENVIRONMENTAL INTELLIGENCE</p><h1>See the problem. Prioritize it. Act.</h1><p className="subtitle">CivicEco turns community observations into shared evidence and helps residents focus on the issues that need attention most.</p></div>
          <div className="top-actions"><span className="sync-pill"><span className="sync-dot"/>{syncStatus}</span>{user && <button className="notification-button icon-button" onClick={() => { setShowNotifications(v => !v); loadNotifications() }} title="Notifications"><Bell size={19}/>{notifications.length > 0 && <span className="notification-badge">{Math.min(99, notifications.length)}</span>}</button>}<button className="icon-button" onClick={exportReports} title="Export community data"><Download size={19}/></button><button className="icon-button" onClick={() => setShowInsights(true)} title="Open analytics insights"><TrendingUp size={19}/></button>{user ? <div className="account-actions"><button className="account-button" onClick={() => setShowCommunityCenter(true)} title="Open community center"><UserCircle size={18}/><span>{user.name}</span></button><button className="icon-button" onClick={signOut} title="Sign out"><LogOut size={17}/></button></div> : <button className="account-button" onClick={() => {setAuthMode('login');setAuthError('');setShowAuth(true)}}><LogIn size={17}/><span>Sign in</span></button>}</div>
        </header>

        {notice && <div className="toast"><CheckCircle2 size={18}/>{notice}</div>}

        {showNotifications && user && <div className="notification-popover">
          <div className="notification-popover-head"><div><strong>Notifications</strong><span>{notifications.length ? `${notifications.length} recent updates` : 'No new community updates'}</span></div><button className="icon-button" onClick={() => setShowNotifications(false)}><X size={16}/></button></div>
          {notifications.length ? <div className="notification-list">{notifications.map(n => <button className="notification-item" key={n.id} onClick={() => { const r=reports.find(x=>Number(x.id)===Number(n.reportId)); if(r) setSelected(r); setShowNotifications(false) }}><div className={`notification-icon ${n.type}`}><Bell size={15}/></div><div><strong>{n.title}</strong><p>{n.text}</p><small>{new Date(n.createdAt).toLocaleString()}</small></div></button>)}</div> : <div className="notification-empty"><Bell size={20}/><span>Follow an issue to receive community updates here.</span></div>}
        </div>}

        <section className="stats-grid">
          <Stat icon={MapPin} label="Active issues" value={activeCount} note="Across the community" />
          <Stat icon={AlertTriangle} label="High priority" value={highCount} note="Needs attention first" />
          <Stat icon={Users} label="Community reports" value={totalReports} note="Resident observations" />
          <Stat icon={CheckCircle2} label="Resolved issues" value={resolvedCount} note={`${averageImpact}/100 average impact`} />
        </section>

        {!user && <div className="account-banner panel"><div className="account-banner-icon"><LockKeyhole size={19}/></div><div><strong>Save your CivicEco work across devices</strong><p>Sign in to sync reports and community updates with the CivicEco backend. You can still use the app locally without an account.</p></div><button className="secondary-button" onClick={() => {setAuthMode('signup');setAuthError('');setShowAuth(true)}}>Create free account <ChevronRight size={15}/></button></div>}

        <section className="environment-panel panel">
          <div className="panel-heading"><div><p className="eyebrow">LIVE ENVIRONMENTAL SIGNALS</p><h2>Community conditions</h2><p>Public environmental data gives CivicEco more context than reports alone.</p></div><button className="secondary-button" onClick={loadEnvironment} disabled={environmentLoading}><RefreshCw size={15} className={environmentLoading ? 'spin' : ''}/>{environmentLoading ? 'Refreshing' : 'Refresh data'}</button></div>
          {environmentError && <div className="data-warning"><AlertTriangle size={16}/><span>{environmentError}</span></div>}
          {environment ? <div className="environment-grid">
            <div className="environment-card weather-card"><div className="environment-icon"><CloudSun size={21}/></div><div><span>National Weather Service</span><strong>{environment.weather?.temperature ?? '—'}° {environment.weather?.unit || ''}</strong><p>{environment.weather?.shortForecast || 'No forecast available'}</p></div></div>
            <div className="environment-card"><div className="environment-icon"><AlertTriangle size={21}/></div><div><span>Active weather alerts</span><strong>{environment.alerts?.length ?? 0}</strong><p>{environment.alerts?.[0]?.event || 'No active alerts at demo location'}</p></div></div>
            <div className="environment-card"><div className="environment-icon"><Waves size={21}/></div><div><span>USGS water monitoring</span><strong>{environment.waterStations?.length ?? 0}</strong><p>Nearby monitoring locations found</p></div></div>
            <div className="environment-card intelligence-card"><div className="environment-icon"><Sparkles size={21}/></div><div><span>CivicEco intelligence</span><strong>{environment.signals?.weatherAlertPressure ? 'Context elevated' : 'Baseline'}</strong><p>Environmental context is now included in issue prioritization.</p></div></div>
          </div> : !environmentLoading && <div className="data-loading">Connect CivicEco to public environmental data to enrich community reports.</div>}
          {environment?.sources && <div className="data-sources"><span>Data sources:</span>{environment.sources.map(source => <a key={source.name} href={source.url} target="_blank" rel="noreferrer">{source.name}<ExternalLink size={11}/></a>)}</div>}
        </section>

        {environment?.intelligence && <section className="intelligence-panel panel">
          <div className="panel-heading">
            <div><p className="eyebrow">CIVICECO INTELLIGENCE ENGINE</p><h2>Why issues are prioritized</h2><p>Scores combine community evidence with public environmental context. They are decision-support signals, not proof of causation.</p></div>
            <div className="intelligence-summary"><strong>{environment.intelligence.summary.average}/100</strong><span>average intelligence score</span></div>
          </div>
          <div className="intelligence-grid">
            {environment.intelligence.ranking.slice(0, 3).map(item => {
              const report = reports.find(r => r.id === item.id)
              if (!report) return null
              return <button className="intel-item" key={item.id} onClick={() => setSelected(report)}>
                <div className="intel-score"><strong>{item.score}</strong><span>{item.level}</span></div>
                <div><strong>{report.title}</strong><p>{item.explanation.slice(0, 2).join(' · ')}</p></div>
                <ArrowUpRight size={16}/>
              </button>
            })}
          </div>
          <div className="methodology"><strong>Scoring model:</strong> severity + community confirmations + recurrence + freshness + relevant public environmental signals.</div>
        </section>}

        {environment?.intelligence?.temporalPatterns && <section className="temporal-panel panel">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">TIME-BASED PATTERN DETECTION</p>
              <h2>What is changing?</h2>
              <p>CivicEco compares the last 7 days with the previous 7 days to find rising, falling, or new environmental activity.</p>
            </div>
            <div className="temporal-headline"><Clock3 size={17}/><span>{environment.intelligence.temporalPatterns.headline}</span></div>
          </div>
          <div className="temporal-grid">
            {environment.intelligence.temporalPatterns.patterns.slice(0, 4).map(pattern => {
              const c = CATEGORIES.find(x => x.id === pattern.category)
              const Icon = c?.icon || AlertTriangle
              const change = pattern.changePercent
              return <div className="temporal-card" key={pattern.category}>
                <div className="temporal-card-top">
                  <div className="temporal-icon" style={{color:c?.color || '#6edb8b', background:`${c?.color || '#6edb8b'}18`}}><Icon size={18}/></div>
                  <span className={`trend-badge ${pattern.level.toLowerCase().replace(' ', '-')}`}>{pattern.level}</span>
                </div>
                <strong>{c?.name || pattern.category}</strong>
                <div className="temporal-numbers">
                  <div><span>Last 7 days</span><b>{pattern.currentReports}</b></div>
                  <div><span>Previous 7</span><b>{pattern.previousReports}</b></div>
                  <div><span>Change</span><b>{change === null ? 'New' : `${change > 0 ? '+' : ''}${change}%`}</b></div>
                </div>
                <p>{pattern.explanation}</p>
              </div>
            })}
          </div>
          <div className="temporal-note"><TrendingUp size={15}/><span>Pattern detection is based on CivicEco reports and timestamps. A rising pattern is a signal for attention, not proof of an environmental cause.</span></div>
        </section>}

        {environment?.intelligence?.earlyWarnings && <section className="warning-panel panel">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">CIVICECO EARLY-WARNING SYSTEM</p>
              <h2>What may need attention next?</h2>
              <p>CivicEco combines recent activity, momentum, community evidence, and geographic clustering to flag emerging concerns before they become larger community priorities.</p>
            </div>
            <div className="warning-headline"><Bell size={17}/><span>{environment.intelligence.earlyWarnings.headline}</span></div>
          </div>
          <div className="warning-grid">
            {environment.intelligence.earlyWarnings.warnings.slice(0, 4).map(warning => {
              const c = CATEGORIES.find(x => x.id === warning.category)
              const Icon = c?.icon || AlertTriangle
              return <div className="warning-card" key={warning.id}>
                <div className="warning-card-top">
                  <div className="warning-icon" style={{color:c?.color || '#6edb8b', background:`${c?.color || '#6edb8b'}18`}}><Icon size={18}/></div>
                  <span className={`warning-badge ${warning.level.toLowerCase().replace(/\s+/g,'-')}`}>{warning.level}</span>
                </div>
                <div className="warning-title-row"><strong>{c?.name || warning.category}</strong><b>{warning.score}</b></div>
                <div className="warning-meter"><i style={{width:`${warning.score}%`}} /></div>
                <ul>{warning.reasons.slice(0,3).map(reason => <li key={reason}>{reason}</li>)}</ul>
              </div>
            })}
          </div>
          <div className="warning-note"><ShieldCheck size={15}/><span>{environment.intelligence.earlyWarnings.methodology}</span></div>
        </section>}

        <section className="main-grid" id="map">
          <div className="map-panel panel">
            <div className="panel-heading"><div><h2>Community environmental map</h2><p>Explore reported issues and local resources.</p></div><button className="secondary-button" onClick={() => setShowReport(true)}><Plus size={16}/>Report</button></div>
            <div className="map-toolbar">
              <div className="search"><Search size={16}/><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search issues, places, or descriptions..."/></div>
              <div className="filter-wrap"><Filter size={15}/><select value={category} onChange={e => setCategory(e.target.value)}><option value="all">All issues</option>{CATEGORIES.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
              <div className="filter-wrap"><Clock3 size={15}/><select value={mapDays} onChange={e => setMapDays(Number(e.target.value))}><option value="7">7 days</option><option value="14">14 days</option><option value="30">30 days</option><option value="0">All time</option></select></div>
            </div>
            <div className="map-wrapper">
              <RealMap reports={filtered} resources={RESOURCES} selected={selected} onSelect={setSelected} days={mapDays} />
              <div className="map-legend"><strong>Map key</strong>{CATEGORIES.slice(0,4).map(c => <span key={c.id}><i style={{background:c.color}}/>{c.name}</span>)}<span><i className="resource-dot"/>Resources</span></div>
              <div className="map-intel-badge"><Zap size={11}/> Spatial hotspot layer active · {mapDays === 0 ? "all time" : `last ${mapDays} days`}</div>
              <div className="map-count"><MapPin size={13}/>{filtered.length} visible issues</div>
            </div>
          </div>

          <aside className="priority-panel panel">
            <div className="panel-heading"><div><h2>Community priorities</h2><p>What needs attention first?</p></div><Sparkles size={20} className="accent"/></div>
            <div className="priority-list">{priorityReports.map(r => { const c=CATEGORIES.find(x=>x.id===r.category); const score=scoreReport(r, environment); const Icon=c.icon; return <button className="priority-item" key={r.id} onClick={()=>setSelected(r)}><div className="priority-icon" style={{color:c.color,background:`${c.color}18`}}><Icon size={18}/></div><div className="priority-copy"><strong>{r.title}</strong><span>{r.reports} community reports · {r.status}</span></div><div className="score"><b>{score}</b><small>impact</small></div></button> })}</div>
            <button className="planner-button" onClick={()=>openActionBuilder()}><Sparkles size={17}/>Create a response plan<ChevronRight size={16}/></button>
          </aside>
        </section>

        <section className="action-workspace" id="actions">
          <div className="panel response-panel">
            <div className="panel-heading"><div><p className="eyebrow">COMMUNITY RESPONSE</p><h2>Turn priorities into action</h2><p>Create a response, assign ownership, track progress, and check whether conditions improve.</p></div><button className="secondary-button" onClick={()=>openActionBuilder()}><Plus size={15}/>New response</button></div>
            <div className="response-list">
              {actions.length === 0 && <div className="response-empty">No response plans yet. Select a high-priority issue and create the first measurable response.</div>}
              {actions.slice(0,5).map(action => { const report=reports.find(r=>r.id===action.reportId); const c=CATEGORIES.find(x=>x.id===report?.category); const Icon=c?.icon||ClipboardCheck; const tasks=action.tasks||[]; const participants=action.participants||[]; return <div className="response-card" key={action.id}>
                <div className="response-card-top"><div className="response-title"><div className="action-icon"><Icon size={17}/></div><strong>{action.title}</strong></div><span className={`status-pill ${action.status.toLowerCase()}`}>{action.status}</span></div>
                <div className="response-meta"><span className="response-chip">Owner: {action.owner}</span>{action.dueDate && <span className="response-chip">Due: {action.dueDate}</span>}<span className="response-chip"><Users size={12}/> {participants.length} participant{participants.length===1?'':'s'}</span></div>
                <p>{report?.title || 'Environmental issue'} · Goal: {action.goal}</p>
                <div className="progress-line"><i style={{width:`${action.progress}%`}}/></div><small>{action.progress}% complete · {action.checkIns?.length || 0} check-in{(action.checkIns?.length || 0)===1?'':'s'}</small>{action.checkIns?.length > 0 && (() => { const latest = action.checkIns[action.checkIns.length - 1]; const o = latest.outcome; if (!o) return null; const change = o.percentChange; return <div className={`outcome-card ${change == null ? '' : change < 0 ? 'improving' : change > 0 ? 'rising' : 'stable'}`}><div><span>Observable outcome</span><strong>{change == null ? 'Baseline established' : `${change > 0 ? '+' : ''}${change}%`}</strong></div><p>{o.baseline} confirmations at baseline → {o.current} now{change < 0 ? ' · activity decreased' : change > 0 ? ' · activity increased' : ' · no change'}</p></div> })()}
                <div className="response-task-list">{tasks.map(task => <label className={`response-task ${task.completed?'done':''}`} key={task.id}><input type="checkbox" checked={!!task.completed} onChange={()=>toggleTask(action,task)} disabled={!action.joinedByMe}/><span>{task.title}</span></label>)}</div>
                <div className="response-actions"><button className="secondary-button" onClick={()=>updateAction(action.id,{joinToggle:true})}><UserPlus size={14}/>{action.joinedByMe ? 'Leave response' : 'Join response'}</button><button className="secondary-button" onClick={()=>checkInAction(action)} disabled={!action.joinedByMe}><TrendingUp size={14}/>Check in</button></div>
              </div>})}
            </div>
          </div>
          <div className="panel measurement-panel">
            <div className="panel-heading"><div><p className="eyebrow">MEASURE</p><h2>Did the community improve?</h2><p>CivicEco compares future observations with the baseline captured when a response starts.</p></div><TrendingUp size={20} className="accent"/></div>
            {actions.length ? <div className="measurement-box"><h3>Response measurement</h3><p>Every check-in records current confirmations, status, and response progress. CivicEco compares those observations with the baseline captured when the response starts.</p><div className="measurement-stats"><div className="measurement-stat"><span>Plans</span><strong>{actions.length}</strong></div><div className="measurement-stat"><span>Completed</span><strong>{actions.filter(a=>a.status==='Completed').length}</strong></div><div className="measurement-stat"><span>Active</span><strong>{actions.filter(a=>a.status==='Active').length}</strong></div><div className="measurement-stat"><span>Check-ins</span><strong>{actions.reduce((n,a)=>n+(a.checkIns?.length||0),0)}</strong></div></div><div className="outcome-grid">{actions.filter(a=>a.checkIns?.length).slice(0,4).map(a=>{const latest=a.checkIns[a.checkIns.length-1]; const o=latest.outcome; return <div className="outcome-summary" key={a.id}><span>{a.title}</span><strong>{o?.percentChange == null ? 'Baseline' : `${o.percentChange > 0 ? '+' : ''}${o.percentChange}%`}</strong><small>{o?.baseline ?? '—'} → {o?.current ?? '—'} confirmations</small></div>})}</div></div> : <div className="response-empty">Create a response plan to begin measuring outcomes.</div>}
            <div className="success-note"><ShieldCheck size={15}/><span>CivicEco measures observable community signals. It does not claim that an action caused an environmental change without supporting evidence.</span></div>
          </div>
        </section>

        <section className="bottom-grid" id="community">
          <div className="panel action-panel"><div className="panel-heading"><div><h2>Community action</h2><p>Reports become more useful when they lead to a measurable next step.</p></div></div><div className="action-cards">{CATEGORIES.slice(0,3).map(c => { const Icon=c.icon; return <Action key={c.id} icon={Icon} title={ACTIONS[c.id][0]} text={ACTIONS[c.id][1]}/> })}</div></div>
          <div className="panel insight-panel"><div className="insight-icon"><Zap size={20}/></div><p className="eyebrow">WHY THIS MATTERS</p><h2>From scattered observations to shared evidence.</h2><p>CivicEco combines severity, frequency, and community confirmation to help people decide which problems deserve attention first.</p><button className="text-button" onClick={()=>setShowReport(true)}>Add your observation <ChevronRight size={15}/></button></div>
        </section>

        <section className="resource-section panel" id="resources">
          <div className="panel-heading"><div><h2>Community resources</h2><p>Places that can support environmental action.</p></div><Navigation size={20} className="accent"/></div>
          <div className="resource-grid">{RESOURCES.map(r => <div className="resource-card" key={r.name}><div className="resource-card-icon"><Recycle size={18}/></div><div><strong>{r.name}</strong><span>{r.type} resource</span></div><ArrowUpRight size={16}/></div>)}</div>
        </section>

        <section className="how-section">
          <div><p className="eyebrow">HOW CIVICECO WORKS</p><h2>Observe → Prioritize → Act → Measure</h2></div>
          <div className="how-grid"><How n="1" icon={MapPin} title="Observe" text="Residents report what they see."/><How n="2" icon={BarChart3} title="Prioritize" text="Impact scores surface patterns."/><How n="3" icon={ClipboardCheck} title="Act" text="Action plans turn data into next steps."/><How n="4" icon={TrendingUp} title="Measure" text="New reports show whether conditions improve."/></div>
        </section>
      </main>

      {selected && <Modal onClose={()=>setSelected(null)} title="Environmental issue"><IssueDetail allReports={reports} selected={selected} environment={environment} user={user} community={communityData[selected.id]} communityLoading={communityLoading} commentText={commentText} setCommentText={setCommentText} onConfirm={()=>addConfirmation(selected)} onFollow={()=>toggleFollow(selected)} onComment={()=>addComment(selected)} onResolve={()=>markResolved(selected)} onPlan={()=>{setSelected(null);setShowPlanner(true)}}/></Modal>}
      {showAuth && <Modal onClose={()=>setShowAuth(false)} title={authMode === 'login' ? 'Sign in to CivicEco' : 'Create your CivicEco account'}><form className="auth-form" onSubmit={submitAuth}>{authMode === 'signup' && <label>Name<input required value={authForm.name} onChange={e=>setAuthForm({...authForm,name:e.target.value})} placeholder="Your name"/></label>}<label>Email<input required type="email" value={authForm.email} onChange={e=>setAuthForm({...authForm,email:e.target.value})} placeholder="you@example.com"/></label><label>Password<input required minLength={8} type="password" value={authForm.password} onChange={e=>setAuthForm({...authForm,password:e.target.value})} placeholder="At least 8 characters"/></label>{authError && <div className="auth-error"><AlertTriangle size={15}/>{authError}</div>}<button className="primary-button" disabled={authLoading} type="submit">{authLoading ? 'Working…' : authMode === 'login' ? <><LogIn size={16}/>Sign in</> : <><UserCircle size={16}/>Create account</>}</button><button type="button" className="text-button" onClick={()=>{setAuthMode(authMode === 'login' ? 'signup' : 'login');setAuthError('')}}>{authMode === 'login' ? 'Need an account? Create one' : 'Already have an account? Sign in'}</button></form></Modal>}
      {showReport && <Modal onClose={()=>setShowReport(false)} title="Report an environmental issue"><form className="report-form" onSubmit={submitReport}><label>Issue title<input required value={form.title} onChange={e=>setForm({...form,title:e.target.value})} placeholder="e.g. Trash near the walking trail"/></label><label>Location<div className="location-input"><input required value={form.location} onChange={e=>setForm({...form,location:e.target.value})} placeholder="Park, street, trail, or area"/><button type="button" className="secondary-button" onClick={useLocation}><Navigation size={15}/></button></div></label><label>Category<select value={form.category} onChange={e=>setForm({...form,category:e.target.value})}>{CATEGORIES.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></label><label>Severity<select value={form.severity} onChange={e=>setForm({...form,severity:Number(e.target.value)})}><option value="1">1 — Low</option><option value="2">2 — Moderate</option><option value="3">3 — Significant</option><option value="4">4 — Serious</option><option value="5">5 — Critical</option></select></label><label>Description<textarea required rows="4" value={form.description} onChange={e=>setForm({...form,description:e.target.value})} placeholder="What did you observe? Include useful context such as when or how often you noticed it."/></label><label>Evidence photo <input type="file" accept="image/*" onChange={e=>handleEvidence(e.target.files?.[0])}/><small className="field-help">Optional. CivicEco stores up to one small image with this report.</small></label>{evidence && <div className="evidence-preview"><img src={evidence.data} alt="Report evidence preview"/><div><strong>{evidence.name}</strong><button type="button" className="text-button" onClick={()=>setEvidence(null)}>Remove</button></div></div>}<button className="primary-button" type="submit"><Plus size={17}/>Add community report</button></form></Modal>}
      {showPlanner && <Modal onClose={()=>setShowPlanner(false)} title="Community action plan"><Planner reports={priorityReports} environment={environment}/></Modal>}
      {showActionBuilder && <Modal onClose={()=>setShowActionBuilder(false)} title="Create community response"><form className="action-form" onSubmit={createAction}><label>Issue<select value={actionTarget?.id || ''} onChange={e=>setActionTarget(reports.find(r=>String(r.id)===e.target.value))}>{priorityReports.map(r=><option key={r.id} value={r.id}>{r.title} · {scoreReport(r,environment)}/100</option>)}</select></label><label>Response / target<input required value={actionForm.target} onChange={e=>setActionForm({...actionForm,target:e.target.value})}/></label><label>Owner<input value={actionForm.owner} onChange={e=>setActionForm({...actionForm,owner:e.target.value})}/></label><label>Due date<input type="date" value={actionForm.dueDate} onChange={e=>setActionForm({...actionForm,dueDate:e.target.value})}/></label><label>Baseline<textarea rows="2" value={actionForm.baseline} onChange={e=>setActionForm({...actionForm,baseline:e.target.value})}/></label><label>Success goal<textarea required rows="2" value={actionForm.goal} onChange={e=>setActionForm({...actionForm,goal:e.target.value})}/></label><div className="action-form-actions"><button type="button" className="secondary-button" onClick={()=>setShowActionBuilder(false)}>Cancel</button><button className="primary-button" type="submit"><ClipboardCheck size={15}/>Create response</button></div></form></Modal>}
      {showInsights && <Modal onClose={()=>setShowInsights(false)} title="CivicEco Insights"><Insights reports={reports} environment={environment} actions={actions} hotspots={hotspots} onSelect={setSelected}/></Modal>}
      {showCommunityCenter && user && <Modal onClose={()=>setShowCommunityCenter(false)} title="Community Center"><CommunityCenter user={user} apiRequest={apiRequest} onSelect={setSelected} onClose={()=>setShowCommunityCenter(false)}/></Modal>}
      {showTrends && <Modal onClose={()=>setShowTrends(false)} title="Community trends"><Trends reports={reports}/></Modal>}
    </div>
  )
}

function Stat({icon:Icon,label,value,note}){return <div className="stat-card"><div className="stat-icon"><Icon size={19}/></div><div><span>{label}</span><strong>{value}</strong><small>{note}</small></div></div>}
function Action({icon:Icon,title,text}){return <div className="action-card"><div className="action-icon"><Icon size={19}/></div><div><strong>{title}</strong><p>{text}</p></div></div>}
function How({n,icon:Icon,title,text}){return <div className="how-card"><div className="how-number">{n}</div><Icon size={20}/><strong>{title}</strong><p>{text}</p></div>}
function IssueDetail({selected,onConfirm,onFollow,onComment,onResolve,onPlan,allReports=[],environment,user,community,communityLoading,commentText,setCommentText}){
  const c=CATEGORIES.find(x=>x.id===selected.category); const Icon=c?.icon||AlertTriangle; const verification=verificationFor(selected,allReports)
  return <div className="issue-detail">
    <div className="issue-title"><div className="detail-icon" style={{background:`${c?.color || '#6edb8b'}18`,color:c?.color || '#6edb8b'}}><Icon size={22}/></div><div><h2>{selected.title}</h2><span className="status">{selected.status} · {selected.location}</span></div></div>
    <p>{selected.description}</p>
    <div className="detail-grid"><div><span>Impact score</span><strong>{scoreReport(selected, environment)}/100</strong></div><div><span>Community reports</span><strong>{selected.reports}</strong></div><div><span>Reported</span><strong>{selected.created}</strong></div></div>
    <div className="verification-card"><div className="verification-icon"><ShieldCheck size={18}/></div><div><strong>{verification.level} · {verification.score}/100</strong><p>Confidence uses evidence, independent confirmations, report completeness, and location data. It is a trust signal, not proof that an observation is true.</p></div></div>
    {verification.possibleDuplicate && <div className="data-warning"><AlertTriangle size={16}/><span>This report may overlap with another nearby report. CivicEco will avoid treating matching reports as independent evidence without review.</span></div>}
    {selected.evidence?.length > 0 && <div className="evidence-gallery">{selected.evidence.map((item,i)=><img key={i} src={item.data} alt={`Evidence ${i+1} for ${selected.title}`}/>)}</div>}
    <div className="community-collab-card">
      <div className="collab-heading"><div><p className="eyebrow">COMMUNITY COLLABORATION</p><h3>Work together on this issue</h3></div><Users size={19}/></div>
      <div className="collab-stats"><span><strong>{community?.confirmations ?? Math.max(0,(selected.reports||1)-1)}</strong> unique confirmations</span><span><strong>{community?.followers ?? 0}</strong> followers</span><span><strong>{community?.comments?.length ?? 0}</strong> comments</span></div>
      <div className="detail-actions"><button className="secondary-button" onClick={onConfirm} disabled={community?.confirmedByMe}><Users size={15}/>{community?.confirmedByMe ? 'Confirmed' : 'I saw this too'}</button><button className="secondary-button" onClick={onFollow}><Bell size={15}/>{community?.following ? 'Following' : 'Follow issue'}</button></div>
      {!user && <p className="collab-signin">Sign in to add a unique confirmation, follow this issue, or join the discussion.</p>}
      {communityLoading && <div className="collab-loading">Loading community activity…</div>}
      <div className="comment-box"><textarea value={commentText} onChange={e=>setCommentText(e.target.value)} maxLength={500} rows="2" placeholder={user ? 'Share a useful observation or update…' : 'Sign in to comment'} disabled={!user}/><button className="primary-button" onClick={onComment} disabled={!user || !commentText.trim()}><Users size={15}/>Comment</button></div>
      <div className="comment-list">{(community?.comments || []).slice(0,5).map(comment=><div className="comment-item" key={comment.id}><div className="comment-avatar">{comment.name?.slice(0,1).toUpperCase() || 'C'}</div><div><strong>{comment.name}</strong><span>{new Date(comment.createdAt).toLocaleString()}</span><p>{comment.text}</p></div></div>)}{!communityLoading && !(community?.comments?.length) && <div className="collab-empty">No discussion yet. Be the first to add a useful observation.</div>}</div>
    </div>
    <div className="detail-actions"><>{selected.status !== 'Resolved' && <button className="secondary-button" onClick={onResolve}><CheckCircle2 size={15}/>Mark resolved</button>}<button className="primary-button" onClick={onPlan}><Sparkles size={16}/>Build action plan</button></></div>
  </div>
}
function Planner({reports, environment}){return <div className="planner"><div className="planner-banner"><Sparkles size={20}/><div><strong>Generated priority strategy</strong><span>Uses severity, community evidence, recurrence, freshness, and public environmental context.</span></div></div>{reports.slice(0,3).map((r,i)=>{const steps=ACTIONS[r.category]||ACTIONS.litter;return <div className="plan-step" key={r.id}><span>{i+1}</span><div><strong>{r.title} · {scoreReport(r, environment)}/100</strong><p>{steps[0]} {steps[1]}</p></div></div>})}<div className="plan-note"><Clock3 size={16}/><span>Recheck each issue after action and compare future community reports to measure progress.</span></div></div>}
function Insights({reports, environment, actions, hotspots, onSelect}) {
  const categoryRows = CATEGORIES.map(c => {
    const items = reports.filter(r => r.category === c.id)
    const avg = items.length ? Math.round(items.reduce((s, r) => s + scoreReport(r, environment), 0) / items.length) : 0
    return { ...c, count: items.length, confirmations: items.reduce((s, r) => s + (r.reports || 0), 0), avg }
  }).sort((a, b) => b.avg - a.avg)
  const maxCount = Math.max(1, ...categoryRows.map(r => r.count))
  const resolved = reports.filter(r => r.status === 'Resolved').length
  const active = reports.length - resolved
  const evidenceCount = reports.reduce((n, r) => n + (r.evidence?.length || 0), 0)
  const checkIns = actions.reduce((n, a) => n + (a.checkIns?.length || 0), 0)
  const temporal = environment?.intelligence?.temporalPatterns?.patterns || []
  const warnings = environment?.intelligence?.earlyWarnings?.warnings || []
  const top = [...reports].sort((a, b) => scoreReport(b, environment) - scoreReport(a, environment)).slice(0, 3)

  return <div className="insights">
    <div className="insights-hero">
      <div>
        <p className="eyebrow">COMMUNITY ANALYTICS</p>
        <h3>What the CivicEco data is telling us</h3>
        <p>Explore issue volume, impact, momentum, response activity, and environmental signals in one place.</p>
      </div>
      <div className="insights-score"><strong>{reports.length ? Math.round(reports.reduce((s,r)=>s+scoreReport(r,environment),0)/reports.length) : 0}</strong><span>average impact</span></div>
    </div>

    <div className="insights-stat-grid">
      <div><span>Total issues</span><strong>{reports.length}</strong><small>{active} active · {resolved} resolved</small></div>
      <div><span>Confirmations</span><strong>{reports.reduce((s,r)=>s+(r.reports||0),0)}</strong><small>Community observations</small></div>
      <div><span>Evidence</span><strong>{evidenceCount}</strong><small>Attached report images</small></div>
      <div><span>Response check-ins</span><strong>{checkIns}</strong><small>Progress measurements</small></div>
    </div>

    <div className="insights-section">
      <div className="insights-section-heading"><div><h4>Category activity</h4><p>Issue volume and average impact by environmental category.</p></div></div>
      <div className="category-bars">
        {categoryRows.map(row => <div className="category-bar-row" key={row.id}>
          <div className="category-bar-label"><span>{row.name}</span><b>{row.count}</b></div>
          <div className="category-bar-track"><i style={{width:`${(row.count/maxCount)*100}%`,background:row.color}}/></div>
          <span className="category-bar-impact">{row.avg}/100</span>
        </div>)}
      </div>
    </div>

    <div className="insights-columns">
      <div className="insights-section">
        <div className="insights-section-heading"><div><h4>Highest-priority issues</h4><p>Ranked by the current CivicEco intelligence model.</p></div></div>
        <div className="insight-issue-list">
          {top.map(r => <button key={r.id} className="insight-issue" onClick={()=>onSelect(r)}>
            <div><strong>{r.title}</strong><span>{r.reports} confirmations · {r.status}</span></div>
            <b>{scoreReport(r,environment)}</b>
          </button>)}
        </div>
      </div>
      <div className="insights-section">
        <div className="insights-section-heading"><div><h4>Signals to watch</h4><p>Current pattern and early-warning signals.</p></div></div>
        <div className="signal-list">
          {temporal.slice(0,3).map(p => <div className="signal-row" key={p.category}><span>{CATEGORIES.find(c=>c.id===p.category)?.name || p.category}</span><b>{p.level}</b><small>{p.changePercent === null ? 'New activity' : `${p.changePercent > 0 ? '+' : ''}${p.changePercent}% vs prior period`}</small></div>)}
          {!temporal.length && <div className="insight-empty">More time-stamped reports are needed before CivicEco can identify a trend.</div>}
          {warnings.slice(0,2).map(w => <div className="signal-row warning-signal" key={w.id}><span>{CATEGORIES.find(c=>c.id===w.category)?.name || w.category}</span><b>{w.level}</b><small>Early-warning score {w.score}/100</small></div>)}
        </div>
      </div>
    </div>

    {hotspots.length > 0 && <div className="insights-section">
      <div className="insights-section-heading"><div><h4>Detected geographic hotspots</h4><p>Clusters of nearby reports that may deserve closer attention.</p></div></div>
      <div className="hotspot-summary-grid">
        {hotspots.slice(0,3).map((h,i)=><div className="hotspot-summary" key={h.id || i}><span>Hotspot {i+1}</span><strong>{h.score || h.priority || '—'}</strong><small>{h.reports?.length || h.reportCount || 0} nearby reports</small></div>)}
      </div>
    </div>}

    <div className="insights-disclaimer"><ShieldCheck size={15}/><span>These analytics are decision-support signals based on CivicEco reports and available public data. They do not establish causation or replace professional environmental assessment.</span></div>
  </div>
}

function Trends({reports}){const rows=CATEGORIES.map(c=>({c,count:reports.filter(r=>r.category===c.id).length,impact:reports.filter(r=>r.category===c.id).reduce((s,r)=>s+scoreReport(r),0)})).sort((a,b)=>b.impact-a.impact);return <div className="trends"><div className="trend-summary"><div><span>Issues tracked</span><strong>{reports.length}</strong></div><div><span>Total confirmations</span><strong>{reports.reduce((s,r)=>s+r.reports,0)}</strong></div><div><span>Highest category</span><strong>{rows[0]?.c.name||'—'}</strong></div></div>{rows.map(r=><div className="trend-row" key={r.c.id}><div className="trend-name"><r.c.icon size={17}/><span>{r.c.name}</span></div><div className="bar"><i style={{width:`${Math.min(100,r.impact/Math.max(1,reports.length*100)*100)}%`,background:r.c.color}}/></div><strong>{r.count}</strong></div>)}</div>}
function Modal({children,onClose,title}){return <div className="modal-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget)onClose()}}><div className="modal"><div className="modal-header"><h2>{title}</h2><button className="icon-button" onClick={onClose}><X size={18}/></button></div>{children}</div></div>}

export default App
