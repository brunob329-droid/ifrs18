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
  const resultCard = document.getElementById('resultCard');
  const resultTitle = document.getElementById('resultTitle');
  const resultReason = document.getElementById('resultReason');
  const auditStamp = document.getElementById('auditStamp');
  const reconSection = document.getElementById('reconSection');
  const reconTable = document.getElementById('reconTable');

  let lastEntry = null;

  // Lógica de seleção de botões Sim/Não (CORRIGIDA para manter o estado visual azul)
  document.querySelectorAll('[data-q]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const q = e.target.getAttribute('data-q');
      const val = (e.target.getAttribute('data-val') === 'true');
      
      // Atualiza o estado lógico
      qState[q] = val;
      
      // Atualiza o estado visual: remove 'active' de todos no mesmo grupo e adiciona no clicado
      const parent = e.target.closest('.q-controls');
      parent.querySelectorAll('button').forEach(b => b.classList.remove('active'));
      e.target.classList.add('active');
    });
  });

  // Cálculo automático de IR na tabela de reconciliação
  const adjValInput = document.getElementById('adjVal');
  const adjTaxInput = document.getElementById('adjTax');
  
  if (adjValInput) {
    adjValInput.addEventListener('input', (e) => {
      const val = parseFloat(e.target.value) || 0;
      if (adjTaxInput) {
        adjTaxInput.value = (val * 0.34).toFixed(2);
      }
    });
  }

  // Função para validar e enviar (Integrado com a Trilha de Auditoria)
  evaluateBtn.addEventListener('click', async () => {
    const metricName = metricInput.value.trim();
    
    // Validação básica
    if (!metricName || !companyNameInput.value) {
      alert('Informe o nome da métrica e da empresa para iniciar a trilha de auditoria.');
      return;
    }
    
    if (qState.q1 === null || qState.q2 === null) {
      alert('Por favor, responda às perguntas essenciais da árvore de decisão.');
      return;
    }

    // Auto-identificação de subtotais excluídos (Q3)
    if (excludedList.some(e => metricName.toLowerCase().includes(e))) {
      qState.q3 = true;
      const q3BtnYes = document.querySelector('[data-q="q3"][data-val="true"]');
      if (q3BtnYes) q3BtnYes.click();
    }

    // Coleta de dados de reconciliação (§123)
    const valorBruto = adjValInput?.value || 0;

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
      alert('Erro ao conectar com o servidor. Verifique se o backend está rodando.');
    }
  });

  function exibirResultado(entry) {
    resultCard.classList.remove('hidden');
    resultTitle.textContent = entry.analiseTecnica.isMDPM ? 'RESULTADO: É MDPM ✔' : 'RESULTADO: NÃO É MDPM ✘';
    resultReason.textContent = entry.analiseTecnica.reason;
    
    // Exibir carimbo de auditoria
    if (auditStamp) {
        auditStamp.innerHTML = `<strong>ID de Auditoria:</strong> ${entry.metadata.hashVerificacao} | <strong>Data:</strong> ${new Date(entry.metadata.timestamp).toLocaleString()}`;
    }
    
    // Mostrar seção de reconciliação apenas se for MDPM
    if (entry.analiseTecnica.isMDPM) {
        reconSection.classList.remove('hidden');
    } else {
        reconSection.classList.add('hidden');
    }
  }

  // Geração de Nota Explicativa (HTML) com Requisitos do Parágrafo 123
  function generateNoteHtml(entry) {
    const isMDPM = entry.analiseTecnica.isMDPM;
    const reconHTML = entry.reconciliacao ? `
        <div style="margin-top:20px; border:1px solid #0b62a4; padding:15px; border-radius:8px;">
            <h4 style="margin-top:0; color:#0b62a4;">Detalhamento de Reconciliação (§123)</h4>
            <table style="width:100%; border-collapse: collapse;">
                <tr><td style="padding:5px 0;"><strong>Valor Bruto do Ajuste:</strong></td><td style="text-align:right;">R$ ${entry.reconciliacao.valorBruto}</td></tr>
                <tr><td style="padding:5px 0;"><strong>Efeito IR/CSLL (34%):</strong></td><td style="text-align:right;">R$ ${entry.reconciliacao.efeitoIR}</td></tr>
                <tr><td style="padding:5px 0;"><strong>Efeito em Participação de Não Controladores:</strong></td><td style="text-align:right;">R$ ${entry.reconciliacao.efeitoPNC || '0.00'}</td></tr>
            </table>
        </div>
    ` : '';

    return `
      <html>
        <head>
            <meta charset="utf-8">
            <title>Relatório de Conformidade IFRS 18 - ${entry.dadosMétrica.nome}</title>
            <style>
                body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; padding: 40px; color: #333; }
                .header { border-bottom: 2px solid #0b62a4; margin-bottom: 20px; padding-bottom: 10px; }
                .audit-tag { font-family: monospace; font-size: 12px; color: #666; background: #f4f4f4; padding: 4px 8px; border-radius: 4px; }
                h1 { color: #0b62a4; margin-bottom: 5px; }
                .footer { margin-top: 50px; font-size: 11px; border-top: 1px solid #eee; padding-top: 10px; color: #888; }
                .status-badge { display: inline-block; padding: 5px 12px; border-radius: 20px; font-weight: bold; background: ${isMDPM ? '#d4edda' : '#f8d7da'}; color: ${isMDPM ? '#155724' : '#721c24'}; }
            </style>
        </head>
        <body>
            <div class="header">
                <h1>Relatório de Validação de Métrica</h1>
                <span class="audit-tag">Protocolo de Auditoria: ${entry.metadata.hashVerificacao}</span>
            </div>
            
            <p><strong>Empresa:</strong> ${entry.metadata.empresa} (CVM: ${entry.metadata.cvmID || 'N/A'})</p>
            <p><strong>Período:</strong> ${entry.metadata.periodo || 'N/A'}</p>
            <p><strong>Métrica Analisada:</strong> <span style="font-size: 1.2em; font-weight: bold;">${entry.dadosMétrica.nome}</span></p>
            <p><strong>Resultado:</strong> <span class="status-badge">${isMDPM ? 'IDENTIFICADA COMO MPM' : 'NÃO CLASSIFICADA COMO MPM'}</span></p>
            
            <div style="background: #f9f9f9; padding: 15px; border-left: 5px solid #0b62a4; margin: 20px 0;">
                <p><strong>Fundamentação Técnica (IFRS 18):</strong><br>${entry.analiseTecnica.reason}</p>
            </div>

            ${reconHTML}

            <div style="margin-top:30px;">
                <p><strong>Notas e Justificativas:</strong><br>${entry.notasJustificativa || 'Nenhuma observação adicional registrada.'}</p>
                <p><strong>Auditor Responsável:</strong> ${entry.metadata.auditor}</p>
            </div>

            <div class="footer">
                Este documento é uma saída do Protótipo de Pesquisa Orientada à Prática em IFRS 18. 
                Gerado em: ${new Date(entry.metadata.timestamp).toLocaleString()}
            </div>
        </body>
      </html>`;
  }

  // Ações dos botões de saída
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
    setTimeout(() => {
      win.focus();
      win.print();
    }, 600);
  });

})();
