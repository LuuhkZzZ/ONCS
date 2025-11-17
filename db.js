// db.js
const Database = require("better-sqlite3");
const path = require("path");

const dbPath = path.join(__dirname, "data.db");
const db = new Database(dbPath);

// -----------------------------
// TABELA: RENOVAÇÕES
// -----------------------------
db.prepare(`
CREATE TABLE IF NOT EXISTS renovacoes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,

  gestor_confirmado INTEGER,
  seguradora_novo TEXT,
  comissao_novo REAL,
  premio_total_novo REAL,
  forma_pagamento TEXT,
  parcelas_qtd INTEGER,
  vistoria TEXT,
  observacao TEXT,

  cliente TEXT,
  cpf TEXT,
  seguradora_antiga TEXT,
  ramo TEXT,
  produto TEXT,
  premio_liquido REAL,
  premio_total REAL,
  comissao_antiga REAL,
  apolice TEXT,
  sinistro TEXT,
  sinistros_ativos TEXT,
  item TEXT,
  vigencia_final TEXT,
  tipo TEXT,
  tipo_renovacao TEXT,
  vendedores TEXT,
  contato TEXT,
  status TEXT,
  estipulante TEXT,
  mes_referencia TEXT
)
`).run();

// -----------------------------
// TABELA: NOVOS CONTRATOS
// -----------------------------
db.prepare(`
CREATE TABLE IF NOT EXISTS novos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,

  gestor TEXT,
  data TEXT,
  seguradora TEXT,
  comissao REAL,
  premio REAL,
  tipo TEXT,
  cliente TEXT,
  forma_pagamento TEXT,
  parcelas_qtd INTEGER,
  vistoria TEXT,
  observacao TEXT,
  mes_referencia TEXT
)
`).run();

// -----------------------------
// TABELA: PARCELAS DIÁRIAS
// -----------------------------
db.prepare(`
CREATE TABLE IF NOT EXISTS parcelas_diarias (
  id INTEGER PRIMARY KEY AUTOINCREMENT,

  cliente TEXT,
  apolice TEXT,
  parcela INTEGER,
  data TEXT,
  total REAL,
  seguradora TEXT,
  pagamento TEXT,

  status TEXT,
  data_limite TEXT,

  referencia_dia TEXT
)
`).run();

module.exports = db;