/* =================================================================== */
/* FINANCE.JS V1.0 - MÓDULO FINANCEIRO DENT-IA ADAPTADO
/* Contém: Receitas, Despesas, Estoque e Relatórios
/* =================================================================== */

const FinancePanel = {
    state: { items: [] },
    init: (user, db) => {
        console.log("FinancePanel: Init");
        FinancePanel.state.db = db;
        FinancePanel.state.user = user;
        FinancePanel.switchTab('receber');
        
        // Listener de Saldo Geral
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
        div.innerHTML = ""; // Limpa conteúdo
        
        // Botão Novo (Ação)
        const controls = document.createElement('div');
        controls.style.marginBottom = "15px";
        const btn = document.createElement('button');
        btn.className = "btn btn-primary";
        btn.textContent = tab === 'receber' ? "+ Nova Receita" : (tab === 'pagar' ? "+ Nova Despesa" : "+ Novo Produto");
        btn.onclick = () => FinancePanel.openModal(tab);
        controls.appendChild(btn);
        div.appendChild(controls);
        
        // Container da Lista
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
                
                // Botão Excluir Individual
                itemDiv.querySelector('.btn-del-fin').onclick = () => FinancePanel.deleteItem(refPath, c.key);
                listDiv.appendChild(itemDiv);
            });
        });
    },

    deleteItem: (path, key) => {
        if(confirm("Tem certeza que deseja excluir este registro?")) {
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
        if(title) title.textContent = type === 'receber' ? "Nova Receita" : (type === 'pagar' ? "Nova Despesa" : "Novo Produto");
        
        const stockArea = document.getElementById('fin-stock-area');
        const athleteGroup = document.getElementById('fin-athlete-group');
        
        // Reset de visualização
        if(stockArea) stockArea.classList.add('hidden');
        if(athleteGroup) athleteGroup.classList.add('hidden');
        
        if(type === 'estoque') {
            // Apenas campos básicos
        } else if (type === 'receber') {
            if(stockArea) stockArea.classList.remove('hidden');
            if(athleteGroup) athleteGroup.classList.remove('hidden');
            
            // Popula Produtos
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
            
            // Popula Alunos
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
            // Novo Produto
            FinancePanel.state.db.ref('stock').push({ name: desc, price: val, quantity: 0 }); 
        } else {
            const prodId = document.getElementById('fin-product-select').value;
            const qty = parseFloat(document.getElementById('fin-qty').value || 0);
            
            // Se for receita com produto, baixa estoque
            if(type === 'receber' && prodId) {
                const stockRef = FinancePanel.state.db.ref(`stock/${prodId}/quantity`);
                stockRef.transaction(current => (current || 0) - qty);
            }
            
            // Salva Transação
            const path = type === 'receber' ? 'receivables' : 'expenses';
            FinancePanel.state.db.ref(`finance/${path}`).push({
                description: desc, 
                amount: val, 
                date: date, 
                athleteId: document.getElementById('fin-athlete-select').value || null
            });
        }
        document.getElementById('finance-modal').classList.add('hidden');
        e.target.reset();
    }
};