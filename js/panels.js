/* =================================================================== */
/* PANELS.JS V6.0 - EXIBIÇÃO SEGURA + MAPAS + SPLITS
/* =================================================================== */

const panels = {};

// 1. ADMIN PANEL
const AdminPanel = {
    state: { selectedAthleteId: null, athletes: {} },
    elements: {},

    init: (user, db) => {
        console.log("AdminPanel V6.0: Init");
        AdminPanel.state.db = db;
        AdminPanel.state.currentUser = user;

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
        
        if(document.getElementById('delete-athlete-btn')) document.getElementById('delete-athlete-btn').onclick = AdminPanel.deleteAthlete;
        if(document.getElementById('analyze-athlete-btn-ia')) document.getElementById('analyze-athlete-btn-ia').onclick = AdminPanel.runIA;

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

    // --- LOOP BLINDADO (CreateElement) ---
    loadWorkouts: (uid) => {
        const div = AdminPanel.elements.workouts;
        if(!div) return;
        div.innerHTML = "<p>Carregando...</p>";
        
        AdminPanel.state.db.ref(`data/${uid}/workouts`).orderByChild('date').limitToLast(100).on('value', snap => {
            div.innerHTML = "";
            if(!snap.exists()) { div.innerHTML = "<p>Nenhum treino.</p>"; return; }

            const list = [];
            snap.forEach(c => list.push({key:c.key, ...c.val()}));
            
            list.sort((a,b) => {
                const da = new Date(a.date || 0);
                const db = new Date(b.date || 0);
                return db - da;
            });

            list.forEach(w => {
                try {
                    const dateStr = w.date ? new Date(w.date).toLocaleDateString('pt-BR') : "--/--";
                    const title = w.title || "Sem Título";
                    const desc = w.description || "";
                    const status = w.status || "planejado";

                    const card = document.createElement('div');
                    card.className = 'workout-card';
                    
                    let border = "5px solid #ccc";
                    if(status === 'realizado') border = "5px solid #28a745";
                    else if(status === 'nao_realizado') border = "5px solid #dc3545";
                    card.style.borderLeft = border;

                    // HTML Base
                    let html = `
                        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
                            <strong style="font-size:1.1em; color:var(--primary-color);">${dateStr}</strong>
                            <span class="status-tag ${status}">${status}</span>
                        </div>
                        <div style="font-weight:bold; font-size:1.1rem; margin-bottom:5px;">${title}</div>
                        <div style="white-space:pre-wrap; font-size:0.95rem; color:#444; background:#f9f9f9; padding:8px; border-radius:4px;">${desc}</div>
                    `;

                    // Strava Data
                    if(w.stravaData) {
                        let link = w.stravaData.mapLink ? `<a href="${w.stravaData.mapLink}" target="_blank" style="color:#fc4c02; font-weight:bold;">🗺️ Mapa</a>` : "";
                        if(!link && w.stravaActivityId) link = `<a href="https://www.strava.com/activities/${w.stravaActivityId}" target="_blank" style="color:#fc4c02; font-weight:bold;">🗺️ Mapa</a>`;
                        
                        html += `
                            <div style="margin-top:10px; border-top:1px solid #eee; padding-top:10px;">
                                <div style="color:#fc4c02; font-size:0.8rem; font-weight:bold;"><i class='bx bxl-strava'></i> Strava ${link}</div>
                                <div style="display:grid; grid-template-columns: 1fr 1fr 1fr; gap:5px; margin-top:5px; background:#fff5eb; padding:5px; text-align:center; font-size:0.9rem;">
                                    <div><small>Dist</small><br><strong>${w.stravaData.distancia||"-"}</strong></div>
                                    <div><small>Tempo</small><br><strong>${w.stravaData.tempo||"-"}</strong></div>
                                    <div><small>Pace</small><br><strong>${w.stravaData.ritmo||"-"}</strong></div>
                                </div>
                            </div>`;
                            
                        if(w.stravaData.splits) {
                            let rows = "";
                            w.stravaData.splits.forEach(s => rows += `<tr><td>${s.km}</td><td>${s.pace}</td><td>${s.elev}m</td></tr>`);
                            html += `<details style="margin-top:5px; cursor:pointer; font-size:0.8rem;"><summary>Ver Parciais</summary><table style="width:100%; text-align:center;"><tr><th>Km</th><th>Pace</th><th>Elev</th></tr>${rows}</table></details>`;
                        }
                    }
                    
                    html += `<div style="text-align:right; margin-top:10px; border-top:1px dashed #ddd;"><button class="btn-del btn btn-danger btn-small" style="font-size:0.8rem; padding:2px 5px;">Excluir</button></div>`;
                    card.innerHTML = html;
                    
                    // Eventos Seguros
                    card.addEventListener('click', (e) => { 
                        if (!e.target.closest('button') && !e.target.closest('a') && !e.target.closest('details')) AppPrincipal.openFeedbackModal(w.key, uid, title); 
                    });
                    
                    const btnDel = card.querySelector('.btn-del');
                    if(btnDel) {
                        btnDel.onclick = (ev) => {
                            ev.stopPropagation();
                            if(confirm("Apagar?")) {
                                const u={}; u[`/data/${uid}/workouts/${w.key}`]=null; u[`/publicWorkouts/${w.key}`]=null;
                                AdminPanel.state.db.ref().update(u);
                            }
                        };
                    }
                    div.appendChild(card);
                } catch(err) { console.error("Card Error:", err); }
            });
        });
    },

    handleAddWorkout: (e) => {
        e.preventDefault();
        const uid = AdminPanel.state.selectedAthleteId;
        if(!uid) return alert("Selecione um atleta.");
        const f = e.target;
        const getVal = (id) => f.querySelector(id) ? f.querySelector(id).value : "";
        const data = {
            date: getVal('#workout-date'), title: getVal('#workout-title'),
            description: `[${getVal('#workout-modalidade')}] - ${getVal('#workout-tipo-treino')}\nIntensidade: ${getVal('#workout-intensidade')}\nDist: ${getVal('#workout-distancia')}km | Tempo: ${getVal('#workout-tempo')}\nObs: ${getVal('#workout-observacoes')}`,
            status: 'planejado', createdBy: AdminPanel.state.currentUser.uid, createdAt: new Date().toISOString()
        };
        AdminPanel.state.db.ref(`data/${uid}/workouts`).push(data).then(() => {
            alert("Salvo!"); f.querySelector('#workout-title').value=""; f.querySelector('#workout-observacoes').value="";
        });
    },
    
    loadHistory: (uid) => {
        const div = AdminPanel.elements.iaHistoryList;
        if(!div) return;
        AdminPanel.state.db.ref(`iaAnalysisHistory/${uid}`).limitToLast(5).on('value', s => {
            div.innerHTML = "";
            if(!s.exists()) { div.innerHTML = "<p>Sem histórico.</p>"; return; }
            const list=[]; s.forEach(c=>list.push(c.val())); list.reverse();
            list.forEach(h => div.innerHTML += `<div style="padding:5px; border-bottom:1px solid #eee;"><b>${new Date(h.date).toLocaleDateString()}</b><br><small>${(h.text||"").substring(0,100)}...</small></div>`);
        });
    },

    loadPending: () => {
        const div = AdminPanel.elements.pendingList;
        if(!div) return;
        AdminPanel.state.db.ref('pendingApprovals').on('value', s => {
            div.innerHTML = "";
            if(!s.exists()) { div.innerHTML = "Nenhuma pendência."; return; }
            s.forEach(c => {
                const row = document.createElement('div'); row.className = 'pending-item';
                const v = c.val() || {};
                row.innerHTML = `<span>${v.name||"Anon"}</span> <button class="btn btn-success btn-small">OK</button>`;
                row.querySelector('button').onclick = () => {
                    const u={}; u[`/users/${c.key}`]={name:v.name,email:v.email,role:'atleta',createdAt:new Date().toISOString()}; u[`/data/${c.key}`]={workouts:{}}; u[`/pendingApprovals/${c.key}`]=null;
                    AdminPanel.state.db.ref().update(u);
                };
                div.appendChild(row);
            });
        });
    },

    deleteAthlete: () => {
        const uid = AdminPanel.state.selectedAthleteId;
        if(uid && confirm("Apagar atleta e dados?")) {
            const u={}; u[`/users/${uid}`]=null; u[`/data/${uid}`]=null;
            AdminPanel.state.db.ref().update(u);
            AdminPanel.elements.details.classList.add('hidden');
        }
    },

    runIA: async () => {
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

// 2. ATLETA
const AtletaPanel = {
    init: (user, db) => {
        const list = document.getElementById('atleta-workouts-list');
        if(document.getElementById('atleta-welcome-name')) document.getElementById('atleta-welcome-name').textContent = AppPrincipal.state.userData.name;
        document.getElementById('log-manual-activity-btn').onclick = () => document.getElementById('log-activity-modal').classList.remove('hidden');
        if(!list) return;
        
        db.ref(`data/${user.uid}/workouts`).orderByChild('date').limitToLast(50).on('value', snap => {
            list.innerHTML = ""; if(!snap.exists()) { list.innerHTML = "Sem treinos."; return; }
            const arr = []; snap.forEach(c => arr.push({key:c.key, ...c.val()}));
            arr.sort((a,b) => new Date(b.date||0) - new Date(a.date||0));
            
            arr.forEach(w => {
                try {
                    const card = document.createElement('div'); card.className = 'workout-card';
                    card.style.borderLeft = w.status === 'realizado' ? '5px solid #28a745' : '5px solid #ccc';
                    let extra = w.stravaData ? `<div style="color:#e65100; font-size:0.8rem; margin-top:5px;"><b>Strava:</b> ${w.stravaData.distancia} | ${w.stravaData.ritmo}</div>` : "";
                    card.innerHTML = `
                        <div style="display:flex; justify-content:space-between;"><b>${new Date(w.date).toLocaleDateString('pt-BR')}</b><span class="status-tag ${w.status}">${w.status}</span></div>
                        <div style="font-weight:bold;">${w.title}</div><div style="font-size:0.9rem; color:#666;">${w.description}</div>${extra}
                        <div style="text-align:right; margin-top:10px;"><button class="btn btn-primary btn-small">Ver</button></div>`;
                    
                    card.onclick = (e) => {
                         if(!e.target.closest('a')) AppPrincipal.openFeedbackModal(w.key, user.uid, w.title);
                    };
                    list.appendChild(card);
                } catch(e) { console.error("Erro Card Atleta", e); }
            });
        });
    }
};

// 3. FEED
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
                    let mapL = w.stravaData && w.stravaData.mapLink ? `<a href="${w.stravaData.mapLink}" target="_blank" style="font-size:0.7rem; color:#fc4c02;">[Mapa]</a>` : "";
                    
                    const owner = w.ownerName || "Atleta";
                    const date = w.date ? new Date(w.date).toLocaleDateString() : "--";

                    card.innerHTML = `
                        <div style="display:flex; gap:10px; align-items:center; margin-bottom:5px;">
                            <div style="width:30px; height:30px; background:#ccc; border-radius:50%; display:flex; justify-content:center; align-items:center;">${owner.charAt(0)}</div>
                            <div><b>${owner}</b> <small style="color:#777;">${date} ${icon} ${mapL}</small></div>
                        </div>
                        <div><b>${w.title || "Treino"}</b></div>
                        <div style="font-size:0.9rem; margin-top:5px;">${w.feedback||w.description||""}</div>`;
                    
                    card.onclick = (e) => {
                        if(!e.target.closest('a')) AppPrincipal.openFeedbackModal(w.key, w.ownerId, w.title);
                    };
                    list.appendChild(card);
                } catch(e) { console.error("Erro Feed", e); }
            });
        });
    }
};

window.panels = { init: () => {}, cleanup: () => { if(AdminPanel.state.db) AdminPanel.state.db.ref().off(); } };