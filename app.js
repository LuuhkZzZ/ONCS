// app.js - frontend minimal para gerenciar renovações, novos e parcelas
const API = "/api";

// UI nav
const btnRen = document.getElementById("btn-renovacoes");
const btnNov = document.getElementById("btn-novos");
const btnPar = document.getElementById("btn-parcelas");
const sections = { ren: document.getElementById("sec-renovacoes"), nov: document.getElementById("sec-novos"), par: document.getElementById("sec-parcelas") };

btnRen.onclick = () => show("ren");
btnNov.onclick = () => show("nov");
btnPar.onclick = () => show("par");
function show(name) {
  Object.values(sections).forEach(s => s.classList.remove("ativo"));
  if (name === "ren") sections.ren.classList.add("ativo");
  if (name === "nov") sections.nov.classList.add("ativo");
  if (name === "par") sections.par.classList.add("ativo");
}

// RENOVAÇÕES: carregar e renderizar
async function carregarRenovacoes() {
  const res = await fetch(API + "/renovacoes");
  const data = await res.json();
  const tbody = document.querySelector("#table-renovacoes tbody");
  tbody.innerHTML = "";
  data.forEach(r => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${r.id}</td>
      <td>${r.cliente ?? ""}</td>
      <td>${r.cpf ?? ""}</td>
      <td>${r.vigencia_final ?? ""}</td>
      <td>${r.status ?? ""}</td>
      <td>${r.gestor_confirmado ? "Sim" : "Não"}</td>
      <td><button class="btn-edit-ren" data-id="${r.id}">Editar</button></td>
    `;
    tbody.appendChild(tr);
  });

  document.querySelectorAll(".btn-edit-ren").forEach(b => b.onclick = abrirModalRen);
}

// Modal editar renovação
const modalRen = document.getElementById("modal-renovacao");
const formEditRen = document.getElementById("form-edit-renovacao");
document.getElementById("btn-cancel-ren").onclick = () => modalRen.classList.add("hidden");

async function abrirModalRen(e) {
  const id = e.target.dataset.id;
  const res = await fetch(`${API}/renovacoes`);
  const data = await res.json();
  const item = data.find(x => x.id == id);
  if (!item) return alert("Item não encontrado");

  formEditRen.id.value = item.id;
  formEditRen.gestor_confirmado.checked = !!item.gestor_confirmado;
  formEditRen.seguradora_novo.value = item.seguradora_novo ?? "";
  formEditRen.comissao_novo.value = item.comissao_novo ?? "";
  formEditRen.premio_total_novo.value = item.premio_total_novo ?? "";
  formEditRen.forma_pagamento.value = item.forma_pagamento ?? "";
  formEditRen.parcelas_qtd.value = item.parcelas_qtd ?? "";
  formEditRen.vistoria.value = item.vistoria ?? "";
  formEditRen.observacao.value = item.observacao ?? "";

  modalRen.classList.remove("hidden");
}

formEditRen.addEventListener("submit", async (ev) => {
  ev.preventDefault();
  const id = formEditRen.id.value;
  const body = {
    gestor_confirmado: formEditRen.gestor_confirmado.checked ? 1 : 0,
    seguradora_novo: formEditRen.seguradora_novo.value || null,
    comissao_novo: formEditRen.comissao_novo.value || null,
    premio_total_novo: formEditRen.premio_total_novo.value || null,
    forma_pagamento: formEditRen.forma_pagamento.value || null,
    parcelas_qtd: formEditRen.parcelas_qtd.value || null,
    vistoria: formEditRen.vistoria.value || null,
    observacao: formEditRen.observacao.value || null
  };
  const res = await fetch(`${API}/renovacoes/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
  const json = await res.json();
  if (json.ok) {
    modalRen.classList.add("hidden");
    carregarRenovacoes();
  } else alert("Erro: " + (json.error || JSON.stringify(json)));
});

// NOVOS: criação e listagem
const formNovo = document.getElementById("form-novo");
formNovo.addEventListener("submit", async (e) => {
  e.preventDefault();
  const data = Object.fromEntries(new FormData(formNovo));
  const res = await fetch(`${API}/novos`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data)
  });
  const json = await res.json();
  if (json && json.ok !== false) {
    formNovo.reset();
    carregarNovos();
  } else alert("Erro: " + JSON.stringify(json));
});

async function carregarNovos() {
  const res = await fetch(`${API}/novos`);
  const data = await res.json();
  const tbody = document.querySelector("#table-novos tbody");
  tbody.innerHTML = "";
  data.forEach(n => {
    const tr = document.createElement("tr");
    tr.innerHTML = `<td>${n.id}</td><td>${n.cliente ?? ""}</td><td>${n.seguradora ?? ""}</td><td>${n.data ?? ""}</td><td></td>`;
    tbody.appendChild(tr);
  });
}

// PARCELAS: carregar, filtrar por referencia e editar status/data_limite
let parcelasCache = [];
async function carregarParcelas() {
  const res = await fetch(`${API}/parcelas`);
  const data = await res.json();
  parcelasCache = data;
  const referencias = [...new Set(data.map(p => p.referencia_dia).filter(Boolean))].sort().reverse();
  const sel = document.getElementById("select-referencia");
  sel.innerHTML = `<option value="">Todas</option>` + referencias.map(r => `<option value="${r}">${r}</option>`).join("");
  renderParcelas();
  sel.onchange = () => renderParcelas(sel.value);
}

function renderParcelas(referencia = "") {
  const tbody = document.querySelector("#table-parcelas tbody");
  tbody.innerHTML = "";
  const lista = parcelasCache.filter(p => !referencia || p.referencia_dia === referencia);
  lista.forEach(p => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${p.id}</td>
      <td>${p.cliente ?? ""}</td>
      <td>${p.apolice ?? ""}</td>
      <td>${p.parcela ?? ""}</td>
      <td>${p.data ?? ""}</td>
      <td>${p.total ?? ""}</td>
      <td>${p.seguradora ?? ""}</td>
      <td>${p.pagamento ?? ""}</td>
      <td>
        <select class="status-select" data-id="${p.id}">
          <option value="pendente" ${p.status==='pendente'?'selected':''}>pendente</option>
          <option value="pago" ${p.status==='pago'?'selected':''}>pago</option>
          <option value="atrasado" ${p.status==='atrasado'?'selected':''}>atrasado</option>
        </select>
      </td>
      <td><input class="data-limite" data-id="${p.id}" type="date" value="${p.data_limite ?? ''}" /></td>
      <td><button class="btn-save-par" data-id="${p.id}">Salvar</button></td>
    `;
    tbody.appendChild(tr);
  });

  document.querySelectorAll(".btn-save-par").forEach(b => b.onclick = async (e) => {
    const id = e.target.dataset.id;
    const status = document.querySelector(`.status-select[data-id="${id}"]`).value;
    const data_limite = document.querySelector(`.data-limite[data-id="${id}"]`).value || null;
    const res = await fetch(`${API}/parcelas/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status, data_limite })
    });
    const j = await res.json();
    if (j.ok) {
      alert("Atualizado");
      carregarParcelas();
    } else alert("Erro: " + JSON.stringify(j));
  });
}

// UPLOAD FORMS
document.getElementById("form-upload-ren").addEventListener("submit", async (e) => {
  e.preventDefault();
  await uploadFile(e.target, "/api/import/renovacoes");
});
document.getElementById("form-upload-novos").addEventListener("submit", async (e) => {
  e.preventDefault();
  await uploadFile(e.target, "/api/import/novos");
});
document.getElementById("form-upload-parcelas").addEventListener("submit", async (e) => {
  e.preventDefault();
  await uploadFile(e.target, "/api/import/parcelas");
});

async function uploadFile(formEl, url) {
  const fileInput = formEl.querySelector('input[type="file"]');
  if (!fileInput.files.length) return alert("Selecione um arquivo");
  const fd = new FormData();
  fd.append("file", fileInput.files[0]);
  const msg = document.getElementById("upload-msg");
  msg.textContent = "Enviando...";
  const res = await fetch(url, { method: "POST", body: fd });
  const json = await res.json();
  msg.textContent = json.msg || json.error || JSON.stringify(json);
  // recarrega dados
  await carregarRenovacoes();
  await carregarNovos();
  await carregarParcelas();
}

// Inicializar
show("ren");
carregarRenovacoes();
carregarNovos();
carregarParcelas();