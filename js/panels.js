/* =================================================================== */
/* PANELS.JS V13.0 - MONOLITO COMPLETO (V2 RESTAURADA + FINANCEIRO)
/* CONTÉM: Admin, Atleta, Feed, Financeiro, Mapas, Splits, Blindagem
/* =================================================================== */

const panels = {};

// ===================================================================
// 1. ADMIN PANEL (PAINEL DO TREINADOR)
// ===================================================================
const AdminPanel = {
    state: { selectedAthleteId: null, athletes: {} },
    elements: {},

    init: function(user, db) {
        console.log("AdminPanel V13: Init Completo");
        AdminPanel.state.db = db;
        AdminPanel.state.currentUser = user;

        // Mapeamento de Elementos
        AdminPanel.elements = {
            list: document.getElementById('athlete-list'),
            search: document.getElementById('athlete-search'),
            details: document.getElementById('athlete-detail-content'),
            name: document.getElementById('athlete-detail-name'),
            workouts: document.getElementById('workouts-list'),
            form: document.getElementById('add-workout-form'),
            pendingList: document.getElementById('pending-list'),
            iaHistoryList: document.getElementById('ia-history-list')
        };

        // Listener de Busca
        if (AdminPanel.elements.search) {
            AdminPanel.elements.search.oninput = function(e) {
                AdminPanel.renderList(e.target.value);
            };
        }
        
        // Listener do Formulário (Seguro contra duplicação)
        if (AdminPanel.elements.form) {
            const newForm = AdminPanel.elements.form.cloneNode(true);
            AdminPanel.elements.form.parentNode.replaceChild(newForm, AdminPanel.elements.form);
            AdminPanel.elements.form = newForm;
            AdminPanel.elements.form.addEventListener('submit', AdminPanel.handleAddWorkout);
        }

        // Listeners das Abas
        const tabs = document.querySelectorAll('.tab-btn');
        if (tabs) {
            tabs.forEach(function(btn) {
                btn.onclick = function() {
                    document.querySelectorAll('.tab-btn').forEach(function(b) { b.classList.remove('active'); });
                    document.querySelectorAll('.admin-tab-content').forEach(function(c) { c.classList.remove('active'); });
                    btn.classList.add('active');
                    const target = document.getElementById(`admin-tab-${btn.dataset.tab}`);
                    if (target) target.classList.add('active');
                };
            });
        }
        
        const btnDelete = document.getElementById('delete-athlete-btn');
        if (btnDelete) btnDelete.onclick = AdminPanel.deleteAthlete;
        
        const btnAnalyze = document.getElementById('analyze-athlete-btn-ia');
        if (btnAnalyze) btnAnalyze.onclick = AdminPanel.runIA;

        AdminPanel.loadAthletes();
        AdminPanel.loadPending();
    },

    loadAthletes: function() {
        if (!AdminPanel.state.db) return;
        AdminPanel.state.db.ref('users').orderByChild('name').on('value', function(snap) {
            AdminPanel.state.athletes = snap.val() || {};
            AdminPanel.renderList();
        });
    },

    renderList: function(filter = "") {
        const div = AdminPanel.elements.list;
        if (!div) return;
        div.innerHTML = "";
        
        Object.entries(AdminPanel.state.athletes).forEach(function([uid, data]) {
            if (!data || data.role === 'admin') return;
            const name = data.name || "Sem Nome";
            if (filter && !name.toLowerCase().includes(filter.toLowerCase())) return;

            const row = document.createElement('div');
            row.className = 'athlete-list-item';
            if (uid === AdminPanel.state.selectedAthleteId) row.classList.add('selected');
            
            row.innerHTML = `<span>${name}</span>`;
            row.onclick = function() {
                AdminPanel.selectAthlete(uid, name);
            };
            div.appendChild(row);
        });
    },

    selectAthlete: function(uid, name) {
        AdminPanel.state.selectedAthleteId = uid;
        if (AdminPanel.elements.name) AdminPanel.elements.name.textContent = name;
        if (AdminPanel.elements.details) AdminPanel.elements.details.classList.remove('hidden');
        AdminPanel.renderList(); 
        AdminPanel.loadWorkouts(uid);
        AdminPanel.loadHistory(uid);
    },

    // --- CARREGAMENTO DE TREINOS (LÓGICA V2 + BLINDAGEM) ---
    loadWorkouts: function(uid) {
        const div = AdminPanel.elements.workouts;
        if (!div) return;
        div.innerHTML = "<p>Carregando...</p>";
        
        AdminPanel.state.db.ref(`data/${uid}/workouts`).orderByChild('date').limitToLast(200).on('value', function(snap) {
            div.innerHTML = "";
            if (!snap.exists()) { div.innerHTML = "<p>Nenhum treino agendado.</p>"; return; }

            const list = [];
            snap.forEach(function(c) { list.push({key:c.key, ...c.val()}); });
            
            list.sort(function(a,b) {
                const da = new Date(a.date || 0);
                const db = new Date(b.date || 0);
                return db - da;
            });

            list.forEach(function(w) {
                try {
                    // Proteção contra dados nulos
                    const dateStr = w.date ? new Date(w.date).toLocaleDateString('pt-BR') : "--/--";
                    const title = w.title || "Sem Título";
                    const rawDesc = w.description || "";
                    
                    let status = w.status || "planejado";
                    let border = "5px solid #ccc";
                    if (status === 'realizado') border = "5px solid #28a745";
                    else if (status === 'nao_realizado') border = "5px solid #dc3545";
                    else if (status === 'realizado_parcial') border = "5px solid #ffc107";

                    const card = document.createElement('div');
                    card.className = 'workout-card';
                    card.style.borderLeft = border;

                    let html = `
                        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
                            <strong style="font-size:1.1em; color:var(--primary-color);">${dateStr}</strong>
                            <span class="status-tag ${status}">${status}</span>
                        </div>
                        <div style="font-weight:bold; font-size:1.1rem; margin-bottom:5px;">${title}</div>
                        <div style="white-space:pre-wrap; font-size:0.95rem; color:#444; background:#f9f9f9; padding:8px; border-radius:4px; border:1px solid #eee;">${rawDesc}</div>
                    `;

                    // --- DADOS DO STRAVA (MAPA E SPLITS) ---
                    if (w.stravaData) {
                        let link = "";
                        // Prioriza link direto
                        if (w.stravaData.mapLink) {
                            link = `<a href="${w.stravaData.mapLink}" target="_blank" style="color:#fc4c02; font-weight:bold; text-decoration:none;">🗺️ Ver Mapa</a>`;
                        } else if (w.stravaActivityId) {
                            // Constrói link se tiver ID
                            link = `<a href="https://www.strava.com/activities/${w.stravaActivityId}" target="_blank" style="color:#fc4c02; font-weight:bold; text-decoration:none;">🗺️ Ver Mapa</a>`;
                        }

                        html += `
                            <div style="margin-top:10px; border-top:1px solid #eee; padding-top:10px;">
                                <div style="display:flex; justify-content:space-between; color:#fc4c02; font-size:0.8rem; font-weight:bold; margin-bottom:5px;">
                                    <span><i class='bx bxl-strava'></i> Strava Sync</span>
                                    ${link}
                                </div>
                                <div style="display:grid; grid-template-columns: 1fr 1fr 1fr; gap:5px; background:#fff5eb; padding:5px; text-align:center; font-size:0.9rem; border-radius:4px;">
                                    <div><small>Dist</small><br><strong>${w.stravaData.distancia||"-"}</strong></div>
                                    <div><small>Tempo</small><br><strong>${w.stravaData.tempo||"-"}</strong></div>
                                    <div><small>Pace</small><br><strong>${w.stravaData.ritmo||"-"}</strong></div>
                                </div>
                            </div>
                        `;
                        
                        // TABELA DE PARCIAIS (SPLITS) - CÓDIGO V2 RESTAURADO
                        if (w.stravaData.splits && Array.isArray(w.stravaData.splits) && w.stravaData.splits.length > 0) {
                            let rows = "";
                            w.stravaData.splits.forEach(function(s) {
                                rows += `<tr>
                                    <td style="padding:4px; border-bottom:1px solid #eee;">${s.km || "-"}</td>
                                    <td style="padding:4px; border-bottom:1px solid #eee;">${s.pace || "-"}</td>
                                    <td style="padding:4px; border-bottom:1px solid #eee;">${s.elev || "0"}m</td>
                                </tr>`;
                            });
                            html += `
                                <details style="margin-top:8px; font-size:0.8rem; color:#666; cursor:pointer;">
                                    <summary>Ver Parciais (Km a Km)</summary>
                                    <table style="width:100%; text-align:center; margin-top:5px; border-collapse:collapse; background:white;">
                                        <thead style="background:#eee;"><tr><th>Km</th><th>Pace</th><th>Elev</th></tr></thead>
                                        <tbody>${rows}</tbody>
                                    </table>
                                </details>
                            `;
                        }
                    }

                    // Botão Excluir
                    html += `
                        <div style="text-align:right; margin-top:10px; padding-top:5px; border-top:1px dashed #ddd;">
                            <button class="btn-del btn btn-danger btn-small" style="font-size:0.8rem; padding:2px 8px;">Excluir</button>
                        </div>
                    `;

                    card.innerHTML = html;

                    // Listeners Seguros
                    card.addEventListener('click', function(e) {
                        // Não abre modal se clicar em botões, links ou details
                        if (!e.target.closest('button') && !e.target.closest('a') && !e.target.closest('details')) {
                            AppPrincipal.openFeedbackModal(w.key, uid, title);
                        }
                    });

                    const btnDel = card.querySelector('.btn-del');
                    if (btnDel) {
                        btnDel.onclick = function(ev) {
                            ev.stopPropagation();
                            if (confirm("Tem certeza que deseja apagar este treino?")) {
                                const u = {}; 
                                u[`/data/${uid}/workouts/${w.key}`] = null; 
                                u[`/publicWorkouts/${w.key}`] = null;
                                AdminPanel.state.db.ref().update(u);
                            }
                        };
                    }

                    div.appendChild(card);

                } catch (err) {
                    console.error("Erro no card:", err);
                    // Try/catch garante que se um falhar, o próximo carrega
                }
            });
        });
    },

    handleAddWorkout: function(e) {
        e.preventDefault();
        const uid = AdminPanel.state.selectedAthleteId;
        if (!uid) return alert("Selecione um atleta.");

        const f = e.target;
        const getVal = function(id) {
            const el = f.querySelector(id);
            return el ? el.value : "";
        };
        
        const date = getVal('#workout-date');
        const title = getVal('#workout-title');

        if (!date || !title) return alert("Data e Título obrigatórios.");

        let desc = `[${getVal('#workout-modalidade')}] - ${getVal('#workout-tipo-treino')}\n`;
        desc += `Intensidade: ${getVal('#workout-intensidade')} | Percurso: ${getVal('#workout-percurso')}\n`;
        
        const dist = getVal('#workout-distancia');
        if(dist) desc += `Dist: ${dist}km | `;
        const tempo = getVal('#workout-tempo');
        if(tempo) desc += `Tempo: ${tempo} | `;
        const pace = getVal('#workout-pace');
        if(pace) desc += `Pace: ${pace}`;
        
        const obs = getVal('#workout-observacoes');
        if(obs) desc += `\n\nObs: ${obs}`;

        const data = {
            date: date,
            title: title,
            description: desc,
            status: 'planejado',
            createdBy: AdminPanel.state.currentUser.uid,
            createdAt: new Date().toISOString()
        };

        AdminPanel.state.db.ref(`data/${uid}/workouts`).push(data).then(function() {
            alert("Treino salvo!");
            f.querySelector('#workout-title').value = "";
            f.querySelector('#workout-observacoes').value = "";
        });
    },
    
    loadHistory: function(uid) {
        const div = AdminPanel.elements.iaHistoryList;
        if (!div) return;
        AdminPanel.state.db.ref(`iaAnalysisHistory/${uid}`).limitToLast(5).on('value', function(s) {
            div.innerHTML = "";
            if (!s.exists()) { div.innerHTML = "<p>Sem histórico.</p>"; return; }
            const list = []; 
            s.forEach(function(c) { list.push(c.val()); }); 
            list.reverse();
            list.forEach(function(h) {
                div.innerHTML += `<div style="padding:8px; border-bottom:1px solid #eee; background:#f9f9f9; margin-bottom:5px;"><b>${new Date(h.date).toLocaleDateString()}</b><br><small>${(h.text||"").substring(0,100)}...</small></div>`;
            });
        });
    },

    loadPending: function() {
        const div = AdminPanel.elements.pendingList;
        if (!div) return;
        AdminPanel.state.db.ref('pendingApprovals').on('value', function(s) {
            div.innerHTML = "";
            if (!s.exists()) { div.innerHTML = "Nenhuma pendência."; return; }
            s.forEach(function(c) {
                const row = document.createElement('div'); row.className = 'pending-item';
                const v = c.val() || {};
                row.innerHTML = `<span>${v.name||"Anon"}</span> <button class="btn btn-success btn-small">OK</button>`;
                row.querySelector('button').onclick = function() {
                    const u = {}; 
                    u[`/users/${c.key}`] = {name:v.name, email:v.email, role:'atleta', createdAt:new Date().toISOString()}; 
                    u[`/data/${c.key}`] = {workouts:{}}; 
                    u[`/pendingApprovals/${c.key}`] = null;
                    AdminPanel.state.db.ref().update(u);
                };
                div.appendChild(row);
            });
        });
    },
    
    deleteAthlete: function() {
        const uid = AdminPanel.state.selectedAthleteId;
        if (uid && confirm("Apagar atleta?")) {
            const u = {}; 
            u[`/users/${uid}`] = null; 
            u[`/data/${uid}`] = null;
            AdminPanel.state.db.ref().update(u);
            AdminPanel.elements.details.classList.add('hidden');
        }
    },

    runIA: async function() {
        const uid = AdminPanel.state.selectedAthleteId;
        const output = document.getElementById('ia-analysis-output');
        document.getElementById('ia-analysis-modal').classList.remove('hidden');
        output.textContent = "Analisando...";
        try {
            const snap = await AdminPanel.state.db.ref(`data/${uid}/workouts`).limitToLast(15).once('value');
            const res = await AppPrincipal.callGeminiTextAPI(`Analise: ${JSON.stringify(snap.val())}`);
            output.textContent = res;
            AppPrincipal.state.currentAnalysisData = { date: new Date().toISOString(), text: res, coachId: AdminPanel.state.currentUser.uid };
            document.getElementById('save-ia-analysis-btn').classList.remove('hidden');
        } catch(e) { output.textContent = e.message; }
    }
};

// ===================================================================
// 2. ATLETA PANEL (COMPLETO - COM MAPAS E SPLITS)
// ===================================================================
const AtletaPanel = {
    init: function(user, db) {
        const list = document.getElementById('atleta-workouts-list');
        if (document.getElementById('atleta-welcome-name')) document.getElementById('atleta-welcome-name').textContent = AppPrincipal.state.userData.name;
        
        const btn = document.getElementById('log-manual-activity-btn');
        if(btn) btn.onclick = function() { document.getElementById('log-activity-modal').classList.remove('hidden'); };

        if (!list) return;

        db.ref(`data/${user.uid}/workouts`).orderByChild('date').limitToLast(50).on('value', function(snap) {
            list.innerHTML = ""; 
            if (!snap.exists()) { list.innerHTML = "<p>Sem treinos.</p>"; return; }
            
            const arr = []; 
            snap.forEach(function(c) { arr.push({key:c.key, ...c.val()}); });
            arr.sort(function(a,b) { return new Date(b.date||0) - new Date(a.date||0); });

            arr.forEach(function(w) {
                try {
                    const card = document.createElement('div'); card.className = 'workout-card';
                    card.style.borderLeft = w.status === 'realizado' ? '5px solid #28a745' : '5px solid #ccc';
                    
                    let extra = "";
                    if (w.stravaData) {
                        let link = "";
                        if(w.stravaData.mapLink) link = `<a href="${w.stravaData.mapLink}" target="_blank" style="color:#fc4c02; font-weight:bold;">🗺️ Ver Mapa</a>`;
                        else if(w.stravaActivityId) link = `<a href="https://www.strava.com/activities/${w.stravaActivityId}" target="_blank" style="color:#fc4c02; font-weight:bold;">🗺️ Ver Mapa</a>`;
                        
                        extra = `<div style="color:#e65100; font-size:0.8rem; margin-top:5px;"><b>Strava:</b> ${w.stravaData.distancia} | ${w.stravaData.ritmo} ${link}</div>`;
                    }

                    const dStr = w.date ? new Date(w.date).toLocaleDateString('pt-BR') : "--";
                    
                    card.innerHTML = `
                        <div style="display:flex; justify-content:space-between;"><b>${dStr}</b><span class="status-tag ${w.status}">${w.status}</span></div>
                        <div style="font-weight:bold;">${w.title}</div>
                        <div style="font-size:0.9rem; color:#666;">${(w.description||"").substring(0,100)}...</div>${extra}
                        <div style="text-align:right; margin-top:10px;"><button class="btn btn-primary btn-small">Ver</button></div>`;
                    
                    card.onclick = function(e) {
                         if (!e.target.closest('a')) AppPrincipal.openFeedbackModal(w.key, user.uid, w.title);
                    };
                    list.appendChild(card);
                } catch(e) { console.error("Erro Atleta:", e); }
            });
        });
    }
};

// ===================================================================
// 3. FEED PANEL (COMPLETO)
// ===================================================================
const FeedPanel = {
    init: function(user, db) {
        const list = document.getElementById('feed-list');
        if (!list) return;
        db.ref('publicWorkouts').limitToLast(30).on('value', function(snap) {
            list.innerHTML = ""; 
            if (!snap.exists()) { list.innerHTML = "<p>Vazio.</p>"; return; }
            
            const arr = []; 
            snap.forEach(function(c) { arr.push({key:c.key, ...c.val()}); });
            arr.reverse();

            arr.forEach(function(w) {
                try {
                    const card = document.createElement('div'); card.className = 'workout-card';
                    let icon = w.stravaData ? "<i class='bx bxl-strava' style='color:#fc4c02'></i>" : "";
                    let mapL = "";
                    if (w.stravaData && w.stravaData.mapLink) mapL = `<a href="${w.stravaData.mapLink}" target="_blank" style="font-size:0.7rem; color:#fc4c02;">[Mapa]</a>`;

                    const owner = w.ownerName || "Atleta";
                    const date = w.date ? new Date(w.date).toLocaleDateString() : "--";

                    card.innerHTML = `
                        <div style="display:flex; gap:10px; align-items:center; margin-bottom:5px;">
                            <div style="width:30px; height:30px; background:#ccc; border-radius:50%; display:flex; justify-content:center; align-items:center;">${owner.charAt(0)}</div>
                            <div><b>${owner}</b> <small style="color:#777;">${date} ${icon} ${mapL}</small></div>
                        </div>
                        <div><b>${w.title||"Treino"}</b></div>
                        <div style="font-size:0.9rem; margin-top:5px;">${w.feedback||w.description||""}</div>`;
                    
                    card.onclick = function(e) {
                        if (!e.target.closest('a')) AppPrincipal.openFeedbackModal(w.key, w.ownerId, w.title);
                    };
                    list.appendChild(card);
                } catch(e) { console.error("Erro Feed:", e); }
            });
        });
    }
};

// ===================================================================
// 4. FINANCE PANEL (CORRIGIDO E ISOLADO)
// ===================================================================
const FinancePanel = {
    state: { items: [] },
    init: function(user, db) {
        console.log("FinancePanel V13: Init");
        FinancePanel.state.db = db;
        FinancePanel.state.user = user;
        FinancePanel.switchTab('receber');
        
        // Listener de Saldo
        db.ref(`finance`).on('value', function(s) {
            let rec=0, exp=0;
            if (s.exists()) {
                const d = s.val();
                if (d.receivables) Object.values(d.receivables).forEach(function(r) { rec += parseFloat(r.amount||0); });
                if (d.expenses) Object.values(d.expenses).forEach(function(e) { exp += parseFloat(e.amount||0); });
            }
            const elRec = document.getElementById('fin-total-recebido');
            const elExp = document.getElementById('fin-total-pago');
            const elSal = document.getElementById('fin-saldo');
            if(elRec) elRec.textContent = `R$ ${rec.toFixed(2)}`;
            if(elExp) elExp.textContent = `R$ ${exp.toFixed(2)}`;
            if(elSal) elSal.textContent = `R$ ${(rec-exp).toFixed(2)}`;
        });
        
        // BIND SEGURO DO FORMULÁRIO
        const form = document.getElementById('finance-form');
        if (form) {
            const newForm = form.cloneNode(true);
            form.parentNode.replaceChild(newForm, form);
            newForm.addEventListener('submit', FinancePanel.handleSaveTransaction);
        }
    },

    switchTab: function(tab) {
        const div = document.getElementById('fin-content-area');
        if (!div) return;
        div.innerHTML = ""; 
        
        const controls = document.createElement('div');
        controls.style.marginBottom = "15px";
        const btn = document.createElement('button');
        btn.className = "btn btn-primary";
        
        if (tab === 'estoque') btn.textContent = "+ Novo Produto";
        else if (tab === 'receber') btn.textContent = "+ Nova Receita";
        else btn.textContent = "+ Nova Despesa";
        
        btn.onclick = function() { FinancePanel.openModal(tab); };
        controls.appendChild(btn);
        div.appendChild(controls);
        
        const listDiv = document.createElement('div');
        listDiv.id = "fin-list";
        div.appendChild(listDiv);
        
        const refPath = tab === 'estoque' ? 'stock' : `finance/${tab === 'receber' ? 'receivables' : 'expenses'}`;
        const ref = FinancePanel.state.db.ref(refPath);
        
        ref.on('value', function(s) {
            listDiv.innerHTML = "";
            if (!s.exists()) { listDiv.innerHTML = "<p style='color:#777;'>Nenhum registro.</p>"; return; }
            
            s.forEach(function(c) {
                const i = c.val();
                const itemDiv = document.createElement('div');
                itemDiv.style.background = "white";
                itemDiv.style.padding = "12px";
                itemDiv.style.border = "1px solid #eee";
                itemDiv.style.marginBottom = "8px";
                itemDiv.style.borderRadius = "6px";
                itemDiv.style.display = "flex";
                itemDiv.style.justifyContent = "space-between";
                itemDiv.style.alignItems = "center";
                
                const val = parseFloat(i.amount || i.price || 0).toFixed(2);
                let detail = "";
                if (i.date) detail = new Date(i.date).toLocaleDateString();
                else if (i.quantity !== undefined) detail = `Qtd: ${i.quantity}`;
                
                let color = "#333";
                if (tab === 'receber') color = "var(--success-color)";
                if (tab === 'pagar') color = "var(--danger-color)";

                itemDiv.innerHTML = `
                    <div>
                        <div style="font-weight:bold;">${i.description || i.name}</div>
                        <div style="font-size:0.8rem; color:#777;">${detail}</div>
                    </div>
                    <div style="text-align:right;">
                        <div style="font-weight:bold; color:${color};">R$ ${val}</div>
                        <button class="btn-del-fin" style="color:red; border:none; background:none; cursor:pointer; font-size:1.2rem; margin-top:5px;">&times;</button>
                    </div>
                `;
                
                itemDiv.querySelector('.btn-del-fin').onclick = function() {
                    FinancePanel.deleteItem(refPath, c.key);
                };
                listDiv.appendChild(itemDiv);
            });
        });
    },

    deleteItem: function(path, key) {
        if (confirm("Excluir?")) {
            FinancePanel.state.db.ref(`${path}/${key}`).remove();
        }
    },

    openModal: function(type) {
        const modal = document.getElementById('finance-modal');
        if (!modal) return;
        modal.classList.remove('hidden');
        
        const typeInput = document.getElementById('fin-type');
        if (typeInput) typeInput.value = type;
        
        const title = document.getElementById('finance-modal-title');
        const stockArea = document.getElementById('fin-stock-area');
        const athleteGroup = document.getElementById('fin-athlete-group');
        const dateGroup = document.getElementById('fin-date-group');
        
        // Reset
        if (stockArea) stockArea.classList.add('hidden');
        if (athleteGroup) athleteGroup.classList.add('hidden');
        if (dateGroup) dateGroup.classList.remove('hidden');
        
        if (type === 'estoque') {
            title.textContent = "Novo Produto";
            if (dateGroup) dateGroup.classList.add('hidden');
            if (athleteGroup) athleteGroup.classList.add('hidden');
            if (stockArea) {
                stockArea.classList.remove('hidden');
                const prodSel = document.getElementById('fin-product-select');
                if (prodSel) prodSel.parentElement.classList.add('hidden');
            }
        } else if (type === 'receber') {
            title.textContent = "Nova Receita";
            if (stockArea) stockArea.classList.remove('hidden');
            if (athleteGroup) athleteGroup.classList.remove('hidden');
            
            const sel = document.getElementById('fin-product-select');
            if (sel) {
                sel.parentElement.classList.remove('hidden');
                sel.innerHTML = "<option value=''>Mensalidade (Sem produto)</option>";
                FinancePanel.state.db.ref('stock').once('value', function(s) {
                    s.forEach(function(c) {
                         const opt = document.createElement('option');
                         opt.value = c.key;
                         opt.text = `${c.val().name} (Estoque: ${c.val().quantity})`;
                         sel.appendChild(opt);
                    });
                });
            }
            
            const athSel = document.getElementById('fin-athlete-select');
            if (athSel) {
                athSel.innerHTML = "<option value=''>Avulso</option>";
                FinancePanel.state.db.ref('users').once('value', function(s) {
                    s.forEach(function(c) { 
                        if (c.val().role !== 'admin') {
                            const opt = document.createElement('option');
                            opt.value = c.key;
                            opt.text = c.val().name;
                            athSel.appendChild(opt);
                        }
                    });
                });
            }
        } else {
            title.textContent = "Nova Despesa";
            if (stockArea) stockArea.classList.add('hidden');
            if (athleteGroup) athleteGroup.classList.add('hidden');
        }
    },

    handleSaveTransaction: function(e) {
        e.preventDefault();
        const type = document.getElementById('fin-type').value;
        const desc = document.getElementById('fin-desc').value;
        const val = parseFloat(document.getElementById('fin-value').value);
        const date = document.getElementById('fin-date').value;
        
        if (type === 'estoque') {
            const qty = parseFloat(document.getElementById('fin-qty').value || 0);
            FinancePanel.state.db.ref('stock').push({ name: desc, price: val, quantity: qty });
        } else {
            const prodId = document.getElementById('fin-product-select').value;
            const qty = parseFloat(document.getElementById('fin-qty').value || 0);
            
            if (type === 'receber' && prodId) {
                FinancePanel.state.db.ref(`stock/${prodId}/quantity`).transaction(function(q) { return (q || 0) - qty; });
            }
            
            const path = type === 'receber' ? 'receivables' : 'expenses';
            FinancePanel.state.db.ref(`finance/${path}`).push({
                description: desc, amount: val, date: date, 
                athleteId: document.getElementById('fin-athlete-select').value || null
            });
        }
        document.getElementById('finance-modal').classList.add('hidden');
        e.target.reset();
        
        const prodSel = document.getElementById('fin-product-select');
        if (prodSel) prodSel.parentElement.classList.remove('hidden');
        const dateGroup = document.getElementById('fin-date-group');
        if (dateGroup) dateGroup.classList.remove('hidden');
    }
};

window.panels = { init: function() {}, cleanup: function() { if(AdminPanel.state.db) AdminPanel.state.db.ref().off(); } };