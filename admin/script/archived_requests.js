const API_BASE = '../api';
let currentPage = 1;

document.addEventListener('DOMContentLoaded', function() {
    loadSidebar();
    loadRequests();
    setupListeners();
});

function loadSidebar() {
    fetch('sidebar.html')
        .then(res => res.text())
        .then(html => {
            var temp = document.createElement('div');
            temp.innerHTML = html;
            var container = document.getElementById('sidebar-container');
            var topbar = temp.querySelector('.topbar');
            var navbar = temp.querySelector('.admin-navbar');
            if (topbar) container.appendChild(topbar);
            if (navbar) container.appendChild(navbar);
            container.querySelectorAll('.navbar-dropdown-menu a').forEach(function(link) {
                if (link.getAttribute('href') === 'archived_requests.html') link.classList.add('active');
            });
            var logoutBtn = document.getElementById('logoutBtnTopbar');
            if (logoutBtn) logoutBtn.addEventListener('click', function(e) {
                e.preventDefault();
                if (window.appLogout) { window.appLogout('../api/logout.php'); }
                else { sessionStorage.clear(); window.location.href = '../../index.php'; }
            });
        });
}

function setupListeners() {
    let timeout;
    document.getElementById('searchInput').addEventListener('input', function() {
        clearTimeout(timeout);
        timeout = setTimeout(() => {
            currentPage = 1;
            loadRequests();
        }, 400);
    });
}

async function loadRequests() {
    const search = document.getElementById('searchInput').value;
    const tbody = document.getElementById('tableBody');
    tbody.innerHTML = '<tr><td colspan="8" class="text-center py-4"><div class="spinner-border text-primary"></div></td></tr>';

    try {
        const res = await axios.get(`${API_BASE}/get_all_requests.php`, {
            params: { status: 'all', page: currentPage, search, archived: '1' }
        });

        if (res.data.success) {
            document.getElementById('archivedCount').textContent = `Total Archived: ${res.data.total || 0}`;
            renderTable(res.data.data, res.data.current_page);
            renderPagination(res.data.total_pages, res.data.current_page);
        } else {
            tbody.innerHTML = '<tr><td colspan="8" class="text-center text-danger py-4">Failed to load requests</td></tr>';
            document.getElementById('archivedCount').textContent = 'Total Archived: 0';
        }
    } catch (err) {
        console.error(err);
        tbody.innerHTML = '<tr><td colspan="8" class="text-center text-danger py-4">Error connecting to server</td></tr>';
        document.getElementById('archivedCount').textContent = 'Total Archived: 0';
    }
}

function renderTable(requests, page) {
    const tbody = document.getElementById('tableBody');

    if (!requests || requests.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" class="text-center text-muted py-5"><i class="fas fa-inbox fa-2x mb-2 d-block"></i>No archived requests found</td></tr>';
        return;
    }

    tbody.innerHTML = '';
    requests.forEach((req, i) => {
        const num = (page - 1) * 15 + i + 1;
        const docs = formatDocs(req.documents);
        const clearance = formatClearance(req.clearance);
        const statusBadge = getStatusBadge(req.status);
        const date = req.date_requested ? new Date(req.date_requested).toLocaleDateString() : 'N/A';
        const price = parseFloat(req.total_price || 0).toFixed(2);

        const tr = document.createElement('tr');
        tr.style.cursor = 'pointer';
        tr.addEventListener('click', () => showDetail(req));
        tr.innerHTML = `
            <td>${num}</td>
            <td><strong>${escapeHtml(req.student_name || 'N/A')}</strong></td>
            <td>${escapeHtml(req.course_year || 'N/A')}</td>
            <td>${docs}</td>
            <td class="price-text">P${price}</td>
            <td>${clearance}</td>
            <td>${statusBadge}</td>
            <td>${date}</td>
        `;
        tbody.appendChild(tr);
    });
}

function formatDocs(documents) {
    if (!documents || typeof documents !== 'object') return '<span class="text-muted">None</span>';
    let pills = [];
    if (documents.tor_purpose && Array.isArray(documents.tor_purpose)) {
        documents.tor_purpose.forEach(t => pills.push(`<span class="doc-pill">${escapeHtml(t)}</span>`));
    }
    if (documents.certification && Array.isArray(documents.certification)) {
        documents.certification.forEach(c => pills.push(`<span class="doc-pill">${escapeHtml(c)}</span>`));
    }
    if (documents.diploma && Array.isArray(documents.diploma)) {
        documents.diploma.forEach(d => pills.push(`<span class="doc-pill">${escapeHtml(d)}</span>`));
    }
    if (documents.cav_overseas) {
        pills.push(`<span class="doc-pill">CAV x${documents.cav_copies || 1}</span>`);
    }
    if (documents.others) {
        pills.push(`<span class="doc-pill">${escapeHtml(documents.others)}</span>`);
    }
    return pills.length > 0 ? pills.join('') : '<span class="text-muted">None</span>';
}

function formatClearance(clearance) {
    if (!clearance || typeof clearance !== 'object') return '<span class="text-muted">N/A</span>';
    const depts = ['dean', 'library', 'finance', 'guidance'];
    return depts.map(d => {
        const status = (clearance[d] || 'Pending').toLowerCase();
        let cls = 'pending';
        if (status === 'approved') cls = 'approved';
        else if (status === 'rejected') cls = 'rejected';
        return `<span class="clearance-dot ${cls}" title="${capitalize(d)}: ${capitalize(status)}"></span>`;
    }).join('');
}

function getStatusBadge(status) {
    const s = (status || '').toLowerCase();
    if (s === 'pending' || s === 'processing') return `<span class="badge badge-pending">${status}</span>`;
    if (s === 'ready to claim' || s === 'claimed') return `<span class="badge badge-approved">${status}</span>`;
    if (s === 'rejected') return `<span class="badge badge-rejected">Rejected</span>`;
    return `<span class="badge bg-secondary">${status || 'Unknown'}</span>`;
}

function showDetail(req) {
    const docs = formatDocs(req.documents);
    const price = parseFloat(req.total_price || 0).toFixed(2);
    const date = req.date_requested ? new Date(req.date_requested).toLocaleDateString() : 'N/A';
    const released = req.date_released ? new Date(req.date_released).toLocaleDateString() : 'N/A';

    let clearanceHtml = '';
    if (req.clearance && typeof req.clearance === 'object') {
        const depts = ['dean', 'library', 'finance', 'guidance'];
        clearanceHtml = depts.map(d => {
            const st = req.clearance[d] || 'Pending';
            const cls = st.toLowerCase() === 'approved' ? 'text-success' : st.toLowerCase() === 'rejected' ? 'text-danger' : 'text-warning';
            let remark = '';
            if (req.remarks && req.remarks[d]) {
                remark = `<br><small class="text-danger"><i class="fas fa-comment-dots me-1"></i>${escapeHtml(req.remarks[d])}</small>`;
            }
            return `<div class="col-6 mb-2"><strong>${capitalize(d)}:</strong> <span class="${cls}">${st}</span>${remark}</div>`;
        }).join('');
    }

    document.getElementById('detailBody').innerHTML = `
        <div class="row mb-3">
            <div class="col-6"><strong>Student:</strong> ${escapeHtml(req.student_name || 'N/A')}</div>
            <div class="col-6"><strong>Course/Year:</strong> ${escapeHtml(req.course_year || 'N/A')}</div>
        </div>
        <div class="row mb-3">
            <div class="col-6"><strong>Date Requested:</strong> ${date}</div>
            <div class="col-6"><strong>Date Released:</strong> ${released}</div>
        </div>
        <div class="row mb-3">
            <div class="col-6"><strong>Status:</strong> ${getStatusBadge(req.status)}</div>
            <div class="col-6"><strong>Total Price:</strong> <span class="price-text">P${price}</span></div>
        </div>
        <hr>
        <h6><i class="fas fa-file-alt me-1"></i>Documents</h6>
        <div class="mb-3">${docs}</div>
        <h6><i class="fas fa-clipboard-check me-1"></i>Clearance Status</h6>
        <div class="row">${clearanceHtml || '<div class="col-12 text-muted">No clearance data</div>'}</div>
    `;
    new bootstrap.Modal(document.getElementById('detailModal')).show();
}

function renderPagination(totalPages, current) {
    const ul = document.getElementById('pagination');
    ul.innerHTML = '';
    if (totalPages <= 1) return;

    ul.innerHTML += `<li class="page-item ${current === 1 ? 'disabled' : ''}">
        <a class="page-link" href="#" onclick="changePage(${current - 1}); return false;">Prev</a></li>`;

    for (let i = 1; i <= totalPages; i++) {
        if (i === 1 || i === totalPages || (i >= current - 2 && i <= current + 2)) {
            ul.innerHTML += `<li class="page-item ${i === current ? 'active' : ''}">
                <a class="page-link" href="#" onclick="changePage(${i}); return false;">${i}</a></li>`;
        } else if (i === current - 3 || i === current + 3) {
            ul.innerHTML += `<li class="page-item disabled"><span class="page-link">...</span></li>`;
        }
    }

    ul.innerHTML += `<li class="page-item ${current === totalPages ? 'disabled' : ''}">
        <a class="page-link" href="#" onclick="changePage(${current + 1}); return false;">Next</a></li>`;
}

function changePage(page) {
    currentPage = page;
    loadRequests();
}

function escapeHtml(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

function capitalize(str) {
    return str ? str.charAt(0).toUpperCase() + str.slice(1) : '';
}
