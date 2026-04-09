
require('dotenv').config();
const mongoose = require('mongoose');

mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('🔥 banco conectado'))
  .catch(err => console.log('erro:', err));

const express = require('express');
const fs = require('fs');
const path = require('path');
const cors = require('cors');
const bcrypt = require('bcryptjs');

const app = express();
const DATA_FILE = path.join(__dirname, 'data.json');

app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));

function loadData() {
  if (!fs.existsSync(DATA_FILE)) {
    return {
      turnos: ['Madrugada', 'Manhã', 'Tarde', 'Noite'],
      settings: { cycleStart: '2026-04-01' },
      employees: [],
      folgas: [],
      users: []
    };
  }

  const raw = fs.readFileSync(DATA_FILE, 'utf8');
  try {
    return JSON.parse(raw);
  } catch (err) {
    console.error('Erro ao ler data.json:', err);
    return {
      turnos: ['Madrugada', 'Manhã', 'Tarde', 'Noite'],
      settings: { cycleStart: '2026-04-01' },
      employees: [],
      folgas: [],
      users: []
    };
  }
}

function saveData(data) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf8');
}

function sanitizeData(data) {
  return {
    ...data,
    users: (data.users || []).map(({ password, ...rest }) => rest)
  };
}

function buildSchedule(data, days = 14) {
  const start = new Date(data.settings.cycleStart);
  const schedule = [];

  for (let dayIndex = 0; dayIndex < days; dayIndex += 1) {
    const date = new Date(start);
    date.setDate(start.getDate() + dayIndex);
    const isoDate = date.toISOString().slice(0, 10);

    data.employees.forEach((employee) => {
      const customFolga = data.folgas.some(
        (f) => f.employeeId === employee.id && f.date === isoDate
      );
      const cycleOff = ((dayIndex + employee.id) % 7) === 6;
      const working = !customFolga && !cycleOff;

      schedule.push({
        date: isoDate,
        employeeId: employee.id,
        employeeName: employee.name,
        turno: employee.turno,
        working,
        customFolga
      });
    });
  }

  return schedule;
}

app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'Usuário e senha são obrigatórios.' });
  }

  const data = loadData();
  const user = (data.users || []).find(u => u.username === username);

  if (!user) {
    return res.status(401).json({ error: 'Usuário ou senha inválidos.' });
  }

  // Verificar senha com bcrypt (ou compatibilidade com senhas antigas em plain text)
  const passwordMatch = user.password.startsWith('$2a$') || user.password.startsWith('$2b$')
    ? bcrypt.compareSync(password, user.password)
    : user.password === password; // Compatibilidade com senhas antigas

  if (!passwordMatch) {
    return res.status(401).json({ error: 'Usuário ou senha inválidos.' });
  }

  const schedule = buildSchedule(data, 14);
  const sanitizedData = sanitizeData(data);
  const userPayload = {
    id: user.id,
    name: user.name,
    role: user.role,
    employeeId: user.employeeId
  };

  res.json({ user: userPayload, data: sanitizedData, schedule });
});

app.get('/api/data', (req, res) => {
  const data = loadData();
  const schedule = buildSchedule(data, 14);
  res.json({ data: sanitizeData(data), schedule });
});

app.post('/api/folgas', (req, res) => {
  const incoming = req.body;
  if (!incoming || !Array.isArray(incoming.folgas)) {
    return res.status(400).json({ error: 'Formato inválido. Esperado { folgas: [...] }' });
  }

  const data = loadData();
  data.folgas = incoming.folgas;
  saveData(data);
  res.json({ success: true, folgas: data.folgas });
});

app.post('/api/funcionario', (req, res) => {
  const { name, username, password, turno } = req.body;
  if (!name || !username || !password || !turno) {
    return res.status(400).json({ error: 'Nome, usuário, senha e turno são obrigatórios.' });
  }

  // Validações básicas
  if (username.length < 3) {
    return res.status(400).json({ error: 'Nome de usuário deve ter pelo menos 3 caracteres.' });
  }
  if (password.length < 6) {
    return res.status(400).json({ error: 'Senha deve ter pelo menos 6 caracteres.' });
  }

  const data = loadData();
  
  // Verificar se username já existe
  const existingUser = data.users.find(u => u.username === username);
  if (existingUser) {
    return res.status(400).json({ error: 'Nome de usuário já existe. Escolha outro.' });
  }
  
  // Gerar ID único para funcionário
  const newId = Math.max(...data.employees.map(e => e.id), 0) + 1;
  
  // Criar funcionário
  data.employees.push({
    id: newId,
    name,
    turno
  });

  // Hash da senha com bcrypt
  const hashedPassword = bcrypt.hashSync(password, 10);
  
  // Criar usuário
  data.users.push({
    id: username,
    username,
    password: hashedPassword,
    name,
    role: 'employee',
    employeeId: newId
  });

  saveData(data);
  res.json({ 
    success: true, 
    employee: { id: newId, name, turno },
    username,
    password  // Retorna senha em plain text para mostrar ao coordenador
  });
});

app.delete('/api/funcionario/:id', (req, res) => {
  const employeeId = parseInt(req.params.id, 10);
  const data = loadData();

  // Remover funcionário
  data.employees = data.employees.filter(e => e.id !== employeeId);

  // Remover usuário associado
  const userToRemove = data.users.find(u => u.employeeId === employeeId);
  if (userToRemove) {
    data.users = data.users.filter(u => u.id !== userToRemove.id);
  }

  // Remover folgas do funcionário
  data.folgas = data.folgas.filter(f => f.employeeId !== employeeId);

  saveData(data);
  res.json({ success: true, message: 'Funcionário removido.' });
});

app.post('/api/migrate-passwords', (req, res) => {
  const data = loadData();
  let migratedCount = 0;

  if (data.users) {
    data.users = data.users.map(user => {
      // Se a senha não está em hash (não começa com $2a$ ou $2b$), fazer hash
      if (!user.password.startsWith('$2a$') && !user.password.startsWith('$2b$')) {
        user.password = bcrypt.hashSync(user.password, 10);
        migratedCount++;
      }
      return user;
    });
  }

  saveData(data);
  res.json({ 
    success: true, 
    message: `Migração concluída. ${migratedCount} senhas criptografadas.`
  });
});

const PORT = 3005;

app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});
