const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = 3001;

app.use(express.json());

const salesFile = path.join(__dirname, 'db', 'sales.json');

// Ensure db directory exists
if (!fs.existsSync(path.join(__dirname, 'db'))) {
  fs.mkdirSync(path.join(__dirname, 'db'));
}

// Initialize sales.json if not exists
if (!fs.existsSync(salesFile)) {
  fs.writeFileSync(salesFile, JSON.stringify([]));
}

app.post('/api/sales', (req, res) => {
  const sale = req.body;
  const sales = JSON.parse(fs.readFileSync(salesFile, 'utf8'));
  sales.push({ ...sale, id: Date.now() });
  fs.writeFileSync(salesFile, JSON.stringify(sales, null, 2));
  res.status(201).json({ message: 'Venda registrada' });
});

app.get('/api/sales', (req, res) => {
  const sales = JSON.parse(fs.readFileSync(salesFile, 'utf8'));
  res.json(sales);
});

app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});