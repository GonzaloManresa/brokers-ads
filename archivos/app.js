/* ═══════════════════════════════════════════════════════
   TimeTrack — app.js (Supabase edition)
   Sistema de gestión interna para Brokers Ads
═══════════════════════════════════════════════════════ */

const SUPABASE_URL = 'https://wtzqezssfjhphbivztmz.supabase.co';
const SUPABASE_KEY = 'sb_publishable_nj-PwMllwGhctYXzEOsLZQ_rcrNzpuJ';

const { createClient } = supabase;
const db = createClient(SUPABASE_URL, SUPABASE_KEY);

// ──────────────────────────────────────────
// SESSION (solo en localStorage — dato mínimo)
// ──────────────────────────────────────────
const Session = {
  get()     { try { return JSON.parse(localStorage.getItem('tt_session')); } catch { return null; } },
  set(data) { localStorage.setItem('tt_session', JSON.stringify(data)); },
  clear()   { localStorage.removeItem('tt_session'); }
};

// ──────────────────────────────────────────
// DATABASE MODULE
// ──────────────────────────────────────────
const DB = {
  async getUsers() {
    const { data } = await db.from('users').select('*').order('created_at');
    return data || [];
  },
  async getUserByUsername(username) {
    const { data } = await db.from('users').select('*').eq('username', username).maybeSingle();
    return data || null;
  },
  async getUserById(id) {
    const { data } = await db.from('users').select('*').eq('id', id).maybeSingle();
    return data || null;
  },
  async addUser(user) {
    const { data } = await db.from('users').insert(user).select().single();
    return data;
  },
  async updateUser(id, fields) {
    await db.from('users').update(fields).eq('id', id);
  },

  async getProjects(includeArchived = false) {
    let q = db.from('projects').select('*');
    if (!includeArchived) q = q.eq('active', true);
    const { data } = await q.order('created_at');
    return data || [];
  },
  async addProject(project) {
    const { data } = await db.from('projects').insert(project).select().single();
    return data;
  },
  async updateProject(id, fields) {
    await db.from('projects').update(fields).eq('id', id);
  },

  async getAreas() {
    const { data } = await db.from('areas').select('name').order('name');
    return (data || []).map(r => r.name);
  },

  async getEntries(filters = {}) {
    let q = db.from('entries').select('*');
    if (filters.projectId) q = q.eq('project_id', filters.projectId);
    if (filters.area)      q = q.eq('area', filters.area);
    if (filters.dateFrom)  q = q.gte('date', filters.dateFrom);
    if (filters.dateTo)    q = q.lte('date', filters.dateTo);
    if (filters.date)      q = q.eq('date', filters.date);
    const { data } = await q.order('created_at', { ascending: false });
    return data || [];
  },
  async addEntry(entry) {
    const { data } = await db.from('entries').insert(entry).select().single();
    return data;
  }
};

// ──────────────────────────────────────────
// AUTH
// ──────────────────────────────────────────
const Auth = {
  async login(username, password) {
    const user = await DB.getUserByUsername(username);
    if (!user || user.password !== password || !user.active) return null;
    const session = { userId: user.id, role: user.role, loggedInAt: new Date().toISOString() };
    Session.set(session);
    return session;
  },
  logout() {
    Session.clear();
    Router.go('login');
  },
  async currentSession() {
    const s = Session.get();
    if (!s) return null;
    const user = await DB.getUserById(s.userId);
    if (!user || !user.active) { Session.clear(); return null; }
    return s;
  },
  async handleLogin(event) {
    event.preventDefault();
    const username = document.getElementById('l-user').value.trim();
    const password = document.getElementById('l-pass').value;
    const btn      = event.target.querySelector('button[type="submit"]');
    const err      = document.getElementById('login-error');
    err.classList.remove('visible');
    btn.textContent = 'Ingresando...';
    btn.disabled = true;

    const session = await Auth.login(username, password);
    btn.textContent = 'Ingresar';
    btn.disabled = false;
    if (!session) { err.classList.add('visible'); return; }
    Router.go(session.role);
  }
};

// ──────────────────────────────────────────
// ROUTER
// ──────────────────────────────────────────
const Router = {
  go(viewName) {
    document.querySelectorAll('[data-view]').forEach(v => v.classList.remove('active'));
    const view = document.getElementById('view-' + viewName);
    if (!view) { this.go('login'); return; }
    view.classList.add('active');
    if (viewName === 'empleado') Views.empleado.init();
    if (viewName === 'director') Views.director.init();
  },
  async init() {
    const session = await Auth.currentSession();
    if (!session) { this.go('login'); return; }
    this.go(session.role);
  }
};

// ──────────────────────────────────────────
// NOTIFICATION & MODAL
// ──────────────────────────────────────────
function showNotify(msg = '✓ Registro guardado correctamente') {
  const el = document.getElementById('notify');
  el.textContent = msg;
  el.classList.add('show');
  setTimeout(() => el.classList.remove('show'), 2800);
}

const Modal = {
  _resolve: null,
  show(title, body) {
    document.getElementById('modal-title').textContent = title;
    document.getElementById('modal-body').textContent  = body;
    document.getElementById('modal-overlay').classList.add('visible');
    return new Promise(resolve => { this._resolve = resolve; });
  },
  cancel() {
    document.getElementById('modal-overlay').classList.remove('visible');
    if (this._resolve) this._resolve(false);
    this._resolve = null;
  },
  confirm() {
    document.getElementById('modal-overlay').classList.remove('visible');
    if (this._resolve) this._resolve(true);
    this._resolve = null;
  }
};
document.getElementById('modal-confirm-btn').addEventListener('click', () => Modal.confirm());

// ──────────────────────────────────────────
// HELPERS
// ──────────────────────────────────────────
function formatDate(dateStr) {
  if (!dateStr) return '—';
  const [y, m, d] = dateStr.split('-');
  return `${d}/${m}/${y}`;
}
function statusColor(status) {
  if (status === 'ok')       return 'var(--green)';
  if (status === 'warn')     return 'var(--accent)';
  if (status === 'critical') return 'var(--red)';
  return 'var(--muted)';
}
function clamp(val, min, max) { return Math.max(min, Math.min(max, val)); }
function getWeekRange() {
  const now  = new Date();
  const day  = now.getDay();
  const diff = day === 0 ? 6 : day - 1;
  const mon  = new Date(now); mon.setDate(now.getDate() - diff);
  const sun  = new Date(mon); sun.setDate(mon.getDate() + 6);
  return { from: mon.toISOString().slice(0, 10), to: sun.toISOString().slice(0, 10) };
}
function calcProfitability(project, allEntries) {
  const entries   = allEntries.filter(e => e.project_id === project.id);
  const usedHours = entries.reduce((s, e) => s + parseFloat(e.weighted_hours), 0);
  const margin    = ((project.budget_hours - usedHours) / project.budget_hours) * 100;
  const status    = margin > 30 ? 'ok' : margin > 0 ? 'warn' : 'critical';
  return { budgetHours: project.budget_hours, usedHours: parseFloat(usedHours.toFixed(2)), margin: parseFloat(margin.toFixed(1)), status };
}
function buildProjMap(projects) {
  const m = {};
  projects.forEach(p => m[p.id] = p.name);
  return m;
}

// ──────────────────────────────────────────
// VIEWS
// ──────────────────────────────────────────
const Views = {

  // ── EMPLEADO ──────────────────────────
  empleado: {
    async init() {
      const session = await Auth.currentSession();
      if (!session || session.role !== 'empleado') { Router.go('login'); return; }

      const user = await DB.getUserById(session.userId);
      document.getElementById('emp-role-label').textContent =
        user ? `Bienvenido, ${user.display_name}` : 'Área: equipo';

      const [projects, areas] = await Promise.all([DB.getProjects(), DB.getAreas()]);
      const proySelect = document.getElementById('e-proyecto');
      const areaSelect = document.getElementById('e-area');
      proySelect.innerHTML = '<option value="">Seleccioná un proyecto</option>';
      areaSelect.innerHTML = '<option value="">Seleccioná un área</option>';
      projects.forEach(p => proySelect.insertAdjacentHTML('beforeend', `<option value="${p.id}">${p.name}</option>`));
      areas.forEach(a   => areaSelect.insertAdjacentHTML('beforeend', `<option value="${a}">${a}</option>`));

      await this.renderTodayTable();
    },

    async submit() {
      const projectId = document.getElementById('e-proyecto').value;
      const area      = document.getElementById('e-area').value;
      const tiempo    = document.getElementById('e-tiempo').value;
      const tipo      = document.getElementById('e-tipo').value;
      const errEl     = document.getElementById('emp-form-error');
      const btn       = document.querySelector('#view-empleado .form-submit');
      errEl.classList.remove('visible');

      if (!projectId || !area || !tiempo || !tipo) {
        errEl.textContent = 'Completá todos los campos antes de registrar.';
        errEl.classList.add('visible');
        return;
      }

      btn.textContent = 'Guardando...';
      btn.disabled = true;

      const rawHours      = parseFloat(tiempo);
      const factor        = tipo === 'intermitente' ? 1.2 : 1.0;
      const weightedHours = parseFloat((rawHours * factor).toFixed(2));

      await DB.addEntry({
        id:            'e_' + Date.now(),
        project_id:    projectId,
        area,
        task_type:     tipo,
        raw_hours:     rawHours,
        factor,
        weighted_hours: weightedHours,
        date:          new Date().toISOString().slice(0, 10),
        created_at:    new Date().toISOString()
      });

      btn.textContent = 'Registrar tiempo';
      btn.disabled = false;
      ['e-proyecto', 'e-area', 'e-tiempo', 'e-tipo'].forEach(id => document.getElementById(id).value = '');
      showNotify('✓ Registro guardado correctamente');
      await this.renderTodayTable();
    },

    async renderTodayTable() {
      const wrap  = document.getElementById('today-table-wrap');
      const today = new Date().toISOString().slice(0, 10);
      const [entries, projects] = await Promise.all([
        DB.getEntries({ date: today }),
        DB.getProjects(true)
      ]);
      const pMap = buildProjMap(projects);

      if (!entries.length) {
        wrap.innerHTML = '<div class="empty-state">Sin registros para hoy. ¡Registrá tu primer bloque de tiempo!</div>';
        return;
      }

      const rows = entries.map(e => `
        <tr>
          <td>${pMap[e.project_id] || '—'}</td>
          <td>${e.area}</td>
          <td>${e.raw_hours} h</td>
          <td><span class="badge badge-${e.task_type === 'continua' ? 'cont' : 'int'}">${e.task_type === 'continua' ? 'Continua' : 'Intermitente'}</span></td>
          <td style="font-family:'DM Mono',monospace; color:var(--accent);">${e.weighted_hours} h</td>
        </tr>
      `).join('');

      wrap.innerHTML = `
        <div class="app-table-wrap">
          <table class="app-table">
            <thead><tr><th>Proyecto</th><th>Área</th><th>Horas</th><th>Tipo</th><th>Ponderado</th></tr></thead>
            <tbody>${rows}</tbody>
          </table>
        </div>
      `;
    }
  },

  // ── DIRECTOR ──────────────────────────
  director: {
    _page: 1,
    _pageSize: 20,
    _filters: {},
    _projects: [],
    _entries:  [],
    _areas:    [],

    async init() {
      const session = await Auth.currentSession();
      if (!session || session.role !== 'director') { Router.go('login'); return; }
      await this.reload();
      this.renderDashboard();
      this.initFilters();
    },

    async reload() {
      [this._projects, this._entries, this._areas] = await Promise.all([
        DB.getProjects(true),
        DB.getEntries(),
        DB.getAreas()
      ]);
    },

    switchTab(name, btn) {
      document.querySelectorAll('#view-director .tab').forEach(t => t.classList.remove('active'));
      document.querySelectorAll('#view-director .tab-panel').forEach(p => p.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById('dir-tab-' + name).classList.add('active');
      if (name === 'dashboard') this.renderDashboard();
      if (name === 'entradas')  { this._page = 1; this.renderEntriesTable(); }
      if (name === 'gestion')   this.renderManagement();
    },

    switchSubTab(name, btn) {
      document.querySelectorAll('.sub-tab').forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.sub-panel').forEach(p => p.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById('sub-' + name).classList.add('active');
    },

    // Dashboard
    renderDashboard() {
      this.renderMetrics();
      this.renderProfitCards();
      this.renderActivityFeed();
    },

    renderMetrics() {
      const week       = getWeekRange();
      const weekEnt    = this._entries.filter(e => e.date >= week.from && e.date <= week.to);
      const totalHours = weekEnt.reduce((s, e) => s + parseFloat(e.weighted_hours), 0);
      const active     = this._projects.filter(p => p.active);
      const atRisk     = active.filter(p => calcProfitability(p, this._entries).margin < 30).length;

      document.getElementById('metrics-grid').innerHTML = `
        <div class="metric-card">
          <div class="metric-num">${totalHours.toFixed(1)} h</div>
          <div class="metric-label">Horas ponderadas esta semana</div>
        </div>
        <div class="metric-card">
          <div class="metric-num">${active.length}</div>
          <div class="metric-label">Proyectos activos</div>
        </div>
        <div class="metric-card ${atRisk > 0 ? 'risk' : ''}">
          <div class="metric-num">${atRisk}</div>
          <div class="metric-label">Proyectos en riesgo (margen &lt; 30%)</div>
        </div>
      `;
    },

    renderProfitCards() {
      const sorted = this._projects.filter(p => p.active)
        .map(p => ({ ...p, prof: calcProfitability(p, this._entries) }))
        .sort((a, b) => a.prof.margin - b.prof.margin);

      const grid = document.getElementById('profit-grid');
      if (!sorted.length) { grid.innerHTML = '<div class="empty-state">No hay proyectos activos.</div>'; return; }

      grid.innerHTML = sorted.map(p => {
        const prof   = p.prof;
        const barW   = clamp(prof.margin, 0, 100);
        const pctLbl = prof.margin < 0
          ? `−${Math.abs(prof.margin).toFixed(1)}% excedido`
          : `${prof.margin.toFixed(1)}% de margen restante`;

        const byArea = {};
        this._entries.filter(e => e.project_id === p.id).forEach(e => {
          byArea[e.area] = (byArea[e.area] || 0) + parseFloat(e.weighted_hours);
        });
        const breakdown = Object.entries(byArea).map(([area, h]) => `
          <div class="profit-breakdown-row"><span>${area}</span><span>${h.toFixed(2)} h</span></div>
        `).join('');

        return `
          <div class="profit-card">
            <div class="profit-header">
              <div>
                <div class="profit-name">${p.name}</div>
                <div class="profit-client">${p.client}</div>
              </div>
              <div class="profit-pct ${prof.status}">${pctLbl}</div>
            </div>
            <div class="profit-bar-track">
              <div class="profit-bar-fill ${prof.status}" style="width:${barW}%"></div>
            </div>
            <div class="profit-stats">
              <span>${prof.usedHours} h utilizadas</span>
              <span>Presupuesto: ${prof.budgetHours} h</span>
            </div>
            ${breakdown ? `<div class="profit-breakdown">${breakdown}</div>` : ''}
          </div>
        `;
      }).join('');
    },

    renderActivityFeed() {
      const last10 = [...this._entries].sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, 10);
      const pMap   = buildProjMap(this._projects);
      const list   = document.getElementById('activity-list');
      list.innerHTML = !last10.length
        ? '<div class="empty-state">Sin actividad registrada aún.</div>'
        : last10.map(e => `
            <div class="activity-item">
              <span class="activity-project">${pMap[e.project_id] || '—'}</span>
              <span class="activity-area">${e.area}</span>
              <span class="badge badge-${e.task_type === 'continua' ? 'cont' : 'int'}">${e.task_type === 'continua' ? 'Continua' : 'Intermitente'}</span>
              <span class="activity-hours">${e.weighted_hours} h pond.</span>
              <span class="activity-date">${formatDate(e.date)}</span>
            </div>
          `).join('');
    },

    // Entradas tab
    initFilters() {
      const projSel = document.getElementById('f-proj');
      const areaSel = document.getElementById('f-area-dir');
      projSel.innerHTML = '<option value="">Todos los proyectos</option>';
      areaSel.innerHTML = '<option value="">Todas las áreas</option>';
      this._projects.forEach(p => projSel.insertAdjacentHTML('beforeend', `<option value="${p.id}">${p.name}</option>`));
      this._areas.forEach(a => areaSel.insertAdjacentHTML('beforeend', `<option value="${a}">${a}</option>`));
    },

    applyFilters() {
      this._filters = {
        projectId: document.getElementById('f-proj').value     || null,
        area:      document.getElementById('f-area-dir').value || null,
        dateFrom:  document.getElementById('f-desde').value    || null,
        dateTo:    document.getElementById('f-hasta').value    || null
      };
      this._page = 1;
      this.renderEntriesTable();
    },

    resetFilters() {
      ['f-proj', 'f-area-dir', 'f-desde', 'f-hasta'].forEach(id => document.getElementById(id).value = '');
      this._filters = {};
      this._page = 1;
      this.renderEntriesTable();
    },

    renderEntriesTable() {
      const pMap = buildProjMap(this._projects);
      const f    = this._filters;
      const all  = this._entries.filter(e => {
        if (f.projectId && e.project_id !== f.projectId) return false;
        if (f.area      && e.area       !== f.area)       return false;
        if (f.dateFrom  && e.date < f.dateFrom)           return false;
        if (f.dateTo    && e.date > f.dateTo)             return false;
        return true;
      });

      const total    = all.length;
      const pageData = all.slice((this._page - 1) * this._pageSize, this._page * this._pageSize);
      const tbody    = document.getElementById('entries-tbody');

      if (!total) {
        tbody.innerHTML = `<tr><td colspan="9" style="text-align:center; padding:32px; color:var(--muted); font-style:italic;">Sin entradas para los filtros seleccionados.</td></tr>`;
      } else {
        tbody.innerHTML = pageData.map(e => {
          const proj   = this._projects.find(p => p.id === e.project_id);
          const prof   = proj ? calcProfitability(proj, this._entries) : null;
          const barW   = prof ? clamp(prof.margin, 0, 100) : 0;
          const barC   = prof ? statusColor(prof.status) : 'var(--muted)';
          const slbl   = prof ? (prof.status === 'ok' ? 'OK' : prof.status === 'warn' ? 'Revisar' : 'Excedido') : '—';
          const sbadge = prof ? prof.status : '';
          return `
            <tr>
              <td style="font-family:'DM Mono',monospace; font-size:12px;">${formatDate(e.date)}</td>
              <td>${pMap[e.project_id] || '—'}</td>
              <td>${e.area}</td>
              <td><span class="badge badge-${e.task_type === 'continua' ? 'cont' : 'int'}">${e.task_type === 'continua' ? 'Continua' : 'Intermitente'}</span></td>
              <td style="font-family:'DM Mono',monospace;">${e.raw_hours} h</td>
              <td style="font-family:'DM Mono',monospace;">${e.factor}×</td>
              <td style="font-family:'DM Mono',monospace; color:var(--accent);">${e.weighted_hours} h</td>
              <td><span class="badge badge-${sbadge}">${slbl}</span></td>
              <td><div class="rentab-bar"><div class="rentab-fill" style="width:${barW}%; background:${barC};"></div></div></td>
            </tr>
          `;
        }).join('');
      }

      const totalPages = Math.ceil(total / this._pageSize) || 1;
      document.getElementById('entries-pagination').innerHTML = `
        <span>${total} registros · Página ${this._page} de ${totalPages}</span>
        <div class="pagination-controls">
          <button class="btn-page" ${this._page <= 1 ? 'disabled' : ''} onclick="Views.director.goPage(${this._page - 1})">← Anterior</button>
          <button class="btn-page" ${this._page >= totalPages ? 'disabled' : ''} onclick="Views.director.goPage(${this._page + 1})">Siguiente →</button>
        </div>
      `;
    },

    goPage(p) { this._page = p; this.renderEntriesTable(); },

    exportCSV() {
      const pMap = buildProjMap(this._projects);
      const f    = this._filters;
      const all  = this._entries.filter(e => {
        if (f.projectId && e.project_id !== f.projectId) return false;
        if (f.area      && e.area       !== f.area)       return false;
        if (f.dateFrom  && e.date < f.dateFrom)           return false;
        if (f.dateTo    && e.date > f.dateTo)             return false;
        return true;
      }).sort((a, b) => b.created_at.localeCompare(a.created_at));

      const header = ['Fecha','Proyecto','Área','Tipo','Horas','Factor','Horas Ponderadas','Margen del Proyecto (%)'];
      const rows = all.map(e => {
        const proj = this._projects.find(p => p.id === e.project_id);
        const prof = proj ? calcProfitability(proj, this._entries) : null;
        return [
          e.date, pMap[e.project_id] || '', e.area, e.task_type,
          e.raw_hours, e.factor, e.weighted_hours, prof ? prof.margin.toFixed(1) : ''
        ].map(v => `"${String(v).replace(/"/g, '""')}"`).join(',');
      });

      const csv  = [header.join(','), ...rows].join('\n');
      const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement('a');
      a.href = url; a.download = `timetrack-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click(); URL.revokeObjectURL(url);
    },

    // Gestión tab
    renderManagement() {
      this.renderProjectsTable();
      this.renderUsersTable();
    },

    renderProjectsTable() {
      const active   = this._projects.filter(p => p.active);
      const archived = this._projects.filter(p => !p.active);

      document.getElementById('projects-tbody').innerHTML = active.map(p => {
        const prof = calcProfitability(p, this._entries);
        const barW = clamp(prof.margin, 0, 100);
        return `
          <tr id="proj-row-${p.id}">
            <td>${p.name}</td>
            <td>${p.client}</td>
            <td style="font-family:'DM Mono',monospace;">${p.budget_hours} h</td>
            <td style="font-family:'DM Mono',monospace; color:var(--accent);">${prof.usedHours} h</td>
            <td>
              <div style="display:flex; align-items:center; gap:8px;">
                <div class="rentab-bar" style="width:60px;">
                  <div class="rentab-fill" style="width:${barW}%; background:${statusColor(prof.status)};"></div>
                </div>
                <span style="font-size:12px; font-family:'DM Mono',monospace; color:${statusColor(prof.status)};">${prof.margin.toFixed(1)}%</span>
              </div>
            </td>
            <td style="display:flex; gap:8px; flex-wrap:wrap;">
              <button class="btn-action" onclick="Views.director.editProject('${p.id}')">Editar</button>
              <button class="btn-action danger" onclick="Views.director.archiveProject('${p.id}')">Archivar</button>
            </td>
          </tr>
        `;
      }).join('') || `<tr><td colspan="6" style="text-align:center; padding:20px; color:var(--muted); font-style:italic;">No hay proyectos activos.</td></tr>`;

      document.getElementById('archived-projects-tbody').innerHTML = archived.map(p => `
        <tr>
          <td style="color:var(--muted);">${p.name}</td>
          <td style="color:var(--muted);">${p.client}</td>
          <td style="font-family:'DM Mono',monospace; color:var(--muted);">${p.budget_hours} h</td>
          <td><button class="btn-action" onclick="Views.director.reactivateProject('${p.id}')">Reactivar</button></td>
        </tr>
      `).join('') || `<tr><td colspan="4" style="padding:12px; color:var(--muted); font-style:italic; font-size:13px;">Sin proyectos archivados.</td></tr>`;
    },

    editProject(id) {
      const p = this._projects.find(pr => pr.id === id);
      if (!p) return;
      const row = document.getElementById('proj-row-' + id);
      row.classList.add('editing');
      row.innerHTML = `
        <td><input class="inline-edit" id="ep-name-${id}" value="${p.name}"></td>
        <td><input class="inline-edit" id="ep-client-${id}" value="${p.client}"></td>
        <td><input class="inline-edit" id="ep-budget-${id}" type="number" value="${p.budget_hours}" min="1" step="0.5" style="width:80px;"></td>
        <td colspan="2"></td>
        <td style="display:flex; gap:8px;">
          <button class="btn-action save" onclick="Views.director.saveProject('${id}')">Guardar</button>
          <button class="btn-action cancel-edit" onclick="Views.director.renderProjectsTable()">Cancelar</button>
        </td>
      `;
    },

    async saveProject(id) {
      const name   = document.getElementById('ep-name-' + id).value.trim();
      const client = document.getElementById('ep-client-' + id).value.trim();
      const budget = parseFloat(document.getElementById('ep-budget-' + id).value);
      if (!name || !client || isNaN(budget) || budget <= 0) { showNotify('✗ Completá todos los campos'); return; }
      await DB.updateProject(id, { name, client, budget_hours: budget });
      await this.reload();
      this.renderProjectsTable();
      this.initFilters();
      showNotify('✓ Proyecto actualizado');
    },

    async archiveProject(id) {
      const p = this._projects.find(pr => pr.id === id);
      if (!p) return;
      const ok = await Modal.show('Archivar proyecto', `¿Archivás "${p.name}"? Las entradas existentes se conservan.`);
      if (!ok) return;
      await DB.updateProject(id, { active: false });
      await this.reload();
      this.renderProjectsTable();
      this.initFilters();
      showNotify('Proyecto archivado');
    },

    async reactivateProject(id) {
      await DB.updateProject(id, { active: true });
      await this.reload();
      this.renderProjectsTable();
      this.initFilters();
      showNotify('✓ Proyecto reactivado');
    },

    toggleArchived(type) {
      const sec = document.getElementById('archived-' + type + '-section');
      const btn = document.getElementById('toggle-archived-' + type);
      sec.classList.toggle('open');
      btn.textContent = sec.classList.contains('open') ? '▾ Proyectos archivados' : '▸ Proyectos archivados';
    },

    async addProject() {
      const name   = document.getElementById('np-nombre').value.trim();
      const client = document.getElementById('np-cliente').value.trim();
      const hours  = parseFloat(document.getElementById('np-horas').value);
      const errEl  = document.getElementById('np-error');
      errEl.classList.remove('visible');
      if (!name || !client || isNaN(hours) || hours <= 0) {
        errEl.textContent = 'Completá todos los campos. El presupuesto debe ser mayor a 0.';
        errEl.classList.add('visible');
        return;
      }
      await DB.addProject({ id: 'proj_' + Date.now(), name, client, budget_hours: hours, active: true, created_at: new Date().toISOString() });
      ['np-nombre', 'np-cliente', 'np-horas'].forEach(id => document.getElementById(id).value = '');
      await this.reload();
      this.renderProjectsTable();
      this.initFilters();
      showNotify('✓ Proyecto agregado');
    },

    async renderUsersTable() {
      const session = Session.get();
      const users   = await DB.getUsers();
      document.getElementById('users-tbody').innerHTML = users.map(u => `
        <tr id="user-row-${u.id}">
          <td style="font-family:'DM Mono',monospace;">${u.username}</td>
          <td>${u.display_name}</td>
          <td><span class="badge badge-${u.role}">${u.role === 'director' ? 'Director' : 'Empleado'}</span></td>
          <td><span class="badge ${u.active ? 'badge-ok' : 'badge-critical'}">${u.active ? 'Activo' : 'Inactivo'}</span></td>
          <td style="display:flex; gap:8px; flex-wrap:wrap;">
            <button class="btn-action" onclick="Views.director.editUser('${u.id}')">Editar</button>
            ${u.id !== session.userId
              ? `<button class="btn-action danger" onclick="Views.director.toggleUserActive('${u.id}', ${!u.active})">${u.active ? 'Desactivar' : 'Activar'}</button>`
              : `<span style="font-size:11px; color:var(--muted); padding:5px 8px;">(sesión actual)</span>`
            }
          </td>
        </tr>
      `).join('');
    },

    async editUser(id) {
      const users = await DB.getUsers();
      const u = users.find(u => u.id === id);
      if (!u) return;
      const row = document.getElementById('user-row-' + id);
      row.classList.add('editing');
      row.innerHTML = `
        <td><input class="inline-edit" id="eu-user-${id}" value="${u.username}"></td>
        <td><input class="inline-edit" id="eu-name-${id}" value="${u.display_name}"></td>
        <td>
          <select class="inline-edit" id="eu-rol-${id}">
            <option value="empleado" ${u.role === 'empleado' ? 'selected' : ''}>Empleado</option>
            <option value="director" ${u.role === 'director' ? 'selected' : ''}>Director</option>
          </select>
        </td>
        <td><input class="inline-edit" id="eu-pass-${id}" type="password" placeholder="Nueva contraseña (opcional)"></td>
        <td style="display:flex; gap:8px;">
          <button class="btn-action save" onclick="Views.director.saveUser('${id}')">Guardar</button>
          <button class="btn-action cancel-edit" onclick="Views.director.renderUsersTable()">Cancelar</button>
        </td>
      `;
    },

    async saveUser(id) {
      const username    = document.getElementById('eu-user-' + id).value.trim();
      const displayName = document.getElementById('eu-name-' + id).value.trim();
      const role        = document.getElementById('eu-rol-' + id).value;
      const newPass     = document.getElementById('eu-pass-' + id).value;
      if (!username || !displayName) { showNotify('✗ Usuario y nombre son requeridos'); return; }
      const updates = { username, display_name: displayName, role };
      if (newPass.trim()) updates.password = newPass.trim();
      await DB.updateUser(id, updates);
      await this.renderUsersTable();
      showNotify('✓ Usuario actualizado');
    },

    async toggleUserActive(id, active) {
      const users = await DB.getUsers();
      const u = users.find(u => u.id === id);
      if (!u) return;
      const ok = await Modal.show(
        `${active ? 'Activar' : 'Desactivar'} usuario`,
        `¿Querés ${active ? 'activar' : 'desactivar'} al usuario "${u.username}"?`
      );
      if (!ok) return;
      await DB.updateUser(id, { active });
      await this.renderUsersTable();
      showNotify(`✓ Usuario ${active ? 'activado' : 'desactivado'}`);
    },

    async addUser() {
      const username    = document.getElementById('nu-user').value.trim();
      const password    = document.getElementById('nu-pass').value;
      const displayName = document.getElementById('nu-nombre').value.trim();
      const role        = document.getElementById('nu-rol').value;
      const errEl       = document.getElementById('nu-error');
      errEl.classList.remove('visible');
      if (!username || !password || !displayName) {
        errEl.textContent = 'Completá todos los campos.';
        errEl.classList.add('visible');
        return;
      }
      const existing = await DB.getUserByUsername(username);
      if (existing) {
        errEl.textContent = 'Ese nombre de usuario ya existe.';
        errEl.classList.add('visible');
        return;
      }
      await DB.addUser({ id: 'usr_' + Date.now(), username, password, role, display_name: displayName, active: true, created_at: new Date().toISOString() });
      ['nu-user', 'nu-pass', 'nu-nombre'].forEach(id => document.getElementById(id).value = '');
      document.getElementById('nu-rol').value = 'empleado';
      await this.renderUsersTable();
      showNotify('✓ Usuario agregado');
    }
  }
};

// ──────────────────────────────────────────
// BOOT
// ──────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  Router.init();
});
