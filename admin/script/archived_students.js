document.addEventListener("DOMContentLoaded", () => {
  loadArchivedStudents();
});

// Load archived students from API
function loadArchivedStudents() {
  const spinner = document.getElementById("loadingSpinner");
  const tbody = document.getElementById("archivedTableBody");
  const archivedCount = document.getElementById("archivedCount");
  spinner.classList.add("active");

  axios
    .get("../api/get_archived_students.php")
    .then((res) => {
      spinner.classList.remove("active");
      if (res.data.success && res.data.archived.length > 0) {
        displayArchivedStudents(res.data.archived);
        archivedCount.textContent = `Total Archived: ${res.data.archived.length}`;
      } else {
        tbody.innerHTML = `<tr><td colspan="6" class="empty-state">No archived students found</td></tr>`;
        archivedCount.textContent = "Total Archived: 0";
      }
    })
    .catch((err) => {
      spinner.classList.remove("active");
      console.error(err);
      tbody.innerHTML = `<tr><td colspan="6" class="empty-state">Error loading archived students</td></tr>`;
      archivedCount.textContent = "Total Archived: 0";
    });
}

// Display archived students
function displayArchivedStudents(archived) {
  const tbody = document.getElementById("archivedTableBody");
  let html = '';

  archived.forEach((student) => {
    html += `
      <tr>
        <td>${escapeHtml(student.student_number || 'N/A')}</td>
        <td>${escapeHtml(student.first_name || 'N/A')}</td>
        <td>${escapeHtml(student.last_name || 'N/A')}</td>
        <td>${escapeHtml(student.course || 'N/A')}</td>
        <td>${escapeHtml(student.year_level || 'N/A')}</td>
        <td>${escapeHtml(new Date(student.archived_at).toLocaleString())}</td>
      </tr>
    `;
  });

  tbody.innerHTML = html;
}

// Sidebar
fetch("sidebar.html")
  .then((res) => res.text())
  .then((html) => {
    var temp = document.createElement("div");
    temp.innerHTML = html;
    var container = document.getElementById("sidebar-container");
    var topbar = temp.querySelector(".topbar");
    var navbar = temp.querySelector(".admin-navbar");
    if (topbar) container.appendChild(topbar);
    if (navbar) container.appendChild(navbar);
    container.querySelectorAll(".navbar-dropdown-menu a").forEach(function(link) {
      if (link.getAttribute("href") === "archived_students.html") link.classList.add("active");
    });
    var logoutBtn = document.getElementById("logoutBtnTopbar");
    if (logoutBtn) logoutBtn.addEventListener("click", function(e) {
      e.preventDefault();
      if (window.appLogout) { window.appLogout("../api/logout.php"); }
      else { sessionStorage.clear(); window.location.href = "../../index.php"; }
    });
  });

