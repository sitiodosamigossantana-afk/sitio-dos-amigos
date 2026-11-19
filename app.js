
const SUPABASE_URL = "https://bftkhkynchubkwyfokrw.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_M2OBTDBMqsSzSKb79cxXtg_1ejlyqpt";
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);
let currentUser = null;
const initialMenu=[
['Balde','Skol',65],['Balde','Original',75],['Balde','Heineken',120],['Balde','Corona',130],['Balde','Amstel',70],['Balde','Brahma Puro',75],['Balde','Estela',80],
['Cerveja unidade','Skol',6.5],['Cerveja unidade','Original',7.5],['Cerveja unidade','Heineken',12],['Cerveja unidade','Corona',13],['Cerveja unidade','Amstel',0],['Cerveja unidade','Brahma Puro',0],['Cerveja unidade','Estela',0],
['Copão','Gym',25],['Copão','Cavalo',30],['Copão','Red Label',45],
['Refrigerantes','Coca 2L',18],['Refrigerantes','Lata',8],['Refrigerantes','Itubaína 2L',13],['Refrigerantes','Fanta',16],['Refrigerantes','Água',5],['Refrigerantes','Energético 2L',20],
['Demais','Ice',13],['Demais','Red Bull',15],['Demais','Caipirinha',25],['Demais','Caipiroska',25],['Demais','Batida',20],['Demais','Gelo saborizado',5],
['Porção/Pastel','Calabresa',45],['Porção/Pastel','Batata',35],['Porção/Pastel','Frango à passarinho',50],['Porção/Pastel','Peixe',70],
['Entradas','Criança Até 5 anos',5],['Entradas','Criança',10],['Entradas','Adulto',10],['Entradas','Shows',20]
].map((x,i)=>({id:'m'+i,category:x[0],name:x[1],price:x[2]}));
const initialStock=[...initialMenu.map(p=>p.name),'Gin','Whisky','Gelo de coco','Gelo saborizado - limão','Gelo saborizado - morango','Gelo saborizado - maracujá','Gelo saborizado - frutas vermelhas'].filter((v,i,a)=>a.indexOf(v)===i).map((name,i)=>({id:'s'+i,name,qty:0,unit:'un'}));
let db=JSON.parse(localStorage.getItem('sitioDB')||'null')||{menu:initialMenu,stock:initialStock,clients:[],sales:[],expenses:[],recipes:{'Gym':[{stock:'Gin',qty:1},{stock:'@ice',qty:1}],'Cavalo':[{stock:'Whisky',qty:1},{stock:'Gelo de coco',qty:1}],'Red Label':[{stock:'Whisky',qty:1},{stock:'Gelo de coco',qty:1}]},cashOpen:true};
function makeUuid(){return crypto.randomUUID()}
function ensureCloudIds(){for(const list of [db.menu,db.stock,db.clients,db.sales,db.expenses])for(const x of list){if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(x.id||'')))x.id=makeUuid()}}
let cloudSyncBusy=false,cloudSyncAgain=false;
async function save(){
 localStorage.setItem('sitioDB',JSON.stringify(db));renderAll();
 if(!currentUser)return;
 if(cloudSyncBusy){cloudSyncAgain=true;return;}
 cloudSyncBusy=true;
 try{await saveOperationalData();}
 catch(e){console.error(e);alert('Os dados foram mantidos neste aparelho, mas não foi possível sincronizar com o banco. Confira a conexão e as permissões do Supabase. Detalhe: '+(e.message||e));}
 finally{cloudSyncBusy=false;if(cloudSyncAgain){cloudSyncAgain=false;await save();}}
}
async function saveOperationalData(){
 ensureCloudIds();
 const jobs=[
  ...(isPrivileged()?[['menu_items',db.menu.map(x=>({id:x.id,name:x.name,category:x.category,price:Number(x.price||0),active:true}))]]:[]),
  ['stock_items',db.stock.map(x=>({id:x.id,name:x.name,quantity:Number(x.qty||0),unit:x.unit||'un'}))],
  ['clients',db.clients.map(x=>({id:x.id,name:x.name,nickname:x.nick||'',phone:x.phone||''}))],
  ['sales',db.sales.filter(x=>!x.created_by||x.created_by===currentUser.id).map(x=>({id:x.id,created_by:x.created_by||currentUser.id,client_id:db.clients.find(c=>c.name===x.client)?.id||null,client_name:x.client||'Consumidor',payment_method:x.payment,total:Number(x.total||0),paid:!!x.paid,items:x.items||[],created_at:x.date||new Date().toISOString()}))],
  ...(isPrivileged()?[['expenses',db.expenses.map(x=>({id:x.id,created_by:x.created_by||currentUser.id,description:x.name,amount:Number(x.value||0),created_at:x.date||new Date().toISOString()}))]]:[])
 ];
 for(const [table,rows] of jobs){if(rows.length){const {error}=await supabaseClient.from(table).upsert(rows,{onConflict:'id'});if(error)throw new Error(table+': '+error.message)}}
 const menuByName=new Map(db.menu.map(x=>[x.name,x.id]));const stockByName=new Map(db.stock.map(x=>[x.name,x.id]));
 const recipeRows=[];
 for(const [menuName,parts] of Object.entries(db.recipes||{}))for(const r of parts){const menuId=menuByName.get(menuName);if(menuId)recipeRows.push({menu_item_id:menuId,stock_item_id:r.stock==='@ice'?null:(stockByName.get(r.stock)||null),quantity:Number(r.qty||0),use_selected_ice:r.stock==='@ice'})}
 if(isPrivileged()){const {error:delError}=await supabaseClient.from('recipes').delete().not('menu_item_id','is',null);if(delError)throw new Error('recipes: '+delError.message);if(recipeRows.length){const {error}=await supabaseClient.from('recipes').insert(recipeRows);if(error)throw new Error('recipes: '+error.message)}}
}
async function loadOperationalData(){
 const names=['menu_items','stock_items','clients','sales','recipes',...(isPrivileged()?['expenses']:[])];const out={expenses:[]};
 for(const table of names){const {data,error}=await supabaseClient.from(table).select('*');if(error)throw new Error('Leitura de '+table+': '+error.message);out[table]=data||[]}
 if(out.menu_items.length)db.menu=out.menu_items.map(x=>({id:x.id,category:x.category||'Outros',name:x.name,price:Number(x.price||0)}));
 if(out.stock_items.length)db.stock=out.stock_items.map(x=>({id:x.id,name:x.name,qty:Number(x.quantity||0),unit:x.unit||'un'}));
 db.clients=out.clients.map(x=>({id:x.id,name:x.name,nick:x.nickname||'',phone:x.phone||''}));
 db.sales=out.sales.map(x=>({id:x.id,date:x.created_at,items:Array.isArray(x.items)?x.items:[],client:x.client_name||'',payment:x.payment_method||'',total:Number(x.total||0),paid:!!x.paid,created_by:x.created_by}));
 db.expenses=out.expenses.map(x=>({id:x.id,name:x.description,value:Number(x.amount||0),date:x.created_at,created_by:x.created_by}));
 if(out.menu_items.length){const menuById=new Map(out.menu_items.map(x=>[x.id,x.name]));const stockById=new Map(out.stock_items.map(x=>[x.id,x.name]));const recipes={};for(const r of out.recipes){const mn=menuById.get(r.menu_item_id);if(!mn)continue;(recipes[mn]??=[]).push({stock:r.use_selected_ice?'@ice':(stockById.get(r.stock_item_id)||''),qty:Number(r.quantity||0)})}db.recipes=recipes;}
 if(!out.menu_items.length){ensureCloudIds();await saveOperationalData();}
 localStorage.setItem('sitioDB',JSON.stringify(db));
}
let realtimeChannel=null,remoteRefreshTimer=null,remoteRefreshBusy=false;
function startRealtimeSync(){
 if(realtimeChannel)supabaseClient.removeChannel(realtimeChannel);
 realtimeChannel=supabaseClient.channel('sitio-operational-sync-'+currentUser.id);
 for(const table of ['menu_items','stock_items','clients','sales','recipes',...(isPrivileged()?['expenses']:[])]){
  realtimeChannel=realtimeChannel.on('postgres_changes',{event:'*',schema:'public',table},()=>{
   if(remoteRefreshTimer)clearTimeout(remoteRefreshTimer);
   remoteRefreshTimer=setTimeout(async()=>{
    if(remoteRefreshBusy||!currentUser)return;remoteRefreshBusy=true;
    try{await loadOperationalData();renderAll();}catch(e){console.error('Falha ao atualizar dados em tempo real:',e);}
    finally{remoteRefreshBusy=false;}
   },350);
  });
 }
 realtimeChannel.subscribe(status=>{if(status==='CHANNEL_ERROR'||status==='TIMED_OUT')console.warn('Sincronização em tempo real indisponível:',status);});
}
function money(v){return Number(v||0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'})}
function esc(s){return String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function showTab(id){if(id==='usuarios'&&!isPrivileged())return;document.querySelectorAll('.page').forEach(x=>x.classList.toggle('hidden',x.id!==id));document.querySelectorAll('.tabs button').forEach(x=>x.classList.toggle('active',x.dataset.tab===id));if(id==='usuarios')renderUsers();}
document.querySelectorAll('.tabs button').forEach(b=>b.onclick=()=>showTab(b.dataset.tab));
function todayKey(){return new Date().toLocaleDateString('pt-BR')}
function todaySales(){return db.sales.filter(s=>new Date(s.date).toLocaleDateString('pt-BR')===todayKey())}
function renderAll(){renderHome();renderStock();renderMenu();renderClients();renderSales();renderFinance()}
function renderHome(){let ss=todaySales(),total=ss.reduce((a,s)=>a+s.total,0),paid=ss.filter(s=>s.payment!=='Fiado').reduce((a,s)=>a+s.total,0);document.getElementById('today').textContent=todayKey();document.getElementById('metrics').innerHTML=[['Vendas hoje',money(total)],['Vendas registradas',ss.length],['Recebido hoje',money(paid)],['Fiado hoje',money(total-paid)]].map(x=>`<div class="card"><div class="muted">${x[0]}</div><div class="metric">${x[1]}</div></div>`).join('');document.getElementById('recent').innerHTML=db.sales.slice(-5).reverse().map(s=>`<div class="item"><div><b>${esc(s.client||'Consumidor')}</b><div class="muted">${new Date(s.date).toLocaleString('pt-BR')} • ${esc(s.payment)}</div></div><b>${money(s.total)}</b></div>`).join('')||'<p class="muted">Nenhuma venda registrada.</p>'}
function renderStock(){let q=(document.getElementById('stockSearch')?.value||'').toLowerCase();document.getElementById('stockList').innerHTML=db.stock.filter(s=>s.name.toLowerCase().includes(q)).map(s=>`<div class="item"><div><b>${esc(s.name)}</b><div class="muted">Unidade: ${esc(s.unit||'un')}</div></div><div class="row"><b>${s.qty}</b>${isPrivileged()?`<button class="small secondary" onclick="stockIn('${s.id}')">Entrada</button><button class="small secondary" onclick="editStock('${s.id}')">Editar</button>`:''}</div></div>`).join('');document.getElementById('recipeList').innerHTML=Object.keys(db.recipes).map(n=>`<div class="item"><div><b>${esc(n)}</b><div class="muted">${db.recipes[n].map(r=>r.stock==='@ice'?'Gelo saborizado escolhido':esc(r.stock)+' × '+r.qty).join(' + ')}</div></div>${isPrivileged()?`<button class="small secondary" onclick="editRecipe('${n}')">Configurar</button>`:''}</div>`).join('')}
function renderMenu(){let q=(document.getElementById('menuSearch')?.value||'').toLowerCase();let groups={};db.menu.filter(p=>(p.name+' '+p.category).toLowerCase().includes(q)).forEach(p=>(groups[p.category]??=[]).push(p));document.getElementById('menuList').innerHTML=Object.entries(groups).map(([g,ps])=>`<div class="section"><h3>${esc(g)}</h3>${ps.map(p=>`<div class="item"><div><b>${esc(p.name)}</b><div class="muted">${p.price?money(p.price):'Preço não informado'}</div></div><button class="small secondary" onclick="editMenu('${p.id}')">Editar</button></div>`).join('')}</div>`).join('')}
function renderClients(){document.getElementById('clientList').innerHTML=db.clients.map(c=>`<div class="item"><div><b>${esc(c.name)}</b><div class="muted">${esc(c.nick||'')} • ${esc(c.phone||'')}</div></div><button class="small secondary" onclick="editClient('${c.id}')">Editar</button></div>`).join('')||'<p class="muted">Cadastre clientes para identificar vendas e controlar o fiado.</p>'}
function renderSales(){let q=(document.getElementById('saleSearch')?.value||'').toLowerCase();document.getElementById('salesList').innerHTML=db.sales.slice().reverse().filter(s=>(s.client+' '+s.payment).toLowerCase().includes(q)).map(s=>`<div class="item"><div><b>${esc(s.client||'Consumidor')}</b><div class="muted">${new Date(s.date).toLocaleString('pt-BR')} • ${esc(s.payment)} • ${s.items.map(i=>esc(i.name)+' x'+i.qty).join(', ')}</div></div><b>${money(s.total)}</b></div>`).join('')||'<p class="muted">Nenhuma venda encontrada.</p>'}
function renderFinance(){if(!isPrivileged())return;let ss=todaySales(),total=ss.reduce((a,s)=>a+s.total,0),expenses=db.expenses.filter(e=>new Date(e.date).toLocaleDateString('pt-BR')===todayKey()).reduce((a,e)=>a+e.value,0);document.getElementById('financeMetrics').innerHTML=[['Vendas hoje',money(total)],['Despesas hoje',money(expenses)],['Saldo após despesas',money(total-expenses)],['Fiado em aberto',money(db.sales.filter(s=>s.payment==='Fiado'&&!s.paid).reduce((a,s)=>a+s.total,0))]].map(x=>`<div class="card"><div class="muted">${x[0]}</div><div class="metric">${x[1]}</div></div>`).join('');document.getElementById('financeList').innerHTML=db.sales.slice(-12).reverse().map(s=>`<div class="item"><div><b>${esc(s.payment)} — ${esc(s.client||'Consumidor')}</b><div class="muted">${new Date(s.date).toLocaleString('pt-BR')}</div></div><b>${money(s.total)}</b></div>`).join('')+db.expenses.slice(-5).reverse().map(e=>`<div class="item"><div><b>Despesa: ${esc(e.name)}</b><div class="muted">${new Date(e.date).toLocaleString('pt-BR')}</div></div><b>− ${money(e.value)}</b></div>`).join('')}
function openModal(title,html){document.getElementById('modalTitle').textContent=title;document.getElementById('modalBody').innerHTML=html;document.getElementById('modal').classList.remove('hidden')}
function closeModal(){document.getElementById('modal').classList.add('hidden')}
function openSale(){let cart={};let options=db.menu.map(p=>`<option value="${p.id}">${esc(p.category)} — ${esc(p.name)} (${money(p.price)})</option>`).join('');openModal('Nova venda',`<div class="stack"><label>Produto<select id="sellProduct">${options}</select></label><div class="formgrid"><label>Quantidade<input id="sellQty" type="number" min="1" value="1"></label><label>&nbsp;<button onclick="addToCart()">Adicionar ao pedido</button></label></div><div id="cartView" class="card">Nenhum produto adicionado.</div><label>Cliente<select id="sellClient"><option value="">Consumidor / sem cadastro</option>${db.clients.map(c=>`<option>${esc(c.name)}</option>`).join('')}</select></label><label>Forma de pagamento<select id="sellPayment"><option>Pix</option><option>Dinheiro</option><option>Débito</option><option>Crédito</option><option>Fiado</option></select></label><div class="row"><b>Total</b><strong id="cartTotal">${money(0)}</strong></div><button onclick="finishSale()">Finalizar venda</button></div>`);window.currentCart=cart}
function addToCart(){let p=db.menu.find(x=>x.id===document.getElementById('sellProduct').value),q=Math.max(1,Number(document.getElementById('sellQty').value));let c=window.currentCart;c[p.id]=(c[p.id]||0)+q;renderCart()}
function renderCart(){let c=window.currentCart,items=Object.entries(c).map(([id,q])=>({p:db.menu.find(x=>x.id===id),q}));let total=items.reduce((a,x)=>a+x.p.price*x.q,0);document.getElementById('cartView').innerHTML=items.map(x=>`<div class="item"><span>${esc(x.p.name)} × ${x.q}</span><b>${money(x.p.price*x.q)}</b></div>`).join('')||'Nenhum produto adicionado.';document.getElementById('cartTotal').textContent=money(total)}
function finishSale(){let items=Object.entries(window.currentCart).map(([id,qty])=>({productId:id,name:db.menu.find(p=>p.id===id).name,qty,price:db.menu.find(p=>p.id===id).price}));if(!items.length)return alert('Adicione pelo menos um produto.');let client=document.getElementById('sellClient').value,payment=document.getElementById('sellPayment').value;let deductions=[];for(let it of items){let recipe=db.recipes[it.name];if(recipe){for(let r of recipe){if(r.stock==='@ice'){let flavors=db.stock.filter(s=>s.name.toLowerCase().startsWith('gelo saborizado'));let chosen=prompt('Escolha o sabor do gelo:\\n'+flavors.map(s=>s.name.replace('Gelo saborizado - ','')).join(', '));if(!chosen)return;let found=flavors.find(s=>s.name.toLowerCase().includes(chosen.toLowerCase()));if(!found)return alert('Sabor não encontrado.');deductions.push({stock:found,qty:r.qty*it.qty})}else{let st=db.stock.find(s=>s.name===r.stock);if(st)deductions.push({stock:st,qty:r.qty*it.qty})}}}else{let st=db.stock.find(s=>s.name===it.name);if(st)deductions.push({stock:st,qty:it.qty})}}
let shortage=deductions.filter(d=>d.stock.qty<d.qty);if(shortage.length&&!confirm('Atenção: estoque insuficiente para '+shortage.map(d=>d.stock.name).join(', ')+'. Registrar mesmo assim?'))return;
deductions.forEach(d=>d.stock.qty-=d.qty);let total=items.reduce((a,i)=>a+i.price*i.qty,0);db.sales.push({id:Date.now(),date:new Date().toISOString(),items,client,payment,total,paid:payment!=='Fiado'});closeModal();save();alert('Venda registrada!')}
function addStock(){if(!isPrivileged())return alert('Sem permissão para cadastrar estoque.');openModal('Novo item de estoque',`<div class="stack"><label>Nome<input id="newStockName"></label><label>Unidade<input id="newStockUnit" value="un"></label><button onclick="let n=document.getElementById('newStockName').value.trim();if(!n)return alert('Informe o nome');db.stock.push({id:'s'+Date.now(),name:n,qty:0,unit:document.getElementById('newStockUnit').value});closeModal();save()">Cadastrar com saldo zero</button></div>`)}
function stockIn(id){if(!isPrivileged())return alert('Sem permissão para editar o estoque.');let s=db.stock.find(x=>x.id===id),n=prompt('Quantidade de entrada para '+s.name,s.qty);if(n===null||!Number.isFinite(Number(n))||Number(n)<=0)return;s.qty+=Number(n);save()}
function editStock(id){if(!isPrivileged())return alert('Sem permissão para editar o estoque.');let s=db.stock.find(x=>x.id===id);openModal('Editar estoque',`<div class="stack"><label>Nome<input id="stName" value="${esc(s.name)}"></label><label>Saldo atual<input id="stQty" type="number" step=".01" value="${s.qty}"></label><label>Unidade<input id="stUnit" value="${esc(s.unit)}"></label><button onclick="s.name=document.getElementById('stName').value;s.qty=Number(document.getElementById('stQty').value);s.unit=document.getElementById('stUnit').value;closeModal();save()">Salvar</button></div>`)}
function editRecipe(name){if(!isPrivileged())return alert('Sem permissão para alterar receitas.');let current=db.recipes[name],stockOpts=db.stock.map(s=>`<option>${esc(s.name)}</option>`).join('');openModal('Receita: '+name,`<p class="muted">Informe os itens consumidos por unidade vendida. Para Gym, mantenha “Gelo saborizado escolhido” para perguntar o sabor na venda.</p><div id="recipeEdit">${current.map((r,i)=>`<div class="formgrid" style="margin:8px 0"><label>Insumo<select id="ri${i}"><option value="@ice" ${r.stock==='@ice'?'selected':''}>Gelo saborizado escolhido</option>${db.stock.map(s=>`<option ${s.name===r.stock?'selected':''}>${esc(s.name)}</option>`).join('')}</select></label><label>Quantidade<input id="rq${i}" type="number" min=".01" step=".01" value="${r.qty}"></label></div>`).join('')}</div><button onclick="let a=[];${current.map((r,i)=>`a.push({stock:document.getElementById('ri${i}').value,qty:Number(document.getElementById('rq${i}').value)})`).join(';')};db.recipes['${name}']=a;closeModal();save()">Salvar receita</button>`)}
function addMenu(){if(!isPrivileged())return alert('Sem permissão para alterar o cardápio.');openModal('Novo produto',`<div class="stack"><label>Categoria<input id="mnCat"></label><label>Produto<input id="mnName"></label><label>Preço (R$)<input id="mnPrice" type="number" step=".01"></label><button onclick="let n=document.getElementById('mnName').value.trim();if(!n)return;let p={id:'m'+Date.now(),category:document.getElementById('mnCat').value||'Outros',name:n,price:Number(document.getElementById('mnPrice').value)};db.menu.push(p);if(!db.stock.some(s=>s.name===n))db.stock.push({id:'s'+Date.now(),name:n,qty:0,unit:'un'});closeModal();save()">Cadastrar</button></div>`)}
function editMenu(id){if(!isPrivileged())return alert('Sem permissão para alterar o cardápio.');let p=db.menu.find(x=>x.id===id);openModal('Editar produto',`<div class="stack"><label>Nome<input id="pName" value="${esc(p.name)}"></label><label>Categoria<input id="pCat" value="${esc(p.category)}"></label><label>Preço (R$)<input id="pPrice" type="number" step=".01" value="${p.price}"></label><button onclick="p.name=document.getElementById('pName').value;p.category=document.getElementById('pCat').value;p.price=Number(document.getElementById('pPrice').value);closeModal();save()">Salvar alterações</button></div>`)}
function addClient(){openModal('Cadastrar cliente',`<div class="stack"><label>Nome<input id="cName"></label><label>Apelido<input id="cNick"></label><label>Telefone<input id="cPhone" type="tel"></label><button onclick="let n=document.getElementById('cName').value.trim();if(!n)return alert('Informe o nome');db.clients.push({id:'c'+Date.now(),name:n,nick:document.getElementById('cNick').value,phone:document.getElementById('cPhone').value});closeModal();save()">Salvar cliente</button></div>`)}
function editClient(id){let c=db.clients.find(x=>x.id===id);openModal('Editar cliente',`<div class="stack"><label>Nome<input id="cn" value="${esc(c.name)}"></label><label>Apelido<input id="ck" value="${esc(c.nick)}"></label><label>Telefone<input id="ct" value="${esc(c.phone)}"></label><button onclick="c.name=document.getElementById('cn').value;c.nick=document.getElementById('ck').value;c.phone=document.getElementById('ct').value;closeModal();save()">Salvar</button></div>`)}
function addExpense(){if(!isPrivileged())return alert('Sem permissão para acessar o financeiro.');let name=document.getElementById('expenseName').value.trim(),value=Number(document.getElementById('expenseValue').value);if(!name||value<=0)return alert('Informe descrição e valor.');db.expenses.push({name,value,date:new Date().toISOString()});document.getElementById('expenseName').value='';document.getElementById('expenseValue').value='';save()}
function backup(){let b=new Blob([JSON.stringify(db,null,2)],{type:'application/json'}),a=document.createElement('a');a.href=URL.createObjectURL(b);a.download='backup-sitio-dos-amigos.json';a.click();URL.revokeObjectURL(a.href)}
function restore(e){let f=e.target.files[0];if(!f)return;let r=new FileReader();r.onload=()=>{try{db=JSON.parse(r.result);save();alert('Backup importado.')}catch{alert('Arquivo inválido.')}};r.readAsText(f)}
function resetData(){if(confirm('Tem certeza? Isso apagará vendas, clientes, estoque e configurações deste aparelho.')){localStorage.removeItem('sitioDB');location.reload()}}

let currentRole='staff';
function isPrivileged(){return currentRole==='admin'||currentRole==='manager'}
function applyRole(role){
 currentRole=role||'staff';
 const finance=document.getElementById('financeTab');if(finance)finance.classList.toggle('hidden',!isPrivileged());
 const notice=document.getElementById('roleNotice');
 if(notice)notice.textContent=currentRole==='staff'?'Funcionário: registra vendas e consulta o estoque, sem editar estoque ou acessar o financeiro.':currentRole==='manager'?'Gerente: pode administrar cardápio, estoque e financeiro.':'Administrador: acesso completo.';
 const addMenuBtn=document.getElementById('addMenuButton');if(addMenuBtn)addMenuBtn.classList.toggle('hidden',!isPrivileged());
 const usersTab=document.getElementById('usersTab');if(usersTab)usersTab.classList.toggle('hidden',!isPrivileged());
 const historyCard=document.getElementById('approvalHistoryCard');if(historyCard)historyCard.classList.toggle('hidden',currentRole!=='admin');
 const roleLabel=document.getElementById('accountRole');if(roleLabel)roleLabel.textContent=currentRole==='admin'?'ADMINISTRADOR':currentRole==='manager'?'GERENTE':'FUNCIONÁRIO';
 if(!isPrivileged()&&!document.getElementById('financeiro').classList.contains('hidden'))showTab('inicio');
 renderStock();
}
function roleName(role){return role==='admin'?'Administrador':role==='manager'?'Gerente':'Funcionário'}
async function renderUsers(){
 if(!isPrivileged())return;
 const pending=document.getElementById('pendingUsers');
 if(!pending)return;
 pending.innerHTML='<p class="muted">Carregando solicitações...</p>';
 const {data:rows,error}=await supabaseClient.from('profiles').select('id, full_name, role, approval_status, created_at').eq('approval_status','pending').order('created_at',{ascending:true});
 if(error){pending.innerHTML='<p class="muted">Não foi possível carregar as solicitações. Confira a atualização de permissões do Supabase.</p><p class="muted">'+esc(error.message)+'</p>';return;}
 if(!rows||!rows.length){pending.innerHTML='<p class="muted">Não há usuários aguardando aprovação.</p>';}else{
  pending.innerHTML=rows.map(u=>{
   const options=currentRole==='admin'?'<option value="staff">Funcionário</option><option value="manager">Gerente</option><option value="admin">Administrador</option>':'<option value="staff">Funcionário</option><option value="manager">Gerente</option>';
   return `<div class="item" style="align-items:flex-start"><div style="min-width:0;flex:1"><b>${esc(u.full_name||'Sem nome informado')}</b><div class="muted">Cadastro: ${new Date(u.created_at).toLocaleString('pt-BR')}</div><div class="muted" style="word-break:break-all">ID: ${esc(u.id)}</div><label style="margin-top:8px">Cargo após aprovação<select id="approveRole_${u.id}">${options}</select></label><button style="margin-top:9px" onclick="approvePendingUser('${u.id}')">Aprovar usuário</button></div></div>`;
  }).join('');
 }
 if(currentRole==='admin')await renderApprovalHistory();
}
async function approvePendingUser(userId){
 if(!isPrivileged())return alert('Sem permissão para aprovar usuários.');
 const select=document.getElementById('approveRole_'+userId);if(!select)return;
 const role=select.value;
 if(currentRole==='manager'&&role==='admin')return alert('Gerentes não podem aprovar administradores.');
 if(!confirm('Confirma a aprovação deste usuário como '+roleName(role)+'?'))return;
 const {error}=await supabaseClient.rpc('approve_profile',{p_user_id:userId,p_role:role});
 if(error){alert('Não foi possível aprovar: '+error.message);return;}
 alert('Usuário aprovado com sucesso como '+roleName(role)+'.');
 await renderUsers();
}
async function renderApprovalHistory(){
 const target=document.getElementById('approvalHistory');if(!target||currentRole!=='admin')return;
 const {data,error}=await supabaseClient.from('profile_approval_history').select('user_id, approved_by, granted_role, approved_at').order('approved_at',{ascending:false}).limit(30);
 if(error){target.innerHTML='<p class="muted">Não foi possível carregar o histórico: '+esc(error.message)+'</p>';return;}
 if(!data||!data.length){target.innerHTML='<p class="muted">Nenhuma aprovação registrada ainda.</p>';return;}
 target.innerHTML=data.map(h=>`<div class="item"><div><b>${roleName(h.granted_role)}</b><div class="muted">Aprovado em ${new Date(h.approved_at).toLocaleString('pt-BR')}</div><div class="muted" style="word-break:break-all">Usuário: ${esc(h.user_id)}</div><div class="muted" style="word-break:break-all">Autorizado por: ${esc(h.approved_by)}</div></div></div>`).join('');
}
function showLogin(message=''){
 document.getElementById('loginScreen').classList.remove('hidden');
 document.getElementById('appMain').classList.add('hidden');
 const m=document.getElementById('loginMessage');m.textContent=message;m.classList.toggle('hidden',!message);
}
function showApp(user){
 currentUser=user;
 document.getElementById('loginScreen').classList.add('hidden');
 document.getElementById('appMain').classList.remove('hidden');
 document.getElementById('accountEmail').textContent=user.email||'';
}
function toggleLoginPassword(){
 const input=document.getElementById('loginPassword');
 const button=document.getElementById('toggleLoginPassword');
 const showing=input.type==='password';
 input.type=showing?'text':'password';
 button.textContent=showing?'Ocultar':'Mostrar';
 button.setAttribute('aria-label',showing?'Ocultar senha':'Mostrar senha');
 button.setAttribute('aria-pressed',String(showing));
}
async function handleLogin(event){
 event.preventDefault();
 const button=document.getElementById('loginButton');button.disabled=true;button.textContent='Entrando...';
 const email=document.getElementById('loginEmail').value.trim();
 const password=document.getElementById('loginPassword').value;
 const {data,error}=await supabaseClient.auth.signInWithPassword({email,password});
 button.disabled=false;button.textContent='Entrar';
 if(error){showLogin('Não foi possível entrar: '+error.message);return;}
 await loadUserProfile(data.user);
}
async function loadUserProfile(user){
 const {data:profile,error}=await supabaseClient.from('profiles').select('full_name, role, must_change_password, approval_status').eq('id',user.id).single();
 if(error||!profile){await supabaseClient.auth.signOut();showLogin('Seu perfil ainda não foi encontrado. Confira o cadastro no Supabase e fale comigo antes de continuar.');return;}
 if(profile.approval_status==='pending'){
  await supabaseClient.auth.signOut();
  showLogin('Seu cadastro está aguardando aprovação de um administrador ou gerente. Você poderá entrar após a liberação.');return;
 }
 if(profile.approval_status==='rejected'){
  await supabaseClient.auth.signOut();
  showLogin('Seu cadastro não foi aprovado. Entre em contato com a administração do Sítio dos Amigos.');return;
 }
 if(profile.must_change_password){
  await supabaseClient.auth.signOut();
  showLogin('Este usuário precisa definir uma nova senha antes de usar o aplicativo. Vamos configurar essa etapa com segurança.');return;
 }
 currentRole=profile.role||'staff';
 try{await loadOperationalData();}catch(e){await supabaseClient.auth.signOut();showLogin('Não foi possível carregar os dados compartilhados: '+(e.message||e)+'. Verifique a configuração das permissões do banco.');return;}
 showApp(user);applyRole(profile.role);renderAll();startRealtimeSync();
 document.getElementById('roleNotice').textContent='Dados sincronizados com o banco. Perfil: '+(profile.role==='admin'?'Administrador':profile.role==='manager'?'Gerente':'Funcionário')+'.';
}
async function recoverPassword(){
 const email=document.getElementById('loginEmail').value.trim();
 if(!email){showLogin('Digite seu e-mail no campo acima e toque novamente em “Esqueci minha senha”.');return;}
 const {error}=await supabaseClient.auth.resetPasswordForEmail(email);
 showLogin(error?'Não foi possível enviar o e-mail: '+error.message:'Se o e-mail estiver cadastrado, você receberá as instruções para redefinir a senha.');
}
async function logoutApp(){if(realtimeChannel){await supabaseClient.removeChannel(realtimeChannel);realtimeChannel=null;}await supabaseClient.auth.signOut();currentUser=null;showLogin('Você saiu do aplicativo.');}
document.getElementById('loginForm').addEventListener('submit',handleLogin);
async function initializeAuth(){
 showLogin();
 const {data,error}=await supabaseClient.auth.getSession();
 if(error||!data.session){showLogin();return;}
 await loadUserProfile(data.session.user);
}
initializeAuth();
if('serviceWorker'in navigator)navigator.serviceWorker.register('./sw.js').catch(()=>{});
