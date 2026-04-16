let currentChart = null;

document.addEventListener('DOMContentLoaded', () => {
    initDashboard();
});

function initDashboard() {
    updateDate();
    setupMonthSelector();
    
    // Initial render
    renderDashboardForMonth(currentMonthKey);
    
    setupSearch();
}

function setupMonthSelector() {
    const monthSelect = document.getElementById('monthSelect');
    if (!monthSelect) return;
    
    // Clear existing options
    monthSelect.innerHTML = '';
    
    if (typeof historicalData !== 'undefined') {
        Object.keys(historicalData).forEach(key => {
            const [year, month] = key.split('-');
            const option = document.createElement('option');
            option.value = key;
            
            // Format to something nicer if it has the |!| separator 
            // from our PowerShell script (format: "yyyy-MM|!|MonthName YYYY")
            if (key.includes('|!|')) {
                const parts = key.split('|!|');
                option.value = key;
                option.textContent = parts[1];
            } else {
                option.textContent = key;
            }
            
            monthSelect.appendChild(option);
        });
        
        // Set correctly the current global
        if (Object.keys(historicalData).length > 0) {
           const firstKey = Object.keys(historicalData)[0];
           monthSelect.value = firstKey;
           currentMonthKey = firstKey;
           dentistsData = historicalData[firstKey] || [];
        }
        
        monthSelect.addEventListener('change', (e) => {
            currentMonthKey = e.target.value;
            dentistsData = historicalData[currentMonthKey] || [];
            
            // Also update search input filter if any
            const searchTerm = document.getElementById('dentistSearch').value.toLowerCase();
            const dataToRender = dentistsData.filter(d => d.name.toLowerCase().includes(searchTerm));
            
            renderDashboardForMonth(currentMonthKey, dataToRender);
        });
    }
}

function renderDashboardForMonth(monthKey, specificData = null) {
    const dataToUse = specificData || dentistsData;
    renderSummary(dataToUse);
    renderChart(dataToUse);
    renderTable(dataToUse);
}

function updateDate() {
    const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    document.getElementById('currentDate').textContent = new Date().toLocaleDateString('pt-BR', options);
}

function renderSummary(data = dentistsData) {
    const totalRealizado = data.reduce((acc, curr) => acc + curr.realizado, 0);
    const totalMeta = data.reduce((acc, curr) => acc + curr.metaMensal, 0);
    const globalPercentage = totalMeta > 0 ? (totalRealizado / totalMeta) * 100 : 0;
    
    document.getElementById('totalRealizado').textContent = totalRealizado.toLocaleString('pt-BR');
    document.getElementById('totalMeta').textContent = totalMeta.toLocaleString('pt-BR');
    document.getElementById('globalPercentage').textContent = `${globalPercentage.toFixed(1)}%`;
    document.getElementById('dentistCount').textContent = data.length;
}

function renderChart(data = dentistsData) {
    const ctx = document.getElementById('performanceChart').getContext('2d');
    
    if (currentChart) {
        currentChart.destroy();
    }
    
    // Sort data for chart to show top performers first
    const sortedData = [...data].sort((a, b) => b.realizado - a.realizado);
    
    currentChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: sortedData.map(d => d.name.split(' - ').pop()),
            datasets: [
                {
                    label: 'Realizado',
                    data: sortedData.map(d => d.realizado),
                    backgroundColor: 'rgba(74, 109, 167, 0.7)',
                    borderColor: '#4a6da7',
                    borderWidth: 1,
                    borderRadius: 5,
                    order: 2
                },
                {
                    label: 'Meta Mensal',
                    data: sortedData.map(d => d.metaMensal),
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
                duration: 2000,
                easing: 'easeOutQuart'
            }
        }
    });
}

function renderTable(data) {
    const tbody = document.querySelector('#dentistsTable tbody');
    tbody.innerHTML = '';
    
    data.forEach(d => {
        const tr = document.createElement('tr');
        const status = d.atingido >= 100 ? 'success' : (d.atingido >= 70 ? 'warning' : 'danger');
        const statusLabel = d.atingido >= 100 ? 'Meta Atingida' : (d.atingido >= 70 ? 'Em Progresso' : 'Abaixo da Meta');
        
        tr.innerHTML = `
            <td style="font-weight: 600;">${d.name}</td>
            <td>${d.metaDiaria}</td>
            <td>${d.metaMensal}</td>
            <td>${d.realizado}</td>
            <td><span class="status-badge ${status}">${statusLabel}</span></td>
            <td>
                <div class="progress-mini">
                    <div class="progress-fill" style="width: ${Math.min(d.atingido, 100)}%; background: ${getStatusColor(status)}"></div>
                </div>
                ${d.atingido}%
            </td>
        `;
        tbody.appendChild(tr);
    });
}

function getStatusColor(status) {
    if (status === 'success') return '#22c55e';
    if (status === 'warning') return '#f59e0b';
    return '#ef4444';
}

function setupSearch() {
    const searchInput = document.getElementById('dentistSearch');
    if (!searchInput) return;
    
    searchInput.addEventListener('input', (e) => {
        const term = e.target.value.toLowerCase();
        const filtered = dentistsData.filter(d => d.name.toLowerCase().includes(term));
        renderDashboardForMonth(currentMonthKey, filtered);
    });
}

function exportToCSV() {
    let csv = 'Dentista,Meta Diaria,Meta Mensal,Realizado,% Atingido\n';
    dentistsData.forEach(d => {
        csv += `"${d.name}",${d.metaDiaria},${d.metaMensal},${d.realizado},${d.atingido}\n`;
    });
    
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.setAttribute('hidden', '');
    a.setAttribute('href', url);
    a.setAttribute('download', 'relatorio_dentistas.csv');
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
}
