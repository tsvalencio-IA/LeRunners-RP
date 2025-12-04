/* =================================================================== */
/* ARQUIVO DE MÓDULOS (V4.0 - PRESCRIÇÃO + FINANCEIRO)
/* =================================================================== */

// ===================================================================
// 3. AdminPanel (Lógica do Painel Coach)
// ===================================================================
const AdminPanel = {
    state: {},
    elements: {},

    init: (user, db) => {
        console.log("AdminPanel V4.0: Inicializado.");
        AdminPanel.state = { db, currentUser: user, selectedAthleteId: null, athletes: {} };

        AdminPanel.elements = {
            pendingList: document.getElementById('pending-list'),
            athleteList: document.getElementById('athlete-list'),
            athleteSearch: document.getElementById('athlete-search'),
            athleteDetailName: document.getElementById('athlete-detail-name'),
            athleteDetailContent: document.getElementById('athlete-detail-content'),
            deleteAthleteBtn: document.getElementById('delete-athlete-btn'),
            
            // Abas V2.6
            tabPrescreverBtn: document.querySelector('[data-tab="prescrever"]'),
            tabKpisBtn: document.querySelector('[data-tab="kpis"]'),
            adminTabPrescrever: document.getElementById('admin-tab-prescrever'),
            adminTabKpis: document.getElementById('admin-tab-kpis'),
            
            // Conteúdo Aba 1 (Prescrição)
            addWorkoutForm: document.getElementById('add-workout-form'),
            workoutsList: document.getElementById('workouts-list'),

            // Conteúdo Aba 2 (IA)
            analyzeAthleteBtnIa: document.getElementById('analyze-athlete-btn-ia'),
            iaHistoryList: document.getElementById('ia-history-list')
        };

        // Bind de eventos
        AdminPanel.elements.addWorkoutForm.addEventListener('submit', AdminPanel.handleAddWorkout);
        AdminPanel.elements.athleteSearch.addEventListener('input', AdminPanel.renderAthleteList);
        AdminPanel.elements.deleteAthleteBtn.addEventListener('click', AdminPanel.deleteAthlete);
        
        // Listeners Abas
        AdminPanel.elements.tabPrescreverBtn.addEventListener('click', () => AdminPanel.switchTab('prescrever'));
        AdminPanel.elements.tabKpisBtn.addEventListener('click', () => {
            AdminPanel.switchTab('kpis');
            if(AdminPanel.state.selectedAthleteId) {
                AdminPanel.loadIaHistory(AdminPanel.state.selectedAthleteId);
            }
        });
        AdminPanel.elements.analyzeAthleteBtnIa.addEventListener('click', AdminPanel.handleAnalyzeAthleteIA);
        
        // Carregar dados
        AdminPanel.loadPendingApprovals();
        AdminPanel.loadAthletes();
    },

    switchTab: (tabName) => {
        const { tabPrescreverBtn, tabKpisBtn, adminTabPrescrever, adminTabKpis } = AdminPanel.elements;
        
        const isPrescrever = (tabName === 'prescrever');
        
        tabPrescreverBtn.classList.toggle('active', isPrescrever);
        adminTabPrescrever.classList.toggle('active', isPrescrever);
        
        tabKpisBtn.classList.toggle('active', !isPrescrever);
        adminTabKpis.classList.toggle('active', !isPrescrever);
    },

    loadPendingApprovals: () => {
        const pendingRef = AdminPanel.state.db.ref('pendingApprovals');
        AppPrincipal.state.listeners['adminPending'] = pendingRef.on('value', snapshot => {
            const { pendingList } = AdminPanel.elements;
            pendingList.innerHTML = "";
            if (!snapshot.exists()) {
                pendingList.innerHTML = "<p>Nenhuma solicitação pendente.</p>";
                return;
            }
            snapshot.forEach(childSnapshot => {
                const uid = childSnapshot.key;
                const data = childSnapshot.val();
                const item = document.createElement('div');
                item.className = 'pending-item';
                item.innerHTML = `
                    <div class="pending-item-info">
                        <strong>${data.name}</strong><br>
                        <span>${data.email}</span>
                    </div>
                    <div class="pending-item-actions">
                        <button class="btn btn-success btn-small" data-action="approve" data-uid="${uid}">Aprovar</button>
                        <button class="btn btn-danger btn-small" data-action="reject" data-uid="${uid}">Rejeitar</button>
                    </div>
                `;
                pendingList.appendChild(item);
            });

            pendingList.querySelectorAll('[data-action="approve"]').forEach(btn => 
                btn.addEventListener('click', e => AdminPanel.approveAthlete(e.target.dataset.uid))
            );
            pendingList.querySelectorAll('[data-action="reject"]').forEach(btn => 
                btn.addEventListener('click', e => AdminPanel.rejectAthlete(e.target.dataset.uid))
            );
        });
    },

    loadAthletes: () => {
        const athletesRef = AdminPanel.state.db.ref('users');
        AppPrincipal.state.listeners['adminAthletes'] = athletesRef.orderByChild('name').on('value', snapshot => {
            AdminPanel.state.athletes = snapshot.val() || {};
            AdminPanel.renderAthleteList();
        });
    },

    renderAthleteList: () => {
        const { athleteList, athleteSearch } = AdminPanel.elements;
        const searchTerm = athleteSearch.value.toLowerCase();
        athleteList.innerHTML = "";
        
        if (AdminPanel.state.selectedAthleteId && !AdminPanel.state.athletes[AdminPanel.state.selectedAthleteId]) {
            AdminPanel.selectAthlete(null, null); // Desseleciona
        }

        Object.entries(AdminPanel.state.athletes).forEach(([uid, userData]) => {
            if (uid === AdminPanel.state.currentUser.uid) return;
            if (searchTerm && !userData.name.toLowerCase().includes(searchTerm)) {
                return;
            }

            const el = document.createElement('div');
            el.className = 'athlete-list-item';
            el.dataset.uid = uid;
            el.innerHTML = `<span>${userData.name}</span>`;
            el.addEventListener('click', () => AdminPanel.selectAthlete(uid, userData.name));
            
            if (uid === AdminPanel.state.selectedAthleteId) {
                el.classList.add('selected');
            }
            athleteList.appendChild(el);
        });
    },

    approveAthlete: (uid) => {
        const pendingRef = AdminPanel.state.db.ref('pendingApprovals/' + uid);
        pendingRef.once('value', snapshot => {
            if (!snapshot.exists()) return;
            const pendingData = snapshot.val();
            const newUserProfile = { 
                name: pendingData.name, 
                email: pendingData.email, 
                role: "atleta", 
                createdAt: new Date().toISOString(),
                bio: "", photoUrl: ""
            };
            const updates = {};
            updates[`/users/${uid}`] = newUserProfile;
            updates[`/data/${uid}`] = { workouts: {} };     
            updates[`/iaAnalysisHistory/${uid}`] = {}; 
            updates[`/pendingApprovals/${uid}`] = null; 

            AdminPanel.state.db.ref().update(updates)
                .catch(err => alert("Falha ao aprovar: " + err.message));
        });
    },

    rejectAthlete: (uid) => {
        if (!confirm("Tem certeza que deseja REJEITAR?")) return;
        AdminPanel.state.db.ref('pendingApprovals/' + uid).remove()
            .catch(err => alert("Falha ao rejeitar: " + err.message));
    },

    deleteAthlete: () => {
        const { selectedAthleteId } = AdminPanel.state;
        if (!selectedAthleteId) return;
        const athleteName = AdminPanel.state.athletes[selectedAthleteId].name;
        if (!confirm(`ATENÇÃO: Apagar PERMANENTEMENTE o atleta "${athleteName}"?`)) return;

        const updates = {};
        updates[`/users/${selectedAthleteId}`] = null;
        updates[`/data/${selectedAthleteId}`] = null;
        updates[`/iaAnalysisHistory/${selectedAthleteId}`] = null; 
        
        const feedRef = AdminPanel.state.db.ref('publicWorkouts');
        feedRef.orderByChild('ownerId').equalTo(selectedAthleteId).once('value', snapshot => {
            snapshot.forEach(childSnapshot => {
                const workoutId = childSnapshot.key;
                updates[`/publicWorkouts/${workoutId}`] = null;
                updates[`/workoutComments/${workoutId}`] = null;
                updates[`/workoutLikes/${workoutId}`] = null;
            });
            AdminPanel.state.db.ref().update(updates)
                .then(() => AdminPanel.selectAthlete(null, null))
                .catch(err => alert("Erro ao excluir: " + err.message));
        });
    },

    selectAthlete: (uid, name) => {
        AppPrincipal.cleanupListeners(true);

        if (uid === null) {
            AdminPanel.state.selectedAthleteId = null;
            AdminPanel.elements.athleteDetailName.textContent = "Selecione um Atleta";
            AdminPanel.elements.athleteDetailContent.classList.add('hidden');
        } else {
            AdminPanel.state.selectedAthleteId = uid;
            AdminPanel.elements.athleteDetailName.textContent = `Atleta: ${name}`;
            AdminPanel.elements.athleteDetailContent.classList.remove('hidden');
            AdminPanel.switchTab('prescrever'); 
            AdminPanel.loadWorkouts(uid);
            AdminPanel.loadIaHistory(uid);
        }
        
        document.querySelectorAll('.athlete-list-item').forEach(el => {
            el.classList.toggle('selected', el.dataset.uid === uid);
        });
    },

    loadWorkouts: (athleteId) => {
        const { workoutsList } = AdminPanel.elements;
        workoutsList.innerHTML = "<p>Carregando treinos...</p>";
        
        const workoutsRef = AdminPanel.state.db.ref(`data/${athleteId}/workouts`);
        AppPrincipal.state.listeners['adminWorkouts'] = workoutsRef.orderByChild('date').on('value', snapshot => {
            workoutsList.innerHTML = ""; 
            if (!snapshot.exists()) {
                workoutsList.innerHTML = "<p>Nenhum treino agendado.</p>";
                return;
            }
            snapshot.forEach(childSnapshot => {
                const card = AdminPanel.createWorkoutCard(childSnapshot.key, childSnapshot.val(), athleteId);
                workoutsList.prepend(card);
            });
        });
    },
    
    loadIaHistory: (athleteId) => {
        const { iaHistoryList } = AdminPanel.elements;
        if (!iaHistoryList) return; 
        iaHistoryList.innerHTML = "<p>Carregando histórico...</p>";
        const historyRef = AdminPanel.state.db.ref(`iaAnalysisHistory/${athleteId}`);
        AppPrincipal.state.listeners['adminIaHistory'] = historyRef.orderByChild('analysisDate').limitToLast(10).on('value', snapshot => {
            iaHistoryList.innerHTML = ""; 
            if (!snapshot.exists()) {
                iaHistoryList.innerHTML = "<p>Nenhuma análise salva.</p>";
                return;
            }
            let items = [];
            snapshot.forEach(c => items.push({id: c.key, data: c.val()}));
            items.reverse().forEach(item => iaHistoryList.appendChild(AdminPanel.createIaHistoryCard(item.id, item.data)));
        });
    },

    // ===================================================================
    // SALVAMENTO ESTRUTURADO (ATUALIZAÇÃO V4.0)
    // ===================================================================
    handleAddWorkout: (e) => {
        e.preventDefault();
        const { selectedAthleteId } = AdminPanel.state;
        const { addWorkoutForm } = AdminPanel.elements;
        
        if (!selectedAthleteId) return alert("Selecione um atleta.");

        const date = addWorkoutForm.querySelector('#workout-date').value;
        const title = addWorkoutForm.querySelector('#workout-title').value;
        
        if (!date || !title) return alert("Data e Título são obrigatórios.");

        // Dados Estruturados
        const modalidade = addWorkoutForm.querySelector('#workout-modalidade').value;
        const tipoTreino = addWorkoutForm.querySelector('#workout-tipo-treino').value;
        const intensidade = addWorkoutForm.querySelector('#workout-intensidade').value;
        const percurso = addWorkoutForm.querySelector('#workout-percurso').value;
        
        const distancia = addWorkoutForm.querySelector('#workout-distancia').value.trim();
        const tempo = addWorkoutForm.querySelector('#workout-tempo').value.trim();
        const pace = addWorkoutForm.querySelector('#workout-pace').value.trim();
        const velocidade = addWorkoutForm.querySelector('#workout-velocidade').value.trim();
        const observacoes = addWorkoutForm.querySelector('#workout-observacoes').value.trim();

        // Monta Descrição Visual
        let description = `[${modalidade}] - [${tipoTreino}]\n`;
        description += `Intensidade: ${intensidade}\n`;
        description += `Percurso: ${percurso}\n`;
        description += `--- \n`;
        if (distancia) description += `Distância: ${distancia}\n`;
        if (tempo) description += `Tempo: ${tempo}\n`;
        if (pace) description += `Pace: ${pace}\n`;
        if (velocidade) description += `Velocidade: ${velocidade}\n`;
        if (observacoes) description += `--- \nObservações:\n${observacoes}`;

        // Objeto Completo
        const workoutData = {
            date: date,
            title: title,
            description: description,
            // Campos estruturados salvos separadamente
            structure: {
                modalidade, tipoTreino, intensidade, percurso, distancia, tempo, pace, velocidade
            },
            createdBy: AdminPanel.state.currentUser.uid,
            createdAt: new Date().toISOString(),
            status: "planejado",
            feedback: "",
            imageUrl: null,
            stravaData: null
        };

        AdminPanel.state.db.ref(`data/${selectedAthleteId}/workouts`).push(workoutData)
            .then(() => {
                addWorkoutForm.querySelector('#workout-distancia').value = "";
                addWorkoutForm.querySelector('#workout-tempo').value = "";
                addWorkoutForm.querySelector('#workout-pace').value = "";
                addWorkoutForm.querySelector('#workout-velocidade').value = "";
                addWorkoutForm.querySelector('#workout-observacoes').value = "";
                addWorkoutForm.querySelector('#workout-title').value = "";
            })
            .catch(err => alert("Falha ao salvar: " + err.message));
    },
    
    createWorkoutCard: (id, data, athleteId) => {
        const el = document.createElement('div');
        el.className = 'workout-card';
        el.innerHTML = `
            <div class="workout-card-header">
                <span class="date">${data.date}</span>
                <span class="title">${data.title}</span>
                <span class="status-tag ${data.status || 'planejado'}">${data.status || 'planejado'}</span>
            </div>
            <div class="workout-card-body">
                <p>${data.description || "Sem descrição."}</p>
                ${data.feedback ? `<p class="feedback-text">${data.feedback}</p>` : ''}
                ${data.stravaData ? AdminPanel.createStravaDataDisplay(data.stravaData) : ''}
                ${data.imageUrl ? `<img src="${data.imageUrl}" alt="Foto do treino" class="workout-image">` : ''}
            </div>
            <div class="workout-card-footer">
                <div class="workout-actions">
                    <button class="action-btn btn-like"><i class='bx bx-heart'></i> <span class="like-count">0</span></button>
                    <button class="action-btn btn-comment"><i class='bx bx-comment'></i> <span class="comment-count">0</span></button>
                </div>
                <button class="btn btn-danger btn-small" data-action="delete"><i class="bx bx-trash"></i></button>
            </div>
        `;
        
        el.querySelector('.btn-comment').addEventListener('click', () => {
            AppPrincipal.openFeedbackModal(id, athleteId, data.title);
        });
        
        el.querySelector('[data-action="delete"]').addEventListener('click', () => {
            if (confirm("Apagar este treino?")) {
                const updates = {};
                updates[`/data/${athleteId}/workouts/${id}`] = null;
                updates[`/publicWorkouts/${id}`] = null;
                updates[`/workoutComments/${id}`] = null;
                updates[`/workoutLikes/${id}`] = null;
                AdminPanel.state.db.ref().update(updates).catch(err => alert("Erro: " + err.message));
            }
        });
        
        AdminPanel.loadWorkoutStats(el, id, athleteId);
        return el;
    },
    
    createIaHistoryCard: (id, data) => {
        const el = document.createElement('div');
        el.className = 'workout-card';
        const date = new Date(data.analysisDate).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
        const summary = data.analysisResult.split('\n').slice(0, 3).join('\n') + '...';
        el.innerHTML = `
            <div class="workout-card-header">
                <div><span class="date">Análise de ${date}</span></div>
            </div>
            <div class="workout-card-body"><p>${summary}</p></div>
        `;
        el.addEventListener('click', () => AppPrincipal.openIaAnalysisModal(data));
        return el;
    },

    createStravaDataDisplay: (stravaData) => {
        let mapLinkHtml = '';
        if (stravaData.mapLink) {
            mapLinkHtml = `<p style="margin-top:5px;"><a href="${stravaData.mapLink}" target="_blank" style="color: #fc4c02; font-weight: bold; text-decoration: none;">🗺️ Ver Mapa no Strava</a></p>`;
        }
        return `
            <fieldset class="strava-data-display">
                <legend><i class='bx bxl-strava'></i> Dados Extraídos (Gemini Vision)</legend>
                <p>Distância: ${stravaData.distancia || "N/A"}</p>
                <p>Tempo:     ${stravaData.tempo || "N/A"}</p>
                <p>Ritmo:     ${stravaData.ritmo || "N/A"}</p>
                ${mapLinkHtml}
            </fieldset>
        `;
    },
    
    loadWorkoutStats: (cardElement, workoutId, ownerId) => {
        const likeBtn = cardElement.querySelector('.btn-like');
        const likeCount = cardElement.querySelector('.like-count');
        const commentCount = cardElement.querySelector('.comment-count');
        const isOwner = (AdminPanel.state.currentUser.uid === ownerId);
        
        const likesRef = AdminPanel.state.db.ref(`workoutLikes/${workoutId}`);
        const commentsRef = AdminPanel.state.db.ref(`workoutComments/${workoutId}`);
        
        AppPrincipal.state.listeners[`likes_${workoutId}`] = likesRef.on('value', snapshot => {
            const count = snapshot.numChildren();
            likeCount.textContent = count;
            if (snapshot.hasChild(AdminPanel.state.currentUser.uid)) likeBtn.classList.add('liked');
            else likeBtn.classList.remove('liked');
            
            if (isOwner) likeBtn.disabled = true;

            if (count > 0) {
                likeCount.classList.add('like-count-btn');
                likeCount.onclick = (e) => { e.stopPropagation(); AppPrincipal.openWhoLikedModal(workoutId); };
            } else {
                likeCount.classList.remove('like-count-btn');
                likeCount.onclick = null;
            }
        });
        
        AppPrincipal.state.listeners[`comments_${workoutId}`] = commentsRef.on('value', snapshot => commentCount.textContent = snapshot.numChildren());

        if (!isOwner) {
            likeBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                const myLikeRef = likesRef.child(AdminPanel.state.currentUser.uid);
                myLikeRef.once('value', snapshot => {
                    if (snapshot.exists()) myLikeRef.remove(); else myLikeRef.set(true);
                });
            });
        }
    },

    handleAnalyzeAthleteIA: async () => {
        const { selectedAthleteId } = AdminPanel.state;
        if (!selectedAthleteId) return alert("Selecione um atleta.");
        
        AppPrincipal.openIaAnalysisModal(); 
        const iaAnalysisOutput = AppPrincipal.elements.iaAnalysisOutput;
        const saveBtn = AppPrincipal.elements.saveIaAnalysisBtn;
        
        iaAnalysisOutput.textContent = "Coletando dados do atleta...";
        saveBtn.classList.add('hidden'); 

        try {
            const athleteName = AdminPanel.state.athletes[selectedAthleteId].name;
            const dataRef = AdminPanel.state.db.ref(`data/${selectedAthleteId}/workouts`);
            const snapshot = await dataRef.orderByChild('date').limitToLast(10).once('value');
            
            if (!snapshot.exists()) throw new Error("Nenhum dado de treino encontrado.");
            const workoutData = snapshot.val();
            
            const prompt = `ATUE COMO: Coach de Corrida. ATLETA: ${athleteName}. DADOS: ${JSON.stringify(workoutData, null, 2)}. Crie um relatório breve e direto sobre consistência e performance.`;
            
            iaAnalysisOutput.textContent = "Gerando análise (Gemini)...";
            const analysisResult = await AppPrincipal.callGeminiTextAPI(prompt);
            
            iaAnalysisOutput.textContent = analysisResult;
            AppPrincipal.state.currentAnalysisData = {
                analysisDate: new Date().toISOString(),
                coachUid: AdminPanel.state.currentUser.uid,
                prompt: prompt,
                analysisResult: analysisResult
            };
            saveBtn.classList.remove('hidden'); 

        } catch (err) {
            iaAnalysisOutput.textContent = `ERRO: ${err.message}`;
        }
    }
};

// ===================================================================
// 4. FinancePanel (NOVO MÓDULO)
// ===================================================================
const FinancePanel = {
    state: {},
    elements: {},

    init: (user, db) => {
        console.log("FinancePanel V1.0: Inicializado.");
        FinancePanel.state = { db, currentUser: user, inventory: {}, transactions: [] };
        
        FinancePanel.elements = {
            totalReceita: document.getElementById('fin-total-receita'),
            totalDespesa: document.getElementById('fin-total-despesa'),
            saldo: document.getElementById('fin-saldo'),
            
            // Abas
            tabLancamentosBtn: document.querySelector('[data-fin-tab="lancamentos"]'),
            tabEstoqueBtn: document.querySelector('[data-fin-tab="estoque"]'),
            tabLancamentosContent: document.getElementById('fin-tab-lancamentos'),
            tabEstoqueContent: document.getElementById('fin-tab-estoque'),
            
            // Forms
            transForm: document.getElementById('finance-transaction-form'),
            prodForm: document.getElementById('finance-product-form'),
            
            // Inputs Especiais
            finType: document.getElementById('fin-type'),
            finCategory: document.getElementById('fin-category'),
            finStudentSelector: document.getElementById('fin-student-selector'),
            finStudentSelect: document.getElementById('fin-student-select'),
            finProductSelector: document.getElementById('fin-product-selector'),
            finProductSelect: document.getElementById('fin-product-select'),
            
            // Listas
            transactionsList: document.getElementById('finance-transactions-list'),
            inventoryList: document.getElementById('finance-inventory-list')
        };

        // Eventos de Abas
        FinancePanel.elements.tabLancamentosBtn.addEventListener('click', () => FinancePanel.switchTab('lancamentos'));
        FinancePanel.elements.tabEstoqueBtn.addEventListener('click', () => FinancePanel.switchTab('estoque'));
        
        // Logica Dinâmica do Form de Transação
        FinancePanel.elements.finType.addEventListener('change', FinancePanel.handleTypeChange);
        FinancePanel.elements.finCategory.addEventListener('change', FinancePanel.handleCategoryChange);
        
        // Submits
        FinancePanel.elements.transForm.addEventListener('submit', FinancePanel.handleTransactionSubmit);
        FinancePanel.elements.prodForm.addEventListener('submit', FinancePanel.handleProductSubmit);

        // Preenche Select de Alunos
        FinancePanel.populateStudents();

        // Carrega Dados do Firebase
        FinancePanel.loadData();
    },

    switchTab: (tab) => {
        const { tabLancamentosBtn, tabEstoqueBtn, tabLancamentosContent, tabEstoqueContent } = FinancePanel.elements;
        const isLanc = (tab === 'lancamentos');
        tabLancamentosBtn.classList.toggle('active', isLanc);
        tabLancamentosContent.classList.toggle('active', isLanc);
        tabLancamentosContent.classList.toggle('hidden', !isLanc);
        
        tabEstoqueBtn.classList.toggle('active', !isLanc);
        tabEstoqueContent.classList.toggle('active', !isLanc);
        tabEstoqueContent.classList.toggle('hidden', isLanc);
    },

    populateStudents: () => {
        const { finStudentSelect } = FinancePanel.elements;
        finStudentSelect.innerHTML = '<option value="">Selecione o Aluno...</option>';
        Object.entries(AppPrincipal.state.userCache).forEach(([uid, data]) => {
            const opt = document.createElement('option');
            opt.value = uid;
            opt.textContent = data.name;
            finStudentSelect.appendChild(opt);
        });
    },

    handleTypeChange: () => {
        const type = FinancePanel.elements.finType.value;
        const cat = FinancePanel.elements.finCategory;
        cat.innerHTML = "";
        if (type === 'receita') {
            cat.innerHTML += '<option value="Mensalidade">Mensalidade</option>';
            cat.innerHTML += '<option value="Venda">Venda de Produto</option>';
            cat.innerHTML += '<option value="Outro">Outro</option>';
        } else {
            cat.innerHTML += '<option value="Conta">Conta a Pagar</option>';
            cat.innerHTML += '<option value="Equipamento">Equipamento</option>';
            cat.innerHTML += '<option value="Outro">Outro</option>';
        }
        FinancePanel.handleCategoryChange();
    },

    handleCategoryChange: () => {
        const cat = FinancePanel.elements.finCategory.value;
        const type = FinancePanel.elements.finType.value;
        const { finStudentSelector, finProductSelector } = FinancePanel.elements;
        
        // Lógica de visualização
        if (type === 'receita' && cat === 'Mensalidade') {
            finStudentSelector.classList.remove('hidden');
            finProductSelector.classList.add('hidden');
        } else if (type === 'receita' && cat === 'Venda') {
            finStudentSelector.classList.remove('hidden'); // Opcional: Saber quem comprou
            finProductSelector.classList.remove('hidden');
        } else {
            finStudentSelector.classList.add('hidden');
            finProductSelector.classList.add('hidden');
        }
    },

    loadData: () => {
        const uid = FinancePanel.state.currentUser.uid;
        // Caminho Seguro: data/UID/finance
        const financeRef = FinancePanel.state.db.ref(`data/${uid}/finance`);
        
        AppPrincipal.state.listeners['financeData'] = financeRef.on('value', snapshot => {
            const data = snapshot.val() || {};
            FinancePanel.state.transactions = data.transactions ? Object.entries(data.transactions) : [];
            FinancePanel.state.inventory = data.inventory || {};
            
            FinancePanel.renderTransactions();
            FinancePanel.renderInventory();
            FinancePanel.updateSummary();
            FinancePanel.populateProductSelect();
        });
    },

    populateProductSelect: () => {
        const { finProductSelect } = FinancePanel.elements;
        finProductSelect.innerHTML = '<option value="">Selecione o Produto...</option>';
        Object.entries(FinancePanel.state.inventory).forEach(([key, prod]) => {
            if (prod.qty > 0) {
                const opt = document.createElement('option');
                opt.value = key;
                opt.textContent = `${prod.name} (R$ ${prod.price} - Qtd: ${prod.qty})`;
                finProductSelect.appendChild(opt);
            }
        });
    },

    updateSummary: () => {
        let rec = 0, desp = 0;
        const currentMonth = new Date().getMonth();
        
        FinancePanel.state.transactions.forEach(([key, t]) => {
            const tDate = new Date(t.date);
            // Filtra pelo mês atual para o card, ou pode ser total
            if (tDate.getMonth() === currentMonth) {
                if (t.type === 'receita') rec += parseFloat(t.amount);
                else desp += parseFloat(t.amount);
            }
        });

        FinancePanel.elements.totalReceita.textContent = `R$ ${rec.toFixed(2)}`;
        FinancePanel.elements.totalDespesa.textContent = `R$ ${desp.toFixed(2)}`;
        FinancePanel.elements.saldo.textContent = `R$ ${(rec - desp).toFixed(2)}`;
        
        // Cores do saldo
        FinancePanel.elements.saldo.style.color = (rec - desp) >= 0 ? 'var(--success-color)' : 'var(--danger-color)';
    },

    renderTransactions: () => {
        const list = FinancePanel.elements.transactionsList;
        list.innerHTML = "";
        
        // Ordenar por data decrescente
        const sorted = [...FinancePanel.state.transactions].sort((a,b) => new Date(b[1].date) - new Date(a[1].date));

        sorted.forEach(([key, t]) => {
            const tr = document.createElement('tr');
            const dateStr = new Date(t.date).toLocaleDateString('pt-BR');
            const typeBadge = t.type === 'receita' ? '<span class="badge badge-success">Entrada</span>' : '<span class="badge badge-danger">Saída</span>';
            
            tr.innerHTML = `
                <td>${dateStr}</td>
                <td>${t.description}</td>
                <td>${t.category}</td>
                <td style="color: ${t.type === 'receita' ? 'green' : 'red'}; font-weight: bold;">
                    R$ ${parseFloat(t.amount).toFixed(2)}
                </td>
                <td><button class="btn btn-danger btn-small delete-trans" data-key="${key}"><i class='bx bx-trash'></i></button></td>
            `;
            
            tr.querySelector('.delete-trans').addEventListener('click', () => FinancePanel.deleteTransaction(key));
            list.appendChild(tr);
        });
    },

    renderInventory: () => {
        const list = FinancePanel.elements.inventoryList;
        list.innerHTML = "";
        
        Object.entries(FinancePanel.state.inventory).forEach(([key, prod]) => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${prod.name}</td>
                <td>R$ ${parseFloat(prod.price).toFixed(2)}</td>
                <td>${prod.qty} un</td>
                <td><button class="btn btn-danger btn-small delete-prod" data-key="${key}"><i class='bx bx-trash'></i></button></td>
            `;
            tr.querySelector('.delete-prod').addEventListener('click', () => FinancePanel.deleteProduct(key));
            list.appendChild(tr);
        });
    },

    handleTransactionSubmit: async (e) => {
        e.preventDefault();
        const uid = FinancePanel.state.currentUser.uid;
        
        const type = FinancePanel.elements.finType.value;
        const category = FinancePanel.elements.finCategory.value;
        const desc = document.getElementById('fin-description').value;
        const amount = parseFloat(document.getElementById('fin-amount').value);
        const date = document.getElementById('fin-date').value;
        const studentId = document.getElementById('fin-student-select').value;
        const productId = document.getElementById('fin-product-select').value;

        if (category === 'Venda' && !productId) return alert("Selecione o produto vendido.");

        // Lógica de Abater Estoque
        if (type === 'receita' && category === 'Venda') {
            const prod = FinancePanel.state.inventory[productId];
            if (!prod || prod.qty <= 0) return alert("Produto sem estoque.");
            
            // Atualiza estoque
            await FinancePanel.state.db.ref(`data/${uid}/finance/inventory/${productId}`).update({
                qty: prod.qty - 1
            });
        }

        const transaction = {
            type, category, description: desc, amount, date,
            studentId: studentId || null,
            productId: productId || null,
            createdAt: new Date().toISOString()
        };

        await FinancePanel.state.db.ref(`data/${uid}/finance/transactions`).push(transaction);
        alert("Lançamento salvo!");
        FinancePanel.elements.transForm.reset();
        FinancePanel.handleTypeChange(); // Reseta visual
    },

    handleProductSubmit: async (e) => {
        e.preventDefault();
        const uid = FinancePanel.state.currentUser.uid;
        
        const prod = {
            name: document.getElementById('prod-name').value,
            price: parseFloat(document.getElementById('prod-price').value),
            cost: parseFloat(document.getElementById('prod-cost').value) || 0,
            qty: parseInt(document.getElementById('prod-qty').value)
        };

        await FinancePanel.state.db.ref(`data/${uid}/finance/inventory`).push(prod);
        alert("Produto cadastrado!");
        FinancePanel.elements.prodForm.reset();
    },

    deleteTransaction: (key) => {
        if(confirm("Apagar transação?")) {
            FinancePanel.state.db.ref(`data/${FinancePanel.state.currentUser.uid}/finance/transactions/${key}`).remove();
        }
    },
    
    deleteProduct: (key) => {
        if(confirm("Apagar produto?")) {
            FinancePanel.state.db.ref(`data/${FinancePanel.state.currentUser.uid}/finance/inventory/${key}`).remove();
        }
    }
};

// ===================================================================
// 5. AtletaPanel (Lógica do Painel Atleta)
// ===================================================================
const AtletaPanel = {
    state: {},
    elements: {},

    init: (user, db) => {
        console.log("AtletaPanel V3.3: Inicializado.");
        AtletaPanel.state = { db, currentUser: user };
        AtletaPanel.elements = { 
            workoutsList: document.getElementById('atleta-workouts-list'),
            logManualActivityBtn: document.getElementById('log-manual-activity-btn')
        };
        AtletaPanel.elements.logManualActivityBtn.addEventListener('click', AppPrincipal.openLogActivityModal);
        AtletaPanel.loadWorkouts(user.uid);
    },

    loadWorkouts: (athleteId) => {
        const { workoutsList } = AtletaPanel.elements;
        workoutsList.innerHTML = "<p>Carregando seus treinos...</p>";
        
        const workoutsRef = AtletaPanel.state.db.ref(`data/${athleteId}/workouts`);
        AppPrincipal.state.listeners['atletaWorkouts'] = workoutsRef.orderByChild('date').on('value', snapshot => {
            workoutsList.innerHTML = ""; 
            if (!snapshot.exists()) {
                workoutsList.innerHTML = "<p>Nenhum treino encontrado. Fale com seu coach!</p>";
                return;
            }
            snapshot.forEach(childSnapshot => {
                const card = AtletaPanel.createWorkoutCard(childSnapshot.key, childSnapshot.val(), athleteId);
                workoutsList.prepend(card);
            });
        });
    },

    createWorkoutCard: (id, data, athleteId) => {
        const el = document.createElement('div');
        el.className = 'workout-card';
        el.innerHTML = `
            <div class="workout-card-header">
                <span class="date">${data.date}</span>
                <span class="title">${data.title}</span>
                <span class="status-tag ${data.status || 'planejado'}">${data.status || 'planejado'}</span>
            </div>
            <div class="workout-card-body">
                <p>${data.description || "Sem descrição."}</p>
                ${data.feedback ? `<p class="feedback-text">${data.feedback}</p>` : ''}
                ${data.stravaData ? AtletaPanel.createStravaDataDisplay(data.stravaData) : ''}
                ${data.imageUrl ? `<img src="${data.imageUrl}" alt="Foto do treino" class="workout-image">` : ''}
            </div>
            <div class="workout-card-footer">
                <div class="workout-actions">
                    <button class="action-btn btn-like"><i class='bx bx-heart'></i> <span class="like-count">0</span></button>
                    <button class="action-btn btn-comment"><i class='bx bx-comment'></i> <span class="comment-count">0</span></button>
                </div>
                <button class="btn btn-primary btn-small" data-action="feedback"><i class='bx bx-edit'></i> Feedback</button>
            </div>
        `;

        const feedbackBtn = el.querySelector('[data-action="feedback"]');
        feedbackBtn.addEventListener('click', (e) => {
            e.stopPropagation(); 
            AppPrincipal.openFeedbackModal(id, athleteId, data.title);
        });
        el.addEventListener('click', (e) => {
             if (!e.target.closest('button') && !e.target.closest('a')) {
                 AppPrincipal.openFeedbackModal(id, athleteId, data.title);
             }
        });
        
        AtletaPanel.loadWorkoutStats(el, id, athleteId);
        return el;
    },
    
    createStravaDataDisplay: (stravaData) => {
        let mapLinkHtml = '';
        if (stravaData.mapLink) {
            mapLinkHtml = `<p style="margin-top:5px;"><a href="${stravaData.mapLink}" target="_blank" style="color: #fc4c02; font-weight: bold; text-decoration: none;">🗺️ Ver Mapa no Strava</a></p>`;
        }
        return `
            <fieldset class="strava-data-display">
                <legend><i class='bx bxl-strava'></i> Dados Extraídos (Gemini Vision)</legend>
                <p>Distância: ${stravaData.distancia || "N/A"}</p>
                <p>Tempo:     ${stravaData.tempo || "N/A"}</p>
                <p>Ritmo:     ${stravaData.ritmo || "N/A"}</p>
                ${mapLinkHtml}
            </fieldset>
        `;
    },
    
    loadWorkoutStats: (cardElement, workoutId, ownerId) => {
        const likeBtn = cardElement.querySelector('.btn-like');
        const likeCount = cardElement.querySelector('.like-count');
        const commentCount = cardElement.querySelector('.comment-count');
        
        const isOwner = (AtletaPanel.state.currentUser.uid === ownerId);
        const likesRef = AtletaPanel.state.db.ref(`workoutLikes/${workoutId}`);
        const commentsRef = AtletaPanel.state.db.ref(`workoutComments/${workoutId}`);
        
        AppPrincipal.state.listeners[`likes_${workoutId}`] = likesRef.on('value', snapshot => {
            const count = snapshot.numChildren();
            likeCount.textContent = count;
            if (snapshot.hasChild(AtletaPanel.state.currentUser.uid)) likeBtn.classList.add('liked');
            else likeBtn.classList.remove('liked');
            if (isOwner) likeBtn.disabled = true;

            if (count > 0) {
                likeCount.classList.add('like-count-btn');
                likeCount.onclick = (e) => { e.stopPropagation(); AppPrincipal.openWhoLikedModal(workoutId); };
            } else {
                likeCount.classList.remove('like-count-btn');
                likeCount.onclick = null;
            }
        });
        
        AppPrincipal.state.listeners[`comments_${workoutId}`] = commentsRef.on('value', snapshot => commentCount.textContent = snapshot.numChildren());

        if (!isOwner) {
            likeBtn.addEventListener('click', (e) => {
                e.stopPropagation(); 
                const myLikeRef = likesRef.child(AtletaPanel.state.currentUser.uid);
                myLikeRef.once('value', snapshot => {
                    if (snapshot.exists()) myLikeRef.remove(); else myLikeRef.set(true);
                });
            });
        }
    }
};

// ===================================================================
// 6. FeedPanel (Lógica do Feed Social)
// ===================================================================
const FeedPanel = {
    state: {},
    elements: {},

    init: (user, db) => {
        console.log("FeedPanel V3.3: Inicializado.");
        FeedPanel.state = { db, currentUser: user };
        FeedPanel.elements = { feedList: document.getElementById('feed-list') };
        FeedPanel.loadFeed();
    },

    loadFeed: () => {
        const { feedList } = FeedPanel.elements;
        feedList.innerHTML = "<p>Carregando feed...</p>";
        const feedRef = FeedPanel.state.db.ref('publicWorkouts');
        AppPrincipal.state.listeners['feedData'] = feedRef.orderByChild('realizadoAt').limitToLast(20).on('value', snapshot => {
            feedList.innerHTML = "";
            if (!snapshot.exists()) {
                feedList.innerHTML = "<p>Nenhum treino realizado pela equipe ainda.</p>";
                return;
            }
            let feedItems = [];
            snapshot.forEach(c => feedItems.push({ id: c.key, data: c.val() }));
            feedItems.reverse().forEach(item => feedList.appendChild(FeedPanel.createFeedCard(item.id, item.data, item.data.ownerId)));
        });
    },
    
    createFeedCard: (id, data, ownerId) => {
        const el = document.createElement('div');
        el.className = 'workout-card';
        
        const athleteData = AppPrincipal.state.userCache[ownerId];
        const athleteName = athleteData?.name || data.ownerName || "Atleta";
        const athleteAvatar = athleteData?.photoUrl || 'https://placehold.co/150x150/4169E1/FFFFFF?text=LR';
        
        el.innerHTML = `
            <div class="workout-card-header">
                <img src="${athleteAvatar}" alt="Avatar de ${athleteName}" class="athlete-avatar">
                <span class="athlete-name">${athleteName}</span>
                <div>
                    <span class="date">${data.date}</span>
                    <span class="title">${data.title}</span>
                </div>
                <span class="status-tag ${data.status || 'planejado'}">${data.status}</span>
            </div>
            <div class="workout-card-body">
                ${data.description ? `<p>${data.description}</p>` : ''}
                ${data.feedback ? `<p class="feedback-text">${data.feedback}</p>` : ''}
                ${data.stravaData ? AtletaPanel.createStravaDataDisplay(data.stravaData) : ''}
                ${data.imageUrl ? `<img src="${data.imageUrl}" alt="Foto do treino" class="workout-image">` : ''}
            </div>
            <div class="workout-card-footer">
                <div class="workout-actions">
                    <button class="action-btn btn-like"><i class='bx bx-heart'></i> <span class="like-count">0</span></button>
                    <button class="action-btn btn-comment"><i class='bx bx-comment'></i> <span class="comment-count">0</span></button>
                </div>
            </div>
        `;

        const openProfile = (e) => { e.stopPropagation(); AppPrincipal.openViewProfileModal(ownerId); };
        el.querySelector('.athlete-avatar').addEventListener('click', openProfile);
        el.querySelector('.athlete-name').addEventListener('click', openProfile);
        
        el.addEventListener('click', (e) => {
             if (!e.target.closest('button') && !e.target.closest('a')) AppPrincipal.openFeedbackModal(id, ownerId, data.title);
        });

        FeedPanel.loadWorkoutStats(el, id, ownerId);
        return el;
    },
    
    loadWorkoutStats: (cardElement, workoutId, ownerId) => {
        const likeBtn = cardElement.querySelector('.btn-like');
        const likeCount = cardElement.querySelector('.like-count');
        const commentCount = cardElement.querySelector('.comment-count');
        const isOwner = (FeedPanel.state.currentUser.uid === ownerId);

        const likesRef = FeedPanel.state.db.ref(`workoutLikes/${workoutId}`);
        const commentsRef = FeedPanel.state.db.ref(`workoutComments/${workoutId}`);
        
        AppPrincipal.state.listeners[`feed_likes_${workoutId}`] = likesRef.on('value', snapshot => {
            const count = snapshot.numChildren();
            likeCount.textContent = count;
            if (snapshot.hasChild(FeedPanel.state.currentUser.uid)) likeBtn.classList.add('liked');
            else likeBtn.classList.remove('liked');
            if (isOwner) likeBtn.disabled = true;

            if (count > 0) {
                likeCount.classList.add('like-count-btn');
                likeCount.onclick = (e) => { e.stopPropagation(); AppPrincipal.openWhoLikedModal(workoutId); };
            } else {
                likeCount.classList.remove('like-count-btn');
                likeCount.onclick = null;
            }
        });
        
        AppPrincipal.state.listeners[`feed_comments_${workoutId}`] = commentsRef.on('value', snapshot => commentCount.textContent = snapshot.numChildren());

        if (!isOwner) {
            likeBtn.addEventListener('click', (e) => {
                e.stopPropagation(); 
                const myLikeRef = likesRef.child(FeedPanel.state.currentUser.uid);
                myLikeRef.once('value', snapshot => {
                    if (snapshot.exists()) myLikeRef.remove(); else myLikeRef.set(true);
                });
            });
        }
    }
};