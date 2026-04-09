# 🔐 CREDENCIAIS PADRÃO DO SISTEMA

## ⚠️ IMPORTANTE
**APÓS VENDER PARA A EMPRESA, ALTERE TODAS ESTAS SENHAS!**

---

## 👤 Usuário: Coordenador

```
Usuário: coordenador
Senha:   admin123
```

**Acesso:** Painel de Administração
- Gerenciar funcionários
- Criar escalas
- Enviar notificações
- Gerar relatórios

---

## 👥 Usuários de Funcionários (Auto-gerados)

Cada funcionário criado no sistema recebe automaticamente:

```
Usuário: [nome_em_minusculas_sem_espacos]
Senha:   [nome_em_minusculas] + [número aleatório 0000-9999]
```

### Exemplo:
Se você criar funcionário "Carlos Silva":
```
Usuário: carlossilva
Senha:   carlossilva + número randômico
Exmplo:  carlossilva7341
```

---

## 🔒 COMO AS SENHAS ESTÃO AGORA ARMAZENADAS

**data.json (after migration):**

```json
{
  "users": [
    {
      "id": "coordenador",
      "username": "coordenador",
      "password": "$2b$10$jN.z5yR8mK3p7qX2lA9fS.t6wM1d4bC5eF9gH0jI2kL3nO", 
      "name": "Coordenador",
      "role": "admin",
      "employeeId": null
    },
    {
      "id": "carlos",
      "username": "carlos",
      "password": "$2b$10$qL2pX9mK3d7rS1bT8eF5A.z0yW4cV6hN9oJ1iM3kL7mN",
      "name": "Carlos Silva",
      "role": "employee",
      "employeeId": 1
    }
  ]
}
```

**O que significa:**
- `$2b$10$...` = Senha criptografada com bcryptjs
- Impossível recuperar a senha original
- Sistema compara automaticamente ao fazer login

---

## 🔄 COMO MUDAR SENHAS APÓS VENDER

### Opção 1: Pelo Sistema (cuando houver suporte)
```
1. Funcionário faz login
2. Clica em "Alterar Senha"
3. Digita nova senha
4. Nova senha é automaticamente criptografada
```

### Opção 2: Manualmente (temporário)
```javascript
// No arquivo server.js, crie uma rota temporária:
const bcrypt = require('bcryptjs');

app.post('/api/reset-password', (req, res) => {
  const { username, newPassword } = req.body;
  const data = loadData();
  
  const user = data.users.find(u => u.username === username);
  if (!user) return res.status(404).json({ error: 'User not found' });
  
  user.password = bcrypt.hashSync(newPassword, 10);
  saveData(data);
  res.json({ success: true, message: 'Password reset successful' });
});
```

---

## 📋 CHECKLIST: ANTES DE VENDER

- [ ] Mude a senha do coordenador
  - Usuário: `coordenador`
  - Senha: `[colocar senha forte aqui]`
  
- [ ] Crie um funcionário padrão para teste
  - Nome: qualquer um
  - Turno: um dos 4
  
- [ ] Teste login com as novas credenciais

- [ ] Guarde as credenciais em local seguro (gestor de senhas)

- [ ] NUNCA compartilhe credenciais por email/WhatsApp

- [ ] Entregue ao cliente apenas credenciais de teste iniciais

---

## 🛡️ BOAS PRÁTICAS DE SENHA

Quando a empresa criar suas próprias senhas:

✅ **Bom:**
- "Monitor@2024!"
- "Caf3d0M@nh@"
- "Escala$987XYZ"

❌ **Ruim:**
- "123456"
- "password"
- "admin"
- "12345678"

---

## 🚀 PRÓXIMAS MELHORIAS

**Para a Próxima Versão:**
- [ ] Painel de alterar senha para o usuário
- [ ] Sistema de "Esqueci Senha" com email
- [ ] Autenticação de dois fatores (2FA)
- [ ] Expiração de senhas a cada 90 dias
- [ ] Histórico de logins (auditoria)

---

**Sistema Seguro em Produção! 🎉**
