/* =================================================================== */
/* PANELS.JS V6.0 - ARQUIVO COMPLETO (TREINOS, ALUNOS, FEED)
/* CONTÉM: Lógica V2 Restaurada + Blindagem de Erros + Splits + Mapas
/* =================================================================== */

const panels = {};

// ===================================================================
// 1. ADMIN PANEL (PAINEL DO PROFESSOR COMPLETO)
// ===================================================================
const AdminPanel = {
    state: { selectedAthleteId: null, athletes: {} },
    elements: {},

    // Inicialização Completa
    init: (user, db) => {
        console.log("AdminPanel V6.0: Carregando Módulo Completo...");
        AdminPanel.state.db = db;
        AdminPanel.state.currentUser = user;

        // Mapeamento de TODOS os elementos do DOM
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

        // Listeners de Busca
        if(AdminPanel.elements.search) {
            AdminPanel.elements.search.oninput = (e) => AdminPanel.renderList(e.target.value);
        }
        
        // Listeners do Formulário (Clonagem para segurança total contra duplicação)
        if(AdminPanel.elements.form) {
            const newForm = AdminPanel.elements.form.cloneNode(true);
            AdminPanel.elements.form.parentNode.replaceChild(newForm, AdminPanel.elements.form);
            AdminPanel.elements.form = newForm;
            AdminPanel.elements.form.addEventListener('submit', AdminPanel.handleAddWorkout);
        }

        // Listeners das Abas (Prescrever / IA)
        const tabs = document.querySelectorAll('.tab-btn');
        if(tabs) {
            tabs.forEach(btn => {
                btn.onclick = () => {
                    // Remove classe ativa de todos
                    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
                    document.querySelectorAll('.admin-tab-content').forEach(c => c.classList.remove('active'));
                    // Adiciona ao clicado
                    btn.classList.add('active');
                    const targetId = `admin-tab-${btn.dataset.tab}`;
                    const target = document.getElementById(targetId);
                    if(target) target.classList.add('active');
                };
            });
        }
        
        // Botões de Ação do Aluno
        const btnDelete = document.getElementById('delete-athlete-btn');
        if(btnDelete) btnDelete.onclick = AdminPanel.deleteAthlete;
        
        const btnAnalyze = document.getElementById('analyze-athlete-btn-ia');
        if(btnAnalyze) btnAnalyze.onclick = AdminPanel.runIA;

        // Carregamento Inicial de Dados
        AdminPanel.loadAthletes();
        AdminPanel.loadPending();
    },

    // Carrega lista de usuários do Firebase
    loadAthletes: () => {
        if(!AdminPanel.state.db) return;
        AdminPanel.state.db.ref('users').orderByChild('name').on('value', snap => {
            AdminPanel.state.athletes = snap.val() || {};
            AdminPanel.renderList();
        });
    },

    // Renderiza a lista lateral de atletas
    renderList: (filter = "") => {
        const div = AdminPanel.elements.list;
        if(!div) return;
        div.innerHTML = "";
        
        Object.entries(AdminPanel.state.athletes).forEach(([uid, data]) => {
            // Filtra Admins e Busca
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

    // Seleciona um atleta e carrega seus dados
    selectAthlete: (uid, name) => {
        AdminPanel.state.selectedAthleteId = uid;
        if(AdminPanel.elements.name) AdminPanel.elements.name.textContent = name;
        if(AdminPanel.elements.details) AdminPanel.elements.details.classList.remove('hidden');
        AdminPanel.renderList(); // Atualiza visual da seleção
        AdminPanel.loadWorkouts(uid);
        AdminPanel.loadHistory(uid);
    },

    // --- CARREGAMENTO DE TREINOS (COM BLINDAGEM E DETALHES COMPLETOS) ---
    loadWorkouts: (uid) => {
        const div = AdminPanel.elements.workouts;
        if(!div) return;
        div.innerHTML = "<p>Carregando planilha...</p>";
        
        // Busca os últimos 100 treinos para garantir histórico
        AdminPanel.state.db.ref(`data/${uid}/workouts`).orderByChild('date').limitToLast(100).on('value', snap => {
            div.innerHTML = "";
            if(!snap.exists()) { div.innerHTML = "<p>Nenhum treino agendado.</p>"; return; }

            const list = [];
            snap.forEach(c => list.push({key:c.key, ...c.val()}));
            
            // Ordena por data (mais recente primeiro)
            list.sort((a,b) => {
                const da = new Date(a.date || 0);
                const db = new Date(b.date || 0);
                return db - da;
            });

            // LOOP BLINDADO: Se um item falhar, o próximo carrega
            list.forEach(w => {
                try {
                    // Dados Básicos com Fallback para não quebrar
                    const dateStr = w.date ? new Date(w.date).toLocaleDateString('pt-BR') : "--/--";
                    const title = w.title || "Sem Título";
                    const desc = w.description || "";
                    const status = w.status || "planejado";

                    const card = document.createElement('div');
                    card.className = 'workout-card';
                    
                    // Cores de Status
                    let border = "5px solid #ccc"; // Planejado
                    if(status === 'realizado') border = "5px solid #28a745"; // Verde
                    else if(status === 'nao_realizado') border = "5px solid #dc3545"; // Vermelho
                    else if(status === 'realizado_parcial') border = "5px solid #ffc107"; // Amarelo
                    card.style.borderLeft = border;

                    // Monta HTML do Card Principal
                    let html = `
                        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
                            <strong style="font-size:1.1em; color:var(--primary-color);">${dateStr}</strong>
                            <span class="status-tag ${status}">${status}</span>
                        </div>
                        <div style="font-weight:bold; font-size:1.1rem; margin-bottom:5px;">${title}</div>
                        <div style="white-space:pre-wrap; font-size:0.95rem; color:#444; background:#f9f9f9; padding:8px; border-radius:4px; border:1px solid #eee;">${desc}</div>
                    `;

                    // Dados do Strava (Se existirem) - MAPA E SPLITS
                    if(w.stravaData) {
                        // Lógica do Link do Mapa
                        let link = "";
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
                        
                        // Tabela de Parciais (Splits) - ESSENCIAL
                        if(w.stravaData.splits && Array.isArray(w.stravaData.splits)) {
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

                    // Feedback do Atleta (Se houver)
                    if(w.feedback) {
                         html += `<div style="margin-top:8px; font-size:0.9rem; color:#333; font-style:italic; background:#e8f5e9; padding:5px; border-radius:4px;">💬 "${w.feedback}"</div>`;
                    }

                    // Botão Excluir
                    html += `
                        <div style="text-align:right; margin-top:10px; padding-top:5px; border-top:1px dashed #ddd;">
                            <button class="btn-del btn btn-danger btn-small" style="font-size:0.8rem; padding:2px 8px;">Excluir</button>
                        </div>
                    `;

                    card.innerHTML = html;

                    // Listeners do Card (Abre Modal de Detalhes)
                    card.addEventListener('click', (e) => {
                        // Evita abrir modal se clicar em links, botões ou detalhes
                        if(!e.target.closest('button') && !e.target.closest('a') && !e.target.closest('details')) {
                            AppPrincipal.openFeedbackModal(w.key, uid, title);
                        }
                    });

                    // Listener do Botão Excluir
                    const delBtn = card.querySelector('.btn-del');
                    if(delBtn) {
                        delBtn.onclick = (ev) => {
                            ev.stopPropagation();
                            if(confirm("Tem certeza que deseja apagar este treino?")) {
                                const u={}; 
                                u[`/data/${uid}/workouts/${w.key}`]=null; 
                                u[`/publicWorkouts/${w.key}`]=null;
                                AdminPanel.state.db.ref().update(u);
                            }
                        };
                    }

                    div.appendChild(card);

                } catch (error) {
                    console.error("Erro CRÍTICO ao renderizar treino:", w, error);
                    // O catch garante que o loop continue para o próximo treino
                }
            });
        });
    },

    // Salvar Treino (Formulário Detalhado V17)
    handleAddWorkout: (e) => {
        e.preventDefault();
        const uid = AdminPanel.state.selectedAthleteId;
        if(!uid) return alert("Selecione um atleta.");

        const f = e.target;
        const date = f.querySelector('#workout-date').value;
        const title = f.querySelector('#workout-title').value;
        if(!date || !title) return alert("Data e Título são obrigatórios.");

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
            alert("Treino salvo!");
            f.querySelector('#workout-title').value = "";
            f.querySelector('#workout-observacoes').value = "";
        });
    },

    // Carrega Histórico de IA
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

    // Carrega Aprovações Pendentes
    loadPending: () => {
        const div = AdminPanel.elements.pendingList;
        if(!div) return;
        AdminPanel.state.db.ref('pendingApprovals').on('value', s => {
            div.innerHTML = "";
            if(!s.exists()) { div.innerHTML = "Nenhuma pendência."; return; }
            s.forEach(c => {
                const val = c.val() || {};
                const row = document.createElement('div'); row.className = 'pending-item';
                row.innerHTML = `<span>${val.name||"Anon"}</span> <button class="btn btn-success btn-small">OK</button>`;
                row.querySelector('button').onclick = () => {
                    const u={}; u[`/users/${c.key}`]={name:val.name,email:val.email,role:'atleta',createdAt:new Date().toISOString()}; u[`/data/${c.key}`]={workouts:{}}; u[`/pendingApprovals/${c.key}`]=null;
                    AdminPanel.state.db.ref().update(u);
                };
                div.appendChild(row);
            });
        });
    },
    
    // Deleta Atleta
    deleteAthlete: () => {
        const uid = AdminPanel.state.selectedAthleteId;
        if(uid && confirm("Apagar atleta e dados?")) {
            const u={}; u[`/users/${uid}`]=null; u[`/data/${uid}`]=null;
            AdminPanel.state.db.ref().update(u);
            AdminPanel.elements.details.classList.add('hidden');
        }
    },

    // Executa IA
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

// ===================================================================
// 2. ATLETA PANEL (VISÃO DO ALUNO COMPLETA)
// ===================================================================
const AtletaPanel = {
    init: (user, db) => {
        console.log("AtletaPanel V6.0: Init");
        const list = document.getElementById('atleta-workouts-list');
        const welcome = document.getElementById('atleta-welcome-name');
        if(welcome) welcome.textContent = AppPrincipal.state.userData ? AppPrincipal.state.userData.name : "Atleta";
        
        const btnLog = document.getElementById('log-manual-activity-btn');
        if(btnLog) btnLog.onclick = () => document.getElementById('log-activity-modal').classList.remove('hidden');

        if(!list) return;

        db.ref(`data/${user.uid}/workouts`).orderByChild('date').limitToLast(50).on('value', snap => {
            list.innerHTML = "";
            if(!snap.exists()) { list.innerHTML = "<p>Sem treinos.</p>"; return; }

            const items = [];
            snap.forEach(c => items.push({key:c.key, ...c.val()}));
            items.sort((a,b) => new Date(b.date||0) - new Date(a.date||0));

            items.forEach(w => {
                try {
                    const card = document.createElement('div');
                    card.className = 'workout-card';
                    card.style.borderLeft = w.status === 'realizado' ? '5px solid #28a745' : '5px solid #ccc';
                    
                    let extra = "";
                    if(w.stravaData) {
                        let link = w.stravaData.mapLink ? `<a href="${w.stravaData.mapLink}" target="_blank" style="color:#fc4c02; font-weight:bold; text-decoration:none;">🗺️ Ver Mapa</a>` : "";
                        if(!link && w.stravaActivityId) link = `<a href="https://www.strava.com/activities/${w.stravaActivityId}" target="_blank" style="color:#fc4c02; font-weight:bold; text-decoration:none;">🗺️ Ver Mapa</a>`;
                        
                        extra = `<div style="color:#e65100; font-size:0.8rem; margin-top:5px;"><b>Strava:</b> ${w.stravaData.distancia} | ${w.stravaData.ritmo} ${link}</div>`;
                    }

                    const dStr = w.date ? new Date(w.date).toLocaleDateString('pt-BR') : "--";
                    const tSafe = w.title || "Treino";

                    card.innerHTML = `
                        <div style="display:flex; justify-content:space-between;">
                            <b>${dStr}</b>
                            <span class="status-tag ${w.status || 'planejado'}">${w.status || 'planejado'}</span>
                        </div>
                        <div style="font-weight:bold; margin:5px 0;">${tSafe}</div>
                        <div style="font-size:0.9rem; color:#666;">${(w.description||"").substring(0,100)}...</div>
                        ${extra}
                        <div style="text-align:right; margin-top:10px;"><button class="btn btn-primary btn-small">Ver</button></div>
                    `;
                    
                    card.onclick = (e) => {
                        if(!e.target.closest('a')) AppPrincipal.openFeedbackModal(w.key, user.uid, tSafe);
                    };
                    list.appendChild(card);
                } catch(e) { console.error("Erro Card Atleta:", e); }
            });
        });
    }
};

// ===================================================================
// 3. FEED PANEL (SOCIAL)
// ===================================================================
const FeedPanel = {
    init: (user, db) => {
        const list = document.getElementById('feed-list');
        if(!list) return;
        db.ref('publicWorkouts').limitToLast(30).on('value', snap => {
            list.innerHTML = "";
            if(!snap.exists()) { list.innerHTML = "<p>Vazio.</p>"; return; }
            
            const arr=[];
            snap.forEach(c => arr.push({key:c.key, ...c.val()}));
            arr.reverse();

            arr.forEach(w => {
                try {
                    const card = document.createElement('div');
                    card.className = 'workout-card';
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
                } catch(e) { console.error("Erro Feed:", e); }
            });
        });
    }
};

// Exportação Global Obrigatória
window.panels = { init: () => {}, cleanup: () => { if(AdminPanel.state.db) AdminPanel.state.db.ref().off(); } };