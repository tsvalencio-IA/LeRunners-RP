/* =================================================================== */
/* PANELS.JS V7.0 - MONOLITO COMPLETO (TREINO + FINANCEIRO + FEED)
/* ESTRUTURA: AdminPanel, AtletaPanel, FeedPanel, FinancePanel
/* LÓGICA: Renderização Segura (V2) com Blindagem de Erros
/* =================================================================== */

const panels = {};

// ===================================================================
// 1. ADMIN PANEL (PAINEL DO TREINADOR)
// ===================================================================
const AdminPanel = {
    state: { selectedAthleteId: null, athletes: {} },
    elements: {},

    init: (user, db) => {
        console.log("AdminPanel V7.0: Iniciado.");
        AdminPanel.state.db = db;
        AdminPanel.state.currentUser = user;

        // Mapeamento Seguro
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

        // Listeners
        if(AdminPanel.elements.search) AdminPanel.elements.search.oninput = (e) => AdminPanel.renderList(e.target.value);
        
        if(AdminPanel.elements.form) {
            const newForm = AdminPanel.elements.form.cloneNode(true);
            AdminPanel.elements.form.parentNode.replaceChild(newForm, AdminPanel.elements.form);
            AdminPanel.elements.form = newForm;
            AdminPanel.elements.form.addEventListener('submit', AdminPanel.handleAddWorkout);
        }

        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.onclick = () => {
                document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
                document.querySelectorAll('.admin-tab-content').forEach(c => c.classList.remove('active'));
                btn.classList.add('active');
                const target = document.getElementById(`admin-tab-${btn.dataset.tab}`);
                if(target) target.classList.add('active');
            };
        });
        
        const btnDelete = document.getElementById('delete-athlete-btn');
        if(btnDelete) btnDelete.onclick = AdminPanel.deleteAthlete;
        
        const btnAnalyze = document.getElementById('analyze-athlete-btn-ia');
        if(btnAnalyze) btnAnalyze.onclick = AdminPanel.runIA;

        AdminPanel.loadAthletes();
        AdminPanel.loadPending();
    },

    loadAthletes: () => {
        if(!AdminPanel.state.db) return;
        AdminPanel.state.db.ref('users').orderByChild('name').on('value', snap => {
            AdminPanel.state.athletes = snap.val() || {};
            AdminPanel.renderList();
        });
    },

    renderList: (filter = "") => {
        const div = AdminPanel.elements.list;
        if(!div) return;
        div.innerHTML = "";
        
        Object.entries(AdminPanel.state.athletes).forEach(([uid, data]) => {
            if (!data || data.role === 'admin') return;
            const name = data.name || "Sem Nome";
            if (filter && !name.toLowerCase().includes(filter.toLowerCase())) return;

            const row = document.createElement('div');
            row.className = 'athlete-list-item';
            if(uid === AdminPanel.state.selectedAthleteId) row.classList.add('selected');
            
            row.innerHTML = `<span>${name}</span>`;
            row.onclick = () => AdminPanel.selectAthlete(uid, name);
            div.appendChild(row);
        });
    },

    selectAthlete: (uid, name) => {
        AdminPanel.state.selectedAthleteId = uid;
        if(AdminPanel.elements.name) AdminPanel.elements.name.textContent = name;
        if(AdminPanel.elements.details) AdminPanel.elements.details.classList.remove('hidden');
        AdminPanel.renderList(); 
        AdminPanel.loadWorkouts(uid);
        AdminPanel.loadHistory(uid);
    },

    // --- CARREGAMENTO BLINDADO (V2 Style) ---
    loadWorkouts: (uid) => {
        const div = AdminPanel.elements.workouts;
        if(!div) return;
        div.innerHTML = "<p>Carregando...</p>";
        
        AdminPanel.state.db.ref(`data/${uid}/workouts`).orderByChild('date').limitToLast(100).on('value', snap => {
            div.innerHTML = "";
            if(!snap.exists()) { div.innerHTML = "<p>Nenhum treino.</p>"; return; }

            const list = [];
            snap.forEach(c => list.push({key:c.key, ...c.val()}));
            list.sort((a,b) => new Date(b.date||0) - new Date(a.date||0));

            list.forEach(w => {
                try {
                    const card = document.createElement('div');
                    card.className = 'workout-card';
                    
                    let border = "5px solid #ccc";
                    const status = w.status || "planejado";
                    if(status === 'realizado') border = "5px solid #28a745";
                    else if(status === 'nao_realizado') border = "5px solid #dc3545";
                    card.style.borderLeft = border;

                    const dStr = w.date ? new Date(w.date).toLocaleDateString('pt-BR') : "--";
                    
                    // HTML BASE
                    let html = `
                        <div style="display:flex; justify-content:space-between; margin-bottom:5px;">
                            <strong>${dStr}</strong>
                            <span class="status-tag ${status}">${status}</span>
                        </div>
                        <div style="font-weight:bold; font-size:1.1rem;">${w.title || "Treino"}</div>
                        <div style="white-space:pre-wrap; font-size:0.9rem; color:#555; margin:5px 0;">${w.description || ""}</div>
                    `;

                    // DADOS STRAVA (Mapa e Splits)
                    if(w.stravaData) {
                        let link = "";
                        if(w.stravaData.mapLink) link = `<a href="${w.stravaData.mapLink}" target="_blank" style="color:#fc4c02; font-weight:bold;">🗺️ Ver Mapa</a>`;
                        else if(w.stravaActivityId) link = `<a href="https://www.strava.com/activities/${w.stravaActivityId}" target="_blank" style="color:#fc4c02; font-weight:bold;">🗺️ Ver Mapa</a>`;

                        html += `
                            <div style="margin-top:10px; border-top:1px solid #eee; padding-top:5px;">
                                <div style="color:#fc4c02; font-size:0.8rem; font-weight:bold; display:flex; justify-content:space-between;">
                                    <span><i class='bx bxl-strava'></i> Strava</span> ${link}
                                </div>
                                <div style="display:grid; grid-template-columns:1fr 1fr 1fr; background:#fff5eb; padding:5px; text-align:center; font-size:0.8rem; margin-top:5px;">
                                    <div><strong>Dist</strong><br>${w.stravaData.distancia||"-"}</div>
                                    <div><strong>Tempo</strong><br>${w.stravaData.tempo||"-"}</div>
                                    <div><strong>Pace</strong><br>${w.stravaData.ritmo||"-"}</div>
                                </div>
                            </div>`;
                            
                        if(w.stravaData.splits && Array.isArray(w.stravaData.splits)) {
                            let rows = "";
                            w.stravaData.splits.forEach(s => rows += `<tr><td>${s.km}</td><td>${s.pace}</td><td>${s.elev}m</td></tr>`);
                            html += `<details style="margin-top:5px; font-size:0.8rem;"><summary>Ver Parciais</summary><table style="width:100%; text-align:center; margin-top:5px;"><tr><th>Km</th><th>Pace</th><th>Elev</th></tr>${rows}</table></details>`;
                        }
                    }

                    // Botão Excluir
                    html += `<div style="text-align:right; margin-top:10px; border-top:1px dashed #ddd;"><button class="btn-del btn btn-danger btn-small" style="font-size:0.7rem; margin-top:5px;">Excluir</button></div>`;
                    
                    card.innerHTML = html;

                    // Listeners Seguros
                    card.addEventListener('click', (e) => {
                        if(!e.target.closest('button') && !e.target.closest('a') && !e.target.closest('details')) {
                            AppPrincipal.openFeedbackModal(w.key, uid, w.title);
                        }
                    });

                    const btnDel = card.querySelector('.btn-del');
                    if(btnDel) btnDel.onclick = (e) => {
                        e.stopPropagation();
                        if(confirm("Apagar treino?")) {
                            const u={}; u[`/data/${uid}/workouts/${w.key}`]=null; u[`/publicWorkouts/${w.key}`]=null;
                            AdminPanel.state.db.ref().update(u);
                        }
                    };

                    div.appendChild(card);
                } catch(e) { console.error("Erro Card:", e); }
            });
        });
    },

    // Formulário Detalhado (V17)
    handleAddWorkout: (e) => {
        e.preventDefault();
        const uid = AdminPanel.state.selectedAthleteId;
        if(!uid) return alert("Selecione um atleta.");
        const f = e.target;
        const getVal = (id) => f.querySelector(id) ? f.querySelector(id).value : "";
        
        const date = getVal('#workout-date');
        const title = getVal('#workout-title');
        if(!date || !title) return alert("Campos obrigatórios vazios.");

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
            date: date, title: title, description: desc,
            status: 'planejado', createdBy: AdminPanel.state.currentUser.uid, createdAt: new Date().toISOString()
        };

        AdminPanel.state.db.ref(`data/${uid}/workouts`).push(data).then(() => {
            alert("Salvo!");
            f.querySelector('#workout-title').value="";
            f.querySelector('#workout-observacoes').value="";
        });
    },

    loadHistory: (uid) => {
        const div = AdminPanel.elements.iaHistoryList;
        if(!div) return;
        AdminPanel.state.db.ref(`iaAnalysisHistory/${uid}`).limitToLast(5).on('value', s => {
            div.innerHTML = "";
            if(!s.exists()) { div.innerHTML = "<p>Sem histórico.</p>"; return; }
            const l=[]; s.forEach(c=>l.push(c.val())); l.reverse();
            l.forEach(h => div.innerHTML += `<div style="padding:5px; border-bottom:1px solid #eee;"><b>${new Date(h.date).toLocaleDateString()}</b><br><small>${(h.text||"").substring(0,100)}...</small></div>`);
        });
    },

    loadPending: () => {
        const div = AdminPanel.elements.pendingList;
        if(!div) return;
        AdminPanel.state.db.ref('pendingApprovals').on('value', s => {
            div.innerHTML = "";
            if(!s.exists()) { div.innerHTML = "Nada."; return; }
            s.forEach(c => {
                const r = document.createElement('div'); r.className = 'pending-item';
                const v = c.val()||{};
                r.innerHTML = `<span>${v.name||"Anon"}</span> <button class="btn btn-success btn-small">OK</button>`;
                r.querySelector('button').onclick = () => {
                    const u={}; u[`/users/${c.key}`]={name:v.name,email:v.email,role:'atleta',createdAt:new Date().toISOString()}; u[`/data/${c.key}`]={workouts:{}}; u[`/pendingApprovals/${c.key}`]=null;
                    AdminPanel.state.db.ref().update(u);
                };
                div.appendChild(r);
            });
        });
    },

    deleteAthlete: () => {
        const uid = AdminPanel.state.selectedAthleteId;
        if(uid && confirm("Apagar tudo?")) {
            const u={}; u[`/users/${uid}`]=null; u[`/data/${uid}`]=null;
            AdminPanel.state.db.ref().update(u);
            AdminPanel.elements.details.classList.add('hidden');
        }
    },

    runIA: async () => {
        const uid = AdminPanel.state.selectedAthleteId;
        const out = document.getElementById('ia-analysis-output');
        document.getElementById('ia-analysis-modal').classList.remove('hidden');
        out.textContent = "Analisando...";
        try {
            const snap = await AdminPanel.state.db.ref(`data/${uid}/workouts`).limitToLast(15).once('value');
            const res = await AppPrincipal.callGeminiTextAPI(`Analise: ${JSON.stringify(snap.val())}`);
            out.textContent = res;
            AppPrincipal.state.currentAnalysisData = { date: new Date().toISOString(), text: res, coachId: AdminPanel.state.currentUser.uid };
            document.getElementById('save-ia-analysis-btn').classList.remove('hidden');
        } catch(e) { out.textContent = e.message; }
    }
};

// ===================================================================
// 2. ATLETA PANEL
// ===================================================================
const AtletaPanel = {
    init: (user, db) => {
        const list = document.getElementById('atleta-workouts-list');
        if(document.getElementById('atleta-welcome-name')) document.getElementById('atleta-welcome-name').textContent = AppPrincipal.state.userData.name;
        document.getElementById('log-manual-activity-btn').onclick = () => document.getElementById('log-activity-modal').classList.remove('hidden');
        if(!list) return;
        
        db.ref(`data/${user.uid}/workouts`).orderByChild('date').limitToLast(50).on('value', snap => {
            list.innerHTML = "";
            if(!snap.exists()) { list.innerHTML = "<p>Sem treinos.</p>"; return; }
            
            const arr = []; snap.forEach(c => arr.push({key:c.key, ...c.val()}));
            arr.sort((a,b) => new Date(b.date||0) - new Date(a.date||0));

            arr.forEach(w => {
                try {
                    const card = document.createElement('div'); card.className = 'workout-card';
                    card.style.borderLeft = w.status === 'realizado' ? '5px solid #28a745' : '5px solid #ccc';
                    
                    let extra = "";
                    if(w.stravaData) {
                        let link = w.stravaData.mapLink ? `<a href="${w.stravaData.mapLink}" target="_blank" style="color:#fc4c02;">Map</a>` : "";
                        if(!link && w.stravaActivityId) link = `<a href="https://www.strava.com/activities/${w.stravaActivityId}" target="_blank" style="color:#fc4c02;">Map</a>`;
                        extra = `<div style="color:#e65100; font-size:0.8rem; margin-top:5px;"><b>Strava:</b> ${w.stravaData.distancia} ${link}</div>`;
                    }

                    card.innerHTML = `
                        <div style="display:flex; justify-content:space-between;">
                            <b>${new Date(w.date).toLocaleDateString('pt-BR')}</b>
                            <span class="status-tag ${w.status}">${w.status}</span>
                        </div>
                        <div style="font-weight:bold; margin:5px 0;">${w.title}</div>
                        <div style="font-size:0.9rem; color:#666;">${(w.description||"").substring(0,100)}...</div>
                        ${extra}
                        <div style="text-align:right; margin-top:10px;"><button class="btn btn-primary btn-small">Ver</button></div>`;
                    
                    card.onclick = (e) => { if(!e.target.closest('a')) AppPrincipal.openFeedbackModal(w.key, user.uid, w.title); };
                    list.appendChild(card);
                } catch(e) { console.error("Erro Atleta:", e); }
            });
        });
    }
};

// ===================================================================
// 3. FEED PANEL
// ===================================================================
const FeedPanel = {
    init: (user, db) => {
        const list = document.getElementById('feed-list');
        if(!list) return;
        db.ref('publicWorkouts').limitToLast(30).on('value', snap => {
            list.innerHTML = ""; if(!snap.exists()) return;
            const arr=[]; snap.forEach(c=>arr.push({key:c.key, ...c.val()})); arr.reverse();
            
            arr.forEach(w => {
                try {
                    const card = document.createElement('div'); card.className = 'workout-card';
                    let icon = w.stravaData ? "<i class='bx bxl-strava' style='color:#fc4c02'></i>" : "";
                    
                    card.innerHTML = `
                        <div style="display:flex; gap:10px; align-items:center; margin-bottom:5px;">
                            <div style="width:30px; height:30px; background:#ccc; border-radius:50%; display:flex; justify-content:center; align-items:center;">${w.ownerName?w.ownerName[0]:"U"}</div>
                            <div><b>${w.ownerName||"Atleta"}</b> <small style="color:#777;">${new Date(w.date).toLocaleDateString()} ${icon}</small></div>
                        </div>
                        <div><b>${w.title}</b></div>
                        <div style="font-size:0.9rem;">${w.feedback||w.description||""}</div>`;
                    
                    card.onclick = (e) => { if(!e.target.closest('a')) AppPrincipal.openFeedbackModal(w.key, w.ownerId, w.title); };
                    list.appendChild(card);
                } catch(e) { console.error("Erro Feed:", e); }
            });
        });
    }
};

// ===================================================================
// 4. FINANCE PANEL (INTEGRADO E SEGURO)
// ===================================================================
const FinancePanel = {
    state: {},
    init: (user, db) => {
        console.log("FinancePanel: Init");
        FinancePanel.state.db = db;
        FinancePanel.state.user = user;
        FinancePanel.switchTab('receber');
        
        db.ref(`finance`).on('value', s => {
            let rec=0, exp=0;
            if(s.exists()) {
                const d = s.val();
                if(d.receivables) Object.values(d.receivables).forEach(r => rec += parseFloat(r.amount));
                if(d.expenses) Object.values(d.expenses).forEach(e => exp += parseFloat(e.amount));
            }
            const elR = document.getElementById('fin-total-recebido');
            const elE = document.getElementById('fin-total-pago');
            const elS = document.getElementById('fin-saldo');
            if(elR) elR.textContent = `R$ ${rec.toFixed(2)}`;
            if(elE) elE.textContent = `R$ ${exp.toFixed(2)}`;
            if(elS) elS.textContent = `R$ ${(rec-exp).toFixed(2)}`;
        });
    },

    switchTab: (tab) => {
        const div = document.getElementById('fin-content-area');
        if(!div) return;
        div.innerHTML = ""; 
        
        const btn = document.createElement('button');
        btn.className = "btn btn-primary";
        btn.style.marginBottom = "10px";
        btn.textContent = "+ Novo";
        btn.onclick = () => FinancePanel.openModal(tab);
        div.appendChild(btn);
        
        const listDiv = document.createElement('div');
        div.appendChild(listDiv);
        
        const path = tab==='estoque' ? 'stock' : `finance/${tab==='receber'?'receivables':'expenses'}`;
        const ref = FinancePanel.state.db.ref(path);
        
        ref.on('value', s => {
            listDiv.innerHTML = "";
            if(!s.exists()) { listDiv.innerHTML = "<p>Vazio.</p>"; return; }
            
            s.forEach(c => {
                const i = c.val();
                const item = document.createElement('div');
                item.style.background="white"; item.style.padding="10px"; item.style.border="1px solid #eee"; item.style.marginBottom="5px";
                
                const val = parseFloat(i.amount || i.price || 0).toFixed(2);
                const det = i.date ? new Date(i.date).toLocaleDateString() : (i.quantity + " un");
                
                item.innerHTML = `<b>${i.description||i.name}</b> - R$ ${val} <span style="color:#777; font-size:0.8rem;">${det}</span>`;
                
                const del = document.createElement('button');
                del.innerHTML = "&times;";
                del.style.float="right"; del.style.color="red"; del.style.border="none"; del.style.background="none";
                del.onclick = () => { if(confirm("Excluir?")) FinancePanel.state.db.ref(`${path}/${c.key}`).remove(); };
                
                item.appendChild(del);
                listDiv.appendChild(item);
            });
        });
    },

    openModal: (type) => {
        document.getElementById('finance-modal').classList.remove('hidden');
        document.getElementById('fin-type').value = type;
        
        const stockArea = document.getElementById('fin-stock-area');
        const athleteGrp = document.getElementById('fin-athlete-group');
        
        if(type === 'receber') {
            stockArea.classList.remove('hidden');
            athleteGrp.classList.remove('hidden');
            
            const sel = document.getElementById('fin-product-select');
            sel.innerHTML = "<option value=''>Mensalidade</option>";
            FinancePanel.state.db.ref('stock').once('value', s => {
                s.forEach(c => sel.innerHTML += `<option value="${c.key}">${c.val().name}</option>`);
            });
            
            const ath = document.getElementById('fin-athlete-select');
            ath.innerHTML = "<option value=''>Avulso</option>";
            FinancePanel.state.db.ref('users').once('value', s => {
                s.forEach(c => { if(c.val().role!=='admin') ath.innerHTML += `<option value="${c.key}">${c.val().name}</option>`; });
            });
        } else {
            stockArea.classList.add('hidden');
            athleteGrp.classList.add('hidden');
        }
    },

    handleSaveTransaction: (e) => {
        e.preventDefault();
        const type = document.getElementById('fin-type').value;
        const desc = document.getElementById('fin-desc').value;
        const val = parseFloat(document.getElementById('fin-value').value);
        const date = document.getElementById('fin-date').value;
        
        if(type === 'estoque') {
            FinancePanel.state.db.ref('stock').push({ name: desc, price: val, quantity: 0 });
        } else {
            const prod = document.getElementById('fin-product-select').value;
            const qty = document.getElementById('fin-qty').value;
            
            if(type === 'receber' && prod) {
                FinancePanel.state.db.ref(`stock/${prod}/quantity`).transaction(q => (q||0)-qty);
            }
            
            const path = type === 'receber' ? 'receivables' : 'expenses';
            FinancePanel.state.db.ref(`finance/${path}`).push({
                description: desc, amount: val, date: date,
                athleteId: document.getElementById('fin-athlete-select').value
            });
        }
        document.getElementById('finance-modal').classList.add('hidden');
        e.target.reset();
    }
};

window.panels = { init: () => {}, cleanup: () => { if(AdminPanel.state.db) AdminPanel.state.db.ref().off(); } };