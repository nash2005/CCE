document.addEventListener("DOMContentLoaded", () => {
  loadRequests("pending");
  setupFilterButtons();
  setupApproveModal();
  setupRejectModal();
});

let allRequests = [];
let currentRequestId = null;

function loadRequests(status) {
  const spinner = document.getElementById("loadingSpinner");
  const tbody = document.getElementById("requestsTableBody");
  spinner.classList.add("active");

  axios
    .get("../api/get_registration_requests.php?status=" + status)
    .then((res) => {
      spinner.classList.remove("active");
      if (res.data.success) {
        allRequests = res.data.requests;
        document.getElementById("countPending").textContent = res.data.counts.pending || 0;
        document.getElementById("countApproved").textContent = res.data.counts.approved || 0;
        document.getElementById("countRejected").textContent = res.data.counts.rejected || 0;
        renderTable(allRequests);
      } else {
        tbody.innerHTML =
          '<tr><td colspan="7" class="empty-state">Error loading requests</td></tr>';
      }
    })
    .catch(() => {
      spinner.classList.remove("active");
      tbody.innerHTML =
        '<tr><td colspan="7" class="empty-state">Error loading requests</td></tr>';
    });
}

function renderTable(requests) {
  const tbody = document.getElementById("requestsTableBody");

  if (!requests.length) {
    tbody.innerHTML =
      '<tr><td colspan="7" class="empty-state"><i class="fas fa-inbox fa-2x mb-2 d-block"></i>No registration requests found</td></tr>';
    return;
  }

  let html = "";
  requests.forEach((r) => {
    const statusClass =
      r.status === "pending"
        ? "status-pending"
        : r.status === "approved"
          ? "status-approved"
          : "status-rejected";

    const date = new Date(r.created_at).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });

    const yearSuffix = ["st", "nd", "rd", "th", "th"];
    const yearLabel = r.year_level + (yearSuffix[r.year_level - 1] || "th") + " Year";

    html += `<tr>
      <td class="fw-bold">${escapeHtml(r.student_number)}</td>
      <td>${escapeHtml(r.last_name)}, ${escapeHtml(r.first_name)}</td>
      <td>${escapeHtml(r.course_name)}</td>
      <td>${escapeHtml(yearLabel)}</td>
      <td><span class="status-badge ${statusClass}">${escapeHtml(r.status.charAt(0).toUpperCase() + r.status.slice(1))}</span></td>
      <td>${escapeHtml(date)}</td>
      <td>${
        r.status === "pending"
          ? `<button class="btn btn-sm btn-outline-success me-1" onclick="openApprove(${parseInt(r.id)})" title="Approve"><i class="fas fa-check"></i></button><button class="btn btn-sm btn-outline-danger" onclick="openReject(${parseInt(r.id)})" title="Reject"><i class="fas fa-times"></i></button>`
          : r.admin_remarks
            ? `<span class="text-muted" style="font-size:0.82rem;" title="${escapeHtml(r.admin_remarks)}"><i class="fas fa-comment-dots"></i> ${escapeHtml(r.admin_remarks.substring(0, 30))}${r.admin_remarks.length > 30 ? "..." : ""}</span>`
            : '<span class="text-muted" style="font-size:0.82rem;">-</span>'
      }</td>
    </tr>`;
  });
  tbody.innerHTML = html;
}

function setupFilterButtons() {
  document.querySelectorAll(".filter-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".filter-btn").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      loadRequests(btn.dataset.status);
    });
  });
}

function openApprove(id) {
  const req = allRequests.find((r) => parseInt(r.id) === id);
  if (!req) return;

  currentRequestId = id;
  document.getElementById("approveStudentNumber").textContent = req.student_number;
  document.getElementById("approveName").textContent = req.last_name + ", " + req.first_name;
  document.getElementById("approveCourse").textContent = req.course_name;

  const yearSuffix = ["st", "nd", "rd", "th", "th"];
  document.getElementById("approveYear").textContent =
    req.year_level + (yearSuffix[req.year_level - 1] || "th") + " Year";

  document.getElementById("approveEmail").value = "";
  document.getElementById("approvePassword").value = "";
  document.getElementById("approveRemarks").value = "";

  new bootstrap.Modal(document.getElementById("approveModal")).show();
}

function openReject(id) {
  const req = allRequests.find((r) => parseInt(r.id) === id);
  if (!req) return;

  currentRequestId = id;
  document.getElementById("rejectStudentNumber").textContent = req.student_number;
  document.getElementById("rejectName").textContent = req.last_name + ", " + req.first_name;
  document.getElementById("rejectRemarks").value = "";

  new bootstrap.Modal(document.getElementById("rejectModal")).show();
}

function setupApproveModal() {
  document.getElementById("generatePwBtn").addEventListener("click", () => {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$%";
    let pw = "";
    // Ensure at least one uppercase, one special char
    pw += "ABCDEFGHJKLMNPQRSTUVWXYZ"[Math.floor(Math.random() * 24)];
    pw += "!@#$%"[Math.floor(Math.random() * 5)];
    for (let i = 0; i < 6; i++) pw += chars[Math.floor(Math.random() * chars.length)];
    // Shuffle
    pw = pw
      .split("")
      .sort(() => Math.random() - 0.5)
      .join("");
    document.getElementById("approvePassword").value = pw;
  });

  document.getElementById("confirmApproveBtn").addEventListener("click", () => {
    const email = document.getElementById("approveEmail").value.trim();
    const password = document.getElementById("approvePassword").value;
    const remarks = document.getElementById("approveRemarks").value.trim();

    if (!email || !password) {
      Swal.fire("Missing Fields", "Email and password are required.", "warning");
      return;
    }

    if (password.length < 8) {
      Swal.fire("Weak Password", "Password must be at least 8 characters.", "warning");
      return;
    }

    const btn = document.getElementById("confirmApproveBtn");
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin me-1"></i>Processing...';

    axios
      .post("../api/process_registration.php", {
        id: currentRequestId,
        action: "approve",
        email: email,
        password: password,
        remarks: remarks,
      })
      .then((res) => {
        btn.disabled = false;
        btn.innerHTML = '<i class="fas fa-check me-1"></i>Approve & Create Account';

        if (res.data.success) {
          bootstrap.Modal.getInstance(document.getElementById("approveModal")).hide();
          Swal.fire("Approved", res.data.message, "success");
          loadRequests(getActiveFilter());
        } else {
          Swal.fire("Error", res.data.message, "error");
        }
      })
      .catch(() => {
        btn.disabled = false;
        btn.innerHTML = '<i class="fas fa-check me-1"></i>Approve & Create Account';
        Swal.fire("Error", "Something went wrong.", "error");
      });
  });
}

function setupRejectModal() {
  document.getElementById("confirmRejectBtn").addEventListener("click", () => {
    const remarks = document.getElementById("rejectRemarks").value.trim();

    const btn = document.getElementById("confirmRejectBtn");
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin me-1"></i>Processing...';

    axios
      .post("../api/process_registration.php", {
        id: currentRequestId,
        action: "reject",
        remarks: remarks,
      })
      .then((res) => {
        btn.disabled = false;
        btn.innerHTML = '<i class="fas fa-times me-1"></i>Reject Request';

        if (res.data.success) {
          bootstrap.Modal.getInstance(document.getElementById("rejectModal")).hide();
          Swal.fire("Rejected", res.data.message, "success");
          loadRequests(getActiveFilter());
        } else {
          Swal.fire("Error", res.data.message, "error");
        }
      })
      .catch(() => {
        btn.disabled = false;
        btn.innerHTML = '<i class="fas fa-times me-1"></i>Reject Request';
        Swal.fire("Error", "Something went wrong.", "error");
      });
  });
}

function getActiveFilter() {
  const active = document.querySelector(".filter-btn.active");
  return active ? active.dataset.status : "pending";
}

// Sidebar loader
fetch("../views/sidebar.html")
  .then((res) => res.text())
  .then((html) => {
    var temp = document.createElement("div");
    temp.innerHTML = html;
    var container = document.getElementById("sidebar-container");
    var topbar = temp.querySelector(".topbar");
    var navbar = temp.querySelector(".admin-navbar");
    if (topbar) container.appendChild(topbar);
    if (navbar) container.appendChild(navbar);
    container.querySelectorAll(".navbar-dropdown-menu a").forEach(function (link) {
      if (link.getAttribute("href") === "registration_requests.html")
        link.classList.add("active");
    });
    var logoutBtn = document.getElementById("logoutBtnTopbar");
    if (logoutBtn)
      logoutBtn.addEventListener("click", function (e) {
        e.preventDefault();
        if (window.appLogout) window.appLogout("../api/logout.php");
        else {
          sessionStorage.clear();
          window.location.href = "../../index.php";
        }
      });
  });
