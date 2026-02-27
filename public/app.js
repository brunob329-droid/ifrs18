(() => {
  // Estado das respostas
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
      
      // Feedback Visual: Garante a classe .active para o CSS
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
    
    // Validação de preenchimento manual (Julgamento Profissional)
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
      notes: notesInput.value // Captura a Justificativa do Julgamento Profissional
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
      alert('Servidor em standby. Tente novamente em breve.');
    } finally {
      evaluateBtn.textContent = "Validar e Salvar Log";
      evaluateBtn.disabled = false;
    }
  });

  function exibirResultado(entry) {
    resultCard.classList.remove('hidden');
    // Sigla padronizada para MPM
    resultTitle.textContent = entry.analiseTecnica.isMDPM ? 'RESULTADO: É MPM ✔' : 'RESULTADO: NÃO É MPM ✘';
    resultReason.textContent = entry.analiseTecnica.reason;
    
    if (auditStamp) {
        auditStamp.innerHTML = `<strong>ID de Auditoria:</strong> ${entry.metadata.hashVerificacao} | <strong>Data:</strong> ${new Date(entry.metadata.timestamp).toLocaleString()}`;
    }
    
    if (entry.analiseTecnica.isMDPM) {
        reconSection.classList.remove('hidden');
    } else {
        reconSection.classList.add('hidden');
    }
  }

  // Geração da Nota Explicativa Bilíngue (Conforme imagem_c6bf85.png)
  function generateNoteHtml(entry) {
    const isMPM = entry.analiseTecnica.isMDPM;
    
    return `
      <html>
        <head>
            <meta charset="utf-8">
            <title>Nota Explicativa MPM - ${entry.metadata.empresa}</title>
            <style>
                body { font-family: 'Segoe UI', Arial, sans-serif; line-height: 1.4; padding: 30px; color: #333; }
                .header-table { width: 100%; border-bottom: 2px solid #000; margin-bottom: 10px; }
                .columns { display: flex; gap: 40px; margin-top: 20px; }
                .col { flex: 1; font-size: 12px; }
                h1 { font-size: 18px; color: #0b62a4; margin: 0; }
                h2 { font-size: 13px; margin: 15px 0 5px 0; border-bottom: 1px solid #ccc; font-weight: bold; text-transform: uppercase; }
                .evidence-box { margin-top: 25px; padding: 15px; border: 1px solid #ddd; background: #fdfdfd; font-size: 11px; line-height: 1.6; border-left: 4px solid #0b62a4; }
                .audit-info { text-align: right; font-size: 10px; color: #666; font-family: monospace; }
                ul { padding-left: 18px; margin: 5px 0; }
                li { margin-bottom: 3px; }
            </style>
        </head>
        <body>
            <div class="header-table">
                <table style="width:100%">
                    <tr>
                        <td><h1>Nota Explicativa: MPM</h1></td>
                        <td class="audit-info">UID: ${entry.metadata.hashVerificacao}<br>${new Date(entry.metadata.timestamp).toLocaleString()}</td>
                    </tr>
                </table>
            </div>

            <div class="columns">
                <div class="col">
                    <h2>Português (PT-BR)</h2>
                    <strong>Empresa:</strong> ${entry.metadata.empresa}<br>
                    <strong>Período de reporte:</strong> ${entry.metadata.periodo || 'N/A'}<br>
                    <strong>Setor:</strong> ${entry.metadata.setor || 'N/A'}<br>
                    <strong>Auditor responsável:</strong> ${entry.metadata.auditor}<br>
                    
                    <h2>Justificativa</h2>
                    <p>A métrica passou por todos os filtros e é classificada como MPM (Medida de Desempenho da Administração), exigindo divulgação e reconciliação conforme IFRS 18.</p>
                    
                    <h2>Requisitos de divulgação (IFRS 18)</h2>
                    <ul>
                        <li>Explicação de porque a métrica reflete a visão da administração.</li>
                        <li>Reconciliar a métrica com o subtotal IFRS comparável (§123).</li>
                        <li>Fornecer período e comparativos (quando aplicável).</li>
                    </ul>
                </div>

                <div class="col">
                    <h2>English (EN)</h2>
                    <strong>Company:</strong> ${entry.metadata.empresa}<br>
                    <strong>Reporting period:</strong> ${entry.metadata.periodo || 'N/A'}<br>
                    <strong>Sector:</strong> ${entry.metadata.setor || 'N/A'}<br>
                    <strong>Auditor:</strong> ${entry.metadata.auditor}<br>
                    
                    <h2>Rationale</h2>
                    <p>The measure passed all mandatory filters and is classified as MPM, requiring disclosure and reconciliation per IFRS 18 standards.</p>
                    
                    <h2>Disclosure requirements (IFRS 18)</h2>
                    <ul>
                        <li>Explain why the measure conveys management's view.</li>
                        <li>Reconcile the measure to the comparable IFRS subtotal (§123).</li>
                        <li>Provide period and comparatives (when applicable).</li>
                    </ul>
                </div>
            </div>

            <div class="evidence-box">
                <strong>Evidence / Notes (Julgamento Profissional):</strong><br>
                <em>"${entry.dadosMétrica.notasAdicionais || 'Nenhum detalhamento de evidência inserido pelo auditor.'}"</em>
            </div>

            <p style="font-size: 9px; color: #888; margin-top: 30px; text-align: center; border-top: 1px inset #eee; padding-top: 10px;">
                Gerado via Protótipo de Governança IFRS 18 - Rastreabilidade garantida via ID de Auditoria. 
                Sustentação do julgamento profissional verificável por terceiros [cite: 2026-02-24].
            </p>
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
