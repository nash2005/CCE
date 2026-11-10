// API Base URL
const API_BASE = '../api';
let currentPage = 1;
let totalPages = 1;

// Load sidebar
document.addEventListener('DOMContentLoaded', function() {
    loadSidebar();
    loadArchived();
});

function loadSidebar() {
    fetch('sidebar.html')
        .then(response => response.text())
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
            container.querySelectorAll('.navbar-dropdown-menu a').forEach(function(link) {
                if (link.getAttribute('href') === 'archived.html') link.classList.add('active');
            });
            var logoutBtn = document.getElementById('logoutBtnTopbar');
            if (logoutBtn) logoutBtn.addEventListener('click', function(e) {
                e.preventDefault();
                if (window.appLogout) { window.appLogout('../api/logout.php'); }
                else { sessionStorage.clear(); window.location.href = '../../index.php'; }
            });
        });
}

// Load archived students with filters
async function loadArchived() {
    const search = document.getElementById('searchInput').value;
    const dateFilter = document.getElementById('dateFilter').value;
    
    try {
        const response = await axios.get(`${API_BASE}/get_archived.php`, {
            params: {
                page: currentPage,
                search: search,
                date_filter: dateFilter
            }
        });
        
        if (response.data.success) {
            displayArchived(response.data.data);
            updatePagination(response.data.total_pages);
        }
    } catch (error) {
        console.error('Error loading archived students:', error);
        document.getElementById('tableBody').innerHTML = `
            <tr>
                <td colspan="6" class="text-center text-danger py-4">
                    <i class="fas fa-exclamation-triangle me-2"></i>Error loading archived students
                </td>
            </tr>
        `;
    }
}

// Display archived students in table
function displayArchived(students) {
    const tbody = document.getElementById('tableBody');
    
    if (students.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="6" class="text-center text-muted py-4">
                    <i class="fas fa-info-circle me-2"></i>No archived students found
                </td>
            </tr>
        `;
        return;
    }
    
    tbody.innerHTML = '';
    students.forEach((student, index) => {
        const archivedDate = new Date(student.archived_at).toLocaleDateString();
        tbody.innerHTML += `
            <tr>
                <td>${(currentPage - 1) * 10 + index + 1}</td>
                <td>${student.student_number}</td>
                <td>${student.first_name} ${student.last_name}</td>
                <td>${student.course}</td>
                <td>${student.year_level}</td>
                <td>${archivedDate}</td>
            </tr>
        `;
    });
}

// Update pagination
function updatePagination(total) {
    totalPages = total;
    const pagination = document.getElementById('pagination');
    pagination.innerHTML = '';
    
    for (let i = 1; i <= totalPages; i++) {
        pagination.innerHTML += `
            <li class="page-item ${i === currentPage ? 'active' : ''}">
                <a class="page-link" href="#" onclick="changePage(${i})">${i}</a>
            </li>
        `;
    }
}

// Change page
function changePage(page) {
    currentPage = page;
    loadArchived();
}

// Apply filters
function applyFilters() {
    currentPage = 1;
    loadArchived();
}

// Search on input change with debounce
let searchTimeout;
document.getElementById('searchInput').addEventListener('input', function() {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => {
        currentPage = 1;
        loadArchived();
    }, 500);
});

document.getElementById('dateFilter').addEventListener('change', function() {
    currentPage = 1;
    loadArchived();
});