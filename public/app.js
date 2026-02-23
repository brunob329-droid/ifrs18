(() => {
  // Estado das respostas
  const qState = { q1: null, q2: null, q3: null, q4: null };

  // IFRS 18 — subtotais que NÃO são MDPM (excluídos)
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
  const listBtn = document.getElementById('listBtn');
  const resultCard = document.getElementById('resultCard');
  const resultTitle = document.getElementById('resultTitle');
  const resultReason = document.getElementById('resultReason');
  const auditStamp = document.getElementById('auditStamp');
  const reconTable = document.getElementById('reconTable');

  let lastEntry = null;

  // Lógica de seleção de botões Sim/Não
  document.querySelectorAll('[data-q]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const q = e.target.getAttribute('data-q');
      const val = (e.target.getAttribute('data-val') === 'true');
      qState[q] = val;
      
      const parent = e.target.closest('.q-controls');
      parent.querySelectorAll('button').forEach(b => b.classList.remove('active'));
      e.target.classList.add('active');
    });
  });

  // Função para validar e enviar (Integrado com a Trilha de Auditoria)
  evaluateBtn.addEventListener('click', async () => {
    const metricName = metricInput.value.trim();
    if (!metricName || !companyNameInput.value) {
      alert('Informe o nome da métrica e da empresa para auditoria.');
      return;
    }

    // Auto-identificação de subtotais excluídos (Q3)
    if (excludedList.some(e => metricName.toLowerCase().includes(e))) {
      qState.q3 = true;
      document.querySelector('[data-q="q3"][data-val="true"]').click();
    }

    // Coleta de dados de reconciliação (§123)
    const valorBruto = document.querySelector('#reconTable input[type="number"]')?.value || 0;

    const payload = {
      companyName: companyNameInput.value,
      cvmCode: cvmCodeInput.value,
      reportPeriod: reportPeriodInput.value,
      auditor: auditorInput.value,
      metricName: metricName,
      q1_isSubtotal: qState.q1,
      q2_usedExternally: qState.q2,
      q3_isExcluded: qState.q3,
      q4_presumptionRefutable: qState.q4,
      ajusteValorBruto: valorBruto,
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
      console.error('Erro na validação:', err);
      alert('Erro ao conectar com o servidor de auditoria.');
    }
  });

  function exibirResultado(entry) {
    resultCard.classList.remove('hidden');
    resultTitle.textContent = entry.analiseTecnica.isMDPM ? 'RESULTADO: É MDPM ✔' : 'RESULTADO: NÃO É MDPM ✘';
    resultReason.textContent = entry.analiseTecnica.reason;
    
    // Exibir carimbo de auditoria e tabela de reconciliação se for MDPM
    if (auditStamp) {
        auditStamp.innerHTML = `<strong>ID de Auditoria:</strong> ${entry.metadata.hashVerificacao} | <strong>Data:</strong> ${new Date(entry.metadata.timestamp).toLocaleString()}`;
    }
    
    if (entry.analiseTecnica.isMDPM) {
        reconTable.classList.add('visible');
    } else {
        reconTable.classList.remove('visible');
    }
  }

  // Geração de Nota Explicativa (HTML) com Requisitos do Parágrafo 123
  function generateNoteHtml(entry) {
    const isMDPM = entry.analiseTecnica.isMDPM;
    const reconHTML = entry.reconciliacao ? `
        <div style="margin-top:20px; border:1px solid #0b62a4; padding:10px;">
            <h4>Reconciliação Financeira (§123)</h4>
            <p>Valor Bruto do Ajuste: R$ ${entry.reconciliacao.valorBruto}</p>
            <p>Efeito IR/CSLL (34%): R$ ${entry.reconciliacao.efeitoIR}</p>
            <p>Efeito em Participação de Não Controladores: R$ ${entry.reconciliacao.efeitoPNC}</p>
        </div>
    ` : '';

    return `
      <html>
        <head>
            <title>Relatório de Conformidade IFRS 18</title>
            <style>
                body { font-family: sans-serif; line-height: 1.6; padding: 40px; }
                .header { border-bottom: 2px solid #0b62a4; margin-bottom: 20px; }
                .audit-tag { font-family: monospace; font-size: 12px; color: #666; }
            </style>
        </head>
        <body>
            <div class="header">
                <h1>Relatório de Validação de Métrica (IFRS 18)</h1>
                <p class="audit-tag">Protocolo de Auditoria: ${entry.metadata.hashVerificacao}</p>
            </div>
            <p><strong>Empresa:</strong> ${entry.metadata.empresa} (${entry.metadata.cvmID})</p>
            <p><strong>Métrica Analisada:</strong> ${entry.dadosMétrica.nome}</p>
            <p><strong>Resultado:</strong> ${isMDPM ? 'IDENTIFICADA COMO MPM' : 'NÃO CLASSIFICADA COMO MPM'}</p>
            <p><strong>Fundamentação:</strong> ${entry.analiseTecnica.reason}</p>
            ${reconHTML}
            <div style="margin-top:30px;">
                <p><strong>Notas do Auditor:</strong> ${entry.notasJustificativa || 'Nenhuma observação adicional.'}</p>
                <p><strong>Auditor Responsável:</strong> ${entry.metadata.auditor}</p>
            </div>
            <footer style="margin-top:50px; font-size:10px;">Gerado automaticamente pelo Protótipo de Pesquisa Orientada à Prática.</footer>
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
    setTimeout(() => win.print(), 500);
  });

})();
