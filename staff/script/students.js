// API Base URL
const API_BASE = '../api';
let currentPage = 1;
let totalPages = 1;
let allStudents = [];

// Load sidebar and initialize
document.addEventListener('DOMContentLoaded', function() {
    loadSidebar();
    loadCourses();
    loadStudents();
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
                if (link.getAttribute('href') === 'students.html') link.classList.add('active');
            });
            var logoutBtn = document.getElementById('logoutBtnTopbar');
            if (logoutBtn) logoutBtn.addEventListener('click', function(e) {
                e.preventDefault();
                if (window.appLogout) { window.appLogout('../api/logout.php'); }
                else { sessionStorage.clear(); window.location.href = '../../index.php'; }
            });
        })
        .catch(error => console.error('Error loading navigation:', error));
}

// Load courses for filter dropdown
async function loadCourses() {
    try {
        const response = await axios.get(`${API_BASE}/get_courses.php`);
        if (response.data.success) {
            const courses = response.data.data;
            const courseFilter = document.getElementById('courseFilter');
            
            courses.forEach(course => {
                courseFilter.innerHTML += `<option value="${escapeHtml(course.course_id)}">${escapeHtml(course.course_name)}</option>`;
            });
        }
    } catch (error) {
        console.error('Error loading courses:', error);
    }
}

// Load students with filters and pagination
async function loadStudents() {
    const search = document.getElementById('searchInput').value;
    const course = document.getElementById('courseFilter').value;
    const year = document.getElementById('yearFilter').value;
    
    // Show loading state
    document.getElementById('tableBody').innerHTML = `
        <tr>
            <td colspan="7" class="text-center py-4">
                <div class="spinner-border text-primary" role="status">
                    <span class="visually-hidden">Loading...</span>
                </div>
                <p class="mt-2 text-muted">Fetching students...</p>
            </td>
        </tr>
    `;
    
    try {
        const response = await axios.get(`${API_BASE}/get_students.php`, {
            params: {
                page: currentPage,
                search: search,
                course: course,
                year: year
            }
        });
        
        if (response.data.success) {
            allStudents = response.data.data;
            displayStudents(allStudents);
            updatePagination(response.data.total_pages);
        } else {
            showError('Failed to load students');
        }
    } catch (error) {
        console.error('Error loading students:', error);
        showError('Error connecting to server. Please try again.');
    }
}

// Display students in table
function displayStudents(students) {
    const tbody = document.getElementById('tableBody');
    
    if (!students || students.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="7" class="text-center text-muted py-5">
                    <i class="fas fa-user-slash fa-3x mb-3 d-block"></i>
                    No students found
                </td>
            </tr>
        `;
        return;
    }
    
    tbody.innerHTML = '';
    students.forEach((student, index) => {
        const statusClass = student.status === 'active' ? 'status-active' : 'status-inactive';
        const fullName = `${student.first_name || ''} ${student.last_name || ''}`.trim() || 'N/A';

        tbody.innerHTML += `
            <tr>
                <td>${(currentPage - 1) * 10 + index + 1}</td>
                <td><strong>${escapeHtml(student.student_number || 'N/A')}</strong></td>
                <td>${escapeHtml(fullName)}</td>
                <td>${escapeHtml(student.course_name || 'N/A')}</td>
                <td>${student.year_level ? `${escapeHtml(student.year_level)}${getOrdinalSuffix(student.year_level)} Year` : 'N/A'}</td>
                <td>${escapeHtml(student.email || 'N/A')}</td>
                <td><span class="status-badge ${statusClass}">${escapeHtml(student.status || 'N/A')}</span></td>
            </tr>
        `;
    });
}

// Helper function for ordinal suffixes
function getOrdinalSuffix(num) {
    if (!num) return '';
    const j = num % 10;
    const k = num % 100;
    if (j === 1 && k !== 11) return 'st';
    if (j === 2 && k !== 12) return 'nd';
    if (j === 3 && k !== 13) return 'rd';
    return 'th';
}

// Update pagination
function updatePagination(total) {
    totalPages = total;
    const pagination = document.getElementById('pagination');
    
    pagination.innerHTML = '';
    
    if (totalPages <= 1) {
        return;
    }
    
    // Previous button
    pagination.innerHTML += `
        <li class="page-item ${currentPage === 1 ? 'disabled' : ''}">
            <a class="page-link" href="#" onclick="changePage(${currentPage - 1}); return false;">Previous</a>
        </li>
    `;
    
    // Page numbers
    for (let i = 1; i <= totalPages; i++) {
        if (i === 1 || i === totalPages || (i >= currentPage - 2 && i <= currentPage + 2)) {
            pagination.innerHTML += `
                <li class="page-item ${i === currentPage ? 'active' : ''}">
                    <a class="page-link" href="#" onclick="changePage(${i}); return false;">${i}</a>
                </li>
            `;
        } else if (i === currentPage - 3 || i === currentPage + 3) {
            pagination.innerHTML += `
                <li class="page-item disabled">
                    <span class="page-link">...</span>
                </li>
            `;
        }
    }
    
    // Next button
    pagination.innerHTML += `
        <li class="page-item ${currentPage === totalPages ? 'disabled' : ''}">
            <a class="page-link" href="#" onclick="changePage(${currentPage + 1}); return false;">Next</a>
        </li>
    `;
}

// Change page
function changePage(page) {
    if (page < 1 || page > totalPages) return;
    currentPage = page;
    loadStudents();
    // Scroll to top of table
    document.querySelector('.table-container').scrollIntoView({ behavior: 'smooth' });
}

// Apply filters
function applyFilters() {
    currentPage = 1;
    loadStudents();
}

// Reset filters
function resetFilters() {
    document.getElementById('searchInput').value = '';
    document.getElementById('courseFilter').value = '';
    document.getElementById('yearFilter').value = '';
    currentPage = 1;
    loadStudents();
}

// Show error message
function showError(message) {
    document.getElementById('tableBody').innerHTML = `
        <tr>
            <td colspan="7" class="text-center text-danger py-5">
                <i class="fas fa-exclamation-circle fa-3x mb-3 d-block"></i>
                ${message}
            </td>
        </tr>
    `;
}

// Search with debounce
let searchTimeout;
document.getElementById('searchInput').addEventListener('input', function() {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => {
        currentPage = 1;
        loadStudents();
    }, 500);
});

// Filter on select change
document.getElementById('courseFilter').addEventListener('change', function() {
    currentPage = 1;
    loadStudents();
});

document.getElementById('yearFilter').addEventListener('change', function() {
    currentPage = 1;
    loadStudents();
});

// Add reset button to search section
document.addEventListener('DOMContentLoaded', function() {
    const searchSection = document.querySelector('.search-section .row');
    const resetButton = document.createElement('div');
    resetButton.className = 'col-md-12 text-end mt-2';
    resetButton.innerHTML = `
        <button class="btn btn-outline-secondary btn-sm" onclick="resetFilters()">
            <i class="fas fa-undo me-1"></i>Reset Filters
        </button>
    `;
    searchSection.appendChild(resetButton);
});

// Export to CSV function (optional)
function exportToCSV() {
    if (!allStudents.length) {
        Swal.fire('No Data', 'No students to export', 'info');
        return;
    }
    
    let csv = 'Student Number,Full Name,Course,Year Level,Email,Status\n';
    
    allStudents.forEach(student => {
        const fullName = `${student.first_name || ''} ${student.last_name || ''}`.trim();
        const yearLevel = student.year_level ? `${student.year_level}${getOrdinalSuffix(student.year_level)} Year` : 'N/A';
        
        csv += `"${student.student_number || 'N/A'}","${fullName}","${student.course_name || 'N/A'}","${yearLevel}","${student.email || 'N/A'}","${student.status || 'N/A'}"\n`;
    });
    
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'students_list.csv';
    a.click();
    window.URL.revokeObjectURL(url);
}

// Add export button
document.addEventListener('DOMContentLoaded', function() {
    const tableContainer = document.querySelector('.table-container h5');
    const exportBtn = document.createElement('button');
    exportBtn.className = 'btn btn-success btn-sm float-end';
    exportBtn.innerHTML = '<i class="fas fa-download me-1"></i>Export CSV';
    exportBtn.onclick = exportToCSV;
    tableContainer.appendChild(exportBtn);
});