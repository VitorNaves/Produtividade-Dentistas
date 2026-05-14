// ─── Estado Global ────────────────────────────────────────────────────────────
let currentChart = null;
let currentSort = 'default';
let currentRenderedData = []; // Fix #3: rastreia dados ativos para exportar corretamente

// ─── Inicialização ────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
    initDashboard();
});

function initDashboard() {
    // Fix #1: verificação de segurança antes de qualquer coisa
    if (typeof historicalData === 'undefined' || Object.keys(historicalData).length === 0) {
        console.error('[Fenelon] Nenhum dado encontrado em data.js');
        document.querySelector('.content').innerHTML = `
            <div style="display:flex;align-items:center;justify-content:center;height:80vh;flex-direction:column;gap:1rem;color:var(--text-muted);">
                <span style="font-size:3rem;">⚠️</span>
                <h2>Dados não encontrados</h2>
                <p>Verifique se o arquivo <strong>data.js</strong> foi gerado corretamente pelo script PowerShell.</p>
            </div>`;
        return;
    }

    updateDate();
    setupMonthSelector(); // já define currentMonthKey e dispara o primeiro render
    setupSort();
    setupSearch();
}

// ─── Data & Mês ───────────────────────────────────────────────────────────────
function updateDate() {
    const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    document.getElementById('currentDate').textContent =
        new Date().toLocaleDateString('pt-BR', options);
}

function setupMonthSelector() {
    const monthSelect = document.getElementById('monthSelect');
    if (!monthSelect) return;

    monthSelect.innerHTML = '';

    Object.keys(historicalData).forEach(key => {
        const option = document.createElement('option');
        option.value = key;
        // Suporta tanto o formato "yyyy-MM|!|Nome Mês" quanto chaves simples
        option.textContent = key.includes('|!|') ? key.split('|!|')[1] : key;
        monthSelect.appendChild(option);
    });

    // Define o mês inicial
    const firstKey = Object.keys(historicalData)[0];
    monthSelect.value = firstKey;
    currentMonthKey = firstKey;
    dentistsData = historicalData[firstKey] || [];

    renderDashboardForMonth(currentMonthKey);

    monthSelect.addEventListener('change', (e) => {
        currentMonthKey = e.target.value;
        dentistsData = historicalData[currentMonthKey] || [];

        const searchTerm = document.getElementById('dentistSearch').value.toLowerCase();
        const filtered = dentistsData.filter(d => d.name.toLowerCase().includes(searchTerm));
        renderDashboardForMonth(currentMonthKey, filtered);
    });
}

// ─── Ordenação ────────────────────────────────────────────────────────────────
function setupSort() {
    const sortSelect = document.getElementById('sortSelect');
    if (!sortSelect) return;

    sortSelect.addEventListener('change', (e) => {
        currentSort = e.target.value;
        const searchTerm = document.getElementById('dentistSearch').value.toLowerCase();
        const filtered = dentistsData.filter(d => d.name.toLowerCase().includes(searchTerm));
        renderDashboardForMonth(currentMonthKey, filtered);
    });
}

// Fix #5: lógica de sort extraída para função pura e reutilizável
function sortData(data, sortType) {
    const sorted = [...data];
    const mediaDia = d => d.diasUteis > 0 ? d.realizado / d.diasUteis : 0;

    const comparators = {
        atingido_desc:  (a, b) => b.atingido - a.atingido,
        atingido_asc:   (a, b) => a.atingido - b.atingido,
        media_desc:     (a, b) => mediaDia(b) - mediaDia(a),
        media_asc:      (a, b) => mediaDia(a) - mediaDia(b),
        realizado_desc: (a, b) => b.realizado - a.realizado,
        realizado_asc:  (a, b) => a.realizado - b.realizado,
    };

    return comparators[sortType] ? sorted.sort(comparators[sortType]) : sorted;
}

// ─── Render Principal ─────────────────────────────────────────────────────────
function renderDashboardForMonth(monthKey, specificData = null) {
    const baseData = specificData ?? dentistsData;
    const sortedData = sortData(baseData, currentSort);

    // Fix #3: salva os dados ativos para o export usar
    currentRenderedData = sortedData;

    renderSummary(baseData);
    renderChart(sortedData, monthKey);
    renderTable(sortedData);
}

// ─── Cards de Resumo ──────────────────────────────────────────────────────────
function renderSummary(data) {
    const totalRealizado = data.reduce((acc, d) => acc + d.realizado, 0);
    const totalMeta      = data.reduce((acc, d) => acc + d.metaMensal, 0);
    const globalPct      = totalMeta > 0 ? (totalRealizado / totalMeta) * 100 : 0;
    const avgPct         = data.length > 0
        ? data.reduce((acc, d) => acc + d.atingido, 0) / data.length
        : 0;

    document.getElementById('totalRealizado').textContent  = totalRealizado.toLocaleString('pt-BR');
    document.getElementById('totalMeta').textContent       = totalMeta.toLocaleString('pt-BR');
    document.getElementById('globalPercentage').textContent = `${globalPct.toFixed(1)}%`;
    document.getElementById('dentistCount').textContent    = data.length;

    const avgEl = document.getElementById('avgPercentage');
    if (avgEl) avgEl.textContent = `${avgPct.toFixed(1)}%`;

    // Fix #9: projeção do mês — card extra com estimativa baseada na média/dia
    const projEl = document.getElementById('projectedTotal');
    if (projEl) {
        const projected = data.reduce((acc, d) => {
            const media = d.diasUteis > 0 ? d.realizado / d.diasUteis : 0;
            return acc + media * d.diasUteis;
        }, 0);
        projEl.textContent = Math.round(projected).toLocaleString('pt-BR');
    }
}

// ─── Gráfico ──────────────────────────────────────────────────────────────────
function renderChart(data, monthKey) {
    const ctx = document.getElementById('performanceChart').getContext('2d');

    if (currentChart) {
        currentChart.destroy();
    }

    // Fix #9: atualiza o subtítulo do gráfico com o mês selecionado
    const monthLabel = monthKey && monthKey.includes('|!|')
        ? monthKey.split('|!|')[1]
        : (monthKey || '');
    document.querySelector('.chart-header p').textContent =
        `Realizado vs Meta Mensal${monthLabel ? ' — ' + monthLabel : ''}`;

    currentChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: data.map(d => d.name.split(' - ').pop()),
            datasets: [
                {
                    label: 'Realizado',
                    data: data.map(d => d.realizado),
                    backgroundColor: 'rgba(74, 109, 167, 0.7)',
                    borderColor: '#4a6da7',
                    borderWidth: 1,
                    borderRadius: 5,
                    order: 2
                },
                {
                    label: 'Meta Mensal',
                    data: data.map(d => d.metaMensal),
                    type: 'line',
                    borderColor: '#64748b',
                    borderWidth: 3,
                    pointBackgroundColor: '#64748b',
                    tension: 0.4,
                    fill: false,
                    order: 1
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'top',
                    labels: { color: '#64748b', font: { family: 'Outfit' } }
                },
                tooltip: {
                    backgroundColor: 'rgba(255, 255, 255, 0.95)',
                    titleColor: '#334155',
                    bodyColor: '#334155',
                    titleFont: { family: 'Outfit', size: 14 },
                    bodyFont: { family: 'Outfit' },
                    padding: 12,
                    cornerRadius: 10,
                    borderColor: 'rgba(0,0,0,0.1)',
                    borderWidth: 1,
                    displayColors: true
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    grid: { color: 'rgba(0, 0, 0, 0.05)' },
                    ticks: { color: '#64748b' }
                },
                x: {
                    grid: { display: false },
                    ticks: {
                        color: '#64748b',
                        maxRotation: 45,
                        minRotation: 45
                    }
                }
            },
            animation: {
                duration: 600,
                easing: 'easeOutQuart'
            }
        }
    });
}

// ─── Tabela ───────────────────────────────────────────────────────────────────

// Fix #6: função unificada de status — elimina ternários repetidos pelo código
function getStatusInfo(atingido) {
    if (atingido >= 100) return { cls: 'success', label: 'Meta Atingida',  color: '#22c55e' };
    if (atingido >= 70)  return { cls: 'warning', label: 'Em Progresso',   color: '#f59e0b' };
    return                     { cls: 'danger',  label: 'Abaixo da Meta', color: '#ef4444' };
}

function renderTable(data) {
    const tbody = document.querySelector('#dentistsTable tbody');
    tbody.innerHTML = '';

    data.forEach(d => {
        const status   = getStatusInfo(d.atingido);
        const mediaDia = d.diasUteis > 0
            ? (d.realizado / d.diasUteis).toFixed(2).replace('.', ',')
            : '0,00';

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td style="font-weight:600;">${d.name}</td>
            <td>${d.metaDiaria}</td>
            <td>${d.metaMensal.toLocaleString('pt-BR')}</td>
            <td>${d.realizado.toLocaleString('pt-BR')}</td>
            <td style="font-weight:bold;color:var(--primary);">${mediaDia}</td>
            <td><span class="status-badge ${status.cls}">${status.label}</span></td>
            <td>
                <div class="progress-mini">
                    <div class="progress-fill" style="width:${Math.min(d.atingido, 100)}%;background:${status.color}"></div>
                </div>
                ${d.atingido}%
            </td>
        `;
        tbody.appendChild(tr);
    });
}

// ─── Busca ────────────────────────────────────────────────────────────────────
function setupSearch() {
    const searchInput = document.getElementById('dentistSearch');
    if (!searchInput) return;

    searchInput.addEventListener('input', (e) => {
        const term = e.target.value.toLowerCase();
        const filtered = dentistsData.filter(d => d.name.toLowerCase().includes(term));
        renderDashboardForMonth(currentMonthKey, filtered);
    });
}

// ─── Exportar CSV ─────────────────────────────────────────────────────────────
// Fix #3: exporta os dados ativos (filtrados/ordenados), não o array global cru
function exportToCSV() {
    const dataToExport = currentRenderedData.length ? currentRenderedData : dentistsData;
    const monthLabel   = currentMonthKey.includes('|!|')
        ? currentMonthKey.split('|!|')[1].replace(/\s/g, '_')
        : currentMonthKey;

    let csv = 'Dentista,Meta Diaria,Meta Mensal,Realizado,Media/Dia,% Atingido\n';
    dataToExport.forEach(d => {
        const mediaDia = d.diasUteis > 0 ? (d.realizado / d.diasUteis).toFixed(2) : '0.00';
        csv += `"${d.name}",${d.metaDiaria},${d.metaMensal},${d.realizado},${mediaDia},${d.atingido}\n`;
    });

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.setAttribute('href', url);
    a.setAttribute('download', `relatorio_${monthLabel}.csv`);
    a.click();
    URL.revokeObjectURL(url); // libera memória corretamente
}
