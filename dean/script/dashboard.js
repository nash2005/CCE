const API = "../api";
let allRequests = [];
let currentFilter = "all";

document.addEventListener("DOMContentLoaded", () => {
  loadSidebar();
  loadDashboard();
  loadRequests();
  setupFilters();
});

function loadSidebar() {
  fetch("../views/sidebar.html")
    .then((r) => r.text())
    .then((html) => {
      document.getElementById("sidebar-container").innerHTML = html;
      document
        .getElementById("logoutBtn")
        ?.addEventListener("click", handleLogout);
    });
}

function handleLogout(e) {
  e.preventDefault();
  Swal.fire({
    title: "Are you sure?",
    text: "You want to logout?",
    icon: "warning",
    showCancelButton: true,
    confirmButtonText: "Yes, logout",
    cancelButtonText: "Cancel",
  }).then((result) => {
    if (result.isConfirmed) {
      Swal.fire({
        title: "Logging out...",
        allowOutsideClick: false,
        didOpen: () => Swal.showLoading(),
      });

      // Call logout API directly
      axios
        .post(API + "/logout.php")
        .then(() => {
          // Clear session storage
          sessionStorage.clear();
          // Redirect to login page
          window.location.href = "../../login/views/login.html";
        })
        .catch(() => {
          // Even if API fails, clear session and redirect
          sessionStorage.clear();
          window.location.href = "../../login/views/login.html";
        });
    }
  });
}

function loadDashboard() {
  axios.get(API + "/dashboard.php").then((res) => {
    if (res.data.success) {
      document.getElementById("statPending").textContent = res.data.pending;
      document.getElementById("statApproved").textContent = res.data.approved;
      document.getElementById("statRejected").textContent = res.data.rejected;
      document.getElementById("statTotal").textContent = res.data.total;
    }
  });
}

function loadRequests() {
  axios
    .get(API + "/get_requests.php")
    .then((res) => {
      if (res.data.success) {
        allRequests = res.data.requests;
        renderRequests();
      } else {
        document.getElementById("requestsContainer").innerHTML =
          '<div class="text-center text-muted py-4">No requests found.</div>';
      }
    })
    .catch(() => {
      document.getElementById("requestsContainer").innerHTML =
        '<div class="text-center text-danger py-4">Error loading requests.</div>';
    });
}

// Status priority: pending first, descending toward completed
function statusPriority(status) {
  const s = (status || "").toLowerCase();
  if (s === "pending") return 0;
  if (s === "approved") return 1;
  if (s === "rejected") return 2;
  return 3;
}

function renderRequests() {
  const container = document.getElementById("requestsContainer");
  let filtered =
    currentFilter === "all"
      ? allRequests
      : allRequests.filter((r) => r.department_status === currentFilter);

  // Sort: pendings first (descending toward approved), newest within each status
  filtered = filtered.slice().sort((a, b) => {
    const p = statusPriority(a.department_status) - statusPriority(b.department_status);
    if (p !== 0) return p;
    const ta = new Date(a.date_requested || 0).getTime();
    const tb = new Date(b.date_requested || 0).getTime();
    return tb - ta;
  });

  if (filtered.length === 0) {
    container.innerHTML =
      '<div class="text-center text-muted py-4">No requests found.</div>';
    return;
  }

  const rows = filtered
    .map((r) => {
      const status = r.department_status || "Pending";
      const statusClass = status.toLowerCase();
      const docs = r.documents_data || {};
      const requestId = parseInt(r.request_id);

      let docList = "";
      if (docs.tor_purpose?.length)
        docList +=
          '<span class="badge bg-info me-1">TOR: ' +
          escapeHtml(docs.tor_purpose.join(", ")) +
          "</span>";
      if (docs.certification?.length)
        docList +=
          '<span class="badge bg-secondary me-1">' +
          escapeHtml(docs.certification.join(", ")) +
          "</span>";
      if (docs.diploma?.length)
        docList +=
          '<span class="badge bg-dark me-1">Diploma: ' +
          escapeHtml(docs.diploma.join(", ")) +
          "</span>";

      const deptRemark = r.dept_remarks || "";
      const remarkHtml = deptRemark
        ? `<div class="mt-1" style="font-size:0.8rem;color:${status === "Pending" ? "#b85c00" : "#c62828"};"><i class="fas fa-${status === "Pending" ? "info-circle" : "exclamation-triangle"}"></i> ${escapeHtml(deptRemark)}</div>`
        : "";

      const escapedRemark = deptRemark
        ? escapeHtml(deptRemark).replace(/'/g, "\\'")
        : "";

      return `
      <tr>
        <td onclick="showRequestDetails(${requestId})" style="cursor:pointer;" title="Click to view request details">
          <div class="d-flex justify-content-between align-items-start gap-2 flex-wrap">
            <div>
              <h6 class="mb-1"><i class="fas fa-file-alt me-1" style="color:#4e73df;"></i>${escapeHtml(r.student_name)}</h6>
              <small class="text-muted">${escapeHtml(r.course_year || "N/A")}</small>
              <div class="mt-1">${docList || '<span class="text-muted">No documents listed</span>'}</div>
              <div class="mt-1"><strong style="color:#2b3a67;">₱${parseFloat(r.total_price || 0).toFixed(2)}</strong></div>
              <small class="text-muted d-block mt-1"><i class="fas fa-calendar"></i> ${escapeHtml(r.date_requested || "N/A")}</small>
              ${remarkHtml}
            </div>
            <span class="status-badge status-${escapeHtml(statusClass)}">${escapeHtml(status)}</span>
          </div>
        </td>
        <td class="text-end align-middle" style="width:1%;white-space:nowrap;">
          ${status === "Pending" || status === "Processing"
            ? `<button class="btn btn-success btn-sm me-1" onclick="approveRequest(${requestId})">
                <i class="fas fa-check"></i> Approve
              </button>
              <button class="btn btn-warning btn-sm" onclick="showPendingModal(${requestId}, '${escapeHtml(r.student_name)}', ${deptRemark ? "'" + escapedRemark + "'" : "null"})">
                <i class="fas fa-clock"></i> Pending
              </button>`
            : ""}
        </td>
      </tr>`;
    })
    .join("");

  container.innerHTML = `
    <div class="table-container">
      <table class="table align-middle mb-0">
        <thead>
          <tr>
            <th>Request</th>
             <th>Status</th>

            <th class="text-end" style="width:1%;">Action</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>`;
}

function setupFilters() {
  document.querySelectorAll(".filter-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      document
        .querySelectorAll(".filter-btn")
        .forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      currentFilter = btn.dataset.filter;
      renderRequests();
    });
  });
}

function approveRequest(requestId) {
  Swal.fire({
    title: "Approve this request?",
    icon: "question",
    showCancelButton: true,
    confirmButtonText: "Yes, Approve",
    confirmButtonColor: "#10b981",
  }).then((result) => {
    if (result.isConfirmed) {
      axios
        .post(API + "/update_request.php", {
          request_id: requestId,
          action: "Approved",
        })
        .then((res) => {
          if (res.data.success) {
            Swal.fire("Approved!", res.data.message, "success");
            loadDashboard();
            loadRequests();
          } else {
            Swal.fire("Error", res.data.message, "error");
          }
        });
    }
  });
}

// Show the full details of a request in a modal (clickable request row)
function showRequestDetails(requestId) {
  const r = allRequests.find(
    (x) => parseInt(x.request_id) === parseInt(requestId),
  );
  if (!r) return;

  const docs = r.documents_data || {};
  const clearance = r.clearance_data || {};
  const status = r.department_status || "Pending";
  const statusClass = escapeHtml(status.toLowerCase());

  let docList = "";
  if (docs.tor_purpose?.length)
    docList +=
      '<div class="mb-1"><span class="badge bg-info me-1">TOR</span> ' +
      escapeHtml(docs.tor_purpose.join(", ")) +
      "</div>";
  if (docs.certification?.length)
    docList +=
      '<div class="mb-1"><span class="badge bg-secondary me-1">Certification</span> ' +
      escapeHtml(docs.certification.join(", ")) +
      "</div>";
  if (docs.diploma?.length)
    docList +=
      '<div class="mb-1"><span class="badge bg-dark me-1">Diploma</span> ' +
      escapeHtml(docs.diploma.join(", ")) +
      "</div>";
  if (docs.cav_overseas)
    docList +=
      '<div class="mb-1"><span class="badge bg-primary me-1">CAV Overseas</span>' +
      (docs.cav_copies ? " (" + parseInt(docs.cav_copies) + " copies)" : "") +
      "</div>";

  const deptLabels = {
    dean: "Dean's Office",
    library: "Library",
    finance: "Finance Office",
    guidance: "Guidance Office",
  };
  let clearanceHtml = "";
  Object.keys(deptLabels).forEach((key) => {
    const st = clearance[key] || "Pending";
    const badge =
      st === "Approved"
        ? "bg-success"
        : st === "Rejected"
          ? "bg-danger"
          : "bg-secondary";
    clearanceHtml +=
      `<span class="badge ${badge} me-1 mb-1">` +
      `${escapeHtml(deptLabels[key])}: ${escapeHtml(st)}</span>`;
  });

  const row = (label, value) =>
    `<div class="d-flex justify-content-between border-bottom py-2">` +
    `<span class="text-muted">${label}</span><span class="text-end">${value}</span></div>`;

  document.getElementById("requestDetailBody").innerHTML =
    row(
      "Request No.",
      `<strong style="color:#4e73df;font-family:monospace;">REQ-${String(parseInt(r.request_id)).padStart(6, "0")}</strong>`,
    ) +
    row("Student", escapeHtml(r.student_name || "N/A")) +
    row("Course & Year", escapeHtml(r.course_year || "N/A")) +
    row("Date Requested", escapeHtml(r.date_requested || "N/A")) +
    row(
      "Documents",
      docList || '<span class="text-muted">No documents listed</span>',
    ) +
    row(
      "Total Price",
      `<strong style="color:#2b3a67;">₱${parseFloat(r.total_price || 0).toFixed(2)}</strong>`,
    ) +
    row(
      "Request Status",
      `<span class="status-badge status-${escapeHtml(String(r.request_status || "pending").toLowerCase())}">${escapeHtml(r.request_status || "Pending")}</span>`,
    ) +
    row(
      "My Department Status",
      `<span class="status-badge status-${statusClass}">${escapeHtml(status)}</span>`,
    ) +
    (r.dept_remarks
      ? row("My Remarks", escapeHtml(r.dept_remarks))
      : "") +
    `<div class="mt-3"><div class="fw-semibold mb-1"><i class="fas fa-tasks me-1"></i>Department Clearances</div>${clearanceHtml}</div>`;

  new bootstrap.Modal(document.getElementById("requestDetailModal")).show();
}

let pendingRequestId = null;
function showPendingModal(requestId, studentName, existingRemark) {
  pendingRequestId = requestId;
  document.getElementById("pendingStudentName").textContent = studentName;
  var textarea = document.getElementById("pendingRemarks");
  var editHint = document.getElementById("pendingEditHint");
  if (existingRemark) {
    textarea.value = existingRemark;
    if (editHint) editHint.style.display = "block";
  } else {
    textarea.value = "";
    if (editHint) editHint.style.display = "none";
  }
  new bootstrap.Modal(document.getElementById("pendingModal")).show();
}

document.addEventListener("DOMContentLoaded", () => {
  document
    .getElementById("confirmPendingBtn")
    ?.addEventListener("click", () => {
      const remarks = document.getElementById("pendingRemarks").value.trim();
      if (!remarks) {
        Swal.fire("Error", "Please provide remarks for the student", "error");
        return;
      }
      axios
        .post(API + "/update_request.php", {
          request_id: pendingRequestId,
          action: "Pending",
          reason: remarks,
        })
        .then((res) => {
          if (res.data.success) {
            bootstrap.Modal.getInstance(
              document.getElementById("pendingModal"),
            ).hide();
            Swal.fire(
              "Sent",
              "Remarks sent to student. Request remains pending.",
              "success",
            );
            loadDashboard();
            loadRequests();
          } else {
            Swal.fire("Error", res.data.message, "error");
          }
        });
    });
});

// Escape HTML helper function
function escapeHtml(text) {
  if (!text) return "";
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}
