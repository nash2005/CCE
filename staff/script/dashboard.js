const API_BASE = '../api';

// ============================================================
// Init
// ============================================================
document.addEventListener('DOMContentLoaded', function () {
  loadSidebar();
  fetchDashboardStats();
  fetchQueueData();
  setInterval(fetchQueueData, 15000); // refresh every 15s
});

// ============================================================
// Sidebar
// ============================================================
function loadSidebar() {
  fetch('sidebar.html')
    .then(function (r) { return r.text(); })
    .then(function (html) {
      var temp = document.createElement('div');
      temp.innerHTML = html;
      var container = document.getElementById('sidebar-container');
      var topbar = temp.querySelector('.topbar');
      var navbar = temp.querySelector('.staff-navbar');
      if (topbar) container.appendChild(topbar);
      if (navbar) container.appendChild(navbar);
      var content = document.querySelector('.content');
      if (content) { content.style.marginLeft = '0'; content.style.marginTop = 'calc(var(--cces-topbar-height) + 40px)'; }
      container.querySelectorAll('.navbar-link').forEach(function (link) {
        if (link.getAttribute('href') === 'dashboard.html') link.classList.add('active');
      });
      var logoutBtn = document.getElementById('logoutBtnTopbar');
      if (logoutBtn) logoutBtn.addEventListener('click', function (e) {
        e.preventDefault();
        if (window.appLogout) window.appLogout('../api/logout.php');
        else { sessionStorage.clear(); window.location.href = '../../index.php'; }
      });
    })
    .catch(function (err) { console.error('Error loading navigation:', err); });
}

// ============================================================
// Dashboard stats
// ============================================================
async function fetchDashboardStats() {
  try {
    var res = await axios.get(API_BASE + '/get_dashboard_stats.php');
    if (res.data.success) {
      document.getElementById('totalStudents').textContent = res.data.total || 0;
      document.getElementById('activeStudents').textContent = res.data.active || 0;
      document.getElementById('archivedStudents').textContent = res.data.archived || 0;
    }
  } catch (e) { console.error('Stats error:', e); }
}

// ============================================================
// Queue display
// ============================================================
async function fetchQueueData() {
  try {
    var res = await axios.get(API_BASE + '/get_queue.php');
    if (!res.data.success) return;

    var d = res.data;
    document.getElementById('currentServing').textContent = d.current_number;
    document.getElementById('servedToday').textContent = d.served_today || '0';
    document.getElementById('completedToday').textContent = d.served_today || '0';
    document.getElementById('nowServingNumber').textContent = d.current_number;
  } catch (e) { console.error('Queue fetch error:', e); }
}

// ============================================================
// Queue actions
// ============================================================

// Next number
function nextQueue() {
  axios.post(API_BASE + '/update_queue.php', { action: 'next' })
    .then(function (res) {
      if (res.data.success) {
        fetchQueueData();
      } else { Swal.fire('Error', res.data.message, 'error'); }
    }).catch(function () { Swal.fire('Error', 'Failed to update queue', 'error'); });
}

// Restart queue (back to #1)
function restartQueue() {
  Swal.fire({
    title: 'Restart Queue?',
    text: 'This will reset the numbering back to 1. This cannot be undone.',
    icon: 'warning',
    showCancelButton: true,
    confirmButtonColor: '#dc3545',
    confirmButtonText: 'Yes, restart',
  }).then(function (result) {
    if (!result.isConfirmed) return;
    axios.post(API_BASE + '/update_queue.php', { action: 'restart' })
      .then(function (res) {
        if (res.data.success) {
          Swal.fire({ title: 'Queue Restarted', text: 'Now serving #1.', icon: 'success', timer: 2000, showConfirmButton: false });
          fetchQueueData();
        } else { Swal.fire('Error', res.data.message, 'error'); }
      }).catch(function () { Swal.fire('Error', 'Failed to restart', 'error'); });
  });
}

