// app.js - Sistema Corretora SecureFlow v2
const API = "/api";

// ==========================================
// NAVEGAÇÃO
// ==========================================
const sections = {
  dashboard: document.getElementById("sec-dashboard"),
  ren: document.getElementById("sec-renovacoes"),
  nov: document.getElementById("sec-novos"),
  par: document.getElementById("sec-parcelas"),
  imp: document.getElementById("sec-importar"),
  exp: document.getElementById("sec-exportar")
};

const navButtons = {
  dashboard: document.getElementById("btn-dashboard"),
  ren: document.getElementById("btn-renovacoes"),
  nov: document.getElementById("btn-novos"),
  par: document.getElementById("btn-parcelas"),
  imp: document.getElementById("btn-importar"),
  exp: document.getElementById("btn-exportar")
};

const pageTitle = document.getElementById("page-title");
const pageSubtitle = document.getElementById("page-subtitle");

const titles = {
  dashboard: { title: "Dashboard", subtitle: "Visão geral do sistema" },
  ren: { title: "Renovações", subtitle: "Gerenciar renovações de contratos" },
  nov: { title: "Novos Contratos", subtitle: "Cadastrar e visualizar novos contratos" },
  par: { title: "Parcelas", subtitle: "Acompanhar parcelas por data" },
  imp: { title: "Importar Planilhas", subtitle: "Fazer upload de arquivos Excel" },
  exp: { title: "Exportar Dados", subtitle: "Baixar dados em um período específico" }
};

function show(name) {
  Object.values(sections).forEach(s => s.classList.remove("active"));
  Object.values(navButtons).forEach(b => b.classList.remove("active"));
  if (sections[name]) sections[name].classList.add("active");
  if (navButtons[name]) navButtons[name].classList.add("active");
  if (titles[name]) {
    pageTitle.textContent = titles[name].title;
    pageSubtitle.textContent = titles[name].subtitle;
  }
}

navButtons.dashboard.onclick = () => show("dashboard");
navButtons.ren.onclick = () => show("ren");
navButtons.nov.onclick = () => show("nov");
navButtons.par.onclick = () => show("par");
navButtons.imp.onclick = () => show("imp");
navButtons.exp.onclick = () => show("exp");

// ==========================================
// DASHBOARD
// ==========================================
async function atualizarDashboard() {
  try {
    const [renovacoes, novos, parcelas] = await Promise.all([
      fetch(API + "/renovacoes").then(r => r.json()),
      fetch(API + "/novos").then(r => r.json()),
      fetch(API + "/parcelas").then(r => r.json())
    ]);
    
    document.getElementById("stat-renovacoes").textContent = renovacoes.length;
    document.getElementById("stat-novos").textContent = novos.length;
    document.getElementById("stat-parcelas").textContent = parcelas.length;
    
    const hoje = new Date().toISOString().split("T")[0];
    const alteradasHoje = [...renovacoes, ...novos, ...parcelas].filter(p => p.data_criacao?.startsWith(hoje)).length;
    document.getElementById("stat-alteracoes").textContent = alteradasHoje;
  } catch (e) {
    console.error("Erro ao atualizar dashboard:", e);
  }
}

// ==========================================
// RENOVAÇÕES
// ==========================================
async function carregarRenovacoes() {
  try {
    const res = await fetch(API + "/renovacoes");
    const data = await res.json();
    
    // Agrupa por mês
    const mesesUnicos = [...new Set(data.map(r => r.mes_ano))].sort().reverse();
    
    const sel = document.getElementById("select-mes-renovacoes");
    sel.innerHTML = mesesUnicos.map(m => `<option value="${m}">${m}</option>`).join("");
    
    renderRenovacoes(data, mesesUnicos[0]);
    sel.onchange = () => renderRenovacoes(data, sel.value);
  } catch (e) {
    console.error("Erro ao carregar renovações:", e);
  }
}

function renderRenovacoes(data, mesSelecionado) {
  const tbody = document.querySelector("#table-renovacoes tbody");
  tbody.innerHTML = "";
  
  const filtered = data.filter(r => r.mes_ano === mesSelecionado);
  
  if (filtered.length === 0) {
    tbody.innerHTML = '<tr><td colspan="8" style="text-align:center; padding: 40px;">Nenhuma renovação neste mês</td></tr>';
    return;
  }
  
  filtered.forEach(r => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${r.vigencia_final || "-"}</td>
      <td>${r.cliente || "-"}</td>
      <td>${r.cpf || "-"}</td>
      <td>${r.contato || "-"}</td>
      <td>${r.tipo || "-"}</td>
      <td><span class="badge ${r.status === 'renovado' ? 'success' : 'warning'}">${r.status || "Pendente"}</span></td>
      <td>${r.gestor_confirmado ? "✅" : "❌"}</td>
      <td><button class="btn-edit-ren" data-id="${r.id}">Editar</button></td>
    `;
    tbody.appendChild(tr);
  });
  
  document.querySelectorAll(".btn-edit-ren").forEach(b => b.onclick = abrirModalRen);
}

const modalRen = document.getElementById("modal-renovacao");
const formEditRen = document.getElementById("form-edit-renovacao");
document.getElementById("btn-cancel-ren").onclick = () => modalRen.classList.add("hidden");
document.getElementById("btn-cancel-ren-2").onclick = () => modalRen.classList.add("hidden");

async function abrirModalRen(e) {
  const id = e.target.dataset.id;
  try {
    const res = await fetch(`${API}/renovacoes`);
    const data = await res.json();
    const item = data.find(x => x.id == id);
    if (!item) return;
    
    formEditRen.id.value = item.id;
    formEditRen.gestor_confirmado.checked = !!item.gestor_confirmado;
    formEditRen.seguradora_novo.value = item.seguradora_novo || "";
    formEditRen.comissao_novo.value = item.comissao_novo || "";
    formEditRen.premio_total_novo.value = item.premio_total_novo || "";
    formEditRen.forma_pagamento.value = item.forma_pagamento || "";
    formEditRen.parcelas_qtd.value = item.parcelas_qtd || "";
    formEditRen.vistoria.value = item.vistoria || "";
    formEditRen.observacao.value = item.observacao || "";
    
    modalRen.classList.remove("hidden");
  } catch (e) {
    console.error(e);
  }
}

formEditRen.addEventListener("submit", async (ev) => {
  ev.preventDefault();
  const id = formEditRen.id.value;
  
  try {
    const res = await fetch(`${API}/renovacoes/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        gestor_confirmado: formEditRen.gestor_confirmado.checked ? 1 : 0,
        seguradora_novo: formEditRen.seguradora_novo.value || null,
        comissao_novo: formEditRen.comissao_novo.value || null,
        premio_total_novo: formEditRen.premio_total_novo.value || null,
        forma_pagamento: formEditRen.forma_pagamento.value || null,
        parcelas_qtd: formEditRen.parcelas_qtd.value || null,
        vistoria: formEditRen.vistoria.value || null,
        observacao: formEditRen.observacao.value || null
      })
    });
    
    if ((await res.json()).ok) {
      modalRen.classList.add("hidden");
      await carregarRenovacoes();
      showMessage("Renovação atualizada!", "success");
    }
  } catch (e) {
    showMessage("Erro ao salvar", "error");
  }
});

// ==========================================
// NOVOS CONTRATOS
// ==========================================
const formNovo = document.getElementById("form-novo");

formNovo.addEventListener("submit", async (e) => {
  e.preventDefault();
  const data = Object.fromEntries(new FormData(formNovo));
  
  try {
    const res = await fetch(`${API}/novos`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data)
    });
    
    if ((await res.json()).ok) {
      formNovo.reset();
      await carregarNovos();
      await atualizarDashboard();
      showMessage("Contrato adicionado!", "success");
    }
  } catch (e) {
    showMessage("Erro ao adicionar", "error");
  }
});

async function carregarNovos() {
  try {
    const res = await fetch(`${API}/novos`);
    const data = await res.json();
    const tbody = document.querySelector("#table-novos tbody");
    tbody.innerHTML = "";
    
    if (data.length === 0) {
      tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; padding: 40px;">Nenhum contrato</td></tr>';
      return;
    }
    
    data.forEach(n => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${n.cliente || "-"}</td>
        <td>${n.seguradora || "-"}</td>
        <td>${n.data || "-"}</td>
        <td>R$ ${parseFloat(n.premio || 0).toLocaleString('pt-BR', {minimumFractionDigits: 2})}</td>
        <td>${n.comissao || "-"}%</td>
      `;
      tbody.appendChild(tr);
    });
  } catch (e) {
    console.error(e);
  }
}

// ==========================================
// PARCELAS (com filtro por data)
// ==========================================
let parcelasCache = [];

async function carregarParcelas() {
  try {
    const res = await fetch(`${API}/parcelas`);
    const data = await res.json();
    parcelasCache = data;
    
    const datas = [...new Set(data.map(p => p.referencia_dia))].sort().reverse();
    const sel = document.getElementById("select-data-parcelas");
    
    if (datas.length > 0) {
      sel.value = datas[0];
    }
    
    renderParcelas();
    sel.onchange = () => renderParcelas();
  } catch (e) {
    console.error(e);
  }
}

function renderParcelas() {
  const dataSelecionada = document.getElementById("select-data-parcelas").value;
  const tbody = document.querySelector("#table-parcelas tbody");
  tbody.innerHTML = "";
  
  const lista = parcelasCache.filter(p => !dataSelecionada || p.referencia_dia === dataSelecionada);
  
  if (lista.length === 0) {
    tbody.innerHTML = '<tr><td colspan="10" style="text-align:center; padding: 40px;">Nenhuma parcela</td></tr>';
    return;
  }
  
  lista.forEach(p => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${p.cliente || "-"}</td>
      <td>${p.apolice || "-"}</td>
      <td>${p.parcela || "-"}</td>
      <td>${p.data || "-"}</td>
      <td>R$ ${parseFloat(p.total || 0).toLocaleString('pt-BR', {minimumFractionDigits: 2})}</td>
      <td>${p.seguradora || "-"}</td>
      <td>${p.pagamento || "-"}</td>
      <td>
        <select class="status-select" data-id="${p.id}">
          <option value="pendente" ${p.status==='pendente'?'selected':''}>Pendente</option>
          <option value="pago" ${p.status==='pago'?'selected':''}>Pago</option>
          <option value="notificado" ${p.status==='notificado'?'selected':''}>Notificado</option>
        </select>
      </td>
      <td><input class="data-limite" data-id="${p.id}" type="date" value="${p.data_limite || ''}" /></td>
      <td><button class="btn-save-par" data-id="${p.id}">Salvar</button></td>
    `;
    tbody.appendChild(tr);
  });
  
  document.querySelectorAll(".btn-save-par").forEach(b => {
    b.onclick = async (e) => {
      const id = e.target.dataset.id;
      const status = document.querySelector(`.status-select[data-id="${id}"]`).value;
      const data_limite = document.querySelector(`.data-limite[data-id="${id}"]`).value || null;
      
      try {
        const res = await fetch(`${API}/parcelas/${id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status, data_limite })
        });
        
        if ((await res.json()).ok) {
          await carregarParcelas();
          showMessage("Parcela atualizada!", "success");
        }
      } catch (e) {
        showMessage("Erro ao salvar", "error");
      }
    };
  });
}

// ==========================================
// IMPORTAÇÃO
// ==========================================
function setupUpload(formId, fileInputId, url, fileNameId) {
  const fileInput = document.getElementById(fileInputId);
  const fileNameEl = document.getElementById(fileNameId);
  
  fileInput.addEventListener("change", async (e) => {
    if (!fileInput.files.length) return;
    
    const fileName = fileInput.files[0].name;
    fileNameEl.textContent = `📄 ${fileName}`;
    
    const fd = new FormData();
    fd.append("file", fileInput.files[0]);
    
    const statusEl = document.getElementById("import-status");
    statusEl.innerHTML = `<div class="status-item"><span class="status-dot" style="background: #3b82f6;"></span><span>Importando...</span></div>`;
    
    try {
      const res = await fetch(url, { method: "POST", body: fd });
      const json = await res.json();
      
      if (json.ok) {
        statusEl.innerHTML = `<div class="status-item"><span class="status-dot green"></span><span>✅ ${json.msg}</span></div>`;
        await carregarRenovacoes();
        await carregarNovos();
        await carregarParcelas();
        await atualizarDashboard();
        setTimeout(() => {
          statusEl.innerHTML = '<p class="empty-state">Aguardando upload...</p>';
          fileNameEl.textContent = "";
        }, 5000);
      } else {
        statusEl.innerHTML = `<div class="status-item"><span class="status-dot" style="background: #ef4444;"></span><span>❌ ${json.error}</span></div>`;
      }
    } catch (e) {
      statusEl.innerHTML = `<div class="status-item"><span class="status-dot" style="background: #ef4444;"></span><span>❌ Erro ao enviar</span></div>`;
    }
    fileInput.value = "";
  });
}

setupUpload("form-upload-ren", "file-ren", "/api/import/renovacoes", "file-name-ren");
setupUpload("form-upload-parcelas", "file-parcelas", "/api/import/parcelas", "file-name-parcelas");

// ==========================================
// EXPORTAÇÃO
// ==========================================
["ren", "novos", "parcelas"].forEach(tipo => {
  document.getElementById(`form-export-${tipo}`).addEventListener("submit", async (e) => {
    e.preventDefault();
    const form = e.target;
    const data_inicio = form.data_inicio.value;
    const data_fim = form.data_fim.value;
    
    try {
      const res = await fetch(`/api/export/${tipo}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ data_inicio, data_fim })
      });
      
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${tipo}_${data_inicio}_${data_fim}.xlsx`;
      a.click();
      window.URL.revokeObjectURL(url);
      showMessage("Exportado com sucesso!", "success");
    } catch (e) {
      showMessage("Erro ao exportar", "error");
    }
  });
});

// ==========================================
// UTILITÁRIOS
// ==========================================
function showMessage(text, type = "info") {
  const statusEl = document.getElementById("import-status");
  const colors = { success: "#10b981", error: "#ef4444", info: "#3b82f6" };
  const icons = { success: "✅", error: "❌", info: "ℹ️" };
  statusEl.innerHTML = `<div class="status-item"><span class="status-dot" style="background: ${colors[type]}"></span><span>${icons[type]} ${text}</span></div>`;
}

const searchInput = document.getElementById("search-input");
searchInput.addEventListener("input", (e) => {
  const termo = e.target.value.toLowerCase();
  document.querySelectorAll("tbody tr").forEach(row => {
    row.style.display = row.textContent.toLowerCase().includes(termo) ? "" : "none";
  });
});

// ==========================================
// INICIALIZAÇÃO
// ==========================================
async function inicializar() {
  show("dashboard");
  await atualizarDashboard();
  await carregarRenovacoes();
  await carregarNovos();
  await carregarParcelas();
}

inicializar();
