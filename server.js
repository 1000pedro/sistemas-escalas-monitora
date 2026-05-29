require('dotenv').config();
const mongoose = require('mongoose');
const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  console.error('ERRO: JWT_SECRET não definido no .env. O servidor não pode iniciar.');
  process.exit(1);
}

mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('🔥 banco conectado'))
  .catch(err => console.log('erro:', err));

const EmployeeSchema = new mongoose.Schema({ id: Number, name: String, turno: String });
const UserSchema = new mongoose.Schema({ id: String, username: { type: String, unique: true }, password: String, name: String, role: String, employeeId: Number, failedAttempts: { type: Number, default: 0 }, lockedUntil: { type: Date, default: null } });
const FolgaSchema = new mongoose.Schema({ employeeId: Number, date: String });
const SettingsSchema = new mongoose.Schema({ cycleStart: String });
const NotificationSchema = new mongoose.Schema({
  id: Number,
  type: String,
  employeeId: Number,
  message: String,
  date: String,
  sender: String
});

const Employee = mongoose.model('Employee', EmployeeSchema);
const User = mongoose.model('User', UserSchema);
const Folga = mongoose.model('Folga', FolgaSchema);
const Settings = mongoose.model('Settings', SettingsSchema);
const Notification = mongoose.model('Notification', NotificationSchema);

const app = express();
app.set('trust proxy', 1);
app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));

const MAX_FAILED_ATTEMPTS = 10;
const LOCK_DURATION_MS = 15 * 60 * 1000; // 15 minutos

// ── Middleware de autenticação JWT ──
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Acesso não autorizado.' });

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.status(401).json({ error: 'Token inválido ou expirado.' });
    req.user = user;
    next();
  });
}

// ── Middleware de permissão admin ──
function requireAdmin(req, res, next) {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Acesso restrito a administradores.' });
  next();
}

async function getSettings() {
  let settings = await Settings.findOne();
  if (!settings) settings = await Settings.create({ cycleStart: '2026-04-01' });
  return settings;
}

function buildSchedule(employees, folgas, cycleStart, days = 14) {
  const start = new Date(cycleStart);
  const schedule = [];
  for (let dayIndex = 0; dayIndex < days; dayIndex++) {
    const date = new Date(start);
    date.setDate(start.getDate() + dayIndex);
    const isoDate = date.toISOString().slice(0, 10);
    employees.forEach((employee) => {
      const customFolga = folgas.some(f => f.employeeId === employee.id && f.date === isoDate);
      const cycleOff = ((dayIndex + employee.id) % 7) === 6;
      schedule.push({ date: isoDate, employeeId: employee.id, employeeName: employee.name, turno: employee.turno, working: !customFolga && !cycleOff, customFolga });
    });
  }
  return schedule;
}

// ── Login (com bloqueio por tentativas no banco) ──
app.post('/api/login', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ error: 'Usuário e senha são obrigatórios.' });

  const user = await User.findOne({ username });
  if (!user) return res.status(401).json({ error: 'Usuário ou senha inválidos.' });

  // Verificar se conta está bloqueada
  if (user.lockedUntil && user.lockedUntil > new Date()) {
    const minutosRestantes = Math.ceil((user.lockedUntil - new Date()) / 60000);
    return res.status(429).json({ error: `Conta bloqueada por excesso de tentativas. Tente novamente em ${minutosRestantes} minuto(s).` });
  }

  const isBcrypt = user.password.startsWith('$2a$') || user.password.startsWith('$2b$');
  const passwordMatch = isBcrypt
    ? bcrypt.compareSync(password, user.password)
    : user.password === password;

  if (!passwordMatch) {
    const novasTentativas = (user.failedAttempts || 0) + 1;
    const bloqueado = novasTentativas >= MAX_FAILED_ATTEMPTS;
    await User.updateOne({ _id: user._id }, {
      failedAttempts: novasTentativas,
      lockedUntil: bloqueado ? new Date(Date.now() + LOCK_DURATION_MS) : null
    });
    if (bloqueado) {
      return res.status(429).json({ error: 'Conta bloqueada por excesso de tentativas. Tente novamente em 15 minutos.' });
    }
    return res.status(401).json({ error: 'Usuário ou senha inválidos.' });
  }

  // Login bem-sucedido — resetar tentativas
  await User.updateOne({ _id: user._id }, { failedAttempts: 0, lockedUntil: null });

  // Migrar senha em texto puro para bcrypt automaticamente
  if (!isBcrypt) {
    const hashed = bcrypt.hashSync(password, 10);
    await User.updateOne({ _id: user._id }, { password: hashed });
  }

  const token = jwt.sign(
    { id: user.id, username: user.username, name: user.name, role: user.role, employeeId: user.employeeId },
    JWT_SECRET,
    { expiresIn: '12h' }
  );

  const employees = await Employee.find();
  const folgas = await Folga.find();
  const settings = await getSettings();
  const schedule = buildSchedule(employees, folgas, settings.cycleStart);
  const usersRaw = await User.find();
  const sanitizedUsers = usersRaw.map(u => { const o = u.toObject(); delete o.password; return o; });

  res.json({
    token,
    user: { id: user.id, name: user.name, role: user.role, employeeId: user.employeeId },
    data: { turnos: ['Madrugada', 'Manhã', 'Tarde', 'Noite'], settings: { cycleStart: settings.cycleStart }, employees, folgas, users: sanitizedUsers },
    schedule
  });
});

// ── Rotas protegidas ──

app.get('/api/data', authenticateToken, async (req, res) => {
  const employees = await Employee.find();
  const folgas = await Folga.find();
  const settings = await getSettings();
  const schedule = buildSchedule(employees, folgas, settings.cycleStart);
  const usersRaw = await User.find();
  const sanitizedUsers = usersRaw.map(u => { const o = u.toObject(); delete o.password; return o; });
  res.json({ data: { turnos: ['Madrugada', 'Manhã', 'Tarde', 'Noite'], settings: { cycleStart: settings.cycleStart }, employees, folgas, users: sanitizedUsers }, schedule });
});

app.post('/api/folgas', authenticateToken, requireAdmin, async (req, res) => {
  const { folgas, month } = req.body;
  if (!folgas || !Array.isArray(folgas)) return res.status(400).json({ error: 'Formato inválido.' });

  if (month) {
    const monthRegex = new RegExp(`^${month}`);
    await Folga.deleteMany({ date: monthRegex });
    const monthFolgas = folgas.filter(f => f.date.startsWith(month));
    if (monthFolgas.length > 0) await Folga.insertMany(monthFolgas);
  } else {
    await Folga.deleteMany({});
    if (folgas.length > 0) await Folga.insertMany(folgas);
  }

  const allFolgas = await Folga.find();
  res.json({ success: true, folgas: allFolgas });
});

app.post('/api/funcionario', authenticateToken, requireAdmin, async (req, res) => {
  const { name, username, password, turno } = req.body;
  if (!name || !username || !password || !turno) return res.status(400).json({ error: 'Todos os campos são obrigatórios.' });
  if (username.length < 3) return res.status(400).json({ error: 'Usuário deve ter pelo menos 3 caracteres.' });
  if (password.length < 6) return res.status(400).json({ error: 'Senha deve ter pelo menos 6 caracteres.' });

  const existingUser = await User.findOne({ username });
  if (existingUser) return res.status(400).json({ error: 'Nome de usuário já existe.' });

  const employees = await Employee.find();
  const newId = employees.length > 0 ? Math.max(...employees.map(e => e.id)) + 1 : 1;
  await Employee.create({ id: newId, name, turno });
  const hashedPassword = bcrypt.hashSync(password, 10);
  await User.create({ id: username, username, password: hashedPassword, name, role: 'employee', employeeId: newId });

  // Retorna apenas username, sem expor a senha
  res.json({ success: true, employee: { id: newId, name, turno }, username });
});

app.delete('/api/funcionario/:id', authenticateToken, requireAdmin, async (req, res) => {
  const employeeId = parseInt(req.params.id, 10);
  await Employee.deleteOne({ id: employeeId });
  await User.deleteOne({ employeeId });
  await Folga.deleteMany({ employeeId });
  res.json({ success: true, message: 'Funcionário removido.' });
});

app.get('/api/notificacoes', authenticateToken, async (req, res) => {
  const notificacoes = await Notification.find().sort({ date: -1 });
  res.json({ notificacoes });
});

app.post('/api/notificacoes', authenticateToken, requireAdmin, async (req, res) => {
  const { type, employeeId, message, sender } = req.body;
  if (!message || !sender) return res.status(400).json({ error: 'Mensagem e remetente são obrigatórios.' });
  const notificacao = await Notification.create({
    id: Date.now(),
    type,
    employeeId: employeeId || null,
    message,
    date: new Date().toISOString(),
    sender
  });
  res.json({ success: true, notificacao });
});

app.delete('/api/notificacoes/:id', authenticateToken, requireAdmin, async (req, res) => {
  await Notification.deleteOne({ id: parseInt(req.params.id) });
  res.json({ success: true });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Servidor rodando na porta ${PORT}`));
