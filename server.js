// server.js
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const fs = require('fs');
const path = require('path');

const app = express();
app.use(cors());
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));

const SUB_FILE = path.join(__dirname, 'submissions.json');

function loadSubs() {
  try {
    const raw = fs.readFileSync(SUB_FILE, 'utf8');
    return JSON.parse(raw || '[]');
  } catch (e) {
    return [];
  }
}

function saveSubs(arr) {
  fs.writeFileSync(SUB_FILE, JSON.stringify(arr, null, 2), 'utf8');
}

function evaluateDecisionTree(payload) {
  const { metricName, q1_isSubtotal, q2_usedExternally, q3_isExcluded, q4_presumptionRefutable } = payload;
  const q1 = !!q1_isSubtotal;
  const q2 = !!q2_usedExternally;
  const q3 = !!q3_isExcluded;
  const q4 = !!q4_presumptionRefutable;

  if (!q1) {
    return { isMDPM: false, reason: 'A métrica não é um subtotal de receitas e despesas (Q1 = NÃO).' };
  }
  if (!q2) {
    return { isMDPM: false, reason: 'A métrica não é divulgada em comunicações públicas externas (Q2 = NÃO).' };
  }
  if (q3) {
    return { isMDPM: false, reason: 'A métrica está na lista de subtotais explicitamente excluídos pela IFRS 18 (Q3 = SIM).' };
  }
  if (q4) {
    return { isMDPM: false, reason: 'A presunção de que a métrica comunica a visão da administração foi refutada (Q4 = SIM).' };
  }
  return { isMDPM: true, reason: 'A métrica passou por todos os filtros e é classificada como MDPM; exige divulgação e reconciliação conforme IFRS 18.' };
}

app.post('/api/evaluate', (req, res) => {
  const payload = req.body || {};
  payload.timestamp = new Date().toISOString();

  if (!payload.metricName) {
    return res.status(400).json({ error: 'metricName is required' });
  }

  const evaluation = evaluateDecisionTree(payload);

  const submissions = loadSubs();
  const entry = {
    id: (submissions.length === 0 ? 1 : (submissions[submissions.length - 1].id + 1)),
    metricName: payload.metricName,
    q1_isSubtotal: !!payload.q1_isSubtotal,
    q2_usedExternally: !!payload.q2_usedExternally,
    q3_isExcluded: !!payload.q3_isExcluded,
    q4_presumptionRefutable: !!payload.q4_presumptionRefutable,
    notes: payload.notes || '',
    evaluation,
    timestamp: payload.timestamp
  };

  submissions.push(entry);
  try {
    saveSubs(submissions);
  } catch (err) {
    console.error('Error saving submissions:', err);
  }

  res.json({ success: true, entry });
});

app.get('/api/submissions', (req, res) => {
  const subs = loadSubs();
  res.json({ submissions: subs });
});

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`IFRS18 prototype server running on http://localhost:${PORT}`);
});
