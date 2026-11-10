// API Base URL
const API_BASE = '../api';
let currentPage = 1;
let totalPages = 1;

// Load sidebar
document.addEventListener('DOMContentLoaded', function() {
    loadSidebar();
    loadCourses();
    loadAlumni();
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
                if (link.getAttribute('href') === 'alumni.html') link.classList.add('active');
            });
            var logoutBtn = document.getElementById('logoutBtnTopbar');
            if (logoutBtn) logoutBtn.addEventListener('click', function(e) {
                e.preventDefault();
                if (window.appLogout) { window.appLogout('../api/logout.php'); }
                else { sessionStorage.clear(); window.location.href = '../../index.php'; }
            });
        });
}

// Load courses for filter
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

// Load alumni with filters
async function loadAlumni() {
    const search = document.getElementById('searchInput').value;
    const course = document.getElementById('courseFilter').value;
    
    try {
        const response = await axios.get(`${API_BASE}/get_alumni.php`, {
            params: {
                page: currentPage,
                search: search,
                course: course
            }
        });
        
        if (response.data.success) {
            displayAlumni(response.data.data);
            updatePagination(response.data.total_pages);
        }
    } catch (error) {
        console.error('Error loading alumni:', error);
        document.getElementById('tableBody').innerHTML = `
            <tr>
                <td colspan="7" class="text-center text-danger py-4">
                    <i class="fas fa-exclamation-triangle me-2"></i>Error loading alumni
                </td>
            </tr>
        `;
    }
}

// Display alumni in table
function displayAlumni(alumni) {
    const tbody = document.getElementById('tableBody');
    
    if (alumni.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="7" class="text-center text-muted py-4">
                    <i class="fas fa-info-circle me-2"></i>No alumni found
                </td>
            </tr>
        `;
        return;
    }
    
    tbody.innerHTML = '';
    alumni.forEach((person, index) => {
        tbody.innerHTML += `
            <tr>
                <td>${(currentPage - 1) * 10 + index + 1}</td>
                <td>${escapeHtml(person.student_number || 'N/A')}</td>
                <td>${escapeHtml(person.first_name || '')} ${escapeHtml(person.last_name || '')}</td>
                <td>${escapeHtml(person.course_name || 'N/A')}</td>
                <td>${escapeHtml(person.graduation_year || 'N/A')}</td>
                <td>${escapeHtml(person.email || 'N/A')}</td>
                <td><span class="status-badge status-active">Alumni</span></td>
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
    loadAlumni();
}

// Apply filters
function applyFilters() {
    currentPage = 1;
    loadAlumni();
}

// Search on input change with debounce
let searchTimeout;
document.getElementById('searchInput').addEventListener('input', function() {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => {
        currentPage = 1;
        loadAlumni();
    }, 500);
});

document.getElementById('courseFilter').addEventListener('change', function() {
    currentPage = 1;
    loadAlumni();
});