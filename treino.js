const API_BASE = 'http://localhost:3000';
const loginPanel = document.getElementById('loginPanel');
const appPanel = document.getElementById('appPanel');
const loginBtn = document.getElementById('loginBtn');
const logoutBtn = document.getElementById('logoutBtn');
const usernameInput = document.getElementById('usernameInput');
const passwordInput = document.getElementById('passwordInput');
const loggedName = document.getElementById('loggedName');
const loggedRole = document.getElementById('loggedRole');
const adminPanel = document.getElementById('adminPanel');
const employeePanel = document.getElementById('employeePanel');
const saveFolgasBtn = document.getElementById('saveFolgasBtn');
const folgasList = document.getElementById('folgasList');
const employeeNameDisplay = document.getElementById('employeeName');
const employeeShift = document.getElementById('employeeShift');
const newEmpName = document.getElementById('newEmpName');
const newEmpUsername = document.getElementById('newEmpUsername');
const newEmpPassword = document.getElementById('newEmpPassword');
const newEmpTurno = document.getElementById('newEmpTurno');
const addEmpBtn = document.getElementById('addEmpBtn');
const newEmpResult = document.getElementById('newEmpResult');
const newEmpCredentials = document.getElementById('newEmpCredentials');
const employeesToggleBtn = document.getElementById('employeesToggleBtn');
const employeesList = document.getElementById('employeesList');
const employeesListContainer = document.getElementById('employeesListContainer');
const prevPeriodBtn = document.getElementById('prevPeriodBtn');
const nextPeriodBtn = document.getElementById('nextPeriodBtn');
const periodStartDate = document.getElementById('periodStartDate');
const periodDisplay = document.getElementById('periodDisplay');
const empPrevPeriodBtn = document.getElementById('empPrevPeriodBtn');
const empNextPeriodBtn = document.getElementById('empNextPeriodBtn');
const empPeriodStartDate = document.getElementById('empPeriodStartDate');
const empPeriodDisplay = document.getElementById('empPeriodDisplay');
const notificationType = document.getElementById('notificationType');
const notificationEmployee = document.getElementById('notificationEmployee');
const notificationMessage = document.getElementById('notificationMessage');
const sendNotificationBtn = document.getElementById('sendNotificationBtn');
const notificationsList = document.getElementById('notificationsList');
const employeeNotificationsList = document.getElementById('employeeNotificationsList');
const generateReportBtn = document.getElementById('generateReportBtn');
const reportsContainer = document.getElementById('reportsContainer');

let appData = null;
let scheduleData = [];
let currentUser = null;
let selectedEmployeeId = null;
let adminPeriodStart = null;
let employeePeriodStart = null;
let currentShiftView = null;
let notifications = [];

function formatDate(date) {
  const d = new Date(date);
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return `${day}/${month}/${year}`;
}

function formatMonthLabel(date) {
  const d = new Date(date);
  const monthNames = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
  return `${monthNames[d.getMonth()]} ${d.getFullYear()}`;
}

function getMonthStart(date) {
  const d = new Date(date);
  d.setDate(1);
  return d;
}

function getMonthDates(startDate) {
  const start = new Date(getMonthStart(startDate));
  const year = start.getFullYear();
  const month = start.getMonth();
  const totalDays = new Date(year, month + 1, 0).getDate();
  const dates = [];

  for (let i = 0; i < totalDays; i += 1) {
    const date = new Date(start);
    date.setDate(start.getDate() + i);
    dates.push(date.toISOString().slice(0, 10));
  }

  return dates;
}

function getScheduleStatus(employeeId, dateStr) {
  const date = new Date(dateStr);
  const cycleStart = new Date(appData.settings.cycleStart);
  const diffDays = Math.floor((date - cycleStart) / (1000 * 60 * 60 * 24));
  const isManualFolga = appData.folgas.some(
    (f) => f.employeeId === employeeId && f.date === dateStr
  );
  const cycleOff = ((diffDays + employeeId) % 7) === 6;
  return {
    date: dateStr,
    working: !isManualFolga && !cycleOff,
    customFolga: isManualFolga
  };
}

function toggleEmployeesList() {
  const isHidden = employeesListContainer.classList.toggle('hidden');
  employeesToggleBtn.textContent = isHidden ? 'Mostrar funcionários cadastrados' : 'Ocultar funcionários cadastrados';
  
  if (!isHidden) {
    populateNotificationEmployees();
  }
}

function populateNotificationEmployees() {
  notificationEmployee.innerHTML = '<option value="">Selecione um funcionário</option>';
  appData.employees.forEach(employee => {
    const option = document.createElement('option');
    option.value = employee.id;
    option.textContent = employee.name;
    notificationEmployee.appendChild(option);
  });
}

function toggleNotificationType() {
  const isSpecific = notificationType.value === 'specific';
  notificationEmployee.classList.toggle('hidden', !isSpecific);
}

function sendNotification() {
  const type = notificationType.value;
  const employeeId = type === 'specific' ? parseInt(notificationEmployee.value) : null;
  const message = notificationMessage.value.trim();
  
  if (!message) {
    alert('Digite uma mensagem para a notificação.');
    return;
  }
  
  if (type === 'specific' && !employeeId) {
    alert('Selecione um funcionário para notificação específica.');
    return;
  }
  
  const notification = {
    id: Date.now(),
    type,
    employeeId,
    message,
    date: new Date().toISOString(),
    sender: currentUser.name
  };
  
  notifications.push(notification);
  saveNotifications();
  renderEmployeeNotifications();
  
  notificationMessage.value = '';
  notificationEmployee.value = '';
  
  alert('Notificação enviada com sucesso!');
}

function renderNotifications() {
  if (!notificationsList) return;
  
  notificationsList.innerHTML = '';
  
  const userNotifications = notifications.filter(n => 
    n.type === 'general' || n.employeeId === currentUser.employeeId
  ).sort((a, b) => new Date(b.date) - new Date(a.date));
  
  if (userNotifications.length === 0) {
    notificationsList.innerHTML = '<p style="color: #6b7280; font-style: italic;">Nenhuma notificação.</p>';
    return;
  }
  
  userNotifications.forEach(notification => {
    const div = document.createElement('div');
    div.className = 'notification-item';
    
    const header = document.createElement('div');
    header.className = 'notification-header';
    
    const date = document.createElement('span');
    date.className = 'notification-date';
    date.textContent = formatDate(new Date(notification.date));
    
    header.appendChild(date);
    
    const message = document.createElement('div');
    message.textContent = notification.message;
    
    const sender = document.createElement('div');
    sender.style.fontSize = '12px';
    sender.style.color = '#6b7280';
    sender.style.marginTop = '5px';
    sender.textContent = `Por: ${notification.sender}`;
    
    div.appendChild(header);
    div.appendChild(message);
    div.appendChild(sender);
    
    notificationsList.appendChild(div);
  });
}

function renderEmployeeNotifications() {
  if (!employeeNotificationsList || !currentUser || currentUser.role !== 'employee') return;
  
  employeeNotificationsList.innerHTML = '';
  
  const empId = parseInt(currentUser.employeeId);
  const userNotifications = notifications.filter(n => 
    n.type === 'general' || (n.type === 'specific' && n.employeeId === empId)
  ).sort((a, b) => new Date(b.date) - new Date(a.date));
  
  if (userNotifications.length === 0) {
    employeeNotificationsList.innerHTML = '<p style="color: #6b7280; font-style: italic;">Você não tem notificações no momento.</p>';
    return;
  }
  
  userNotifications.forEach(notification => {
    const div = document.createElement('div');
    div.className = 'notification-item';
    
    const header = document.createElement('div');
    header.className = 'notification-header';
    
    const leftContent = document.createElement('div');
    leftContent.style.display = 'flex';
    leftContent.style.alignItems = 'center';
    leftContent.style.gap = '12px';
    leftContent.style.flex = '1';
    
    const type = document.createElement('span');
    type.className = 'notification-type';
    type.textContent = notification.type === 'general' ? '📢 Geral' : '📬 Pessoal';
    type.style.fontWeight = '600';
    
    const date = document.createElement('span');
    date.className = 'notification-date';
    date.textContent = formatDate(new Date(notification.date));
    
    leftContent.appendChild(type);
    leftContent.appendChild(date);
    
    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'delete-notification-btn';
    deleteBtn.textContent = '✕';
    deleteBtn.style.background = '#ef4444';
    deleteBtn.style.color = 'white';
    deleteBtn.style.border = 'none';
    deleteBtn.style.borderRadius = '4px';
    deleteBtn.style.width = '24px';
    deleteBtn.style.height = '24px';
    deleteBtn.style.cursor = 'pointer';
    deleteBtn.style.fontSize = '14px';
    deleteBtn.style.padding = '0';
    deleteBtn.style.display = 'flex';
    deleteBtn.style.alignItems = 'center';
    deleteBtn.style.justifyContent = 'center';
    deleteBtn.style.transition = 'background-color 0.2s';
    deleteBtn.onclick = () => {
      deleteNotification(notification.id);
    };
    deleteBtn.onmouseover = () => deleteBtn.style.background = '#dc2626';
    deleteBtn.onmouseout = () => deleteBtn.style.background = '#ef4444';
    
    header.appendChild(leftContent);
    header.appendChild(deleteBtn);
    
    const message = document.createElement('div');
    message.textContent = notification.message;
    message.style.marginTop = '8px';
    message.style.lineHeight = '1.4';
    
    const sender = document.createElement('div');
    sender.style.fontSize = '12px';
    sender.style.color = '#6b7280';
    sender.style.marginTop = '5px';
    sender.textContent = `De: ${notification.sender}`;
    
    div.appendChild(header);
    div.appendChild(message);
    div.appendChild(sender);
    
    employeeNotificationsList.appendChild(div);
  });
}

function deleteNotification(notificationId) {
  notifications = notifications.filter(n => n.id !== notificationId);
  saveNotifications();
  renderEmployeeNotifications();
}

function saveNotifications() {
  localStorage.setItem('notifications', JSON.stringify(notifications));
}

function loadNotifications() {
  const saved = localStorage.getItem('notifications');
  if (saved) {
    notifications = JSON.parse(saved);
  }
}

function generateMonthlyReport(shift = null) {
  reportsContainer.classList.remove('hidden');
  const shiftLabel = shift ? ` - Turno ${shift}` : '';
  reportsContainer.innerHTML = `
    <div class="report-header">
      <h4>Relatório Mensal${shiftLabel} - ${formatMonthLabel(adminPeriodStart)}</h4>
      <button id="closeReportBtn" class="close-btn">✕</button>
    </div>
  `;

  const monthDates = getMonthDates(getMonthStart(adminPeriodStart));
  const filteredEmployees = shift ? appData.employees.filter(emp => emp.turno === shift) : appData.employees;

  filteredEmployees.forEach(employee => {
    const employeeSchedule = monthDates.map(date => getScheduleStatus(employee.id, date));
    const totalDays = employeeSchedule.length;
    const workingDays = employeeSchedule.filter(day => day.working).length;
    const offDays = totalDays - workingDays;
    
    const reportCard = document.createElement('div');
    reportCard.className = 'report-card';
    
    const header = document.createElement('div');
    header.className = 'report-employee';
    
    const name = document.createElement('strong');
    name.textContent = employee.name;
    
    const shift = document.createElement('span');
    shift.className = 'employee-shift';
    shift.textContent = employee.turno;
    
    header.appendChild(name);
    header.appendChild(shift);
    
    const stats = document.createElement('div');
    stats.className = 'report-stats';
    
    const workingStat = document.createElement('div');
    workingStat.className = 'stat-item';
    workingStat.innerHTML = `
      <div class="stat-value">${workingDays}</div>
      <div class="stat-label">Dias de Trabalho</div>
    `;
    
    const offStat = document.createElement('div');
    offStat.className = 'stat-item';
    offStat.innerHTML = `
      <div class="stat-value">${offDays}</div>
      <div class="stat-label">Dias de Folga</div>
    `;
    
    const percentageStat = document.createElement('div');
    percentageStat.className = 'stat-item';
    const percentage = Math.round((workingDays / totalDays) * 100);
    percentageStat.innerHTML = `
      <div class="stat-value">${percentage}%</div>
      <div class="stat-label">Presença</div>
    `;
    
    stats.appendChild(workingStat);
    stats.appendChild(offStat);
    stats.appendChild(percentageStat);
    
    reportCard.appendChild(header);
    reportCard.appendChild(stats);
    
    reportsContainer.appendChild(reportCard);
  });

  document.getElementById('closeReportBtn').addEventListener('click', () => {
    reportsContainer.classList.add('hidden');
  });
}

function login() {
  const username = usernameInput.value.trim();
  const password = passwordInput.value;

  if (!username || !password) {
    alert('Preencha usuário e senha para continuar.');
    return;
  }

  fetch(`${API_BASE}/api/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password })
  })
    .then(async (response) => {
      const text = await response.text();
      let json = null;

      if (text) {
        try {
          json = JSON.parse(text);
        } catch (parseError) {
          throw new Error('Resposta inválida do servidor: ' + text);
        }
      }

      if (!response.ok) {
        throw new Error(json?.error || 'Falha ao autenticar.');
      }

      return json;
    })
    .then((json) => {
      currentUser = json.user;
      appData = json.data;
      scheduleData = json.schedule;

      // Inicializar períodos
      adminPeriodStart = appData.settings.cycleStart;
      employeePeriodStart = appData.settings.cycleStart;

      // Carregar notificações e aplicar tema
      loadNotifications();

      usernameInput.value = '';
      passwordInput.value = '';
      loginPanel.classList.add('hidden');
      appPanel.classList.remove('hidden');

      loggedName.textContent = currentUser.name;
      loggedRole.textContent = currentUser.role === 'admin' ? 'Coordenador' : 'Funcionário';
      populateEmployees();
      handleRoleView();
      renderFolgas();
      renderEmployeeView();
      
      // Inicializar UI dos períodos
      if (currentUser.role === 'admin') {
        updateAdminPeriod(adminPeriodStart);
      } else {
        updateEmployeePeriod(employeePeriodStart);
      }
    })
    .catch((error) => {
      console.error(error);
      alert(error.message || 'Erro ao fazer login.');
    });
}

function logout() {
  currentUser = null;
  appData = null;
  scheduleData = [];
  selectedEmployeeId = null;

  appPanel.classList.add('hidden');
  loginPanel.classList.remove('hidden');
}

function populateEmployees() {
  renderEmployeesList();

  selectedEmployeeId = currentUser.role === 'employee' ? currentUser.employeeId : appData.employees[0]?.id;
}

function renderShiftCalendar(shiftName, startDate = null) {
  shiftDetailCalendar.innerHTML = '';
  const employeesInShift = appData.employees.filter(e => e.turno === shiftName);
  if (!employeesInShift.length) {
    shiftDetailCalendar.textContent = 'Não há funcionários cadastrados para este turno.';
    return;
  }

  const baseDate = startDate ? new Date(startDate) : new Date(appData.settings.cycleStart);
  const monthStart = getMonthStart(baseDate);
  const dates = getMonthDates(monthStart);

  const table = document.createElement('table');
  table.className = 'calendar-table';

  const headerRow = document.createElement('tr');
  const nameCell = document.createElement('th');
  nameCell.textContent = 'Funcionário';
  headerRow.appendChild(nameCell);

  dates.forEach((date) => {
    const th = document.createElement('th');
    const [, month, day] = date.split('-');
    th.textContent = `${day}/${month}`;
    headerRow.appendChild(th);
  });
  table.appendChild(headerRow);

  employeesInShift.forEach((employee) => {
    const row = document.createElement('tr');
    const nameCell = document.createElement('td');
    nameCell.textContent = employee.name;
    nameCell.style.fontWeight = '600';
    nameCell.style.textAlign = 'left';
    row.appendChild(nameCell);

    dates.forEach((date) => {
      const cell = document.createElement('td');
      const scheduleItem = getScheduleStatus(employee.id, date);
      const span = document.createElement('span');
      span.className = `schedule-day ${scheduleItem.working ? 'working' : 'off'}`;
      span.textContent = scheduleItem.working ? 'T' : 'F';
      span.style.cursor = 'pointer';
      span.onclick = () => toggleScheduleDay(employee.id, date, span);
      cell.appendChild(span);
      row.appendChild(cell);
    });

    table.appendChild(row);
  });

  shiftDetailCalendar.appendChild(table);
}

function openShiftDetail(shiftName) {
  currentShiftView = shiftName;
  shiftDetailPanel.classList.remove('hidden');
  shiftDetailTitle.textContent = `Escala de ${shiftName}`;
  renderShiftCalendar(shiftName, adminPeriodStart);
}

function closeShiftDetail() {
  currentShiftView = null;
  shiftDetailPanel.classList.add('hidden');
  shiftDetailCalendar.innerHTML = '';
}

function toggleScheduleDay(employeeId, date, element) {
  const isFolga = appData.folgas.some(
    f => f.employeeId === employeeId && f.date === date
  );

  if (isFolga) {
    appData.folgas = appData.folgas.filter(
      f => !(f.employeeId === employeeId && f.date === date)
    );
    element.textContent = 'T';
    element.classList.remove('off');
    element.classList.add('working');
  } else {
    appData.folgas.push({ employeeId, date });
    element.textContent = 'F';
    element.classList.remove('working');
    element.classList.add('off');
  }

  renderFolgas();
}

function renderFolgas() {
  if (!folgasList) return;
  folgasList.innerHTML = '';
  const orderedFolgas = [...appData.folgas].sort((a, b) => a.date.localeCompare(b.date));

  orderedFolgas.forEach((folga) => {
    const employee = appData.employees.find((emp) => emp.id === folga.employeeId);
    const li = document.createElement('li');
    li.textContent = `${folga.date} — ${employee ? employee.name : 'Funcionário não encontrado'}`;
    folgasList.appendChild(li);
  });
}

function renderEmployeeView() {
  const employeeId = currentUser.role === 'employee'
    ? currentUser.employeeId
    : currentUser.employeeId || appData.employees[0]?.id;

  const employee = appData.employees.find((emp) => emp.id === employeeId);
  selectedEmployeeId = employeeId;

  if (!employee) {
    employeeNameDisplay.textContent = '-';
    employeeShift.textContent = '-';
    return;
  }

  employeeNameDisplay.textContent = employee.name;
  employeeShift.textContent = employee.turno;

  renderEmployeeNotifications();

  // Renderizar calendário visual
  renderEmployeeCalendar(employeeId, employeePeriodStart);
}

function renderEmployeeCalendar(employeeId, startDate = null) {
  const container = document.getElementById('employeeCalendar');
  container.innerHTML = '';

  const baseDate = startDate ? new Date(startDate) : new Date(appData.settings.cycleStart);
  const monthStart = getMonthStart(baseDate);
  const dates = getMonthDates(monthStart);

  dates.forEach((date) => {
    const scheduleItem = getScheduleStatus(employeeId, date);
    const dayDiv = document.createElement('div');
    dayDiv.className = `employee-day ${scheduleItem.working ? 'working' : 'off'}`;

    const dateDiv = document.createElement('div');
    dateDiv.className = 'employee-day-date';
    const [, month, dayNum] = date.split('-');
    dateDiv.textContent = `${dayNum}/${month}`;

    const statusDiv = document.createElement('div');
    statusDiv.className = 'employee-day-status';
    statusDiv.textContent = scheduleItem.working ? '✓' : '✕';

    dayDiv.appendChild(dateDiv);
    dayDiv.appendChild(statusDiv);
    container.appendChild(dayDiv);
  });
}

function handleRoleView() {
  const isAdmin = currentUser.role === 'admin';

  adminPanel.classList.toggle('hidden', !isAdmin);
  employeePanel.classList.toggle('hidden', isAdmin);
}

function renderEmployeesList() {
  employeesList.innerHTML = '';
  
  appData.employees.forEach((employee) => {
    const item = document.createElement('div');
    item.className = 'employee-item';
    item.innerHTML = `
      <div>
        <strong>${employee.name}</strong>
        <span class="employee-shift">${employee.turno}</span>
        <span class="employee-status active">Ativo</span>
      </div>
      <button class="btn-remove" onclick="removeEmployee(${employee.id})">Remover</button>
    `;
    employeesList.appendChild(item);
  });
}

function addEmployee() {
  const name = newEmpName.value.trim();
  const username = newEmpUsername.value.trim();
  const password = newEmpPassword.value.trim();
  const turno = newEmpTurno.value;

  if (!name || !username || !password || !turno) {
    alert('Preencha todos os campos: nome, usuário, senha e turno do funcionário');
    return;
  }

  // Validações básicas
  if (username.length < 3) {
    alert('O nome de usuário deve ter pelo menos 3 caracteres');
    return;
  }
  if (password.length < 6) {
    alert('A senha deve ter pelo menos 6 caracteres');
    return;
  }

  fetch(`${API_BASE}/api/funcionario`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, username, password, turno })
  })
    .then(async (response) => {
      const text = await response.text();
      if (!response.ok) {
        throw new Error(text || 'Erro ao adicionar funcionário');
      }
      return JSON.parse(text);
    })
    .then((result) => {
      // Recarregar dados do servidor
      fetch(`${API_BASE}/api/data`)
        .then(r => r.json())
        .then((json) => {
          appData = json.data;
          scheduleData = json.schedule;
          renderEmployeesList();
          if (currentShiftView) {
            renderShiftCalendar(currentShiftView, adminPeriodStart);
          }
          renderFolgas();
          
          // Limpar campos
          newEmpName.value = '';
          newEmpUsername.value = '';
          newEmpPassword.value = '';
          newEmpTurno.value = '';
          
          // Mostrar resultado
          newEmpCredentials.innerHTML = `
            <strong>Usuário:</strong> ${result.username}<br>
            <strong>Senha:</strong> ${result.password}<br>
            <em style="color: #6b7280; font-size: 12px;">Anote essas credenciais e entregue ao funcionário</em>
          `;
          newEmpResult.classList.remove('hidden');
          
          // Esconder resultado após 10 segundos
          setTimeout(() => {
            newEmpResult.classList.add('hidden');
          }, 10000);
        });
    })
    .catch((error) => {
      console.error(error);
      alert('Erro: ' + error.message);
    });
}

function removeEmployee(employeeId) {
  if (!confirm('Tem certeza que deseja remover este funcionário?')) {
    return;
  }

  fetch(`${API_BASE}/api/funcionario/${employeeId}`, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' }
  })
    .then(async (response) => {
      if (!response.ok) {
        const text = await response.text();
        throw new Error(text || 'Erro ao remover funcionário');
      }
      return response.json();
    })
    .then(() => {
      // Recarregar dados
      fetch(`${API_BASE}/api/data`)
        .then(r => r.json())
        .then((json) => {
          appData = json.data;
          scheduleData = json.schedule;
          renderEmployeesList();
          if (currentShiftView) {
            renderShiftCalendar(currentShiftView, adminPeriodStart);
          }
          renderFolgas();
          alert('Funcionário removido com sucesso');
        });
    })
    .catch((error) => {
      console.error(error);
      alert('Erro: ' + error.message);
    });
}

function saveFolgas() {
  fetch(`${API_BASE}/api/folgas`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ folgas: appData.folgas })
  })
    .then((response) => {
      if (!response.ok) {
        throw new Error('Falha ao salvar folgas');
      }
      return response.json();
    })
    .then(() => {
      alert('Folgas salvas com sucesso!');
    })
    .catch((error) => {
      console.error(error);
      alert('Erro ao salvar folgas. Veja o console do navegador.');
    });
}

function updateAdminPeriodUI(date) {
  const monthStart = getMonthStart(date);
  const monthEnd = new Date(monthStart);
  monthEnd.setMonth(monthEnd.getMonth() + 1);
  monthEnd.setDate(0);

  periodStartDate.value = monthStart.toISOString().slice(0, 10);
  periodDisplay.textContent = `${formatMonthLabel(monthStart)} • ${formatDate(monthStart)} a ${formatDate(monthEnd)}`;
}

function updateEmployeePeriodUI(date) {
  const monthStart = getMonthStart(date);
  const monthEnd = new Date(monthStart);
  monthEnd.setMonth(monthEnd.getMonth() + 1);
  monthEnd.setDate(0);

  empPeriodStartDate.value = monthStart.toISOString().slice(0, 10);
  empPeriodDisplay.textContent = `${formatMonthLabel(monthStart)} • ${formatDate(monthStart)} a ${formatDate(monthEnd)}`;
}

function updateAdminPeriod(newDate) {
  adminPeriodStart = newDate;
  updateAdminPeriodUI(newDate);
  
  if (currentShiftView) {
    renderShiftCalendar(currentShiftView, newDate);
  }
  renderFolgas();
}

function nextAdminPeriod() {
  const current = getMonthStart(adminPeriodStart);
  current.setMonth(current.getMonth() + 1);
  updateAdminPeriod(current.toISOString().slice(0, 10));
}

function prevAdminPeriod() {
  const current = getMonthStart(adminPeriodStart);
  current.setMonth(current.getMonth() - 1);
  updateAdminPeriod(current.toISOString().slice(0, 10));
}

function setAdminCustomDate() {
  const selectedDate = periodStartDate.value;
  if (selectedDate) {
    const monthStart = getMonthStart(selectedDate);
    updateAdminPeriod(monthStart.toISOString().slice(0, 10));
  }
}

function updateEmployeePeriod(newDate) {
  employeePeriodStart = newDate;
  updateEmployeePeriodUI(newDate);
  
  renderEmployeeView();
}

function nextEmployeePeriod() {
  const current = getMonthStart(employeePeriodStart);
  current.setMonth(current.getMonth() + 1);
  updateEmployeePeriod(current.toISOString().slice(0, 10));
}

function prevEmployeePeriod() {
  const current = getMonthStart(employeePeriodStart);
  current.setMonth(current.getMonth() - 1);
  updateEmployeePeriod(current.toISOString().slice(0, 10));
}

function setEmployeeCustomDate() {
  const selectedDate = empPeriodStartDate.value;
  if (selectedDate) {
    const monthStart = getMonthStart(selectedDate);
    updateEmployeePeriod(monthStart.toISOString().slice(0, 10));
  }
}

loginBtn.addEventListener('click', login);
logoutBtn.addEventListener('click', logout);
addEmpBtn.addEventListener('click', addEmployee);
employeesToggleBtn.addEventListener('click', toggleEmployeesList);
closeShiftDetailBtn.addEventListener('click', closeShiftDetail);
saveFolgasBtn.addEventListener('click', saveFolgas);
prevPeriodBtn.addEventListener('click', prevAdminPeriod);
nextPeriodBtn.addEventListener('click', nextAdminPeriod);
periodStartDate.addEventListener('change', setAdminCustomDate);
empPrevPeriodBtn.addEventListener('click', prevEmployeePeriod);
empNextPeriodBtn.addEventListener('click', nextEmployeePeriod);
empPeriodStartDate.addEventListener('change', setEmployeeCustomDate);
notificationType.addEventListener('change', toggleNotificationType);
sendNotificationBtn.addEventListener('click', sendNotification);
generateReportBtn.addEventListener('click', generateMonthlyReport);
