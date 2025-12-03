/* =================================================================== */
/* PANELS.JS V8.0 - RESTAURAÇÃO V2 + FINANCEIRO CORRIGIDO
/* =================================================================== */

const panels = {};

// ===================================================================
// 1. ADMIN PANEL (COACH)
// ===================================================================
const AdminPanel = {
    state: { selectedAthleteId: null, athletes: {} },
    elements: {},

    init: (user, db) => {
        console.log("AdminPanel V8.0: Init");
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

        if(AdminPanel.elements.search) {
            AdminPanel.elements.search.oninput = (e) => AdminPanel.renderList(e.target.value);
        }
        
        if(AdminPanel.elements.form) {
            const newForm = AdminPanel.elements.form.cloneNode(true);
            AdminPanel.elements.form.parentNode.replaceChild(newForm, AdminPanel.elements.form);
            AdminPanel.elements.form = newForm;
            AdminPanel.elements.form.addEventListener('submit', AdminPanel.handleAddWorkout);
        }

        const tabs = document.querySelectorAll('.tab-btn');
        if(tabs) {
            tabs.forEach(btn => {
                btn.onclick = () => {
                    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
                    document.querySelectorAll('.admin-tab-content').forEach(c => c.classList.remove('active'));
                    btn.classList.add('active');
                    const target = document.getElementById(`admin-tab-${btn.dataset.tab}`);
                    if(target) target.classList.add('active');
                };
            });
        }
        
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

    // --- CARREGAMENTO DE TREINOS (RESTAURADO COMPLETO) ---
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
                    else if(status === 'realizado_parcial') border = "5px solid #ffc107";
                    card.style.borderLeft = border;

                    let html = `
                        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
                            <strong style="font-size:1.1em; color:var(--primary-color);">${dateStr}</strong>
                            <span class="status-tag ${status}">${status}</span>
                        </div>
                        <div style="font-weight:bold; font-size:1.1rem; margin-bottom:5px;">${title}</div>
                        <div style="white-space:pre-wrap; font-size:0.95rem; color:#444; background:#f9f9f9; padding:8px; border-radius:4px; border:1px solid #eee;">${desc}</div>
                    `;

                    // DADOS STRAVA COMPLETOS (RESTAURADO)
                    if(w.stravaData) {
                        let link = "";
                        // Verifica link direto ou constrói com ID
                        if(w.stravaData.mapLink) {
                            link = `<a href="${w.stravaData.mapLink}" target="_blank" style="color:#fc4c02; font-weight:bold; text-decoration:none; margin-left:auto;">🗺️ Ver Mapa</a>`;
                        } else if(w.stravaActivityId) {
                            link = `<a href="https://www.strava.com/activities/${w.stravaActivityId}" target="_blank" style="color:#fc4c02; font-weight:bold; text-decoration:none; margin-left:auto;">🗺️ Ver Mapa</a>`;
                        }

                        html += `
                            <div style="margin-top:10px; border-top:1px solid #eee; padding-top:10px;">
                                <div style="display:flex; justify-content:space-between; color:#fc4c02; font-size:0.8rem; font-weight:bold;">
                                    <span><i class='bx bxl-strava'></i> Strava Sync</span>
                                    ${link}
                                </div>
                                <div style="display:grid; grid-template-columns: 1fr 1fr 1fr; gap:5px; margin-top:5px; background:#fff5eb; padding:5px; text-align:center; font-size:0.9rem;">
                                    <div><small>Dist</small><br><strong>${w.stravaData.distancia||"-"}</strong></div>
                                    <div><small>Tempo</small><br><strong>${w.stravaData.tempo||"-"}</strong></div>
                                    <div><small>Pace</small><br><strong>${w.stravaData.ritmo||"-"}</strong></div>
                                </div>
                            </div>
                        `;
                        
                        // TABELA DE PARCIAIS (SPLITS)
                        if(w.stravaData.splits && Array.isArray(w.stravaData.splits) && w.stravaData.splits.length > 0) {
                            let rows = "";
                            w.stravaData.splits.forEach(s => {
                                rows += `<tr><td>${s.km || "-"}</td><td>${s.pace || "-"}</td><td>${s.elev || "0"}m</td></tr>`;
                            });
                            html += `
                                <details style="margin-top:5px; font-size:0.8rem; color:#666; cursor:pointer;">
                                    <summary>Ver Parciais (Km a Km)</summary>
                                    <table style="width:100%; text-align:center; margin-top:5px; border-collapse:collapse;">
                                        <thead style="background:#eee;"><tr><th>Km</th><th>Pace</th><th>Elev</th></tr></thead>
                                        <tbody>${rows}</tbody>
                                    </table>
                                </details>
                            `;
                        }
                    }

                    html += `
                        <div style="text-align:right; margin-top:10px; padding-top:5px; border-top:1px dashed #ddd;">
                            <button class="btn-del btn btn-danger btn-small" style="font-size:0.8rem; padding:2px 8px;">Excluir</button>
                        </div>
                    `;

                    card.innerHTML = html;

                    // Listeners Seguros
                    card.addEventListener('click', (e) => {
                        if(!e.target.closest('button') && !e.target.closest('a') && !e.target.closest('details')) {
                            AppPrincipal.openFeedbackModal(w.key, uid, title);
                        }
                    });

                    const delBtn = card.querySelector('.btn-del');
                    if(delBtn) {
                        delBtn.onclick = (ev) => {
                            ev.stopPropagation();
                            if(confirm("Tem certeza?")) {
                                const u={}; 
                                u[`/data/${uid}/workouts/${w.key}`]=null; 
                                u[`/publicWorkouts/${w.key}`]=null;
                                AdminPanel.state.db.ref().update(u);
                            }
                        };
                    }

                    div.appendChild(card);
                } catch (error) {
                    console.error("Erro Card:", error);
                }
            });
        });
    },

    handleAddWorkout: (e) => {
        e.preventDefault();
        const uid = AdminPanel.state.selectedAthleteId;
        if(!uid) return alert("Selecione um atleta.");
        const f = e.target;
        
        const date = f.querySelector('#workout-date').value;
        const title = f.querySelector('#workout-title').value;
        if(!date || !title) return alert("Obrigatório: Data e Título");

        const getVal = (id) => f.querySelector(id) ? f.querySelector(id).value : "";

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

        AdminPanel.state.db.ref(`data/${uid}/workouts`).push(data).then(() => {
            alert("Salvo!");
            f.querySelector('#workout-title').value = "";
            f.querySelector('#workout-observacoes').value = "";
        });
    },

    loadHistory: (uid) => {
        const div = AdminPanel.elements.iaHistoryList;
        if(!div) return;
        AdminPanel.state.db.ref(`iaAnalysisHistory/${uid}`).limitToLast(5).on('value', s => {
            div.innerHTML = "";
            if(!s.exists()) { div.innerHTML = "<p>Sem histórico.</p>"; return; }
            const list=[]; s.forEach(c=>list.push(c.val())); list.reverse();
            list.forEach(h => {
                div.innerHTML += `<div style="padding:8px; border-bottom:1px solid #eee; background:#f9f9f9; margin-bottom:5px;"><b>${new Date(h.date).toLocaleDateString()}</b><br><small>${(h.text||"").substring(0,100)}...</small></div>`;
            });
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
        if(uid && confirm("Apagar?")) {
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
// 2. ATLETA PANEL (COM MAPAS E SPLITS)
// ===================================================================
const AtletaPanel = {
    init: (user, db) => {
        const list = document.getElementById('atleta-workouts-list');
        const welcome = document.getElementById('atleta-welcome-name');
        if(welcome && AppPrincipal.state.userData) welcome.textContent = AppPrincipal.state.userData.name;
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
                        let link = w.stravaData.mapLink ? `<a href="${w.stravaData.mapLink}" target="_blank" style="color:#fc4c02; font-weight:bold; text-decoration:none;">🗺️ Ver Mapa</a>` : "";
                        if(!link && w.stravaActivityId) link = `<a href="https://www.strava.com/activities/${w.stravaActivityId}" target="_blank" style="color:#fc4c02; font-weight:bold; text-decoration:none;">🗺️ Ver Mapa</a>`;
                        
                        extra = `<div style="color:#e65100; font-size:0.8rem; margin-top:5px;"><b>Strava:</b> ${w.stravaData.distancia} | ${w.stravaData.ritmo} ${link}</div>`;
                    }

                    card.innerHTML = `
                        <div style="display:flex; justify-content:space-between;"><b>${new Date(w.date).toLocaleDateString('pt-BR')}</b><span class="status-tag ${w.status}">${w.status}</span></div>
                        <div style="font-weight:bold; margin:5px 0;">${w.title}</div>
                        <div style="font-size:0.9rem; color:#666;">${(w.description||"").substring(0,100)}...</div>
                        ${extra}
                        <div style="text-align:right; margin-top:10px;"><button class="btn btn-primary btn-small">Ver</button></div>`;
                    
                    card.onclick = (e) => {
                         if(!e.target.closest('a')) AppPrincipal.openFeedbackModal(w.key, user.uid, w.title);
                    };
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
                    let mapL = w.stravaData && w.stravaData.mapLink ? `<a href="${w.stravaData.mapLink}" target="_blank" style="font-size:0.7rem; color:#fc4c02;">[Mapa]</a>` : "";
                    
                    card.innerHTML = `
                        <div style="display:flex; gap:10px; align-items:center; margin-bottom:5px;">
                            <div style="width:30px; height:30px; background:#ccc; border-radius:50%; display:flex; justify-content:center; align-items:center;">${w.ownerName?w.ownerName[0]:"?"}</div>
                            <div><b>${w.ownerName||"Atleta"}</b> <small style="color:#777;">${new Date(w.date).toLocaleDateString()} ${icon} ${mapL}</small></div>
                        </div>
                        <div><b>${w.title||"Treino"}</b></div>
                        <div style="font-size:0.9rem;">${w.feedback||w.description||""}</div>`;
                    
                    card.onclick = (e) => { if(!e.target.closest('a')) AppPrincipal.openFeedbackModal(w.key, w.ownerId, w.title); };
                    list.appendChild(card);
                } catch(e) { console.error("Erro Feed:", e); }
            });
        });
    }
};

// ===================================================================
// 4. FINANCE PANEL (CORRIGIDO)
// ===================================================================
const FinancePanel = {
    state: { items: [] },
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
            const elRec = document.getElementById('fin-total-recebido');
            const elExp = document.getElementById('fin-total-pago');
            const elSal = document.getElementById('fin-saldo');
            if(elRec) elRec.textContent = `R$ ${rec.toFixed(2)}`;
            if(elExp) elExp.textContent = `R$ ${exp.toFixed(2)}`;
            if(elSal) elSal.textContent = `R$ ${(rec-exp).toFixed(2)}`;
        });
    },

    switchTab: (tab) => {
        const div = document.getElementById('fin-content-area');
        if(!div) return;
        div.innerHTML = ""; 
        
        // Botão Novo
        const controls = document.createElement('div');
        controls.style.marginBottom = "15px";
        const btn = document.createElement('button');
        btn.className = "btn btn-primary";
        btn.textContent = tab === 'receber' ? "+ Nova Receita" : (tab === 'pagar' ? "+ Nova Despesa" : "+ Novo Produto");
        btn.onclick = () => FinancePanel.openModal(tab);
        controls.appendChild(btn);
        div.appendChild(controls);
        
        const listDiv = document.createElement('div');
        listDiv.id = "fin-list";
        div.appendChild(listDiv);
        
        const refPath = tab === 'estoque' ? 'stock' : `finance/${tab === 'receber' ? 'receivables' : 'expenses'}`;
        const ref = FinancePanel.state.db.ref(refPath);
        
        ref.on('value', s => {
            listDiv.innerHTML = "";
            if(!s.exists()) { listDiv.innerHTML = "<p style='color:#777;'>Nenhum registro encontrado.</p>"; return; }
            
            s.forEach(c => {
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
                const detail = i.date ? new Date(i.date).toLocaleDateString() : (i.quantity ? i.quantity + ' un' : '');
                
                let color = "#333";
                if(tab === 'receber') color = "var(--success-color)";
                if(tab === 'pagar') color = "var(--danger-color)";

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
                
                itemDiv.querySelector('.btn-del-fin').onclick = () => FinancePanel.deleteItem(refPath, c.key);
                listDiv.appendChild(itemDiv);
            });
        });
    },

    deleteItem: (path, key) => {
        if(confirm("Excluir?")) {
            FinancePanel.state.db.ref(`${path}/${key}`).remove();
        }
    },

    openModal: (type) => {
        const modal = document.getElementById('finance-modal');
        if(!modal) return;
        modal.classList.remove('hidden');
        
        const typeInput = document.getElementById('fin-type');
        if(typeInput) typeInput.value = type;
        
        const title = document.getElementById('finance-modal-title');
        
        // AJUSTE DO TÍTULO (CORREÇÃO)
        if (type === 'estoque') {
            title.textContent = "Novo Produto";
        } else if (type === 'receber') {
            title.textContent = "Nova Receita";
        } else {
            title.textContent = "Nova Despesa";
        }
        
        const stockArea = document.getElementById('fin-stock-area');
        const athleteGroup = document.getElementById('fin-athlete-group');
        
        // Reset
        if(stockArea) stockArea.classList.add('hidden');
        if(athleteGroup) athleteGroup.classList.add('hidden');
        
        // Lógica de exibição de campos
        if(type === 'estoque') {
            // Para estoque, não precisa de aluno ou área de movimentação, apenas Descrição (Nome) e Valor (Preço)
            // Vamos usar o campo de quantidade do stockArea? Não, o form padrão tem Desc/Valor/Data.
            // Vamos adaptar o form:
            // Para estoque, precisamos de QUANTIDADE.
            if(stockArea) {
                stockArea.classList.remove('hidden');
                // Esconde o seletor de produto, deixa só qtd
                const prodSel = document.getElementById('fin-product-select');
                if(prodSel) prodSel.parentElement.classList.add('hidden');
            }
        } else if (type === 'receber') {
            if(stockArea) {
                stockArea.classList.remove('hidden');
                const prodSel = document.getElementById('fin-product-select');
                if(prodSel) prodSel.parentElement.classList.remove('hidden');
            }
            if(athleteGroup) athleteGroup.classList.remove('hidden');
            
            const sel = document.getElementById('fin-product-select');
            if(sel) {
                sel.innerHTML = "<option value=''>Mensalidade (Sem produto)</option>";
                FinancePanel.state.db.ref('stock').once('value', s => {
                    s.forEach(c => {
                         const opt = document.createElement('option');
                         opt.value = c.key;
                         opt.text = `${c.val().name} (Estoque: ${c.val().quantity})`;
                         sel.appendChild(opt);
                    });
                });
            }
            
            const athSel = document.getElementById('fin-athlete-select');
            if(athSel) {
                athSel.innerHTML = "<option value=''>Avulso</option>";
                FinancePanel.state.db.ref('users').once('value', s => {
                    s.forEach(c => { 
                        if(c.val().role !== 'admin') {
                            const opt = document.createElement('option');
                            opt.value = c.key;
                            opt.text = c.val().name;
                            athSel.appendChild(opt);
                        }
                    });
                });
            }
        }
    },

    handleSaveTransaction: (e) => {
        e.preventDefault();
        const type = document.getElementById('fin-type').value;
        const desc = document.getElementById('fin-desc').value;
        const val = parseFloat(document.getElementById('fin-value').value);
        const date = document.getElementById('fin-date').value;
        
        if(type === 'estoque') {
            const qty = parseFloat(document.getElementById('fin-qty').value || 0);
            FinancePanel.state.db.ref('stock').push({ name: desc, price: val, quantity: qty }); 
        } else {
            const prodId = document.getElementById('fin-product-select').value;
            const qty = parseFloat(document.getElementById('fin-qty').value || 0);
            
            if(type === 'receber' && prodId) {
                FinancePanel.state.db.ref(`stock/${prodId}/quantity`).transaction(q => (q || 0) - qty);
            }
            
            const path = type === 'receber' ? 'receivables' : 'expenses';
            FinancePanel.state.db.ref(`finance/${path}`).push({
                description: desc, amount: val, date: date, 
                athleteId: document.getElementById('fin-athlete-select').value || null
            });
        }
        document.getElementById('finance-modal').classList.add('hidden');
        e.target.reset();
        
        // Restaura visibilidade padrão dos campos
        const prodSel = document.getElementById('fin-product-select');
        if(prodSel) prodSel.parentElement.classList.remove('hidden');
    }
};

window.panels = { init: () => {}, cleanup: () => { if(AdminPanel.state.db) AdminPanel.state.db.ref().off(); } };