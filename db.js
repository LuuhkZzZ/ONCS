// db.js
const Database = require("better-sqlite3");
const path = require("path");

const dbPath = path.join(__dirname, "data.db");
const db = new Database(dbPath);

// Adiciona coluna de data se não existir (para ordenação por mês)
try {
  db.prepare(`ALTER TABLE renovacoes ADD COLUMN mes_ano TEXT`).run();
} catch (e) {
  // Coluna já existe
}

try {
  db.prepare(`ALTER TABLE parcelas_diarias ADD COLUMN data_importacao TEXT`).run();
} catch (e) {
  // Coluna já existe
}

// Tabela: RENOVAÇÕES
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
  contato TEXT,
  tipo TEXT,
  tipo_renovacao TEXT,
  vendedores TEXT,
  status TEXT,
  estipulante TEXT,
  mes_referencia TEXT,
  mes_ano TEXT,
  data_criacao DATETIME DEFAULT CURRENT_TIMESTAMP
)
`).run();

// Tabela: NOVOS CONTRATOS
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
  mes_referencia TEXT,
  data_criacao DATETIME DEFAULT CURRENT_TIMESTAMP
)
`).run();

// Tabela: PARCELAS DIÁRIAS
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
  referencia_dia TEXT,
  data_importacao TEXT,
  data_criacao DATETIME DEFAULT CURRENT_TIMESTAMP
)
`).run();

module.exports = db;
