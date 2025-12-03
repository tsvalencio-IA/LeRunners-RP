/* =================================================================== */
/* APP.JS V5.0 - CONTROLE CENTRAL (COM STRAVA LOOP COMPLETO)
/* =================================================================== */

const AppPrincipal = {
    state: {
        currentUser: null, userData: null, db: null, auth: null,
        listeners: {}, currentView: 'planilha', viewMode: 'admin',
        adminUIDs: {}, userCache: {}, 
        modal: { isOpen: false, currentWorkoutId: null, currentOwnerId: null, newPhotoUrl: null },
        stravaTokenData: null, currentAnalysisData: null
    },
    elements: {},

    init: () => {
        if(typeof window.firebaseConfig === 'undefined') return;
        try { if(firebase.apps.length === 0) firebase.initializeApp(window.firebaseConfig); } catch(e){}
        AppPrincipal.state.auth = firebase.auth();
        AppPrincipal.state.db = firebase.database();

        if (document.getElementById('login-form')) {
            AuthLogic.init(AppPrincipal.state.auth, AppPrincipal.state.db);
        } else if (document.getElementById('app-container')) {
            AppPrincipal.initPlatform();
        }
    },

    initPlatform: () => {
        const el = AppPrincipal.elements;
        el.loader = document.getElementById('loader');
        el.appContainer = document.getElementById('app-container');
        el.mainContent = document.getElementById('app-main-content');

        document.getElementById('logoutButton').onclick = AppPrincipal.handleLogout;
        document.getElementById('nav-planilha-btn').onclick = () => AppPrincipal.navigateTo('planilha');
        document.getElementById('nav-feed-btn').onclick = () => AppPrincipal.navigateTo('feed');
        
        // Botão Financeiro (Admin Only)
        const btnFinance = document.getElementById('nav-finance-btn');
        if(btnFinance) btnFinance.onclick = () => AppPrincipal.navigateTo('finance');

        document.getElementById('nav-profile-btn').onclick = AppPrincipal.openProfileModal;
        
        document.querySelectorAll('.close-btn').forEach(b => b.onclick = (e) => e.target.closest('.modal-overlay').classList.add('hidden'));
        
        // Forms
        if(document.getElementById('feedback-form')) document.getElementById('feedback-form').onsubmit = AppPrincipal.handleFeedbackSubmit;
        if(document.getElementById('finance-form')) document.getElementById('finance-form').onsubmit = FinancePanel.handleSaveTransaction;
        
        const photoInput = document.getElementById('photo-upload-input');
        if(photoInput) photoInput.onchange = AppPrincipal.handlePhotoUpload;

        const urlParams = new URLSearchParams(window.location.search);
        
        AppPrincipal.state.auth.onAuthStateChanged((user) => {
            if(!user) { window.location.href = 'index.html'; return; }
            AppPrincipal.state.currentUser = user;
            if (urlParams.get('code')) { AppPrincipal.exchangeStravaCode(urlParams.get('code')); return; }
            AppPrincipal.loadUserData(user.uid);
        });
    },

    loadUserData: (uid) => {
        AppPrincipal.state.db.ref('users').on('value', s => AppPrincipal.state.userCache = s.val() || {});
        AppPrincipal.state.db.ref('users/' + uid).once('value', s => {
            let data = s.val();
            AppPrincipal.state.db.ref('admins/' + uid).once('value', adminSnap => {
                const isAdmin = adminSnap.exists() && adminSnap.val() === true;
                if (!data && isAdmin) { data = { name: AppPrincipal.state.currentUser.email, role: 'admin' }; AppPrincipal.state.db.ref('users/' + uid).set(data); }
                
                if (data) {
                    AppPrincipal.state.userData = { ...data, uid: uid };
                    document.getElementById('userDisplay').textContent = data.name;
                    
                    if (isAdmin) {
                        AppPrincipal.state.userData.role = 'admin'; 
                        const btnFin = document.getElementById('nav-finance-btn');
                        if(btnFin) btnFin.classList.remove('hidden');

                        // Toggle Modo Atleta
                        const nav = document.querySelector('.app-header nav');
                        if(!document.getElementById('admin-toggle')) {
                            const btn = document.createElement('button');
                            btn.id = 'admin-toggle'; btn.className = 'btn btn-nav'; btn.innerHTML = "Modo Atleta"; btn.style.border="1px solid white"; btn.style.marginLeft="10px";
                            btn.onclick = () => {
                                if (AppPrincipal.state.viewMode === 'admin') {
                                    AppPrincipal.state.viewMode = 'atleta'; btn.innerHTML = "Modo Coach";
                                    AppPrincipal.updateClasses(false);
                                } else {
                                    AppPrincipal.state.viewMode = 'admin'; btn.innerHTML = "Modo Atleta";
                                    AppPrincipal.updateClasses(true);
                                }
                                AppPrincipal.navigateTo('planilha');
                            };
                            nav.insertBefore(btn, document.getElementById('logoutButton'));
                        }
                    }
                    AppPrincipal.state.db.ref(`users/${uid}/stravaAuth`).on('value', ts => AppPrincipal.state.stravaTokenData = ts.val());
                    AppPrincipal.updateClasses(isAdmin);
                    AppPrincipal.navigateTo('planilha');
                }
            });
        });
    },

    updateClasses: (isAdmin) => {
        const c = document.getElementById('app-container');
        if(AppPrincipal.state.viewMode==='admin' && isAdmin) { c.classList.add('admin-view'); c.classList.remove('atleta-view'); }
        else { c.classList.add('atleta-view'); c.classList.remove('admin-view'); }
    },

    navigateTo: (page) => {
        const { mainContent, loader, appContainer } = AppPrincipal.elements;
        mainContent.innerHTML = "";
        if(window.panels && window.panels.cleanup) window.panels.cleanup();
        
        let templateId = "";
        if (page === 'planilha') {
            templateId = (AppPrincipal.state.userData.role === 'admin' && AppPrincipal.state.viewMode === 'admin') ? "admin-panel-template" : "atleta-panel-template";
        } else if (page === 'feed') {
            templateId = "feed-panel-template";
        } else if (page === 'finance') {
            templateId = "finance-panel-template";
        }

        const template = document.getElementById(templateId);
        if (template) {
            mainContent.appendChild(template.content.cloneNode(true));
            if (page === 'planilha') {
                if (AppPrincipal.state.userData.role === 'admin' && AppPrincipal.state.viewMode === 'admin') AdminPanel.init(AppPrincipal.state.currentUser, AppPrincipal.state.db);
                else AtletaPanel.init(AppPrincipal.state.currentUser, AppPrincipal.state.db);
            } else if (page === 'feed') FeedPanel.init(AppPrincipal.state.currentUser, AppPrincipal.state.db);
            else if (page === 'finance') FinancePanel.init(AppPrincipal.state.currentUser, AppPrincipal.state.db);
        }
        loader.classList.add('hidden');
        appContainer.classList.remove('hidden');
    },

    handleLogout: () => AppPrincipal.state.auth.signOut().then(() => window.location.href = 'index.html'),

    // STRAVA DEEP SYNC (LOOP)
    handleStravaConnect: () => { window.location.href = `https://www.strava.com/oauth/authorize?client_id=${window.STRAVA_PUBLIC_CONFIG.clientID}&response_type=code&redirect_uri=${window.STRAVA_PUBLIC_CONFIG.redirectURI}&approval_prompt=force&scope=read_all,activity:read_all,profile:read_all`; },
    
    exchangeStravaCode: async (code) => {
        try {
            const token = await AppPrincipal.state.currentUser.getIdToken();
            await fetch(window.STRAVA_PUBLIC_CONFIG.vercelAPI, { method: 'POST', headers: {'Content-Type':'application/json','Authorization':`Bearer ${token}`}, body: JSON.stringify({code}) });
            window.history.replaceState({}, document.title, "app.html"); window.location.reload();
        } catch(e) { alert("Erro Strava Auth: " + e.message); }
    },

    handleStravaSyncActivities: async () => {
        const { stravaTokenData, currentUser } = AppPrincipal.state;
        if (!stravaTokenData) return alert("Conecte o Strava primeiro.");
        const btn = document.getElementById('btn-strava-action');
        const statusMsg = document.getElementById('strava-sync-status');
        if(btn) { btn.disabled=true; btn.textContent="Sincronizando..."; }

        try {
            const existingSnap = await AppPrincipal.state.db.ref(`data/${currentUser.uid}/workouts`).once('value');
            const existingWorkouts = existingSnap.val() || {};
            const updates = {};
            let totalImported = 0;
            let page = 1;
            let keepFetching = true;
            const perPage = 30;

            while (keepFetching) {
                if(statusMsg) statusMsg.textContent = `Buscando página ${page}...`;
                const response = await fetch(`https://www.strava.com/api/v3/athlete/activities?per_page=${perPage}&page=${page}`, { headers: { 'Authorization': `Bearer ${stravaTokenData.accessToken}` } });
                if (!response.ok) break;
                
                const activities = await response.json();
                if (activities.length === 0) { keepFetching = false; break; }

                for(const act of activities) {
                    if(!act.start_date) continue;
                    let matchKey = null;
                    const actDate = act.start_date.split('T')[0];
                    let alreadyExists = false;

                    for (const [key, val] of Object.entries(existingWorkouts)) {
                        if (val && String(val.stravaActivityId) === String(act.id)) alreadyExists = true;
                        if (val && val.date === actDate && val.status !== 'realizado') matchKey = key;
                    }

                    if(alreadyExists && !matchKey) continue;

                    await new Promise(r => setTimeout(r, 200)); 
                    const detailRes = await fetch(`https://www.strava.com/api/v3/activities/${act.id}`, { headers: { 'Authorization': `Bearer ${stravaTokenData.accessToken}` } });
                    const detail = await detailRes.json();
                    
                    let splits = [];
                    if(detail.splits_metric) {
                        splits = detail.splits_metric.map((s, i) => {
                            const pMin = Math.floor((s.moving_time/60)/(s.distance/1000)); 
                            const pSec = Math.round(((s.moving_time/60)/(s.distance/1000)-pMin)*60);
                            const pStr = `${pMin}'${pSec.toString().padStart(2,'0')}"`;
                            return { km: i+1, pace: pStr, time: new Date(s.moving_time*1000).toISOString().substr(14,5), elev: (s.elevation_difference||0).toFixed(0) };
                        });
                    }
                    
                    const distKm = (act.distance/1000).toFixed(2)+" km";
                    const paceMin = Math.floor((act.moving_time/60)/(act.distance/1000));
                    const paceSec = Math.round(((act.moving_time/60)/(act.distance/1000)-paceMin)*60);
                    const pTotal = `${paceMin}:${paceSec.toString().padStart(2,'0')}`;
                    
                    const stravaPayload = { 
                        distancia: distKm, tempo: new Date(act.moving_time*1000).toISOString().substr(11,8), 
                        ritmo: pTotal, id: act.id, splits: splits, elevacao: (act.total_elevation_gain||0)+"m",
                        mapLink: detail.map?.summary_polyline ? `https://www.strava.com/activities/${act.id}` : null
                    };

                    const commonData = {
                        status: 'realizado',
                        realizadoAt: new Date().toISOString(),
                        stravaData: stravaPayload,
                        stravaActivityId: act.id,
                        feedback: `Sincronizado. ${distKm} em ${stravaPayload.tempo}.`
                    };

                    if (matchKey) {
                        updates[`/data/${currentUser.uid}/workouts/${matchKey}`] = { ...existingWorkouts[matchKey], ...commonData };
                        updates[`/publicWorkouts/${matchKey}`] = { ownerId: currentUser.uid, ownerName: AppPrincipal.state.userData.name, ...existingWorkouts[matchKey], ...commonData };
                        totalImported++;
                    } else {
                        const newKey = AppPrincipal.state.db.ref().push().key;
                        const wData = {
                            title: act.name, date: actDate, description: `[Importado]: ${act.type}`, 
                            createdBy: currentUser.uid, ...commonData
                        };
                        updates[`/data/${currentUser.uid}/workouts/${newKey}`] = wData;
                        updates[`/publicWorkouts/${newKey}`] = { ownerId: currentUser.uid, ownerName: AppPrincipal.state.userData.name, ...wData };
                        totalImported++;
                    }
                }
                page++;
            }

            if(Object.keys(updates).length > 0) {
                await AppPrincipal.state.db.ref().update(updates);
                alert(`Sync Completo! ${totalImported} atividades.`);
            } else {
                alert("Tudo atualizado.");
            }
            document.getElementById('profile-modal').classList.add('hidden');

        } catch(e) { console.error(e); alert("Erro Sync: "+e.message); } 
        finally { if(btn) { btn.disabled=false; btn.textContent="Sincronizar Strava"; } if(statusMsg) statusMsg.textContent=""; }
    },

    // MODAIS (FEEDBACK)
    openFeedbackModal: (workoutId, ownerId, title) => {
        const modal = document.getElementById('feedback-modal');
        AppPrincipal.state.modal = { isOpen: true, currentWorkoutId: workoutId, currentOwnerId: ownerId };
        document.getElementById('feedback-modal-title').textContent = title;
        document.getElementById('comments-list').innerHTML = "Carregando...";
        document.getElementById('modal-strava-data').classList.add('hidden');

        AppPrincipal.state.db.ref(`data/${ownerId}/workouts/${workoutId}`).once('value', s => {
            if(s.exists()) {
                const d = s.val();
                if(document.getElementById('workout-status')) document.getElementById('workout-status').value = d.status || 'planejado';
                if(document.getElementById('workout-feedback-text')) document.getElementById('workout-feedback-text').value = d.feedback || '';
                
                if(d.stravaData) {
                    const content = document.getElementById('modal-strava-content');
                    document.getElementById('modal-strava-data').classList.remove('hidden');
                    let html = `<div style="text-align:center; margin-bottom:10px;"><b>${d.stravaData.distancia}</b> | ${d.stravaData.ritmo} | ${d.stravaData.tempo}</div>`;
                    if(d.stravaData.splits) {
                        html += `<table style="width:100%; font-size:0.8rem; border-collapse:collapse; text-align:center;"><thead style="background:#eee;"><tr><th>Km</th><th>Pace</th><th>Elev</th></tr></thead><tbody>`;
                        d.stravaData.splits.forEach(sp => html += `<tr><td>${sp.km}</td><td>${sp.pace}</td><td>${sp.elev}m</td></tr>`);
                        html += `</tbody></table>`;
                    }
                    if(content) content.innerHTML = html;
                }
            }
        });
        
        AppPrincipal.state.db.ref(`workoutComments/${workoutId}`).on('value', s => {
            const list = document.getElementById('comments-list');
            if(list) {
                list.innerHTML = "";
                if(!s.exists()) return;
                s.forEach(c => list.innerHTML += `<div style="border-bottom:1px solid #eee; padding:5px;"><b>${c.val().name}:</b> ${c.val().text}</div>`);
            }
        });
        modal.classList.remove('hidden');
    },
    
    handleFeedbackSubmit: async (e) => {
        e.preventDefault();
        const { currentWorkoutId, currentOwnerId } = AppPrincipal.state.modal;
        const btn = document.getElementById('save-feedback-btn');
        if(btn) { btn.disabled=true; btn.textContent="Salvando..."; }

        try {
            let imageUrl = null;
            const fileInput = document.getElementById('photo-upload-input');
            if (fileInput && fileInput.files.length > 0) {
                document.getElementById('photo-upload-feedback').textContent = "Upload...";
                imageUrl = await AppPrincipal.uploadFileToCloudinary(fileInput.files[0], 'workouts');
            }

            const updates = { 
                status: document.getElementById('workout-status').value, 
                feedback: document.getElementById('workout-feedback-text').value
            };
            if(imageUrl) updates.imageUrl = imageUrl;

            await AppPrincipal.state.db.ref(`data/${currentOwnerId}/workouts/${currentWorkoutId}`).update(updates);
            
            const fullSnap = await AppPrincipal.state.db.ref(`data/${currentOwnerId}/workouts/${currentWorkoutId}`).once('value');
            if(updates.status !== 'planejado') await AppPrincipal.state.db.ref(`publicWorkouts/${currentWorkoutId}`).set({ ownerId: currentOwnerId, ownerName: AppPrincipal.state.userCache[currentOwnerId]?.name, ...fullSnap.val() });
            
            document.getElementById('feedback-modal').classList.add('hidden');
        } catch(err) { alert("Erro: " + err.message); } 
        finally { if(btn) { btn.disabled=false; btn.textContent="Salvar Feedback"; } }
    },
    
    handleCommentSubmit: (e) => {
        e.preventDefault();
        const text = document.getElementById('comment-input').value;
        if(!text) return;
        AppPrincipal.state.db.ref(`workoutComments/${AppPrincipal.state.modal.currentWorkoutId}`).push({ uid: AppPrincipal.state.currentUser.uid, name: AppPrincipal.state.userData.name, text: text, timestamp: firebase.database.ServerValue.TIMESTAMP });
        document.getElementById('comment-input').value = "";
    },

    handlePhotoUpload: async (e) => {
        const file = e.target.files[0];
        if(!file) return;
        const feedback = document.getElementById('photo-upload-feedback');
        if(feedback) feedback.textContent = "Analisando...";
        try {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = async () => {
                const base64 = reader.result.split(',')[1];
                const prompt = `Analise esta imagem. JSON: { "distancia": "X km", "tempo": "HH:MM:SS", "ritmo": "X:XX /km" }`;
                const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${window.GEMINI_API_KEY}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ contents: [{ parts: [{ text: prompt }, { inlineData: { mimeType: file.type, data: base64 } }] }] }) });
                const data = await res.json();
                const json = JSON.parse(data.candidates[0].content.parts[0].text);
                if(feedback) feedback.textContent = "Dados extraídos!";
                const sd = document.getElementById('modal-strava-content');
                const box = document.getElementById('modal-strava-data');
                if(box) box.classList.remove('hidden');
                if(sd) sd.innerHTML = `<div><b>IA Vision:</b> ${json.distancia} | ${json.tempo} | ${json.ritmo}</div>`;
            };
        } catch (err) { if(feedback) feedback.textContent = "Erro leitura IA."; }
    },

    openProfileModal: () => { 
        document.getElementById('profile-modal').classList.remove('hidden'); 
        const u = AppPrincipal.state.userData;
        if(u) {
            document.getElementById('profile-name').value = u.name || "";
            document.getElementById('profile-bio').value = u.bio || "";
            document.getElementById('profile-pic-preview').src = u.photoUrl || "https://placehold.co/150";
        }
        const container = document.getElementById('strava-connection-area');
        if(container) {
            container.innerHTML = "";
            const btn = document.createElement('button'); btn.className='btn btn-secondary'; btn.style.width='100%'; btn.style.marginTop='15px';
            if (AppPrincipal.state.stravaTokenData) {
                btn.innerHTML = "Sincronizar Strava (Deep)"; btn.style.backgroundColor = "#fc4c02"; btn.onclick = AppPrincipal.handleStravaSyncActivities;
                const status = document.createElement('p'); status.id="strava-sync-status"; status.style.fontSize="0.8rem"; container.appendChild(status);
            } else {
                btn.innerHTML = "Conectar Strava"; btn.onclick = AppPrincipal.handleStravaConnect;
            }
            container.appendChild(btn);
        }
    },

    handleProfileSubmit: async (e) => { 
        e.preventDefault(); 
        await AppPrincipal.state.db.ref(`users/${AppPrincipal.state.currentUser.uid}`).update({name: document.getElementById('profile-name').value, bio: document.getElementById('profile-bio').value});
        document.getElementById('profile-modal').classList.add('hidden');
    },
    
    callGeminiTextAPI: async (prompt) => {
        if(!window.GEMINI_API_KEY) return "Sem Chave API";
        const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${window.GEMINI_API_KEY}`, { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }) });
        const d = await r.json(); return d.candidates[0].content.parts[0].text;
    },

    handleSaveIaAnalysis: async () => {
        if(!AppPrincipal.state.currentAnalysisData) return;
        await AppPrincipal.state.db.ref(`iaAnalysisHistory/${AdminPanel.state.selectedAthleteId}`).push(AppPrincipal.state.currentAnalysisData);
        document.getElementById('ia-analysis-modal').classList.add('hidden');
    },

    uploadFileToCloudinary: async (file, folder) => {
        const formData = new FormData(); formData.append('file', file); formData.append('upload_preset', window.CLOUDINARY_CONFIG.uploadPreset); formData.append('folder', `lerunners/${folder}`);
        const res = await fetch(`https://api.cloudinary.com/v1_1/${window.CLOUDINARY_CONFIG.cloudName}/upload`, { method: 'POST', body: formData });
        const data = await res.json(); return data.secure_url;
    }
};

const AuthLogic = {
    init: (auth, db) => {
        document.getElementById('login-form').addEventListener('submit', (e) => {
            e.preventDefault();
            auth.signInWithEmailAndPassword(document.getElementById('loginEmail').value, document.getElementById('loginPassword').value)
                .then(() => window.location.href = 'app.html')
                .catch(e => document.getElementById('login-error').textContent = e.message);
        });
    }
};

document.addEventListener('DOMContentLoaded', AppPrincipal.init);