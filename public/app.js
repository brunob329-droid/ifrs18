(() => {
  // Estado das respostas
  const qState = { q1: null, q2: null, q3: null, q4: null };

  // IFRS 18 — subtotais que NÃO são MDPM (excluídos)
  const excludedList = [
    "lucro bruto",
    "resultado bruto",
    "gross profit",
    "resultado operacional",
    "operating profit",
    "resultado antes do financeiro e imposto",
    "ebit",
    "lucro líquido",
    "resultado líquido",
    "net income",
    "resultado após impostos",
    "resultado de operações continuadas"
  ];

  // elementos
  const companyNameInput = document.getElementById('companyName');
  const cvmCodeInput = document.getElementById('cvmCode');
  const reportPeriodInput = document.getElementById('reportPeriod');
  const sectorInput = document.getElementById('sector');
  const auditorInput = document.getElementById('auditor');

  const metricInput = document.getElementById('metricName');
  const notesInput = document.getElementById('notes');
  const evaluateBtn = document.getElementById('evaluateBtn');
  const generateBtn = document.getElementById('generateBtn');
  const printBtn = document.getElementById('printBtn');
  const listBtn = document.getElementById('listBtn');
  const resultCard = document.getElementById('resultCard');
  const resultTitle = document.getElementById('resultTitle');
  const resultReason = document.getElementById('resultReason');
  const subsList = document.getElementById('subsList');
  const subsContainer = document.getElementById('subsContainer');
  const modeSelect = document.getElementById('modeSelect');

  let lastEntry = null;

  // modo default salvo em localStorage
  const storedMode = localStorage.getItem('mdpmMode');
  if (storedMode) modeSelect.value = storedMode;
  modeSelect.addEventListener('change', () => {
    localStorage.setItem('mdpmMode', modeSelect.value);
  });

  // carregar submissões
  async function loadSubmissions() {
    try {
      const resp = await fetch('/api/submissions');
      const data = await resp.json();
      const subs = data.submissions || [];
      subsContainer.innerHTML = subs.length === 0 ? '<div class="small">Nenhuma submissão encontrada</div>' :
        subs.map(s => {
          return `<div class="list-item">
            <div><strong>${s.metricName}</strong> — <span class="small">${new Date(s.timestamp).toLocaleString()}</span></div>
            <div class="small">Q1: ${s.q1_isSubtotal} • Q2: ${s.q2_usedExternally} • Q3: ${s.q3_isExcluded} • Q4: ${s.q4_presumptionRefutable}</div>
            <div class="small">Resultado: ${s.evaluation.isMDPM ? 'MDPM' : 'NÃO MDPM'} — ${s.evaluation.reason}</div>
            <div class="small">Notas: ${s.notes || '-'}</div>
          </div>`;
        }).join('');
    } catch (err) {
      subsContainer.innerHTML = '<div class="small">Erro ao carregar submissões</div>';
      console.error(err);
    }
  }

  // marcar botões Sim/Não e atualizar estado
  document.querySelectorAll('[data-q]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const q = e.target.getAttribute('data-q');
      const valStr = e.target.getAttribute('data-val');
      const val = (valStr === 'true');
      qState[q] = val;
      const parent = e.target.closest('.q-controls');
      if (parent) parent.querySelectorAll('button').forEach(b => b.classList.remove('active'));
      e.target.classList.add('active');
    });
  });

  // função utilitária para criar id curto
  function makeShortId() {
    const t = Date.now().toString(36);
    const r = Math.random().toString(36).slice(2,8);
    return `${t}-${r}`;
  }

  // gerar nota (bilingue, acadêmica)
  function generateNoteHtml(entry) {
    // company metadata (prefer values from inputs if available)
    const meta = {
      companyName: companyNameInput.value.trim() || entry.companyName || '',
      cvmCode: cvmCodeInput.value.trim() || entry.cvmCode || '',
      reportPeriod: reportPeriodInput.value.trim() || entry.reportPeriod || '',
      sector: sectorInput.value.trim() || entry.sector || '',
      auditor: auditorInput.value.trim() || entry.auditor || '',
      generatedAt: new Date().toLocaleString(),
      uid: entry.uid || makeShortId()
    };

    // bilingual labels (PT / EN)
    const L = {
      title_pt: entry.evaluation.isMDPM ? 'Nota Explicativa: MDPM' : 'Nota Explicativa: NÃO MDPM',
      title_en: entry.evaluation.isMDPM ? 'Explanatory Note: MPM' : 'Explanatory Note: NOT MPM',
      metric_pt: 'Métrica',
      metric_en: 'Metric',
      result_pt: 'Resultado',
      result_en: 'Result',
      reason_pt: 'Justificativa',
      reason_en: 'Rationale',
      company_pt: 'Empresa',
      company_en: 'Company',
      period_pt: 'Período de reporte',
      period_en: 'Reporting period',
      sector_pt: 'Setor',
      sector_en: 'Sector',
      auditor_pt: 'Auditor responsável',
      auditor_en: 'Auditor'
    };

    const title = `${L.title_pt} / ${L.title_en}`;
    const date = meta.generatedAt;
    const uid = meta.uid;

    // HTML com duas colunas (PT | EN)
    const html = `<!doctype html>
    <html>
    <head>
      <meta charset="utf-8"/>
      <title>${L.title_pt} - ${entry.metricName}</title>
      <style>
        body{font-family:Arial,Helvetica,sans-serif;padding:24px;color:#0b1220}
        .header{display:flex;justify-content:space-between;align-items:flex-start}
        h1{color:#0b62a4;margin:0}
        .meta{font-size:13px;color:#444;margin-top:6px}
        .two-col{display:flex;gap:20px}
        .col{flex:1}
        .section{margin-top:16px}
        .mono{font-family:monospace;background:#f4f6f8;padding:8px;border-radius:6px}
        table{border-collapse:collapse;width:100%;margin-top:8px}
        th,td{border:1px solid #ddd;padding:8px;text-align:left}
        footer{margin-top:22px;color:#666;font-size:12px}
        .tag{display:inline-block;padding:6px 8px;border-radius:6px;background:#eef3ff;color:#0b62a4;font-weight:700}
      </style>
    </head>
    <body>
      <div class="header">
        <div>
          <h1>${L.title_pt}</h1>
          <div class="meta"><strong>${L.metric_pt}:</strong> ${entry.metricName}</div>
          <div class="meta">${L.result_pt}: <strong>${entry.evaluation.isMDPM ? 'É MDPM' : 'NÃO é MDPM'}</strong></div>
        </div>
        <div style="text-align:right">
          <div class="mono">UID: ${uid}</div>
          <div class="meta">${date}</div>
        </div>
      </div>

      <div class="section two-col">
        <div class="col">
          <h3>Português (PT-BR)</h3>
          <p><strong>${L.company_pt}:</strong> ${meta.companyName || '-'}</p>
          <p><strong>${L.period_pt}:</strong> ${meta.reportPeriod || '-'}</p>
          <p><strong>${L.sector_pt}:</strong> ${meta.sector || '-'}</p>
          <p><strong>${L.auditor_pt}:</strong> ${meta.auditor || '-'}</p>

          <div class="section">
            <h4>${L.reason_pt}</h4>
            <p>${entry.evaluation.reason}</p>
          </div>

          <div class="section">
            <h4>Requisitos de divulgação (IFRS 18)</h4>
            <ul>
              <li>Explicação de porque a métrica reflete a visão da administração.</li>
              <li>Reconciliar a métrica com o subtotal IFRS comparável.</li>
              <li>Fornecer período e comparativos (quando aplicável).</li>
            </ul>
          </div>
        </div>

        <div class="col">
          <h3>English (EN)</h3>
          <p><strong>${L.company_en}:</strong> ${meta.companyName || '-'}</p>
          <p><strong>${L.period_en}:</strong> ${meta.reportPeriod || '-'}</p>
          <p><strong>${L.sector_en}:</strong> ${meta.sector || '-'}</p>
          <p><strong>${L.auditor_en}:</strong> ${meta.auditor || '-'}</p>

          <div class="section">
            <h4>${L.reason_en}</h4>
            <p>${entry.evaluation.reason}</p>
          </div>

          <div class="section">
            <h4>Disclosure requirements (IFRS 18)</h4>
            <ul>
              <li>Explain why the measure conveys management's view.</li>
              <li>Reconcile the measure to the comparable IFRS subtotal.</li>
              <li>Provide period and comparatives (when applicable).</li>
            </ul>
          </div>
        </div>
      </div>

      <div class="section">
        <h4>Evidence / Notes</h4>
        <p>${entry.notes ? entry.notes.replace(/\n/g,'<br/>') : '-'}</p>
      </div>

      <footer>
        Generated by IFRS18 Prototype • UID: ${uid}
      </footer>
    </body>
    </html>`;

    return html;
  }

  // handler evaluate (envia ao backend)
  evaluateBtn.addEventListener('click', async () => {
    const metricName = metricInput.value.trim();
    if (!metricName) {
      alert('Informe o nome da métrica antes de validar.');
      return;
    }

    // auto Q3
    const metricLower = metricName.toLowerCase();
    const autoExcluded = excludedList.some(e => metricLower.includes(e));
    if (autoExcluded) {
      qState.q3 = true;
      const btnYes = document.querySelector('[data-q="q3"][data-val="true"]');
      const btnNo = document.querySelector('[data-q="q3"][data-val="false"]');
      if (btnNo) btnNo.classList.remove('active');
      if (btnYes) btnYes.classList.add('active');
    }

    const payload = {
      metricName,
      q1_isSubtotal: !!qState.q1,
      q2_usedExternally: !!qState.q2,
      q3_isExcluded: !!qState.q3,
      q4_presumptionRefutable: !!qState.q4,
      notes: notesInput.value.trim(),
      companyName: companyNameInput.value.trim(),
      cvmCode: cvmCodeInput.value.trim(),
      reportPeriod: reportPeriodInput.value.trim(),
      sector: sectorInput.value.trim(),
      auditor: auditorInput.value.trim(),
      uid: makeShortId()
    };

    try {
      const resp = await fetch('/api/evaluate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await resp.json();
      if (!data.success) {
        alert('Erro do servidor: ' + JSON.stringify(data));
        return;
      }

      const entry = data.entry;
      lastEntry = entry;

      // Mostrar resultado (texto acadêmico mais completo)
      resultCard.classList.remove('hidden');
      resultTitle.textContent = entry.evaluation.isMDPM ? 'RESULTADO: É MDPM ✔' : 'RESULTADO: NÃO É MDPM ✘';
      resultReason.textContent = entry.evaluation.reason;

      // atualizar histórico
      await loadSubmissions();

    } catch (err) {
      console.error(err);
      alert('Erro de comunicação com o servidor. Veja console.');
    }
  });

  // abrir nota em nova aba (HTML) - não imprime automaticamente
  generateBtn.addEventListener('click', async () => {
    if (!lastEntry) {
      // tenta buscar última do servidor
      try {
        const resp = await fetch('/api/submissions');
        const data = await resp.json();
        const subs = data.submissions || [];
        if (subs.length === 0) { alert('Nenhuma submissão salva ainda.'); return; }
        lastEntry = subs[subs.length - 1];
      } catch (err) {
        console.error(err);
        alert('Erro ao buscar submissões.');
        return;
      }
    }
    const html = generateNoteHtml(lastEntry);
    const w = window.open('', '_blank');
    w.document.write(html);
    w.document.close();
  });

  // abrir nota e chamar print (Exportar para PDF via Print)
  printBtn.addEventListener('click', async () => {
    if (!lastEntry) {
      try {
        const resp = await fetch('/api/submissions');
        const data = await resp.json();
        const subs = data.submissions || [];
        if (subs.length === 0) { alert('Nenhuma submissão salva ainda.'); return; }
        lastEntry = subs[subs.length - 1];
      } catch (err) {
        console.error(err);
        alert('Erro ao buscar submissões.');
        return;
      }
    }
    const html = generateNoteHtml(lastEntry);
    const w = window.open('', '_blank');
    w.document.write(html);
    w.document.close();
    // small delay to ensure content loads, then trigger print
    setTimeout(() => {
      try { w.focus(); w.print(); } catch (e) { console.warn('Print blocked.', e); }
    }, 600);
  });

  // listar submissões
  listBtn.addEventListener('click', () => {
    subsList.classList.toggle('hidden');
    if (!subsList.classList.contains('hidden')) loadSubmissions();
  });

  // initial: nothing
})();
