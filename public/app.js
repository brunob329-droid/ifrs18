(() => {
  // Estado das respostas (Tree Decision)
  const qState = { q1: null, q2: null, q3: null, q4: null };

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
      
      const parent = e.target.closest('.q-controls');
      parent.querySelectorAll('button').forEach(b => b.classList.remove('active'));
      e.target.classList.add('active');
    });
  });

  // Cálculo automático de IR (34%) conforme §123 IFRS 18
  if (adjValInput) {
    adjValInput.addEventListener('input', (e) => {
      const val = parseFloat(e.target.value) || 0;
      if (adjTaxInput) {
        adjTaxInput.value = (val * 0.34).toFixed(2);
      }
    });
  }

  // Função para validar e enviar para Auditoria
  evaluateBtn.addEventListener('click', async () => {
    const metricName = metricInput.value.trim();
    
    if (!metricName || !companyNameInput.value) {
      alert('Informe o nome da métrica e da empresa para iniciar a auditoria.');
      return;
    }
    
    if (qState.q1 === null || qState.q2 === null || qState.q3 === null) {
      alert('Por favor, responda aos critérios da árvore de decisão manualmente.');
      return;
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
      alert('Servidor em standby. Verifique a conexão com o backend.');
    } finally {
      evaluateBtn.textContent = "Validar e Salvar Log";
      evaluateBtn.disabled = false;
    }
  });

  // EXIBIÇÃO CORRIGIDA (Remove MDPM e padroniza MPM)
  function exibirResultado(entry) {
    resultCard.classList.remove('hidden');
    
    // Título padronizado
    resultTitle.textContent = entry.analiseTecnica.isMDPM ? 'RESULTADO: É MPM ✔' : 'RESULTADO: NÃO É MPM ✘';
    
    // Filtro para limpar qualquer menção a "MDPM" vinda do servidor
    const cleanReason = entry.analiseTecnica.reason.replace(/MDPM/g, 'MPM');
    resultReason.textContent = cleanReason;
    
    if (auditStamp) {
        auditStamp.innerHTML = `<strong>ID de Auditoria:</strong> ${entry.metadata.hashVerificacao} | <strong>Data:</strong> ${new Date(entry.metadata.timestamp).toLocaleString()}`;
    }
    
    if (entry.analiseTecnica.isMDPM) {
        reconSection.classList.remove('hidden');
    } else {
        reconSection.classList.add('hidden');
    }
  }

  // Geração da Nota Explicativa (Blindada contra MDPM)
  function generateNoteHtml(entry) {
    // Tratamento preventivo de dados
    const empresa = entry.metadata.empresa || "N/A";
    const justificativa = (entry.analiseTecnica.reason || "").replace(/MDPM/g, 'MPM');
    const notasAudit = entry.dadosMetrica?.notasAdicionais || entry.dadosMétrica?.notasAdicionais || 'Nenhum detalhamento inserido.';

    return `
      <html>
        <head>
            <meta charset="utf-8">
            <title>Nota Explicativa MPM - ${empresa}</title>
            <style>
                body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; padding: 40px; color: #333; }
                .header-table { width: 100%; border-bottom: 3px solid #0b62a4; margin-bottom: 20px; padding-bottom: 10px; }
                .columns { display: flex; gap: 50px; margin-top: 20px; }
                .col { flex: 1; font-size: 13px; text-align: justify; }
                h1 { font-size: 22px; color: #0b62a4; margin: 0; }
                h2 { font-size: 14px; margin: 20px 0 10px 0; border-bottom: 1px solid #eee; color: #0b62a4; font-weight: bold; text-transform: uppercase; }
                .evidence-box { margin-top: 30px; padding: 20px; border: 1px solid #ddd; background: #f9f9f9; font-size: 12px; border-left: 5px solid #0b62a4; font-style: italic; }
                .audit-info { text-align: right; font-size: 11px; color: #777; font-family: 'Courier New', monospace; }
                ul { padding-left: 20px; }
                li { margin-bottom: 5px; }
            </style>
        </head>
        <body>
            <div class="header-table">
                <table style="width:100%">
                    <tr>
                        <td><h1>Nota Explicativa: Medidas de Desempenho (MPM)</h1></td>
                        <td class="audit-info">UID: ${entry.metadata.hashVerificacao}<br>Gerado em: ${new Date(entry.metadata.timestamp).toLocaleString()}</td>
                    </tr>
                </table>
            </div>

            <div class="columns">
                <div class="col">
                    <h2>Português (PT-BR)</h2>
                    <strong>Entidade:</strong> ${empresa}<br>
                    <strong>Período:</strong> ${entry.metadata.periodo || 'N/A'}<br>
                    <strong>Auditor:</strong> ${entry.metadata.auditor}<br>
                    
                    <h3>Conclusão do Julgamento</h3>
                    <p>${justificativa}</p>
                    
                    <h2>Conformidade IFRS 18</h2>
                    <ul>
                        <li>Atendimento aos critérios de subtotal da administração (§117).</li>
                        <li>Reconciliação detalhada exigida no Quadro de Ajustes (§123).</li>
                        <li>Divulgação obrigatória em nota específica (§122).</li>
                    </ul>
                </div>

                <div class="col">
                    <h2>English (EN)</h2>
                    <strong>Entity:</strong> ${empresa}<br>
                    <strong>Reporting Period:</strong> ${entry.metadata.periodo || 'N/A'}<br>
                    <strong>Lead Auditor:</strong> ${entry.metadata.auditor}<br>
                    
                    <h3>Rationale</h3>
                    <p>The measure is classified as a Management Performance Measure (MPM) as it represents management's view of financial performance and is disclosed outside financial statements.</p>
                    
                    <h2>Disclosure Requirements</h2>
                    <ul>
                        <li>Reasoning for why the measure provides useful information.</li>
                        <li>Tax effect and non-controlling interest reconciliation (§123).</li>
                        <li>Consistent presentation across reporting periods.</li>
                    </ul>
                </div>
            </div>

            <div class="evidence-box">
                <strong>Evidências e Notas do Auditor:</strong><br>
                "${notasAudit}"
            </div>

            <footer style="font-size: 10px; color: #999; margin-top: 50px; text-align: center; border-top: 1px solid #eee; padding-top: 15px;">
                Artefato Tecnológico de Governança Contábil. Rastreabilidade via ID de Auditoria. 
                Sustentação baseada no julgamento profissional conforme diretrizes do Congresso USP 2026.
            </footer>
        </body>
      </html>`;
  }

  // Eventos de Geração de Nota e Impressão
  if (generateBtn) {
    generateBtn.addEventListener('click', () => {
        if (!lastEntry) return alert('Realize uma validação primeiro.');
        const win = window.open('', '_blank');
        win.document.write(generateNoteHtml(lastEntry));
        win.document.close();
    });
  }

  if (printBtn) {
    printBtn.addEventListener('click', () => {
        if (!lastEntry) return alert('Realize uma validação primeiro.');
        const win = window.open('', '_blank');
        win.document.write(generateNoteHtml(lastEntry));
        win.document.close();
        setTimeout(() => { win.focus(); win.print(); }, 600);
    });
  }
})();
