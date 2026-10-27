import express from 'express'
import path from 'node:path'
import fs from 'node:fs/promises'
import crypto from 'node:crypto'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const app = express()
const PORT = Number(process.env.PORT || 3001)
const NODE_ENV = process.env.NODE_ENV || 'development'
const MAX_JSON_BYTES = process.env.MAX_JSON_BYTES || '2mb'
const SESSION_TTL_MS = Number(process.env.SESSION_TTL_MS || 1000 * 60 * 60 * 24)
const DATA_DIR = path.join(__dirname, 'data')
const DB_FILE = path.join(DATA_DIR, 'civiceco.json')
const DIST_DIR = path.join(__dirname, 'dist')

app.disable('x-powered-by')
app.use((req, res, next) => {
  const requestId = crypto.randomUUID()
  req.requestId = requestId
  res.setHeader('X-Request-ID', requestId)
  res.setHeader('X-Content-Type-Options', 'nosniff')
  res.setHeader('X-Frame-Options', 'DENY')
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin')
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=(self)')
  next()
})
app.use(express.json({ limit: MAX_JSON_BYTES }))
app.use(express.static(DIST_DIR, { extensions: ['html'], maxAge: NODE_ENV === 'production' ? '1h' : 0 }))
const rateBuckets = new Map()
function rateLimit(limit = 120, windowMs = 60_000) {
  return (req, res, next) => {
    const key = `${req.ip || 'unknown'}:${req.path}`
    const now = Date.now()
    const bucket = rateBuckets.get(key)
    if (!bucket || now - bucket.start >= windowMs) {
      rateBuckets.set(key, { start: now, count: 1 })
      return next()
    }
    bucket.count += 1
    if (bucket.count > limit) return res.status(429).json({ error: 'Too many requests. Please wait and try again.', requestId: req.requestId })
    next()
  }
}
app.use('/api/auth', rateLimit(20, 60_000))
app.use('/api', rateLimit(180, 60_000))

const sessions = new Map()
const seedReports = [
  { id: 1, lat: 38.9185, lng: -77.0295, title: 'Litter around park entrance', category: 'litter', severity: 3, reports: 8, status: 'Open', description: 'Repeated trash buildup near the main entrance.', location: 'Community Park', created: '2 days ago', createdAt: '2026-10-24T12:00:00Z', evidence: [] },
  { id: 2, lat: 38.932, lng: -77.012, title: 'Dumping near creek access', category: 'dumping', severity: 5, reports: 6, status: 'Open', description: 'Multiple reports of discarded household material.', location: 'Creek Road', created: '1 day ago', createdAt: '2026-10-25T12:00:00Z', evidence: [] },
  { id: 3, lat: 38.894, lng: -77.018, title: 'Water quality concern', category: 'water', severity: 5, reports: 4, status: 'Investigating', description: 'Residents noticed unusual water color after rainfall.', location: 'South Creek', created: '4 days ago', createdAt: '2026-10-22T12:00:00Z', evidence: [] },
  { id: 4, lat: 38.889, lng: -77.057, title: 'Damaged tree cluster', category: 'trees', severity: 2, reports: 3, status: 'Open', description: 'Several damaged trees beside a walking path.', location: 'Greenway Trail', created: '6 days ago', createdAt: '2026-10-20T12:00:00Z', evidence: [] },
  { id: 5, lat: 38.9075, lng: -77.048, title: 'Recycling access gap', category: 'recycling', severity: 2, reports: 5, status: 'Open', description: 'Few recycling bins serve a busy community area.', location: 'Main Street', created: '3 days ago', createdAt: '2026-10-23T12:00:00Z', evidence: [] },
  { id: 6, lat: 38.921, lng: -77.055, title: 'Park maintenance issue', category: 'parks', severity: 3, reports: 2, status: 'Planned', description: 'Park equipment and surrounding area need attention.', location: 'Neighborhood Park', created: '8 days ago', createdAt: '2026-10-18T12:00:00Z', evidence: [] },
]

async function readDb() {
  try { return JSON.parse(await fs.readFile(DB_FILE, 'utf8')) } catch { return { users: [], reports: seedReports, actions: [] } }
}
async function writeDb(db) {
  await fs.mkdir(DATA_DIR, { recursive: true })
  if (process.env.BACKUP_DB === 'true') {
    try {
      await fs.copyFile(DB_FILE, `${DB_FILE}.backup`)
    } catch {}
  }
  const tempFile = `${DB_FILE}.tmp`
  await fs.writeFile(tempFile, JSON.stringify(db, null, 2), 'utf8')
  await fs.rename(tempFile, DB_FILE)
}
function hashPassword(password, salt = crypto.randomBytes(16).toString('hex')) {
  return new Promise((resolve, reject) => crypto.scrypt(password, salt, 64, (err, key) => err ? reject(err) : resolve(`${salt}:${key.toString('hex')}`)))
}
async function verifyPassword(password, stored) {
  const [salt, hash] = String(stored).split(':')
  if (!salt || !hash) return false
  const derived = await hashPassword(password, salt)
  return crypto.timingSafeEqual(Buffer.from(derived.split(':')[1], 'hex'), Buffer.from(hash, 'hex'))
}
function auth(req) {
  const token = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '')
  const session = token ? sessions.get(token) : null
  if (!session) return null
  if (session.expiresAt && session.expiresAt < Date.now()) { sessions.delete(token); return null }
  return session
}

app.get('/api/health', async (_req, res) => res.json({ ok: true, service: 'CivicEco API', persistence: 'local-json' }))

app.post('/api/auth/signup', async (req, res) => {
  const { name, email, password } = req.body || {}
  if (!name || !email || !password || String(password).length < 8 || String(password).length > 128) return res.status(400).json({ error: 'Name, email, and a password between 8 and 128 characters are required.' })
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email).trim())) return res.status(400).json({ error: 'Please provide a valid email address.' })
  const db = await readDb()
  const normalized = String(email).trim().toLowerCase()
  if (db.users.some(u => u.email === normalized)) return res.status(409).json({ error: 'An account with that email already exists.' })
  const user = { id: crypto.randomUUID(), name: String(name).trim().slice(0, 80), email: normalized, passwordHash: await hashPassword(String(password)), createdAt: new Date().toISOString() }
  db.users.push(user)
  await writeDb(db)
  const token = crypto.randomBytes(32).toString('hex')
  sessions.set(token, { userId: user.id, expiresAt: Date.now() + SESSION_TTL_MS })
  res.status(201).json({ token, user: { id: user.id, name: user.name, email: user.email } })
})

app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body || {}
  const db = await readDb()
  const user = db.users.find(u => u.email === String(email || '').trim().toLowerCase())
  if (!user || !(await verifyPassword(String(password || ''), user.passwordHash))) return res.status(401).json({ error: 'Email or password is incorrect.' })
  const token = crypto.randomBytes(32).toString('hex')
  sessions.set(token, { userId: user.id, expiresAt: Date.now() + SESSION_TTL_MS })
  res.json({ token, user: { id: user.id, name: user.name, email: user.email } })
})

app.get('/api/auth/me', async (req, res) => {
  const session = auth(req); if (!session) return res.status(401).json({ error: 'Not signed in.' })
  const db = await readDb(); const user = db.users.find(u => u.id === session.userId)
  if (!user) return res.status(401).json({ error: 'Account not found.' })
  res.json({ user: { id: user.id, name: user.name, email: user.email } })
})

app.post('/api/auth/logout', (req, res) => { const token = String(req.headers.authorization || '').replace(/^Bearer\s+/i, ''); sessions.delete(token); res.json({ ok: true }) })

app.get('/api/reports', async (_req, res) => { const db = await readDb(); res.json({ reports: db.reports }) })

app.post('/api/reports', async (req, res) => {
  const session = auth(req); if (!session) return res.status(401).json({ error: 'Sign in to save a report to the community database.' })
  const db = await readDb(); const input = req.body || {}
  const report = { ...input, id: Date.now(), reports: 1, status: 'Open', created: 'Just now', createdAt: new Date().toISOString(), createdBy: session.userId, evidence: Array.isArray(input.evidence) ? input.evidence.slice(0, 4) : [] }
  db.reports.push(report); await writeDb(db); res.status(201).json({ report })
})

app.patch('/api/reports/:id', async (req, res) => {
  const session = auth(req); if (!session) return res.status(401).json({ error: 'Sign in to update community data.' })
  const db = await readDb(); const id = Number(req.params.id); const index = db.reports.findIndex(r => Number(r.id) === id)
  if (index < 0) return res.status(404).json({ error: 'Report not found.' })
  db.reports[index] = { ...db.reports[index], ...req.body, id: db.reports[index].id, updatedAt: new Date().toISOString() }; await writeDb(db); res.json({ report: db.reports[index] })
})


function ensureCommunity(db) {
  if (!db.community) db.community = { confirmations: [], follows: [], comments: [] }
  return db.community
}

app.get('/api/reports/:id/community', async (req, res) => {
  const db = await readDb(); const community = ensureCommunity(db); const reportId = Number(req.params.id)
  const comments = community.comments.filter(c => Number(c.reportId) === reportId).sort((a,b) => new Date(b.createdAt) - new Date(a.createdAt))
  const followers = community.follows.filter(f => Number(f.reportId) === reportId)
  const confirmations = community.confirmations.filter(c => Number(c.reportId) === reportId)
  const session = auth(req)
  res.json({
    followers: followers.length,
    confirmations: confirmations.length,
    following: !!session && followers.some(f => f.userId === session.userId),
    confirmedByMe: !!session && confirmations.some(c => c.userId === session.userId),
    comments: comments.map(c => ({ id:c.id, name:c.name, text:c.text, createdAt:c.createdAt }))
  })
})

app.post('/api/reports/:id/confirm', async (req, res) => {
  const session = auth(req); if (!session) return res.status(401).json({ error: 'Sign in to confirm an observation.' })
  const db = await readDb(); const community = ensureCommunity(db); const reportId = Number(req.params.id)
  const report = db.reports.find(r => Number(r.id) === reportId); if (!report) return res.status(404).json({ error: 'Report not found.' })
  if (community.confirmations.some(c => Number(c.reportId) === reportId && c.userId === session.userId)) return res.status(409).json({ error: 'You already confirmed this report.' })
  community.confirmations.push({ id: crypto.randomUUID(), reportId, userId: session.userId, createdAt: new Date().toISOString() })
  report.reports = Number(report.reports || 0) + 1
  await writeDb(db); res.json({ report, confirmedByMe: true, confirmations: community.confirmations.filter(c => Number(c.reportId) === reportId).length })
})

app.post('/api/reports/:id/follow', async (req, res) => {
  const session = auth(req); if (!session) return res.status(401).json({ error: 'Sign in to follow an issue.' })
  const db = await readDb(); const community = ensureCommunity(db); const reportId = Number(req.params.id)
  if (!db.reports.some(r => Number(r.id) === reportId)) return res.status(404).json({ error: 'Report not found.' })
  const index = community.follows.findIndex(f => Number(f.reportId) === reportId && f.userId === session.userId)
  let following
  if (index >= 0) { community.follows.splice(index, 1); following = false } else { community.follows.push({ id: crypto.randomUUID(), reportId, userId: session.userId, createdAt: new Date().toISOString() }); following = true }
  await writeDb(db); res.json({ following, followers: community.follows.filter(f => Number(f.reportId) === reportId).length })
})

app.post('/api/reports/:id/comments', async (req, res) => {
  const session = auth(req); if (!session) return res.status(401).json({ error: 'Sign in to comment.' })
  const text = String(req.body?.text || '').trim(); if (!text || text.length > 500) return res.status(400).json({ error: 'Comment must be between 1 and 500 characters.' })
  const db = await readDb(); const community = ensureCommunity(db); const reportId = Number(req.params.id)
  if (!db.reports.some(r => Number(r.id) === reportId)) return res.status(404).json({ error: 'Report not found.' })
  const user = db.users.find(u => u.id === session.userId)
  const comment = { id: crypto.randomUUID(), reportId, userId: session.userId, name: user?.name || 'CivicEco member', text, createdAt: new Date().toISOString() }
  community.comments.push(comment); await writeDb(db)
  res.status(201).json({ comment: { id: comment.id, name: comment.name, text: comment.text, createdAt: comment.createdAt } })
})


app.get('/api/notifications', async (req, res) => {
  const session = auth(req); if (!session) return res.status(401).json({ error: 'Sign in to view notifications.' })
  const db = await readDb(); const community = ensureCommunity(db)
  const followedIds = new Set(community.follows.filter(f => f.userId === session.userId).map(f => Number(f.reportId)))
  const reportsById = new Map(db.reports.map(r => [Number(r.id), r]))
  const usersById = new Map(db.users.map(u => [u.id, u]))
  const events = []
  community.confirmations.filter(c => followedIds.has(Number(c.reportId)) && c.userId !== session.userId).forEach(c => {
    const r = reportsById.get(Number(c.reportId)); if (!r) return
    const u = usersById.get(c.userId)
    events.push({ id: `confirm-${c.id}`, type: 'confirmation', title: 'New community confirmation', text: `${u?.name || 'A community member'} confirmed “${r.title}”.`, reportId: r.id, createdAt: c.createdAt })
  })
  community.comments.filter(c => followedIds.has(Number(c.reportId)) && c.userId !== session.userId).forEach(c => {
    const r = reportsById.get(Number(c.reportId)); if (!r) return
    events.push({ id: `comment-${c.id}`, type: 'comment', title: 'New comment on a followed issue', text: `${c.name || 'A community member'} commented on “${r.title}”.`, reportId: r.id, createdAt: c.createdAt })
  })
  followedIds.forEach(id => {
    const r = reportsById.get(id); if (!r) return
    if (r.status === 'Resolved') events.push({ id: `resolved-${r.id}-${r.createdAt}`, type: 'resolved', title: 'Followed issue resolved', text: `“${r.title}” is marked resolved.`, reportId: r.id, createdAt: r.updatedAt || r.createdAt })
  })
  events.sort((a,b) => new Date(b.createdAt) - new Date(a.createdAt))
  res.json({ notifications: events.slice(0, 30) })
})

app.get('/api/profile', async (req, res) => {
  const session = auth(req); if (!session) return res.status(401).json({ error: 'Sign in to view your community profile.' })
  const db = await readDb(); const community = ensureCommunity(db)
  const user = db.users.find(u => u.id === session.userId)
  if (!user) return res.status(404).json({ error: 'User not found.' })
  const reports = db.reports.filter(r => r.createdBy === session.userId)
  const confirmed = community.confirmations.filter(c => c.userId === session.userId)
  const follows = community.follows.filter(f => f.userId === session.userId)
  const comments = community.comments.filter(c => c.userId === session.userId)
  const allActions = ensureActions(db)
  const joinedResponses = allActions.filter(a => actionForUser(a, session.userId))
  const responseParticipation = joinedResponses.map(a => ({
    id: a.id,
    reportId: a.reportId,
    title: a.title,
    status: a.status,
    progress: Number(a.progress || 0),
    owner: a.owner,
    dueDate: a.dueDate || '',
    goal: a.goal,
    participantCount: Array.isArray(a.participants) ? a.participants.length : 0,
    taskCount: Array.isArray(a.tasks) ? a.tasks.length : 0,
    completedTasks: Array.isArray(a.tasks) ? a.tasks.filter(t => t.completed).length : 0,
    checkIns: Array.isArray(a.checkIns) ? a.checkIns.length : 0,
    joinedAt: (a.participants || []).find(p => p.userId === session.userId)?.joinedAt || a.createdAt
  })).sort((a,b) => new Date(b.joinedAt || 0) - new Date(a.joinedAt || 0)).slice(0, 12)
  const completedTasks = joinedResponses.reduce((sum, a) => sum + (Array.isArray(a.tasks) ? a.tasks.filter(t => t.completed).length : 0), 0)
  const responseCheckIns = joinedResponses.reduce((sum, a) => sum + (Array.isArray(a.checkIns) ? a.checkIns.filter(c => c.recordedBy === session.userId).length : 0), 0)
  const evidenceReports = reports.filter(r => Array.isArray(r.evidence) && r.evidence.length > 0)
  const milestoneDefs = [
    { id:'first-report', title:'First Report', description:'Submitted your first community environmental report.', earned: reports.length >= 1, icon:'report' },
    { id:'evidence-contributor', title:'Evidence Contributor', description:'Added evidence to a community report.', earned: evidenceReports.length >= 1, icon:'evidence' },
    { id:'community-verifier', title:'Community Verifier', description:'Confirmed another community observation.', earned: confirmed.length >= 1, icon:'verify' },
    { id:'issue-watcher', title:'Issue Watcher', description:'Followed an environmental issue.', earned: follows.length >= 1, icon:'follow' },
    { id:'conversation-starter', title:'Conversation Starter', description:'Joined an environmental issue discussion.', earned: comments.length >= 1, icon:'comment' },
    { id:'response-teammate', title:'Response Teammate', description:'Joined a community response plan.', earned: joinedResponses.length >= 1, icon:'response' },
    { id:'action-finisher', title:'Action Finisher', description:'Completed a community response task.', earned: completedTasks >= 1, icon:'task' },
    { id:'outcome-measurer', title:'Outcome Measurer', description:'Recorded a response measurement check-in.', earned: responseCheckIns >= 1, icon:'measure' }
  ]
  const earnedMilestones = milestoneDefs.filter(m => m.earned).length
  const timeline = [
    ...reports.map(r => ({ type:'report', title:'Submitted a report', text:r.title, createdAt:r.createdAt })),
    ...confirmed.map(c => ({ type:'confirmation', title:'Confirmed an issue', text:db.reports.find(r => Number(r.id) === Number(c.reportId))?.title || 'Environmental issue', createdAt:c.createdAt })),
    ...follows.map(f => ({ type:'follow', title:'Followed an issue', text:db.reports.find(r => Number(r.id) === Number(f.reportId))?.title || 'Environmental issue', createdAt:f.createdAt })),
    ...comments.map(c => ({ type:'comment', title:'Joined a discussion', text:c.text, createdAt:c.createdAt })),
    ...joinedResponses.flatMap(a => (a.participants || []).filter(p => p.userId === session.userId).map(p => ({ type:'response', title:'Joined a response plan', text:a.title, createdAt:p.joinedAt }))),
    ...joinedResponses.flatMap(a => (a.tasks || []).filter(t => t.completed).map(t => ({ type:'task', title:'Completed a response task', text:t.title, createdAt:t.completedAt || a.updatedAt || a.createdAt }))),
    ...joinedResponses.flatMap(a => (a.checkIns || []).filter(c => c.recordedBy === session.userId).map(c => ({ type:'measure', title:'Recorded a measurement check-in', text:a.title, createdAt:c.date })))
  ].filter(e => e.createdAt).sort((a,b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, 30)
  res.json({
    user: { id: user.id, name: user.name, email: user.email, createdAt: user.createdAt },
    stats: { reports: reports.length, confirmations: confirmed.length, following: follows.length, comments: comments.length, responses: joinedResponses.length, resolved: reports.filter(r => r.status === 'Resolved').length, completedTasks, responseCheckIns, evidenceReports: evidenceReports.length, milestones: earnedMilestones },
    reports: reports.slice().sort((a,b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0)).slice(0, 12).map(r => ({ id:r.id, title:r.title, category:r.category, status:r.status, severity:r.severity, createdAt:r.createdAt, reports:r.reports || 0 })),
    following: follows.map(f => { const r = db.reports.find(x => Number(x.id) === Number(f.reportId)); return r ? { id:r.id, title:r.title, category:r.category, status:r.status } : null }).filter(Boolean).slice(0, 12),
    comments: comments.slice().sort((a,b) => new Date(b.createdAt)-new Date(a.createdAt)).slice(0, 12).map(c => ({ reportId:c.reportId, text:c.text, createdAt:c.createdAt })),
    responses: responseParticipation,
    milestones: milestoneDefs,
    timeline,
    contributionSummary: { trackedActions: reports.length + confirmed.length + follows.length + comments.length + completedTasks + responseCheckIns, earnedMilestones }
  })
})


function ensureActions(db) {
  if (!Array.isArray(db.actions)) db.actions = []
  return db.actions
}

function actionForUser(action, userId) {
  return Array.isArray(action.participants) && action.participants.some(p => p.userId === userId)
}

app.get('/api/actions', async (req, res) => {
  const db = await readDb()
  const actions = ensureActions(db)
  const session = auth(req)
  res.json({
    actions: actions.map(a => ({
      ...a,
      participants: Array.isArray(a.participants) ? a.participants.map(p => ({ userId: p.userId, name: p.name, joinedAt: p.joinedAt })) : [],
      tasks: Array.isArray(a.tasks) ? a.tasks : [],
      joinedByMe: !!session && actionForUser(a, session.userId)
    }))
  })
})

app.post('/api/actions', async (req, res) => {
  const session = auth(req)
  if (!session) return res.status(401).json({ error: 'Sign in to create a community response.' })
  const { reportId, title, owner, dueDate, baseline, goal } = req.body || {}
  if (!reportId || !title || !goal) return res.status(400).json({ error: 'Issue, response target, and success goal are required.' })
  const db = await readDb()
  const report = db.reports.find(r => Number(r.id) === Number(reportId))
  if (!report) return res.status(404).json({ error: 'Report not found.' })
  const user = db.users.find(u => u.id === session.userId)
  const action = {
    id: crypto.randomUUID(),
    reportId: report.id,
    title: String(title).trim().slice(0, 160),
    owner: String(owner || 'Community team').trim().slice(0, 100),
    dueDate: String(dueDate || ''),
    baseline: String(baseline || ''),
    baselineConfirmations: Number(report.reports || 0),
    goal: String(goal).trim().slice(0, 500),
    status: 'Planned',
    progress: 0,
    createdAt: new Date().toISOString(),
    createdBy: session.userId,
    participants: [{ userId: session.userId, name: user?.name || 'Community member', joinedAt: new Date().toISOString() }],
    tasks: [
      { id: crypto.randomUUID(), title: 'Review the issue and agree on the first step.', completed: false, createdBy: session.userId },
      { id: crypto.randomUUID(), title: 'Record a baseline observation before action.', completed: false, createdBy: session.userId }
    ],
    checkIns: []
  }
  ensureActions(db).unshift(action)
  await writeDb(db)
  res.status(201).json({ action: { ...action, joinedByMe: true } })
})

app.post('/api/actions/:id/join', async (req, res) => {
  const session = auth(req)
  if (!session) return res.status(401).json({ error: 'Sign in to join a response plan.' })
  const db = await readDb()
  const action = ensureActions(db).find(a => String(a.id) === String(req.params.id))
  if (!action) return res.status(404).json({ error: 'Response plan not found.' })
  const participants = Array.isArray(action.participants) ? action.participants : (action.participants = [])
  const index = participants.findIndex(p => p.userId === session.userId)
  let joinedByMe
  if (index >= 0) {
    if (action.createdBy === session.userId && participants.length === 1) {
      return res.status(400).json({ error: 'The response owner must remain on the response plan.' })
    }
    participants.splice(index, 1)
    joinedByMe = false
  } else {
    const user = db.users.find(u => u.id === session.userId)
    participants.push({ userId: session.userId, name: user?.name || 'Community member', joinedAt: new Date().toISOString() })
    joinedByMe = true
  }
  await writeDb(db)
  res.json({ joinedByMe, participants })
})

app.post('/api/actions/:id/tasks/:taskId/toggle', async (req, res) => {
  const session = auth(req)
  if (!session) return res.status(401).json({ error: 'Sign in to update response tasks.' })
  const db = await readDb()
  const action = ensureActions(db).find(a => String(a.id) === String(req.params.id))
  if (!action) return res.status(404).json({ error: 'Response plan not found.' })
  if (!actionForUser(action, session.userId)) return res.status(403).json({ error: 'Join this response plan before updating tasks.' })
  const task = (action.tasks || []).find(t => String(t.id) === String(req.params.taskId))
  if (!task) return res.status(404).json({ error: 'Task not found.' })
  task.completed = !task.completed
  task.completedAt = task.completed ? new Date().toISOString() : null
  const completed = (action.tasks || []).filter(t => t.completed).length
  action.progress = Math.min(100, Math.round((completed / Math.max(1, action.tasks.length)) * 100))
  action.status = action.progress >= 100 ? 'Completed' : action.progress > 0 ? 'Active' : 'Planned'
  action.updatedAt = new Date().toISOString()
  await writeDb(db)
  res.json({ action })
})

app.post('/api/actions/:id/checkin', async (req, res) => {
  const session = auth(req)
  if (!session) return res.status(401).json({ error: 'Sign in to record a response check-in.' })
  const db = await readDb()
  const action = ensureActions(db).find(a => String(a.id) === String(req.params.id))
  if (!action) return res.status(404).json({ error: 'Response plan not found.' })
  if (!actionForUser(action, session.userId)) return res.status(403).json({ error: 'Join this response plan before recording progress.' })
  const report = db.reports.find(r => Number(r.id) === Number(action.reportId))
  const checkIn = {
    id: crypto.randomUUID(),
    date: new Date().toISOString(),
    confirmations: Number(report?.reports || 0),
    status: report?.status || 'Unknown',
    progress: Number(action.progress || 0),
    baselineConfirmations: Number(action.baselineConfirmations ?? report?.reports ?? 0),
    currentConfirmations: Number(report?.reports || 0),
    outcome: (() => { const baseline = Number(action.baselineConfirmations ?? report?.reports ?? 0); const current = Number(report?.reports || 0); const delta = current - baseline; const percentChange = baseline > 0 ? Math.round((delta / baseline) * 100) : null; return { baseline, current, delta, percentChange } })(),
    recordedBy: session.userId
  }
  action.checkIns = Array.isArray(action.checkIns) ? action.checkIns : []
  action.checkIns.push(checkIn)
  action.updatedAt = new Date().toISOString()
  await writeDb(db)
  res.json({ action })
})

app.get('/api/analytics', async (_req, res) => {
  const db = await readDb(); const reports = db.reports
  const byCategory = Object.fromEntries(['litter','dumping','water','trees','recycling','parks'].map(category => [category, reports.filter(r => r.category === category).length]))
  res.json({ totalReports: reports.reduce((s,r)=>s+Number(r.reports||0),0), issues: reports.length, resolved: reports.filter(r=>r.status==='Resolved').length, byCategory, evidenceCount: reports.reduce((s,r)=>s+(Array.isArray(r.evidence)?r.evidence.length:0),0) })
})

app.get('/api/environment', async (req, res) => {
  const lat = Number(req.query.lat || 38.9072), lon = Number(req.query.lon || -77.0369)
  try {
    const point = await fetch(`https://api.weather.gov/points/${lat},${lon}`, { headers: { 'User-Agent': 'CivicEco student project contact@example.com', Accept: 'application/geo+json' } }).then(r => { if (!r.ok) throw new Error('NWS point failed'); return r.json() })
    const forecast = await fetch(point.properties.forecast, { headers: { 'User-Agent': 'CivicEco student project contact@example.com', Accept: 'application/geo+json' } }).then(r => r.ok ? r.json() : null)
    const alerts = await fetch(`https://api.weather.gov/alerts/active?point=${lat},${lon}`, { headers: { 'User-Agent': 'CivicEco student project contact@example.com', Accept: 'application/geo+json' } }).then(r => r.ok ? r.json() : { features: [] })
    const water = await fetch(`https://api.waterdata.usgs.gov/ogcapi/v0/collections/monitoring-locations/items?bbox=${lon-0.15},${lat-0.15},${lon+0.15},${lat+0.15}&limit=10`, { headers: { Accept: 'application/geo+json' } }).then(r => r.ok ? r.json() : { features: [] }).catch(() => ({ features: [] }))
    const period = forecast?.properties?.periods?.[0]
    res.json({ weather: period ? { temperature: period.temperature, unit: period.temperatureUnit, shortForecast: period.shortForecast } : null, alerts: (alerts.features || []).map(f => ({ event: f.properties?.event, headline: f.properties?.headline })).slice(0, 6), waterStations: water.features || [], signals: { weatherAlertPressure: Math.min(40, (alerts.features || []).length * 10) }, sources: [{ name: 'National Weather Service', url: 'https://www.weather.gov/documentation/services-web-api' }, { name: 'USGS Water Data', url: 'https://api.waterdata.usgs.gov/' }] })
  } catch { res.status(502).json({ error: 'Environmental services are temporarily unavailable.' }) }
})

app.post('/api/intelligence', async (req, res) => {
  const { reports = [], environment = {} } = req.body || {}
  const active = reports.filter(r => r.status !== 'Resolved')
  const now = Date.now()
  const weatherPressure = Number(environment?.signals?.weatherAlertPressure || 0)
  const scores = Object.fromEntries(active.map(r => {
    const severity = Number(r.severity || 0)
    const confirmations = Number(r.reports || 0)
    const ageDays = r.createdAt ? Math.max(0, (now - new Date(r.createdAt).getTime()) / 86400000) : 0
    const freshness = ageDays <= 7 ? 10 : ageDays <= 30 ? 5 : 0
    const weather = weatherPressure > 0 && ['water','parks','trees'].includes(r.category) ? Math.min(10, weatherPressure / 4) : 0
    const score = Math.min(100, Math.round(severity * 12 + confirmations * 5 + freshness + weather))
    return [r.id, { score, level: score >= 70 ? 'High' : score >= 40 ? 'Moderate' : 'Low' }]
  }))

  const ranking = active.map(r => {
    const item = scores[r.id]
    const explanation = [`${r.severity}/5 reported severity`, `${r.reports} community confirmations`]
    if (r.createdAt && (now - new Date(r.createdAt).getTime()) <= 7 * 86400000) explanation.push('reported within the last 7 days')
    if (weatherPressure > 0 && ['water','parks','trees'].includes(r.category)) explanation.push('current weather alerts add environmental context')
    return { id:r.id, score:item.score, level:item.level, explanation }
  }).sort((a,b) => b.score - a.score)

  // Spatial hotspots: group nearby geolocated reports into simple explainable clusters.
  const located = active.filter(r => Number.isFinite(Number(r.lat)) && Number.isFinite(Number(r.lng)))
  const clusters = []
  for (const report of located) {
    const lat = Number(report.lat), lng = Number(report.lng)
    let cluster = clusters.find(c => Math.hypot(c.lat - lat, c.lng - lng) < 0.006)
    if (!cluster) { cluster = { lat, lng, reports: [] }; clusters.push(cluster) }
    cluster.reports.push(report)
  }
  const hotspots = clusters.filter(c => c.reports.length >= 2).map((c, index) => {
    const reportScore = c.reports.reduce((sum, r) => sum + scores[r.id].score, 0) / c.reports.length
    const confirmations = c.reports.reduce((sum, r) => sum + Number(r.reports || 0), 0)
    const score = Math.min(100, Math.round(reportScore + c.reports.length * 5 + confirmations * 2))
    return { id:`hotspot-${index + 1}`, lat:c.lat, lng:c.lng, score, reportCount:c.reports.length, reportIds:c.reports.map(r => r.id), category:c.reports[0]?.category || 'mixed', explanation:[`${c.reports.length} nearby active reports`, `${confirmations} community confirmations`, 'reports are geographically clustered'] }
  }).sort((a,b) => b.score - a.score)

  // Temporal signals: compare recent 7-day activity with the preceding 7 days.
  const categories = [...new Set(reports.map(r => r.category).filter(Boolean))]
  const patterns = categories.map(category => {
    const current = reports.filter(r => r.category === category && r.createdAt && now - new Date(r.createdAt).getTime() <= 7 * 86400000).length
    const previous = reports.filter(r => r.category === category && r.createdAt && now - new Date(r.createdAt).getTime() > 7 * 86400000 && now - new Date(r.createdAt).getTime() <= 14 * 86400000).length
    const change = previous === 0 ? (current > 0 ? null : 0) : Math.round(((current - previous) / previous) * 100)
    return { category, current, previous, change, direction: current > previous ? 'rising' : current < previous ? 'falling' : 'stable' }
  }).filter(p => p.current > 0 || p.previous > 0).sort((a,b) => (b.current - b.previous) - (a.current - a.previous))
  const strongestPattern = patterns[0]
  const temporalHeadline = strongestPattern ? `${strongestPattern.category} activity is ${strongestPattern.direction}${strongestPattern.change == null ? '' : ` (${strongestPattern.change > 0 ? '+' : ''}${strongestPattern.change}%)`}.` : 'Not enough dated community reports for a time trend.'

  // Early warnings combine recent growth, severity, confirmations, and spatial concentration.
  const earlyWarnings = patterns.filter(p => p.direction === 'rising' && p.current >= 2).map((p, index) => {
    const categoryReports = active.filter(r => r.category === p.category)
    const avgSeverity = categoryReports.length ? categoryReports.reduce((sum,r) => sum + Number(r.severity || 0), 0) / categoryReports.length : 0
    const hotspot = hotspots.find(h => h.category === p.category)
    const score = Math.min(100, Math.round((p.change == null ? 35 : Math.min(45, 30 + p.change / 4)) + avgSeverity * 7 + (hotspot ? 15 : 0)))
    return { id:`warning-${index + 1}`, category:p.category, score, level:score >= 70 ? 'Priority' : score >= 45 ? 'Emerging Concern' : 'Watch', explanation:[`${p.current} reports in the last 7 days`, p.change == null ? 'no prior-week baseline' : `${p.change > 0 ? '+' : ''}${p.change}% compared with the previous 7 days`, hotspot ? 'geographic clustering detected' : 'no geographic cluster detected'] }
  }).sort((a,b) => b.score - a.score)

  res.json({
    scores, ranking,
    summary:{ average: active.length ? Math.round(active.reduce((sum,r) => sum + scores[r.id].score,0) / active.length) : 0 },
    hotspots,
    temporalPatterns:{ patterns, headline:temporalHeadline },
    earlyWarnings:{ warnings:earlyWarnings, headline:earlyWarnings[0] ? `${earlyWarnings[0].category} may deserve earlier attention.` : 'No strong early-warning signals detected.' }
  })
})

setInterval(() => {
  const now = Date.now()
  for (const [token, session] of sessions) if (session.expiresAt && session.expiresAt < now) sessions.delete(token)
  for (const [key, bucket] of rateBuckets) if (now - bucket.start > 120_000) rateBuckets.delete(key)
}, 60_000).unref()

app.use('/api', (req, res, next) => {
  if (req.path === '/health') return next()
  res.status(404).json({ error: 'API route not found.', requestId: req.requestId })
})

app.get('/{*splat}', async (req, res) => {
  if (req.path.startsWith('/api/')) return res.status(404).json({ error: 'API route not found.' })
  try { await fs.access(path.join(DIST_DIR, 'index.html')); res.sendFile(path.join(DIST_DIR, 'index.html')) } catch { res.status(404).send('CivicEco frontend is not built yet. Run npm run build.') }
})

app.use((err, req, res, _next) => {
  console.error(`[${req.requestId || 'no-id'}]`, err)
  if (res.headersSent) return
  res.status(500).json({ error: NODE_ENV === 'production' ? 'Something went wrong.' : (err.message || 'Internal server error.'), requestId: req.requestId })
})

app.listen(PORT, () => console.log(`CivicEco server running at http://localhost:${PORT}`))
