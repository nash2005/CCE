const API_BASE = '../api';
let statusChart = null;
let lastReportData = null;

document.addEventListener('DOMContentLoaded', function () {
    loadSidebar();
    loadReports();
});

function loadSidebar() {
    fetch('sidebar.html')
        .then(r => r.text())
        .then(html => {
            var temp = document.createElement('div');
            temp.innerHTML = html;
            var container = document.getElementById('sidebar-container');
            var topbar = temp.querySelector('.topbar');
            var navbar = temp.querySelector('.staff-navbar');
            if (topbar) container.appendChild(topbar);
            if (navbar) container.appendChild(navbar);
            var content = document.querySelector('.content');
            if (content) { content.style.marginLeft = '0'; content.style.marginTop = 'calc(var(--cces-topbar-height) + 40px)'; }
            container.querySelectorAll('.navbar-link').forEach(function(link) {
                if (link.getAttribute('href') === 'reports.html') link.classList.add('active');
            });
            var logoutBtn = document.getElementById('logoutBtnTopbar');
            if (logoutBtn) logoutBtn.addEventListener('click', function(e) {
                e.preventDefault();
                if (window.appLogout) { window.appLogout('../api/logout.php'); }
                else { sessionStorage.clear(); window.location.href = '../../index.php'; }
            });
        });
}

async function loadReports() {
    const month = document.getElementById('filterMonth').value;
    const year = document.getElementById('filterYear').value;
    const dateFrom = document.getElementById('filterDateFrom').value;
    const dateTo = document.getElementById('filterDateTo').value;

    try {
        const res = await axios.get(`${API_BASE}/get_reports.php`, {
            params: { month, year, date_from: dateFrom, date_to: dateTo }
        });

        if (!res.data.success) {
            console.error('Reports error:', res.data.message);
            return;
        }

        const data = res.data;
        lastReportData = data;

        populateYears(data.available_years);

        // Update stat cards
        document.getElementById('statTotal').textContent = data.summary.total;
        document.getElementById('statPending').textContent = data.summary.pending;
        document.getElementById('statReady').textContent = data.summary.ready;
        document.getElementById('statClaimed').textContent = data.summary.claimed;
        document.getElementById('statRejected').textContent = data.summary.rejected;

        // Render chart
        renderStatusChart(data.summary, data.monthly_trend, data.trend_year);

    } catch (err) {
        console.error('Error loading reports:', err);
    }
}

function populateYears(years) {
    const sel = document.getElementById('filterYear');
    const current = sel.value;
    if (sel.options.length <= 1) {
        years.forEach(y => {
            sel.innerHTML += `<option value="${y}">${y}</option>`;
        });
        const thisYear = new Date().getFullYear();
        if (!years.includes(thisYear.toString()) && !years.includes(thisYear)) {
            sel.innerHTML += `<option value="${thisYear}">${thisYear}</option>`;
        }
    }
    if (current) sel.value = current;
}

function renderStatusChart(summary, monthlyTrend, trendYear) {
    const ctx = document.getElementById('statusChart').getContext('2d');
    document.getElementById('chartYearLabel').textContent = `(${trendYear})`;

    if (statusChart) statusChart.destroy();

    const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

    statusChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: MONTH_NAMES,
            datasets: [
                {
                    label: 'Pending',
                    data: monthlyTrend.map(m => m.pending),
                    backgroundColor: '#f59e0b',
                    borderRadius: 4
                },
                {
                    label: 'Ready to Claim',
                    data: monthlyTrend.map(m => m.ready),
                    backgroundColor: '#10b981',
                    borderRadius: 4
                },
                {
                    label: 'Claimed',
                    data: monthlyTrend.map(m => m.claimed),
                    backgroundColor: '#8b5cf6',
                    borderRadius: 4
                },
                {
                    label: 'Rejected',
                    data: monthlyTrend.map(m => m.rejected),
                    backgroundColor: '#ef4444',
                    borderRadius: 4
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'top',
                    labels: { usePointStyle: true, padding: 15, font: { size: 12 } }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: { stepSize: 1 },
                    grid: { color: 'rgba(0,0,0,0.05)' }
                },
                x: {
                    grid: { display: false }
                }
            }
        }
    });
}

function applyFilters() {
    loadReports();
}

function resetFilters() {
    document.getElementById('filterMonth').value = '0';
    document.getElementById('filterYear').value = '0';
    document.getElementById('filterDateFrom').value = '';
    document.getElementById('filterDateTo').value = '';
    loadReports();
}

function generatePDF() {
    if (!lastReportData) {
        Swal.fire('Error', 'No report data loaded yet.', 'error');
        return;
    }

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    const data = lastReportData;
    const now = new Date();
    const dateStr = now.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

    // Header
    doc.setFontSize(18);
    doc.setFont(undefined, 'bold');
    doc.text('CCES Online Requisition', 105, 20, { align: 'center' });
    doc.setFontSize(14);
    doc.setFont(undefined, 'normal');
    doc.text('Staff Reports', 105, 28, { align: 'center' });
    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text('Generated: ' + dateStr, 105, 35, { align: 'center' });
    doc.setTextColor(0);

    // Filter date — bold and centered
    const month = document.getElementById('filterMonth');
    const year = document.getElementById('filterYear');
    const dateFrom = document.getElementById('filterDateFrom').value;
    const dateTo = document.getElementById('filterDateTo').value;
    let filterText = '';
    if (dateFrom && dateTo) {
        filterText = dateFrom + '  to  ' + dateTo;
    } else if (dateFrom) {
        filterText = 'From: ' + dateFrom;
    } else if (dateTo) {
        filterText = 'Up to: ' + dateTo;
    } else if (month.value !== '0' && year.value !== '0') {
        filterText = month.options[month.selectedIndex].text + ' ' + year.value;
    } else if (month.value !== '0') {
        filterText = month.options[month.selectedIndex].text;
    } else if (year.value !== '0') {
        filterText = 'Year ' + year.value;
    } else {
        filterText = 'All Records';
    }
    doc.setFontSize(12);
    doc.setFont(undefined, 'bold');
    doc.text(filterText, 105, 44, { align: 'center' });

    // Summary table only
    doc.setFontSize(12);
    doc.setFont(undefined, 'bold');
    doc.text('Summary', 14, 56);

    doc.autoTable({
        startY: 60,
        head: [['Metric', 'Count']],
        body: [
            ['Total Requests', data.summary.total],
            ['Pending', data.summary.pending],
            ['Ready to Claim', data.summary.ready],
            ['Claimed', data.summary.claimed],
            ['Rejected', data.summary.rejected]
        ],
        theme: 'grid',
        headStyles: { fillColor: [102, 126, 234] },
        styles: { fontSize: 10 }
    });

    doc.save('Staff_Report_' + now.toISOString().slice(0, 10) + '.pdf');
}
