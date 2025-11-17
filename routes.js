// routes.js
console.log("🔥 ROUTES CARREGADO");

const express = require("express");
const router = express.Router();
const db = require("./db");
const ExcelJS = require("exceljs");
const path = require("path");
const multer = require("multer");

// -----------------------------------
// UPLOAD
// -----------------------------------
const upload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) =>
      cb(null, path.join(__dirname, "excel")),
    filename: (req, file, cb) => cb(null, file.originalname)
  })
});

// -----------------------------------
// FUNÇÃO PARA TRATAR VALORES DO EXCEL
// -----------------------------------
function normalize(value) {
  if (value === undefined || value === null) return null;

  // Data
  if (value instanceof Date) {
    return value.toISOString().split("T")[0]; // YYYY-MM-DD
  }

  // Objeto (às vezes ocorre em células com fórmula)
  if (typeof value === "object") {
    return JSON.stringify(value);
  }

  // Número muito grande → converte para string
  if (typeof value === "number" && !Number.isFinite(value)) {
    return String(value);
  }

  return value;
}

// -----------------------------------
// GETS
// -----------------------------------
router.get("/renovacoes", (req, res) => {
  const data = db.prepare("SELECT * FROM renovacoes").all();
  res.json(data);
});

router.get("/novos", (req, res) => {
  const data = db.prepare("SELECT * FROM novos").all();
  res.json(data);
});

router.get("/parcelas", (req, res) => {
  const data = db.prepare("SELECT * FROM parcelas_diarias").all();
  res.json(data);
});

// -----------------------------------
// IMPORTAR RENOVAÇÕES (VERSÃO CORRIGIDA E À PROVA DE ERROS)
// -----------------------------------
router.post("/import/renovacoes", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: "Nenhum arquivo enviado" });

    const filePath = req.file.path;
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(filePath);

    const insert = db.prepare(`
      INSERT INTO renovacoes (
        gestor_confirmado, seguradora_novo, comissao_novo, premio_total_novo, forma_pagamento,
        parcelas_qtd, vistoria, observacao,
        cliente, cpf, seguradora_antiga, ramo, produto, premio_liquido, premio_total,
        comissao_antiga, apolice, sinistro, sinistros_ativos, item, vigencia_final,
        tipo, tipo_renovacao, vendedores, contato, status, estipulante, mes_referencia
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    db.transaction(() => {
      workbook.worksheets.forEach(sheet => {
        const mes = sheet.name;

        sheet.eachRow((row, i) => {
          if (i === 1) return;

          // Pega valores, remove o índice 0 do ExcelJS
          let cols = row.values.slice(1).map(normalize);

          // Garante 27 colunas (preenche com null se faltar)
          while (cols.length < 27) cols.push(null);

          // Se vier mais que 27, corta
          cols = cols.slice(0, 27);

          insert.run(...cols, mes);
        });
      });
    })();

    res.json({ ok: true, msg: "Renovações importadas!" });

  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message });
  }
});

// -----------------------------------
// IMPORTAR NOVOS
// -----------------------------------
router.post("/import/novos", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: "Nenhum arquivo enviado" });

    const filePath = req.file.path;
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(filePath);

    const insert = db.prepare(`
      INSERT INTO novos (
        gestor, data, seguradora, comissao, premio, tipo, cliente,
        forma_pagamento, parcelas_qtd, vistoria, observacao, mes_referencia
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    db.transaction(() => {
      workbook.worksheets.forEach(sheet => {
        const mes = sheet.name;

        sheet.eachRow((row, i) => {
          if (i === 1) return;

          const v = row.values.map(normalize);

          insert.run(
            v[1], v[2], v[3], v[4], v[5], v[6],
            v[7], v[8], v[9], v[10], v[11], mes
          );
        });
      });
    })();

    res.json({ ok: true, msg: "Novos importados!" });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message });
  }
});

// -----------------------------------
// IMPORTAR PARCELAS
// -----------------------------------
router.post("/import/parcelas", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: "Nenhum arquivo enviado" });

    const filePath = req.file.path;
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(filePath);

    const insert = db.prepare(`
      INSERT INTO parcelas_diarias (
        cliente, apolice, parcela, data, total, seguradora, pagamento,
        status, data_limite, referencia_dia
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    db.transaction(() => {
      workbook.worksheets.forEach(sheet => {
        const referenciaDia = sheet.name;

        sheet.eachRow((row, i) => {
          if (i === 1) return;

          const v = row.values.slice(1).map(normalize);

          insert.run(
            v[0], v[1], v[2], v[3], v[4],
            v[5], v[6], v[7], v[8], referenciaDia
          );
        });
      });
    })();

    res.json({ ok: true, msg: "Parcelas importadas!" });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message });
  }
});

// ------------------------------
// ATUALIZAR RENOVAÇÃO (campos editáveis)
// ------------------------------
router.put("/renovacoes/:id", (req, res) => {
  try {
    const id = req.params.id;
    // Só permitimos estes campos para edição no app
    const {
      gestor_confirmado,
      seguradora_novo,
      comissao_novo,
      premio_total_novo,
      forma_pagamento,
      parcelas_qtd,
      vistoria,
      observacao
    } = req.body;

    const stmt = db.prepare(`
      UPDATE renovacoes SET
        gestor_confirmado = ?, seguradora_novo = ?, comissao_novo = ?,
        premio_total_novo = ?, forma_pagamento = ?, parcelas_qtd = ?,
        vistoria = ?, observacao = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `);

    stmt.run(
      gestor_confirmado ? 1 : 0,
      seguradora_novo ?? null,
      comissao_novo ?? null,
      premio_total_novo ?? null,
      forma_pagamento ?? null,
      parcelas_qtd ?? null,
      vistoria ?? null,
      observacao ?? null,
      id
    );

    res.json({ ok: true, msg: "Renovação atualizada" });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message });
  }
});

// ------------------------------
// ATUALIZAR PARCELA (status, data_limite apenas)
// ------------------------------
router.put("/parcelas/:id", (req, res) => {
  try {
    const id = req.params.id;
    const { status, data_limite } = req.body;

    const stmt = db.prepare(`
      UPDATE parcelas_diarias SET
        status = ?, data_limite = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `);

    stmt.run(status ?? null, data_limite ?? null, id);

    res.json({ ok: true, msg: "Parcela atualizada" });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message });
  }
});

// ------------------------------
// ATUALIZAR/EDITAR NOVO CONTRATO (opcional)
// ------------------------------
router.put("/novos/:id", (req, res) => {
  try {
    const id = req.params.id;
    const {
      gestor, data, seguradora, comissao, premio, tipo, cliente,
      forma_pagamento, parcelas_qtd, vistoria, observacao
    } = req.body;

    const stmt = db.prepare(`
      UPDATE novos SET
        gestor = ?, data = ?, seguradora = ?, comissao = ?, premio = ?, tipo = ?, cliente = ?,
        forma_pagamento = ?, parcelas_qtd = ?, vistoria = ?, observacao = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `);

    stmt.run(
      gestor ?? null, data ?? null, seguradora ?? null, comissao ?? null, premio ?? null, tipo ?? null, cliente ?? null,
      forma_pagamento ?? null, parcelas_qtd ?? null, vistoria ?? null, observacao ?? null,
      id
    );

    res.json({ ok: true, msg: "Contrato novo atualizado" });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;