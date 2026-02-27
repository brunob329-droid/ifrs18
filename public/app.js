(() => {
  // Estado das respostas
  const qState = { q1: null, q2: null, q3: null, q4: null };

  // IFRS 18 — subtotais que NÃO são MPM (excluídos)
  const excludedList = [
    "lucro bruto", "resultado bruto", "gross profit", "resultado operacional",
    "operating profit", "ebit", "lucro líquido", "resultado líquido",
    "net income", "resultado após impostos"
  ];

  // Elementos de Metadados (Governança Corporativa)
  const companyNameInput = document.getElementById('companyName');
  const cvmCodeInput = document.getElementById('cvmCode');
  const reportPeriodInput = document.getElementById('reportPeriod');
  const sectorInput = document.getElementById('sector');
  const auditorInput = document.getElementById('auditor');

  // Elementos da Métrica e Ações
  const metricInput = document.getElementById('metricName');
  const notesInput = document.getElementById('notes');
  const evaluateBtn = document.getElementById('evaluateBtn');
  const generateBtn = document.getElementById('generateBtn');
  const printBtn = document.getElementById('printBtn');
  const resultCard = document.getElementById('resultCard');
  const resultTitle = document.getElementById('resultTitle');
  const resultReason = document.getElementById('resultReason');
  const auditStamp = document.getElementById('auditStamp');
  const reconSection = document.getElementById('reconSection');
  const adjValInput = document.getElementById('adjVal');
  const adjTaxInput = document.getElementById('adjTax');

  let lastEntry = null;

  // Lógica de seleção de botões Sim/Não (Destaque Visual)
  document.querySelectorAll('[data-q]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const q = e.target.getAttribute('data-q');
      const val = (e.target.getAttribute('data-val') === 'true');
      
      qState[q] = val;
      
      // Feedback Visual: Garante a classe .active para o CSS brilhar
      const parent = e.target.closest('.q-controls');
      parent.querySelectorAll('button').forEach(b => b.classList.remove('active'));
      e.target.classList.add('active');
    });
  });

  // Cálculo automático de IR (34%) conforme §123
  if (adjValInput) {
    adjValInput.addEventListener('input', (e) => {
      const val = parseFloat(e.target.value) || 0;
      if (adjTaxInput) {
        adjTaxInput.value = (val * 0.34).toFixed(2);
      }
    });
  }

  // Função para validar e enviar
  evaluateBtn.addEventListener('click', async () => {
    const metricName = metricInput.value.trim();
    
    if (!metricName || !companyNameInput.value) {
      alert('Informe o nome da métrica e da empresa para iniciar a auditoria.');
      return;
    }
    
    if (qState.q1 === null || qState.q2 === null) {
      alert('Por favor, responda aos critérios da árvore de decisão.');
      return;
    }

    // Auto-identificação de subtotais excluídos (Q3)
    if (excludedList.some(e => metricName.toLowerCase().includes(e))) {
      qState.q3 = true;
      const q3BtnYes = document.querySelector('[data-q="q3"][data-val="true"]');
      if (q3BtnYes) {
        const parent = q3BtnYes.closest('.q-controls');
        parent.querySelectorAll('button').forEach(b => b.classList.remove('active'));
        q3BtnYes.classList.add('active');
      }
    }

    evaluateBtn.textContent = "Processando Auditoria...";
    evaluateBtn.disabled = true;

    const payload = {
      companyName: companyNameInput.value,
      cvmCode: cvmCodeInput.value,
      reportPeriod: reportPeriodInput.value,
      sector: sectorInput.value,
      auditor: auditorInput.value,
      metricName: metricName,
      q1_isSubtotal: qState.q1,
      q2_usedExternally: qState.q2,
      q3_isExcluded: qState.q3,
      q4_presumptionRefutable: qState.q4,
      ajusteValorBruto: adjValInput?.value || 0,
      notes: notesInput.value
    };

    try {
      const resp = await fetch('/api/evaluate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await resp.json();
      
      if (data.success) {
        lastEntry = data.entry;
        exibirResultado(data.entry);
      }
    } catch (err) {
      alert('Servidor em standby. Tente novamente em 30 segundos.');
    } finally {
      evaluateBtn.textContent = "Validar e Salvar Log";
      evaluateBtn.disabled = false;
    }
  });

  function exibirResultado(entry) {
    resultCard.classList.remove('hidden');
    // Alterado MDPM -> MPM
    resultTitle.textContent = entry.analiseTecnica.isMDPM ? 'RESULTADO: É MPM ✔' : 'RESULTADO: NÃO É MPM ✘';
    resultReason.textContent = entry.analiseTecnica.reason;
    
    if (auditStamp) {
        auditStamp.innerHTML = `<strong>ID de Auditoria:</strong> ${entry.metadata.hashVerificacao} | <strong>Data:</strong> ${new Date(entry.metadata.timestamp).toLocaleString()}`;
    }
    
    // Mostra/Oculta seção de reconciliação (§123)
    if (entry.analiseTecnica.isMDPM) {
        reconSection.classList.remove('hidden');
    } else {
        reconSection.classList.add('hidden');
    }
  }

  function generateNoteHtml(entry) {
    const isMPM = entry.analiseTecnica.isMDPM; // Mantido isMDPM aqui para não quebrar a conexão com o backend
    const reconHTML = entry.reconciliacao ? `
        <div style="margin-top:20px; border:1px solid #0b62a4; padding:15px; border-radius:8px; background:#f0f7ff;">
            <h4 style="margin-top:0; color:#0b62a4;">Detalhamento de Reconciliação Financeira (§123)</h4>
            <table style="width:100%; border-collapse: collapse;">
                <tr><td style="padding:5px 0;"><strong>Ajuste Bruto:</strong></td><td style="text-align:right;">R$ ${entry.reconciliacao.valorBruto}</td></tr>
                <tr><td style="padding:5px 0;"><strong>Efeito IR/CSLL (34%):</strong></td><td style="text-align:right;">R$ ${entry.reconciliacao.efeitoIR}</td></tr>
                <tr><td style="padding:5px 0;"><strong>Efeito PNC:</strong></td><td style="text-align:right;">R$ ${entry.reconciliacao.efeitoPNC || '0.00'}</td></tr>
            </table>
        </div>
    ` : '';

    return `
      <html>
        <head>
            <meta charset="utf-8">
            <title>Auditoria IFRS 18 - ${entry.dadosMétrica.nome}</title>
            <style>
                body { font-family: 'Segoe UI', Arial; line-height: 1.6; padding: 40px; color: #333; }
                .header { border-bottom: 3px solid #0b62a4; margin-bottom: 20px; padding-bottom: 10px; }
                .audit-tag { font-family: monospace; font-size: 11px; color: #666; background: #eee; padding: 3px 6px; }
                .status { display: inline-block; padding: 6px 12px; border-radius: 4px; font-weight: bold; 
                          background: ${isMPM ? '#d4edda' : '#f8d7da'}; color: ${isMPM ? '#155724' : '#721c24'}; }
            </style>
        </head>
        <body>
            <div class="header">
                <h1>Nota de Conformidade Normativa</h1>
                <span class="audit-tag">HASH: ${entry.metadata.hashVerificacao}</span>
            </div>
            <p><strong>Empresa:</strong> ${entry.metadata.empresa} | <strong>Auditor:</strong> ${entry.metadata.auditor}</p>
            <p><strong>Métrica:</strong> ${entry.dadosMétrica.nome} <span class="status">${isMPM ? 'MPM CONFIRMADA' : 'NÃO MPM'}</span></p>
            <div style="background:#f9f9f9; padding:15px; border-left:5px solid #0b62a4;">
                <strong>Justificativa Técnica:</strong><br>${entry.analiseTecnica.reason}
            </div>
            ${reconHTML}
            <p style="margin-top:20px; font-size:12px; color:#666;">Gerado via Protótipo de Governança IFRS 18 - Data: ${new Date(entry.metadata.timestamp).toLocaleString()}</p>
        </body>
      </html>`;
  }

  generateBtn.addEventListener('click', () => {
    if (!lastEntry) return alert('Realize uma validação primeiro.');
    const win = window.open('', '_blank');
    win.document.write(generateNoteHtml(lastEntry));
    win.document.close();
  });

  printBtn.addEventListener('click', () => {
    if (!lastEntry) return alert('Realize uma validação primeiro.');
    const win = window.open('', '_blank');
    win.document.write(generateNoteHtml(lastEntry));
    win.document.close();
    setTimeout(() => { win.focus(); win.print(); }, 600);
  });
})();
