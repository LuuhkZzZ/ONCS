// routes.js
console.log("🔥 ROUTES CARREGADO");

const express = require("express");
const router = express.Router();
const db = require("./db");
const ExcelJS = require("exceljs");
const path = require("path");
const multer = require("multer");

const upload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => cb(null, path.join(__dirname, "excel")),
    filename: (req, file, cb) => cb(null, file.originalname)
  })
});

function normalize(value) {
  if (value === undefined || value === null) return null;
  if (value instanceof Date) return value.toISOString().split("T")[0];
  if (typeof value === "object") return JSON.stringify(value);
  if (typeof value === "number" && !Number.isFinite(value)) return String(value);
  return value;
}

// ==========================================
// GETS
// ==========================================
router.get("/renovacoes", (req, res) => {
  const data = db.prepare("SELECT * FROM renovacoes ORDER BY mes_ano DESC, vigencia_final DESC").all();
  res.json(data);
});

router.get("/novos", (req, res) => {
  const data = db.prepare("SELECT * FROM novos ORDER BY data DESC").all();
  res.json(data);
});

router.get("/parcelas", (req, res) => {
  const data = db.prepare("SELECT * FROM parcelas_diarias ORDER BY data DESC").all();
  res.json(data);
});

// ==========================================
// IMPORTAR RENOVAÇÕES
// ==========================================
router.post("/import/renovacoes", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: "Nenhum arquivo enviado" });

    const filePath = req.file.path;
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(filePath);

    const insert = db.prepare(`
      INSERT INTO renovacoes (
        vigencia_final, cliente, cpf, contato, tipo, status, gestor_confirmado,
        seguradora_novo, comissao_novo, premio_total_novo, forma_pagamento,
        parcelas_qtd, vistoria, observacao,
        seguradora_antiga, ramo, produto, premio_liquido, premio_total,
        comissao_antiga, apolice, sinistro, sinistros_ativos, item,
        tipo_renovacao, vendedores, estipulante, mes_referencia, mes_ano
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    db.transaction(() => {
      workbook.worksheets.forEach(sheet => {
        const mes = sheet.name;
        sheet.eachRow((row, i) => {
          if (i === 1) return;
          
          let cols = row.values.slice(1).map(normalize);
          while (cols.length < 27) cols.push(null);
          cols = cols.slice(0, 27);
          
          const mesAno = new Date().toISOString().slice(0, 7); // YYYY-MM
          insert.run(...cols, mes, mesAno);
        });
      });
    })();

    res.json({ ok: true, msg: "Renovações importadas com sucesso!" });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message });
  }
});

// ==========================================
// IMPORTAR PARCELAS (com repetição de status do dia anterior)
// ==========================================
router.post("/import/parcelas", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: "Nenhum arquivo enviado" });

    const filePath = req.file.path;
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(filePath);

    const hoje = new Date().toISOString().split("T")[0];
    const ontem = new Date(Date.now() - 86400000).toISOString().split("T")[0];

    const insert = db.prepare(`
      INSERT INTO parcelas_diarias (
        cliente, apolice, parcela, data, total, seguradora, pagamento,
        status, data_limite, referencia_dia, data_importacao
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const selectOnthem = db.prepare(`
      SELECT status, data_limite FROM parcelas_diarias
      WHERE cliente = ? AND apolice = ? AND parcela = ? AND referencia_dia = ?
      LIMIT 1
    `);

    db.transaction(() => {
      workbook.worksheets.forEach(sheet => {
        const referenciaDia = sheet.name;

        sheet.eachRow((row, i) => {
          if (i === 1) return;

          const v = row.values.slice(1).map(normalize);
          const cliente = v[0];
          const apolice = v[1];
          const parcela = v[2];

          // Busca dados do dia anterior
          const statusAnterior = selectOnthem.get(cliente, apolice, parcela, ontem);
          const status = statusAnterior?.status || v[7] || "pendente";
          const data_limite = statusAnterior?.data_limite || v[8] || null;

          insert.run(
            cliente, apolice, parcela, v[3], v[4],
            v[5], v[6], status, data_limite, referenciaDia, hoje
          );
        });
      });
    })();

    res.json({ ok: true, msg: "Parcelas importadas com sucesso!" });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message });
  }
});

// ==========================================
// EXPORTAR RENOVAÇÕES POR PERÍODO
// ==========================================
router.post("/export/renovacoes", async (req, res) => {
  try {
    const { data_inicio, data_fim } = req.body;

    const renovacoes = db.prepare(`
      SELECT vigencia_final, cliente, cpf, contato, tipo, status, gestor_confirmado
      FROM renovacoes
      WHERE vigencia_final BETWEEN ? AND ?
      ORDER BY vigencia_final DESC
    `).all(data_inicio, data_fim);

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Renovações");

    worksheet.columns = [
      { header: "Vigência Final", key: "vigencia_final", width: 15 },
      { header: "Cliente", key: "cliente", width: 30 },
      { header: "CPF", key: "cpf", width: 18 },
      { header: "Contato", key: "contato", width: 18 },
      { header: "Tipo", key: "tipo", width: 12 },
      { header: "Status", key: "status", width: 15 },
      { header: "Gestor", key: "gestor_confirmado", width: 12 }
    ];

    worksheet.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
    worksheet.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF3b82f6" } };

    renovacoes.forEach(r => {
      worksheet.addRow({
        vigencia_final: r.vigencia_final,
        cliente: r.cliente,
        cpf: r.cpf,
        contato: r.contato,
        tipo: r.tipo,
        status: r.status,
        gestor_confirmado: r.gestor_confirmado ? "Sim" : "Não"
      });
    });

    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", `attachment; filename=renovacoes_${data_inicio}_${data_fim}.xlsx`);
    await workbook.xlsx.write(res);
    res.end();
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message });
  }
});

// ==========================================
// EXPORTAR NOVOS CONTRATOS POR PERÍODO
// ==========================================
router.post("/export/novos", async (req, res) => {
  try {
    const { data_inicio, data_fim } = req.body;

    const novos = db.prepare(`
      SELECT cliente, seguradora, data, premio, comissao
      FROM novos
      WHERE data BETWEEN ? AND ?
      ORDER BY data DESC
    `).all(data_inicio, data_fim);

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Novos Contratos");

    worksheet.columns = [
      { header: "Cliente", key: "cliente", width: 30 },
      { header: "Seguradora", key: "seguradora", width: 25 },
      { header: "Data", key: "data", width: 12 },
      { header: "Prêmio", key: "premio", width: 15 },
      { header: "Comissão", key: "comissao", width: 12 }
    ];

    worksheet.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
    worksheet.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF10b981" } };

    novos.forEach(n => {
      worksheet.addRow({
        cliente: n.cliente,
        seguradora: n.seguradora,
        data: n.data,
        premio: n.premio ? `R$ ${parseFloat(n.premio).toLocaleString('pt-BR')}` : "-",
        comissao: n.comissao ? `${n.comissao}%` : "-"
      });
    });

    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", `attachment; filename=novos_${data_inicio}_${data_fim}.xlsx`);
    await workbook.xlsx.write(res);
    res.end();
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message });
  }
});

// ==========================================
// EXPORTAR PARCELAS POR PERÍODO
// ==========================================
router.post("/export/parcelas", async (req, res) => {
  try {
    const { data_inicio, data_fim } = req.body;

    const parcelas = db.prepare(`
      SELECT cliente, apolice, parcela, data, total, seguradora, status, data_limite
      FROM parcelas_diarias
      WHERE referencia_dia BETWEEN ? AND ?
      ORDER BY data DESC
    `).all(data_inicio, data_fim);

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Parcelas");

    worksheet.columns = [
      { header: "Cliente", key: "cliente", width: 25 },
      { header: "Apólice", key: "apolice", width: 15 },
      { header: "Parcela", key: "parcela", width: 10 },
      { header: "Data", key: "data", width: 12 },
      { header: "Total", key: "total", width: 12 },
      { header: "Seguradora", key: "seguradora", width: 20 },
      { header: "Status", key: "status", width: 12 },
      { header: "Data Limite", key: "data_limite", width: 12 }
    ];

    worksheet.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
    worksheet.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFf59e0b" } };

    parcelas.forEach(p => {
      worksheet.addRow({
        cliente: p.cliente,
        apolice: p.apolice,
        parcela: p.parcela,
        data: p.data,
        total: p.total ? `R$ ${parseFloat(p.total).toLocaleString('pt-BR')}` : "-",
        seguradora: p.seguradora,
        status: p.status,
        data_limite: p.data_limite
      });
    });

    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", `attachment; filename=parcelas_${data_inicio}_${data_fim}.xlsx`);
    await workbook.xlsx.write(res);
    res.end();
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message });
  }
});

// ==========================================
// ATUALIZAR RENOVAÇÃO
// ==========================================
router.put("/renovacoes/:id", (req, res) => {
  try {
    const id = req.params.id;
    const { gestor_confirmado, seguradora_novo, comissao_novo, premio_total_novo, forma_pagamento, parcelas_qtd, vistoria, observacao } = req.body;

    const stmt = db.prepare(`
      UPDATE renovacoes SET
        gestor_confirmado = ?, seguradora_novo = ?, comissao_novo = ?,
        premio_total_novo = ?, forma_pagamento = ?, parcelas_qtd = ?,
        vistoria = ?, observacao = ?
      WHERE id = ?
    `);

    stmt.run(gestor_confirmado ? 1 : 0, seguradora_novo ?? null, comissao_novo ?? null, premio_total_novo ?? null, forma_pagamento ?? null, parcelas_qtd ?? null, vistoria ?? null, observacao ?? null, id);
    res.json({ ok: true, msg: "Renovação atualizada" });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message });
  }
});

// ==========================================
// ATUALIZAR PARCELA
// ==========================================
router.put("/parcelas/:id", (req, res) => {
  try {
    const id = req.params.id;
    const { status, data_limite } = req.body;

    const stmt = db.prepare(`UPDATE parcelas_diarias SET status = ?, data_limite = ? WHERE id = ?`);
    stmt.run(status ?? null, data_limite ?? null, id);
    res.json({ ok: true, msg: "Parcela atualizada" });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message });
  }
});

// ==========================================
// CRIAR NOVO CONTRATO
// ==========================================
router.post("/novos", (req, res) => {
  try {
    const { gestor, data, seguradora, comissao, premio, tipo, cliente, forma_pagamento, parcelas_qtd, vistoria, observacao } = req.body;

    const stmt = db.prepare(`
      INSERT INTO novos (gestor, data, seguradora, comissao, premio, tipo, cliente, forma_pagamento, parcelas_qtd, vistoria, observacao)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const result = stmt.run(gestor ?? null, data ?? null, seguradora ?? null, comissao ?? null, premio ?? null, tipo ?? null, cliente ?? null, forma_pagamento ?? null, parcelas_qtd ?? null, vistoria ?? null, observacao ?? null);
    res.json({ ok: true, id: result.lastInsertRowid });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
