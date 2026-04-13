require('dotenv').config();
const mongoose = require('mongoose');
const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');

mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('🔥 banco conectado'))
  .catch(err => console.log('erro:', err));

const EmployeeSchema = new mongoose.Schema({ id: Number, name: String, turno: String });
const UserSchema = new mongoose.Schema({ id: String, username: { type: String, unique: true }, password: String, name: String, role: String, employeeId: Number });
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
app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));

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

app.post('/api/login', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ error: 'Usuário e senha são obrigatórios.' });

  const user = await User.findOne({ username });
  if (!user) return res.status(401).json({ error: 'Usuário ou senha inválidos.' });

  const passwordMatch = user.password.startsWith('$2a$') || user.password.startsWith('$2b$')
    ? bcrypt.compareSync(password, user.password)
    : user.password === password;
  if (!passwordMatch) return res.status(401).json({ error: 'Usuário ou senha inválidos.' });

  const employees = await Employee.find();
  const folgas = await Folga.find();
  const settings = await getSettings();
  const schedule = buildSchedule(employees, folgas, settings.cycleStart);
  const usersRaw = await User.find();
  const sanitizedUsers = usersRaw.map(u => { const o = u.toObject(); delete o.password; return o; });

  res.json({
    user: { id: user.id, name: user.name, role: user.role, employeeId: user.employeeId },
    data: { turnos: ['Madrugada', 'Manhã', 'Tarde', 'Noite'], settings: { cycleStart: settings.cycleStart }, employees, folgas, users: sanitizedUsers },
    schedule
  });
});

app.get('/api/data', async (req, res) => {
  const employees = await Employee.find();
  const folgas = await Folga.find();
  const settings = await getSettings();
  const schedule = buildSchedule(employees, folgas, settings.cycleStart);
  const usersRaw = await User.find();
  const sanitizedUsers = usersRaw.map(u => { const o = u.toObject(); delete o.password; return o; });
  res.json({ data: { turnos: ['Madrugada', 'Manhã', 'Tarde', 'Noite'], settings: { cycleStart: settings.cycleStart }, employees, folgas, users: sanitizedUsers }, schedule });
});

app.post('/api/folgas', async (req, res) => {
  const incoming = req.body;
  if (!incoming || !Array.isArray(incoming.folgas)) return res.status(400).json({ error: 'Formato inválido.' });
  await Folga.deleteMany({});
  await Folga.insertMany(incoming.folgas);
  const folgas = await Folga.find();
  res.json({ success: true, folgas });
});

app.post('/api/funcionario', async (req, res) => {
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
  res.json({ success: true, employee: { id: newId, name, turno }, username, password });
});

app.delete('/api/funcionario/:id', async (req, res) => {
  const employeeId = parseInt(req.params.id, 10);
  await Employee.deleteOne({ id: employeeId });
  await User.deleteOne({ employeeId });
  await Folga.deleteMany({ employeeId });
  res.json({ success: true, message: 'Funcionário removido.' });
});

app.get('/api/notificacoes', async (req, res) => {
  const notificacoes = await Notification.find().sort({ date: -1 });
  res.json({ notificacoes });
});

app.post('/api/notificacoes', async (req, res) => {
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

app.delete('/api/notificacoes/:id', async (req, res) => {
  await Notification.deleteOne({ id: parseInt(req.params.id) });
  res.json({ success: true });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Servidor rodando na porta ${PORT}`));