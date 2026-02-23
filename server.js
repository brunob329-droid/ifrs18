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

// Carregar submissões com tratamento de erro
function loadSubs() {
  try {
    if (!fs.existsSync(SUB_FILE)) return [];
    const raw = fs.readFileSync(SUB_FILE, 'utf8');
    return JSON.parse(raw || '[]');
  } catch (e) {
    console.error("Erro ao carregar arquivo de auditoria:", e);
    return [];
  }
}

function saveSubs(arr) {
  fs.writeFileSync(SUB_FILE, JSON.stringify(arr, null, 2), 'utf8');
}

// Lógica de Decisão baseada estritamente na IFRS 18 (Fundamentação Teórica)
function evaluateDecisionTree(payload) {
  const { q1_isSubtotal, q2_usedExternally, q3_isExcluded, q4_presumptionRefutable } = payload;

  if (!q1_isSubtotal) {
    return { 
      isMDPM: false, 
      reason: 'A métrica não atende ao §117: não é um subtotal de receitas/despesas.',
      statusNormativo: 'Fora do Escopo'
    };
  }
  if (!q2_usedExternally) {
    return { 
      isMDPM: false, 
      reason: 'A métrica não atende ao §118: não é utilizada em comunicações públicas.',
      statusNormativo: 'Uso Interno Apenas' 
    };
  }
  if (q3_isExcluded) {
    return { 
      isMDPM: false, 
      reason: 'Métrica excluída conforme §118(b) e B21-B27 (Ex: Lucro Bruto ou EBIT).',
      statusNormativo: 'Subtotal IFRS Mandatório'
    };
  }
  if (q4_presumptionRefutable) {
    return { 
      isMDPM: false, 
      reason: 'A presunção de visão da administração foi refutada conforme §§119-120.',
      statusNormativo: 'Presunção Refutada'
    };
  }
  
  return { 
    isMDPM: true, 
    reason: 'Classificada como MDPM. Exige reconciliação e divulgação de efeitos fiscais (§122-123).',
    statusNormativo: 'MDPM Identificada'
  };
}

// ROTA PRINCIPAL: Avaliação com foco em Governança
app.post('/api/evaluate', (req, res) => {
  const payload = req.body || {};
  
  if (!payload.metricName || !payload.companyName) {
    return res.status(400).json({ error: 'Nome da métrica e da empresa são obrigatórios para a trilha de auditoria.' });
  }

  // Executa a árvore de decisão
  const evaluation = evaluateDecisionTree(payload);

  // Lógica de Reconciliação Simplificada (§123)
  let reconciliacaoEfetiva = null;
  if (evaluation.isMDPM && payload.ajusteValorBruto) {
    const valorBruto = parseFloat(payload.ajusteValorBruto);
    reconciliacaoEfetiva = {
        valorBruto: valorBruto,
        efeitoIR: (valorBruto * 0.34).toFixed(2), // Alíquota estimada de 34%
        efeitoPNC: payload.efeitoPNC || 0
    };
  }

  const submissions = loadSubs();
  
  // Criação do Registro de Auditoria (Essencial para o Quesito IV do Congresso)
  const entry = {
    id: (submissions.length === 0 ? 1 : (submissions[submissions.length - 1].id + 1)),
    metadata: {
        timestamp: new Date().toISOString(),
        empresa: payload.companyName,
        cvmID: payload.cvmCode,
        periodo: payload.reportPeriod,
        auditor: payload.auditor || 'Não informado',
        hashVerificacao: Math.random().toString(36).substring(2, 15).toUpperCase() // Simula integridade
    },
    dadosMétrica: {
        nome: payload.metricName,
        respostas: {
            subtotal: !!payload.q1_isSubtotal,
            publico: !!payload.q2_usedExternally,
            excluida: !!payload.q3_isExcluded,
            refutada: !!payload.q4_presumptionRefutable
        }
    },
    analiseTecnica: evaluation,
    reconciliacao: reconciliacaoEfetiva,
    notasJustificativa: payload.notes || ''
  };

  submissions.push(entry);
  
  try {
    saveSubs(submissions);
    res.json({ success: true, entry });
  } catch (err) {
    console.error('Erro ao gravar log de auditoria:', err);
    res.status(500).json({ error: 'Falha ao salvar registro de conformidade.' });
  }
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
  console.log(`
  ==================================================
  PROTÓTIPO IFRS 18 - BACKEND INICIADO
  FOCO: PESQUISA ORIENTADA À PRÁTICA (ÁREA X)
  PORTA: ${PORT}
  ==================================================
  `);
});
