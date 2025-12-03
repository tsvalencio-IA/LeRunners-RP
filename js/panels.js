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
                                    <div><small>Pace</small><br><strong>${w.stravaData.ritmo||