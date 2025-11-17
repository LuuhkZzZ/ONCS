// index.js
const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");
const path = require("path");
const routes = require("./routes"); // vamos criar já já
const app = express();
const PORT = 3000;

// Middleware: para interpretar JSON e permitir acesso do front-end
app.use(cors());
app.use(bodyParser.json());

// Rota principal da API
app.use("/api", routes);

// Servir os arquivos do front-end (client)
app.use("/", express.static(path.join(__dirname, "..", "client")));

// Iniciar o servidor
app.listen(PORT, () => {
  console.log(`🚀 Servidor rodando na porta ${PORT}`);
});