const API_BASE = "../api";

let allRequests = [];
let currentFilter = "all";
let detailModal = null;
let finalizeModal = null;
let pendingFinalizeId = null;
let pendingFinalizeAction = null;
let reviewModal = null;
let pendingReviewId = null;
// Step 2 review working state: one row per requested document so the staff can
// set TOR pages one by one and deselect documents before sending to departments
let reviewDocRows = [];
let activeTorRowIndex = null;
let torPagesModal = null;
let scheduleModal = null;
let pendingScheduleId = null;

document.addEventListener("DOMContentLoaded", function () {
  loadSidebar();
  fetchRequests();

  // Filter buttons
  document.querySelectorAll(".filter-btn").forEach((btn) => {
    btn.addEventListener("click", function () {
      document
        .querySelectorAll(".filter-btn")
        .forEach((b) => b.classList.remove("active"));
      this.classList.add("active");
      currentFilter = this.dataset.filter;
      renderRequests();
    });
  });

  // Search
  document.getElementById("searchInput").addEventListener("input", function () {
    renderRequests();
  });

  detailModal = new bootstrap.Modal(document.getElementById("detailModal"));
  finalizeModal = new bootstrap.Modal(document.getElementById("finalizeModal"));
  reviewModal = new bootstrap.Modal(document.getElementById("reviewModal"));
  torPagesModal = new bootstrap.Modal(document.getElementById("torPagesModal"));
  scheduleModal = new bootstrap.Modal(document.getElementById("scheduleModal"));

  document
    .getElementById("confirmFinalizeBtn")
    .addEventListener("click", confirmFinalize);
  document
    .getElementById("confirmReviewBtn")
    .addEventListener("click", confirmReview);
  document
    .getElementById("saveTorPagesBtn")
    .addEventListener("click", saveTorPages);
  document
    .getElementById("confirmScheduleBtn")
    .addEventListener("click", confirmClaimSchedule);

  setInterval(fetchRequests, 30000);
});

function loadSidebar() {
  fetch("sidebar.html")
    .then((r) => r.text())
    .then((html) => {
      var temp = document.createElement("div");
      temp.innerHTML = html;
      var container = document.getElementById("sidebar-container");
      var topbar = temp.querySelector(".topbar");
      var navbar = temp.querySelector(".staff-navbar");
      if (topbar) container.appendChild(topbar);
      if (navbar) container.appendChild(navbar);
      var content = document.querySelector(".content");
      if (content) {
        content.style.marginLeft = "0";
        content.style.marginTop = "calc(var(--cces-topbar-height) + 40px)";
      }
      container.querySelectorAll(".navbar-link").forEach(function (link) {
        if (link.getAttribute("href") === "requests.html")
          link.classList.add("active");
      });
      var logoutBtn = document.getElementById("logoutBtnTopbar");
      if (logoutBtn)
        logoutBtn.addEventListener("click", function (e) {
          e.preventDefault();
          if (window.appLogout) {
            window.appLogout("../api/logout.php");
          } else {
            sessionStorage.clear();
            window.location.href = "../../index.php";
          }
        });
    })
    .catch((err) => console.error("Error loading navigation:", err));
}

async function fetchRequests() {
  try {
    const response = await axios.get(`${API_BASE}/get_all_requests.php`);
    if (response.data.success) {
      allRequests = response.data.requests;
      updateStats();
      renderRequests();
    } else {
      showEmpty("Failed to load requests");
    }
  } catch (error) {
    console.error("Error fetching requests:", error);
    showEmpty("Error connecting to server");
  }
}

// The status stored in the database. The API returns the *effective* status in
// `status` (a scheduled request shows as "Pending" until its window opens),
// while `raw_status` keeps the value stored in tbl_requests.
function getRawStatus(req) {
  return ((req && (req.raw_status || req.status)) || "").toLowerCase();
}

// True when a claiming schedule has already been recorded for the request
function hasClaimSchedule(req) {
  return (
    getRawStatus(req) === "scheduled for claiming" ||
    !!(req && req.claim_schedule_start)
  );
}

// Where we are relative to the claiming window: "", "before", "open" or "ended"
function getClaimWindowState(req) {
  if (!req) return "";
  if (typeof req.claim_window_state === "string" && req.claim_window_state !== "") {
    return req.claim_window_state;
  }
  // Fallback for payloads without the server-computed state
  const start = toDateInputValue(req.claim_schedule_start);
  if (!start) return "";
  const now = new Date();
  const today =
    now.getFullYear() +
    "-" +
    String(now.getMonth() + 1).padStart(2, "0") +
    "-" +
    String(now.getDate()).padStart(2, "0");
  if (today < start) return "before";
  const end = toDateInputValue(req.claim_schedule_end);
  if (end && today > end) return "ended";
  return "open";
}

function getRequestCategory(req) {
  const status = (req.status || "").toLowerCase();
  const raw = getRawStatus(req);
  if (status === "claimed" || raw === "claimed") return "claimed";
  if (status === "rejected" || raw === "rejected") return "rejected";
  // A request with a claiming schedule stays "pending" until the first day of
  // the claiming window and is "ready" from that day onwards
  if (raw === "scheduled for claiming") {
    return status === "ready to claim" ? "ready" : "pending";
  }
  // Anything else — including a finalized request without a claiming schedule
  // (step 7: waiting for the reference number) — is still "pending":
  // "Ready to Claim" only shows once the claiming window has started
  return "pending";
}

// Step 2 = Pending status with no department clearance records yet
function isStep2(req) {
  const status = (req.status || "").toLowerCase();
  if (status !== "pending") return false;
  const cl = req.clearance || {};
  return Object.keys(cl).length === 0;
}

// Requests that are ready to claim, have been paid, but have not had a
// claiming schedule set yet — i.e. the ones where the "Set Claiming
// Schedule" button appears in the detail footer.
function needsSchedule(req) {
  if (!req) return false;
  const raw = getRawStatus(req);
  if (raw !== "ready to claim") return false;
  if (!req.is_paid) return false;
  return !hasClaimSchedule(req);
}

// Submission loading toast (lower-right corner) used by every submission-type
// action. Delegates to the shared showSubmitLoader() helper so the spinner and
// progress bar live in a compact toast instead of a full-screen dialog.
function showProcessing(message) {
  if (typeof showSubmitLoader === "function") {
    showSubmitLoader(message);
  } else {
    // Fallback for environments where the helper has not been loaded yet.
    Swal.fire({
      toast: true,
      position: "bottom-end",
      title: "Please wait",
      html: message,
      showConfirmButton: false,
      showCancelButton: false,
      allowOutsideClick: false,
      allowEscapeKey: false,
      didOpen: () => Swal.showLoading(),
    });
  }
}

function updateStats() {
  let pending = 0,
    ready = 0,
    claimed = 0;
  allRequests.forEach((req) => {
    const cat = getRequestCategory(req);
    if (cat === "pending") pending++;
    else if (cat === "ready") ready++;
    else if (cat === "claimed") claimed++;
  });

  document.getElementById("statTotal").textContent = allRequests.length;
  document.getElementById("statPending").textContent = pending;
  document.getElementById("statReady").textContent = ready;
  document.getElementById("statClaimed").textContent = claimed;
}

// Status priority: pending/processing first, descending toward completed
function statusPriority(status) {
  const s = (status || "").toLowerCase();
  if (s === "pending" || s === "processing") return 0;
  if (s === "ready to claim") return 1;
  if (s === "claimed" || s === "released") return 2;
  if (s === "completed") return 3;
  if (s === "rejected") return 4;
  return 5;
}

function renderRequests() {
  const tbody = document.getElementById("tableBody");
  const searchTerm = document
    .getElementById("searchInput")
    .value.toLowerCase()
    .trim();

  let filtered = allRequests;

  // Apply filter
  if (currentFilter === "step2") {
    filtered = filtered.filter((req) => isStep2(req));
  } else if (currentFilter === "needs-schedule") {
    filtered = filtered.filter((req) => needsSchedule(req));
  } else if (currentFilter !== "all") {
    filtered = filtered.filter(
      (req) => getRequestCategory(req) === currentFilter,
    );
  }

  // Apply search
  if (searchTerm) {
    filtered = filtered.filter(
      (req) =>
        (req.student_name || "").toLowerCase().includes(searchTerm) ||
        (req.course_year || "").toLowerCase().includes(searchTerm),
    );
  }

  // Sort: pendings first (descending to completed), newest within each status
  filtered = filtered.slice().sort((a, b) => {
    const p = statusPriority(a.status) - statusPriority(b.status);
    if (p !== 0) return p;
    const ta = new Date(a.date_requested || 0).getTime();
    const tb = new Date(b.date_requested || 0).getTime();
    return tb - ta;
  });

  if (filtered.length === 0) {
    tbody.innerHTML = `
            <tr><td colspan="8">
                <div class="empty-state">
                    <i class="fas fa-inbox d-block"></i>
                    <p>No requests found</p>
                </div>
            </td></tr>`;
    return;
  }

  let html = "";
  filtered.forEach((req, i) => {
    html += buildTableRow(req, i + 1);
  });
  tbody.innerHTML = html;
}

function buildTableRow(req, index) {
  const cl = req.clearance || {};
  const docs = req.documents || {};
  const status = req.status || "Pending";
  const cat = getRequestCategory(req);
  const depts = ["library", "guidance", "finance", "dean"];
  const isPaid = req.is_paid || false;

  // Document summary
  let docParts = [];
  if (docs.tor_purpose?.length)
    docParts.push(`TOR (${docs.tor_purpose.length})`);
  if (docs.certification?.length)
    docParts.push(`Cert (${docs.certification.length})`);
  if (docs.diploma?.length) docParts.push(`Diploma (${docs.diploma.length})`);
  if (docs.cav_overseas) docParts.push(`CAV (${docs.cav_copies || 1})`);
  if (docs.others) docParts.push("Other");
  const docSummary = docParts.length
    ? docParts.map((d) => `<span class="doc-pill">${d}</span>`).join(" ")
    : '<span class="text-muted">N/A</span>';

  // Clearance dots
  let dotsHtml = '<div class="clearance-dots">';
  depts.forEach((d) => {
    const val = cl[d] || "Pending";
    let cls = "pending";
    if (val === "Approved") cls = "approved";
    else if (val === "Rejected") cls = "rejected";
    dotsHtml += `<span class="clearance-dot ${cls}" title="${capitalize(d)}: ${val}"></span>`;
  });
  dotsHtml += "</div>";

  // Date
  const dateStr = req.date_requested
    ? new Date(req.date_requested).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      })
    : "N/A";

  // Status badge
  let badgeClass = "badge-pending";
  if (cat === "ready") badgeClass = "badge-ready";
  else if (cat === "claimed") badgeClass = "badge-claimed";
  else if (cat === "rejected") badgeClass = "badge-rejected";

  const statusLower = (status || "").toLowerCase();
  const rawStatusLower = getRawStatus(req);
  let statusIcon = "fa-clock";
  if (rawStatusLower === "scheduled for claiming") statusIcon = "fa-calendar-check";
  else if (cat === "ready") statusIcon = "fa-check-circle";
  else if (cat === "claimed") statusIcon = "fa-box-open";
  else if (cat === "rejected") statusIcon = "fa-times-circle";

  let statusHtml = `<span class="badge-status ${badgeClass}"><i class="fas ${statusIcon} me-1"></i>${escapeHtml(status)}</span>`;
  if (
    isPaid &&
    (cat === "ready" ||
      rawStatusLower === "scheduled for claiming" ||
      rawStatusLower === "ready to claim")
  ) {
    statusHtml += ` <span class="badge-status badge-ready"><i class="fas fa-check-circle me-1"></i>PAID</span>`;
  }

  // Claim Schedule column — separate from the status
  const scheduleSpan = formatScheduleSpan(req, true);
  const scheduleCell = scheduleSpan
    ? `<span style="color:#b85c00; font-weight:600;"><i class="fas fa-calendar-check me-1"></i>${escapeHtml(scheduleSpan)}</span>`
    : '<span style="color:#94a3b8;"><i class="fas fa-hourglass-half me-1"></i>Not set</span>';

  const tracking = req.tracking_number || "#" + req.request_id;

  const clickHandler = isStep2(req)
    ? `openReviewModal(${req.request_id})`
    : `showDetail(${req.request_id})`;

  return `
        <tr onclick="${clickHandler}">
            <td><small style="color:#667eea;font-weight:600;">${escapeHtml(tracking)}</small></td>
            <td><strong>${escapeHtml(req.student_name)}</strong></td>
            <td>${escapeHtml(req.course_year || "N/A")}</td>
            <td>${docSummary}</td>
            <td>${dotsHtml}</td>
            <td>${dateStr}</td>
            <td>${statusHtml}</td>
            <td>${scheduleCell}</td>
        </tr>`;
}

function showDetail(requestId) {
  const req = allRequests.find((r) => r.request_id == requestId);
  if (!req) return;

  const cl = req.clearance || {};
  const docs = req.documents || {};
  const remarks = req.remarks || {};
  const depts = ["library", "guidance", "finance", "dean"];
  const status = req.status || "Pending";
  const cat = getRequestCategory(req);
  const isPaid = req.is_paid || false;

  const dateStr = req.date_requested
    ? new Date(req.date_requested).toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "N/A";

  // Documents list
  let docList = "";
  if (docs.tor_purpose?.length)
    docs.tor_purpose.forEach((d) => {
      docList += `<span class="doc-pill">TOR: ${escapeHtml(d)}</span> `;
    });
  if (docs.certification?.length)
    docs.certification.forEach((d) => {
      docList += `<span class="doc-pill">${escapeHtml(d)}</span> `;
    });
  if (docs.diploma?.length)
    docs.diploma.forEach((d) => {
      docList += `<span class="doc-pill">Diploma: ${escapeHtml(d)}</span> `;
    });
  if (docs.cav_overseas)
    docList += `<span class="doc-pill">CAV Overseas (${docs.cav_copies || 1})</span> `;
  if (docs.others)
    docList += `<span class="doc-pill">${escapeHtml(docs.others)}</span> `;
  if (!docList) docList = '<span class="text-muted">None</span>';

  // Clearance rows
  let clearanceRows = "";
  depts.forEach((dept) => {
    const val = cl[dept] || "Pending";
    let badgeCls = "badge-pending";
    if (val === "Approved") badgeCls = "badge-ready";
    else if (val === "Rejected") badgeCls = "badge-rejected";

    let remarkHtml = "";
    if (val === "Rejected" && remarks[dept]) {
      remarkHtml = `<div class="remark-text"><i class="fas fa-info-circle me-1"></i>${escapeHtml(remarks[dept])}</div>`;
    }

    clearanceRows += `
            <div class="dept-row">
                <div>
                    <span class="dept-name">${dept}</span>
                    ${remarkHtml}
                </div>
                <span class="badge-status ${badgeCls}">${escapeHtml(val)}</span>
            </div>`;
  });

  // Staff remarks
  let staffRemarksHtml = "";
  if (remarks.staff) {
    staffRemarksHtml = `
            <div class="detail-section">
                <h6><i class="fas fa-user-tie me-2"></i>Staff Remarks</h6>
                <p style="font-size:0.85rem; color:#334155;">${escapeHtml(remarks.staff)}</p>
            </div>`;
  }

  const trackingDisplay = req.tracking_number || "REQ-" + req.request_id;
  // A finalized request whose claiming schedule is not set yet (step 7:
  // waiting for the reference number) still shows as "Pending"
  const rawStatusLower = getRawStatus(req);
  const isReadyRaw = rawStatusLower === "ready to claim";
  // A claiming schedule already set (even while the request still shows Pending)
  const isScheduled = hasClaimSchedule(req);
  const claimWindowState = getClaimWindowState(req);
  const claimWindowOpen = isScheduled && claimWindowState !== "before";

  // Claiming schedule set by the staff (after the reference number is recorded)
  const scheduleSpanLong = formatScheduleSpan(req, false);
  let scheduleHtml = "";
  if (scheduleSpanLong) {
    scheduleHtml = `
        <div class="detail-section">
            <h6><i class="fas fa-calendar-check me-2"></i>Claiming Schedule</h6>
            <div class="detail-grid">
                <div class="detail-item">
                    <div class="dlabel">Claiming Period</div>
                    <div class="dvalue" style="color:#b85c00; font-weight:700;">${escapeHtml(scheduleSpanLong)}</div>
                </div>
                <div class="detail-item">
                    <div class="dlabel">Schedule Remarks</div>
                    <div class="dvalue" style="font-size:0.85rem;">${
                      req.claim_schedule_remarks
                        ? escapeHtml(req.claim_schedule_remarks)
                        : '<span class="text-muted">None</span>'
                    }</div>
                </div>
            </div>
        </div>`;
  }

  // Reminder that the request keeps the "Pending" status until the window opens
  const claimWindowNoteHtml =
    isScheduled && !claimWindowOpen
      ? `
        <div class="detail-section">
            <div class="p-3" style="background:#fef3c7; border-radius:8px; border-left:4px solid #f59e0b; font-size:0.85rem; color:#92400e;">
                <i class="fas fa-hourglass-half me-1"></i><strong>Waiting for the claiming window.</strong>
                The request stays <strong>Pending</strong> until ${escapeHtml(formatScheduleDate(req.claim_schedule_start, false))} and automatically becomes <strong>Ready to Claim</strong> on that day.
            </div>
        </div>`
      : "";

  document.getElementById("detailBody").innerHTML = `
        <div class="detail-section">
            <h6><i class="fas fa-user-graduate me-2"></i>Student Information</h6>
            <div class="detail-grid">
                <div class="detail-item">
                    <div class="dlabel">Tracking No.</div>
                    <div class="dvalue" style="color:#667eea; font-weight:700;">${escapeHtml(trackingDisplay)}</div>
                </div>
                <div class="detail-item">
                    <div class="dlabel">Name</div>
                    <div class="dvalue">${escapeHtml(req.student_name)}</div>
                </div>
                <div class="detail-item">
                    <div class="dlabel">Course & Year</div>
                    <div class="dvalue">${escapeHtml(req.course_year || "N/A")}</div>
                </div>
                <div class="detail-item">
                    <div class="dlabel">Date Requested</div>
                    <div class="dvalue">${dateStr}</div>
                </div>
                <div class="detail-item">
                    <div class="dlabel">Total Price</div>
                    <div class="dvalue" style="color:${isPaid ? "#10b981" : "#4e73df"}; font-weight:700;">
                        ${isPaid ? '<span class="badge-status badge-ready"><i class="fas fa-check-circle me-1"></i>PAID</span>' : "₱" + parseFloat(req.total_price || 0).toFixed(2)}
                    </div>
                </div>
                <div class="detail-item">
                    <div class="dlabel">Reference Number</div>
                    <div class="dvalue" id="detailReferenceNumber" style="font-weight:600; word-break:break-word;">${escapeHtml(req.reference_number || "N/A")}</div>
                </div>
            </div>
        </div>
        ${scheduleHtml}
        ${claimWindowNoteHtml}
        <div class="detail-section">
            <h6><i class="fas fa-file-alt me-2"></i>Documents Requested</h6>
            <div>${docList}</div>
            ${
              docs.tor_purpose?.length
                ? `
            <div class="mt-3 p-3" style="background:#fff8e1; border-radius:8px; border-left:4px solid #f59e0b;">
                <div class="d-flex align-items-center gap-2 flex-wrap">
                    <strong style="color:#92400e; font-size:0.85rem;"><i class="fas fa-file-alt me-1"></i>TOR Pages:</strong>
                    <input type="number" id="torPagesInput" class="form-control form-control-sm" style="width:80px;" min="1" value="" placeholder="0">
                    <button class="btn btn-sm btn-warning" onclick="setTorPages(${req.user_id})"><i class="fas fa-save me-1"></i>Set Pages</button>
                    <span id="torPagesStatus" class="text-muted" style="font-size:0.8rem;"></span>
                </div>
            </div>`
                : ""
            }
            ${
              isReadyRaw && !isPaid
                ? `
            <div class="mt-3 p-3" style="background:#e8f4fd; border-radius:8px; border-left:4px solid #3b82f6;">
                <div class="d-flex align-items-center gap-2 flex-wrap">
                    <strong style="color:#1e40af; font-size:0.85rem;"><i class="fas fa-receipt me-1"></i>Reference Number:</strong>
                    <input type="text" id="referenceNumberInput" class="form-control form-control-sm" style="width:200px;" placeholder="Enter reference number" oninput="document.getElementById('detailReferenceNumber').textContent = this.value.trim() || 'N/A'">
                    <button class="btn btn-sm btn-primary" onclick="submitReferenceNumber(${req.request_id})">
                        <i class="fas fa-paper-plane me-1"></i>Enter
                    </button>
                </div>
            </div>`
                : ""
            }
        </div>
        <div class="detail-section">
            <h6><i class="fas fa-clipboard-check me-2"></i>Department Clearance</h6>
            ${clearanceRows}
        </div>
        ${staffRemarksHtml}`;

  // Footer actions
  let footerHtml =
    '<button class="btn btn-secondary" data-bs-dismiss="modal">Close</button>';
  if (isScheduled) {
    // Claiming schedule already set => staff may reschedule or finally mark it as claimed
    footerHtml += `<button class="btn btn-outline-primary" onclick="openScheduleModal(${req.request_id})"><i class="fas fa-calendar-alt me-1"></i>Update Schedule</button>`;
    footerHtml += `<button class="btn btn-primary"${
      claimWindowOpen
        ? ""
        : " disabled"
    } title="${
      claimWindowOpen
        ? "Mark this request as claimed"
        : `The claiming window starts on ${escapeHtml(formatScheduleDate(req.claim_schedule_start, false))}`
    }" onclick="detailModal.hide(); claimRequest(${req.request_id})"><i class="fas fa-hand-holding me-1"></i>Mark as Claimed</button>`;
  } else if (isReadyRaw && isPaid) {
    // Reference number entered (payment recorded) => staff can now set the claiming schedule
    footerHtml += `<button class="btn btn-primary" onclick="openScheduleModal(${req.request_id})"><i class="fas fa-calendar-plus me-1"></i>Set Claiming Schedule</button>`;
  } else if (isReadyRaw && !isPaid) {
    // Staff must enter a reference number before a claiming schedule can be set
    footerHtml += '<button class="btn btn-primary" disabled title="Enter a reference number first"><i class="fas fa-calendar-plus me-1"></i>Set Claiming Schedule</button>';
  } else if (cat === "claimed") {
    // Print claim slip is only available after the request has been claimed
    footerHtml += `<button class="btn btn-outline-primary" onclick="printClaimSlip(${req.request_id})"><i class="fas fa-print me-1"></i>Print Claim Slip</button>`;
  } else if (cat === "pending" && !isScheduled && !isReadyRaw) {
    // Only truly unfinished requests (not yet finalized by the staff) can be
    // sent to the student — a finalized request shows as Pending but must not
    // be finalized twice
    const allResponded = depts.every((d) => cl[d] && cl[d] !== "Pending");
    if (allResponded) {
      footerHtml += `<button class="btn btn-success" onclick="detailModal.hide(); finalizeRequest(${req.request_id})"><i class="fas fa-paper-plane me-1"></i>Send to Student</button>`;
    }
  }
  document.getElementById("detailFooter").innerHTML = footerHtml;

  detailModal.show();

  // Load TOR pages if applicable
  if (docs.tor_purpose?.length) {
    loadTorPages(req.user_id);
  }
}

async function loadTorPages(userId) {
  try {
    const res = await axios.get(
      `${API_BASE}/get_tor_pages.php?user_id=${userId}`,
    );
    if (res.data.success && res.data.total_pages > 0) {
      document.getElementById("torPagesInput").value = res.data.total_pages;
      document.getElementById("torPagesStatus").textContent =
        `(Last updated: ${res.data.updated_at || "N/A"})`;
    } else {
      document.getElementById("torPagesStatus").textContent = "(Not yet set)";
    }
  } catch (e) {
    console.error("Error loading TOR pages:", e);
  }
}

async function setTorPages(userId) {
  const pages = parseInt(document.getElementById("torPagesInput").value);
  if (!pages || pages <= 0) {
    Swal.fire("Error", "Please enter a valid number of pages", "warning");
    return;
  }
  try {
    const res = await axios.post(`${API_BASE}/set_tor_pages.php`, {
      user_id: userId,
      total_pages: pages,
    });
    if (res.data.success) {
      Swal.fire({
        title: "Saved!",
        text: res.data.message,
        icon: "success",
        timer: 1500,
        showConfirmButton: false,
      });
      document.getElementById("torPagesStatus").textContent =
        "(Updated just now)";
      fetchRequests();
    } else {
      Swal.fire("Error", res.data.message, "error");
    }
  } catch (e) {
    Swal.fire("Error", "Failed to save TOR pages", "error");
  }
}

async function submitReferenceNumber(requestId) {
  const referenceInput = document.getElementById("referenceNumberInput");
  const referenceNumber = referenceInput.value.trim();

  if (!referenceNumber) {
    Swal.fire("Error", "Please enter a reference number", "warning");
    return;
  }

  // Professional processing loader (clean centered dialog, native spinner)
  showProcessing("Recording the reference number...");

  try {
    const response = await axios.post(`${API_BASE}/submit_reference.php`, {
      request_id: requestId,
      reference_number: referenceNumber,
    });

    Swal.close();

    if (response.data.success) {
      const refDisplay = document.getElementById("detailReferenceNumber");
      if (refDisplay) refDisplay.textContent = referenceNumber;
      Swal.fire({
        title: "Submitted Successfully!",
        text: "Reference number recorded. Payment marked as PAID. You can now set the claiming schedule.",
        icon: "success",
        timer: 2500,
        showConfirmButton: false,
      });

      // Keep the detail modal OPEN — it only closes when marked as claimed.
      // Refresh the data first (await), then re-render the modal so
      // the reference number shows and "Set Claiming Schedule" becomes available.
      await fetchRequests();
      showDetail(requestId);
    } else {
      Swal.fire(
        "Error",
        response.data.message || "Failed to submit reference number",
        "error",
      );
    }
  } catch (error) {
    Swal.close();
    console.error("Error submitting reference:", error);
    Swal.fire("Error", "Failed to connect to server", "error");
  }
}

async function claimRequest(requestId) {
  const result = await Swal.fire({
    title: "Mark as Claimed?",
    text: "This request will be marked as claimed by the student and their tracker will be completed.",
    icon: "question",
    showCancelButton: true,
    confirmButtonColor: "#4e73df",
    confirmButtonText: "Yes, mark as Claimed",
  });

  if (!result.isConfirmed) return;

  // Professional processing loader (clean centered dialog, native spinner)
  showProcessing("Marking the request as claimed...");

  try {
    const response = await axios.post(`${API_BASE}/claim_request.php`, {
      request_id: requestId,
    });
    Swal.close();
    if (response.data.success) {
      Swal.fire({
        title: "Claimed!",
        text: response.data.message,
        icon: "success",
        timer: 2000,
        showConfirmButton: false,
      });
      fetchRequests();
    } else {
      Swal.fire("Error", response.data.message, "error");
    }
  } catch (error) {
    Swal.close();
    Swal.fire("Error", "Failed to connect to server", "error");
  }
}

// ─── Claiming Schedule ───

// Format a YYYY-MM-DD value, e.g. "September 20, 2026" (or "Sep 20, 2026" when short)
function formatScheduleDate(value, short) {
  if (!value) return "";
  const raw = String(value).trim();
  const d = new Date(raw.length <= 10 ? raw + "T00:00:00" : raw);
  if (isNaN(d.getTime())) return raw;
  return d.toLocaleDateString(
    "en-US",
    short
      ? { month: "short", day: "numeric", year: "numeric" }
      : { month: "long", day: "numeric", year: "numeric" },
  );
}

// Claiming schedule span, e.g. "Sep 20, 2026 - Sep 24, 2026" ("" when not set)
function formatScheduleSpan(req, short) {
  if (!req || !req.claim_schedule_start || !req.claim_schedule_end) return "";
  const start = formatScheduleDate(req.claim_schedule_start, short);
  const end = formatScheduleDate(req.claim_schedule_end, short);
  if (!start || !end) return "";
  return start === end ? start : start + " \u2013 " + end;
}

// Normalise a DB date value for <input type="date">
function toDateInputValue(value) {
  if (!value) return "";
  return String(value).slice(0, 10);
}

function openScheduleModal(requestId) {
  const req = allRequests.find((r) => r.request_id == requestId);
  if (!req) return;

  // A schedule already stored (even while the request still shows Pending)
  const isScheduled = hasClaimSchedule(req);

  // The reference number must be recorded before a schedule can be set
  if (!isScheduled && !(req.is_paid || false)) {
    Swal.fire(
      "Reference Number Required",
      "Please enter the reference number before setting a claiming schedule.",
      "warning",
    );
    return;
  }

  pendingScheduleId = requestId;

  document.getElementById("scheduleStudentName").textContent =
    req.student_name || "N/A";

  const startInput = document.getElementById("scheduleStartInput");
  const endInput = document.getElementById("scheduleEndInput");
  const existingStart = toDateInputValue(req.claim_schedule_start);
  const existingEnd = toDateInputValue(req.claim_schedule_end);

  // Default to a 5-day window starting tomorrow when no schedule exists yet
  const now = new Date();
  const defaultStart = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  const defaultEnd = new Date(now.getTime() + 5 * 24 * 60 * 60 * 1000);

  startInput.value = existingStart || defaultStart.toISOString().slice(0, 10);
  endInput.value = existingEnd || defaultEnd.toISOString().slice(0, 10);
  endInput.min = startInput.value;

  startInput.onchange = function () {
    if (!this.value) return;
    endInput.min = this.value;
    if (!endInput.value || endInput.value < this.value) {
      endInput.value = this.value;
    }
  };

  document.getElementById("scheduleRemarksInput").value =
    req.claim_schedule_remarks || "";

  document.querySelector("#scheduleModal .modal-title").innerHTML = isScheduled
    ? '<i class="fas fa-calendar-alt me-2"></i>Update Claiming Schedule'
    : '<i class="fas fa-calendar-plus me-2"></i>Set Claiming Schedule';
  document.getElementById("confirmScheduleBtn").innerHTML = isScheduled
    ? '<i class="fas fa-calendar-check me-1"></i>Update Schedule'
    : '<i class="fas fa-calendar-check me-1"></i>Set Schedule';

  scheduleModal.show();
}

async function confirmClaimSchedule() {
  if (!pendingScheduleId) return;

  const start = document.getElementById("scheduleStartInput").value;
  const end = document.getElementById("scheduleEndInput").value;
  const remarks = document
    .getElementById("scheduleRemarksInput")
    .value.trim();

  if (!start || !end) {
    Swal.fire(
      "Incomplete Schedule",
      "Please select both the start and end date of the claiming period.",
      "warning",
    );
    return;
  }

  if (end < start) {
    Swal.fire(
      "Invalid Schedule",
      "The end date must be on or after the start date.",
      "warning",
    );
    return;
  }

  const requestId = pendingScheduleId;
  scheduleModal.hide();

  // Professional processing loader (clean centered dialog, native spinner)
  showProcessing("Saving the claiming schedule...");

  try {
    const response = await axios.post(`${API_BASE}/set_claim_schedule.php`, {
      request_id: requestId,
      schedule_start: start,
      schedule_end: end,
      schedule_remarks: remarks,
    });

    Swal.close();

    if (response.data.success) {
      Swal.fire({
        title: "Schedule Saved!",
        text: response.data.message,
        icon: "success",
        timer: 2500,
        showConfirmButton: false,
      });
      await fetchRequests();
      showDetail(requestId);
    } else {
      Swal.fire(
        "Error",
        response.data.message || "Failed to save the claiming schedule",
        "error",
      );
    }
  } catch (error) {
    Swal.close();
    console.error("Error saving claiming schedule:", error);
    Swal.fire("Error", "Failed to connect to server", "error");
  }

  pendingScheduleId = null;
}

function finalizeRequest(requestId) {
  const req = allRequests.find((r) => r.request_id == requestId);
  if (!req) return;

  const cl = req.clearance || {};
  const remarks = req.remarks || {};
  const depts = ["library", "guidance", "finance", "dean"];

  const hasPending = depts.some((d) => !cl[d] || cl[d] === "Pending");
  if (hasPending) {
    Swal.fire(
      "Cannot Finalize",
      "Not all departments have responded yet.",
      "warning",
    );
    return;
  }

  const hasRejection = depts.some((d) => cl[d] === "Rejected");
  const action = hasRejection ? "Rejected" : "Ready to Claim";

  pendingFinalizeId = requestId;
  pendingFinalizeAction = action;

  document.getElementById("modalStudentName").textContent = req.student_name;

  // Pre-filled message sent to the student (staff can edit or replace it).
  // A rejection gets an empty box because "submit your reference number" no longer applies.
  document.getElementById("modalStaffRemarks").value = hasRejection
    ? ""
    : "Submit Your Reference Number in the Registrar";

  let summaryHtml = "";
  depts.forEach((dept) => {
    const val = cl[dept] || "Pending";
    let badgeCls = "badge-pending";
    if (val === "Approved") badgeCls = "badge-ready";
    else if (val === "Rejected") badgeCls = "badge-rejected";

    let reasonHtml = "";
    if (val === "Rejected" && remarks[dept]) {
      reasonHtml = `<small class="text-danger d-block mt-1"><i class="fas fa-info-circle me-1"></i>${escapeHtml(remarks[dept])}</small>`;
    }

    summaryHtml += `
            <div class="dept-row">
                <div>
                    <span class="dept-name">${dept}</span>
                    ${reasonHtml}
                </div>
                <span class="badge-status ${badgeCls}">${val}</span>
            </div>`;
  });
  document.getElementById("modalClearanceSummary").innerHTML = summaryHtml;

  // "Outcome: Ready to Claim" is no longer displayed - the clearance summary above
  // already shows the outcome, and the flow now continues with the reference number
  // and claiming schedule. Only a rejection is still surfaced (row hidden otherwise).
  const outcomeRow = document.getElementById("modalOutcomeRow");
  const outcomeEl = document.getElementById("modalOutcome");
  if (hasRejection) {
    outcomeEl.innerHTML =
      '<span class="badge-status badge-rejected"><i class="fas fa-times-circle me-1"></i>Rejected</span>';
    if (outcomeRow) outcomeRow.style.display = "";
  } else {
    outcomeEl.innerHTML = "";
    if (outcomeRow) outcomeRow.style.display = "none";
  }

  finalizeModal.show();
}

async function confirmFinalize() {
  if (!pendingFinalizeId || !pendingFinalizeAction) return;

  const staffRemarks = document
    .getElementById("modalStaffRemarks")
    .value.trim();

  // Smoothly close the finalize form while the notification is being sent
  finalizeModal.hide();

  // Professional processing loader (clean centered dialog, native spinner)
  showProcessing("Sending notification to the student...");

  try {
    const response = await axios.post(`${API_BASE}/finalize_request.php`, {
      request_id: pendingFinalizeId,
      action: pendingFinalizeAction,
      staff_remarks: staffRemarks,
    });

    Swal.close();

    if (response.data.success) {
      Swal.fire({
        title: "Success!",
        text: response.data.message,
        icon: "success",
        timer: 2500,
        showConfirmButton: false,
      });
      fetchRequests();
    } else {
      Swal.fire(
        "Error",
        response.data.message || "Failed to finalize",
        "error",
      );
    }
  } catch (error) {
    Swal.close();
    Swal.fire("Error", "Failed to connect to server", "error");
  }

  pendingFinalizeId = null;
  pendingFinalizeAction = null;
}

function printClaimSlip(requestId) {
  const req = allRequests.find((r) => r.request_id == requestId);
  if (!req) return;
  sessionStorage.setItem(
    "claimSlipData",
    JSON.stringify({
      tracking_number: req.tracking_number || "REQ-" + req.request_id,
      student_name: req.student_name,
      course_year: req.course_year,
      date_requested: req.date_requested,
      date_released: req.date_released,
      total_price: req.total_price,
      documents: req.documents,
    }),
  );
  window.open("/REQUEST/shared/claim_slip.html", "_blank");
}

function showEmpty(message) {
  document.getElementById("tableBody").innerHTML = `
        <tr><td colspan="7">
            <div class="empty-state">
                <i class="fas fa-inbox d-block"></i>
                <p>${escapeHtml(message)}</p>
            </div>
        </td></tr>`;
}

function openReviewModal(requestId) {
  const req = allRequests.find((r) => r.request_id == requestId);
  if (!req) return;

  pendingReviewId = requestId;

  document.getElementById("reviewStudentName").textContent =
    req.student_name || "N/A";

  // Working copy of the requested documents: every TOR is clicked individually
  // to set its page count and any document can be deselected
  reviewDocRows = buildReviewDocRows(req);

  refreshReviewModal();

  reviewModal.show();
}

// ---- Step 2 review: per-document rows, per-TOR pages, deselection ----

// Build the working rows for the review modal from the request's documents.
// Falls back to the legacy document arrays if the API returned no junction rows.
function buildReviewDocRows(req) {
  const docs = req.documents || {};

  if (Array.isArray(docs.doc_rows) && docs.doc_rows.length) {
    return docs.doc_rows.map((row) => ({
      id: row.id,
      name: row.document_name,
      type: (row.type_name || "").toLowerCase(),
      copies: parseInt(row.copies, 10) || 1,
      pages:
        row.pages && parseInt(row.pages, 10) > 0
          ? parseInt(row.pages, 10)
          : null,
      price: parseFloat(row.price) || 0,
      included: true,
    }));
  }

  const rows = [];
  const push = (name, type, copies) =>
    rows.push({
      id: null,
      name,
      type,
      copies: copies || 1,
      pages: null,
      price: 0,
      included: true,
    });
  (docs.tor_purpose || []).forEach((name) => push(name, "tor"));
  (docs.certification || []).forEach((name) => push(name, "certification"));
  (docs.diploma || []).forEach(() => push("Diploma", "certification"));
  if (docs.cav_overseas) push("CAV Overseas", "cav", docs.cav_copies || 1);
  return rows;
}

// Human readable label for a review row (matches the old doc pills)
function docLabel(row) {
  if (row.type === "tor") return "TOR: " + row.name;
  if (row.type === "cav")
    return (
      "CAV Overseas (" +
      row.copies +
      (row.copies === 1 ? " copy)" : " copies)")
    );
  if (row.type === "certification" && row.name === "Diploma")
    return "Diploma: First Copy";
  return row.name;
}

// Render the document rows inside the Step 2 review modal.
// TOR rows open the "Set TOR Pages" modal; the checkbox deselects a document.
function renderReviewDocs() {
  const container = document.getElementById("reviewDocsList");
  if (!container) return;

  if (!reviewDocRows.length) {
    container.innerHTML = '<span class="text-muted">None</span>';
    updateTorSummary();
    return;
  }

  container.innerHTML = reviewDocRows
    .map((row, index) => {
      const isTor = row.type === "tor";
      const chip = isTor
        ? row.pages
          ? `<span class="tor-pages-chip"><i class="fas fa-file-alt me-1"></i>${row.pages} page${row.pages === 1 ? "" : "s"}</span>`
          : '<span class="tor-pages-chip missing"><i class="fas fa-exclamation-triangle me-1"></i>Set pages</span>'
        : "";
      const clickAction = isTor
        ? `openTorPagesModal(${index})`
        : `toggleReviewDoc(${index})`;

      return `
        <div class="review-doc-row ${isTor ? "tor-row" : ""} ${row.included ? "" : "excluded"}" onclick="${clickAction}">
          <input type="checkbox" class="form-check-input mt-0" ${row.included ? "checked" : ""} onclick="event.stopPropagation(); toggleReviewDoc(${index});">
          <span class="doc-label">${escapeHtml(docLabel(row))}</span>
          ${chip}
          ${isTor ? '<i class="fas fa-chevron-right" style="color:#f59e0b; font-size:0.7rem;"></i>' : ""}
        </div>`;
    })
    .join("");

  updateTorSummary();
}

// Include/exclude a document from the request before it goes to departments
function toggleReviewDoc(index) {
  const row = reviewDocRows[index];
  if (!row) return;
  row.included = !row.included;
  refreshReviewModal();
}

// Live summary of the per-TOR page counts (replaces the old overall input)
function updateTorSummary() {
  const section = document.getElementById("reviewTorSection");
  const summary = document.getElementById("reviewTorSummary");
  if (!section || !summary) return;

  const torRows = reviewDocRows.filter((r) => r.type === "tor" && r.included);
  if (!torRows.length) {
    section.style.display = "none";
    summary.innerHTML = "";
    return;
  }

  const missing = torRows.filter((r) => !(r.pages > 0));
  const totalPages = torRows.reduce(
    (sum, r) => sum + (r.pages || 0) * r.copies,
    0,
  );
  const totalFee = torRows.reduce(
    (sum, r) => sum + (r.price || 0) * (r.pages || 0) * r.copies,
    0,
  );

  section.style.display = "block";
  summary.innerHTML = `
    <div>${torRows.length} TOR ${torRows.length === 1 ? "document" : "documents"} &middot;
      Total pages: <strong>${totalPages}</strong> &middot;
      TOR fee: <strong>&#8369;${totalFee.toFixed(2)}</strong></div>
    ${
      missing.length
        ? `<div class="mt-1" style="color:#b91c1c; font-weight:600;"><i class="fas fa-exclamation-triangle me-1"></i>Set pages for: ${missing
            .map((r) => escapeHtml(docLabel(r)))
            .join(", ")}</div>`
        : '<div class="mt-1" style="color:#065f46; font-weight:600;"><i class="fas fa-check-circle me-1"></i>All TOR pages set. Click a TOR above to adjust.</div>'
    }`;
}

// Open the "Set TOR Pages" modal for a single TOR (one by one)
function openTorPagesModal(index) {
  const row = reviewDocRows[index];
  if (!row || row.type !== "tor") return;

  activeTorRowIndex = index;
  document.getElementById("torPagesDocName").textContent = docLabel(row);
  const input = document.getElementById("reviewTorPagesInput");
  input.value = row.pages || "";
  torPagesModal.show();
  setTimeout(() => input.focus(), 400);
}

// Save the page count of the TOR currently being edited
function saveTorPages() {
  const input = document.getElementById("reviewTorPagesInput");
  const pages = parseInt(input.value, 10);

  if (!pages || pages <= 0) {
    Swal.fire(
      "Invalid",
      "Please enter a valid number of pages (1 or more).",
      "warning",
    );
    input.focus();
    return;
  }

  const row = reviewDocRows[activeTorRowIndex];
  if (row) row.pages = pages;

  torPagesModal.hide();
  refreshReviewModal();
}

// Re-render the whole review modal from the current working state
function refreshReviewModal() {
  const req = allRequests.find((r) => r.request_id == pendingReviewId);
  if (!req) return;
  renderReviewDocs();
  renderCavRequirement(req);
  updateReviewGating();
}

// Enable "Submit to Departments" only when the review is complete: at least one
// document left, every included TOR has a page count, and the CAV requirement
// (if applicable) has been confirmed.
function updateReviewGating() {
  const reviewBtn = document.getElementById("confirmReviewBtn");
  const submitInfo = document.getElementById("reviewSubmitInfo");
  if (!reviewBtn) return;

  const req = allRequests.find((r) => r.request_id == pendingReviewId);
  if (!req) return;

  const included = reviewDocRows.filter((r) => r.included);
  const missingTor = included.filter((r) => r.type === "tor" && !(r.pages > 0));
  const hasIncludedCav = included.some((r) => r.type === "cav");
  const holdForCav = hasIncludedCav && !req.cav_requirements_submitted;
  const noDocs = included.length === 0;

  const ready = !noDocs && !missingTor.length && !holdForCav;

  // The CAV hold hides the action entirely until "Requirements Submitted"
  reviewBtn.style.display = holdForCav ? "none" : "";
  reviewBtn.disabled = !ready;
  if (submitInfo) submitInfo.style.display = holdForCav ? "none" : "";
}

// Render the CAV requirement block inside the Step 2 review modal.
// While the diploma requirement is still outstanding the footer's
// "Submit to Departments" button is hidden so staff must first confirm the
// submission; confirming swaps the modal back to the send-to-departments view.
function renderCavRequirement(req) {
  const docs = req.documents || {};
  const submitted = !!req.cav_requirements_submitted;

  // Reflect the staff's current selection — deselecting the CAV document also
  // clears the requirement hold (the button itself is handled by
  // updateReviewGating(), which also covers per-TOR pages and deselection).
  const cavRow = reviewDocRows.find((r) => r.type === "cav" && r.included);
  const hasCav = cavRow
    ? true
    : reviewDocRows.length
      ? false
      : !!docs.cav_overseas;
  const copies = cavRow ? cavRow.copies : docs.cav_copies || 1;

  const cavSection = document.getElementById("reviewCavSection");

  if (cavSection) {
    if (!hasCav) {
      cavSection.style.display = "none";
      cavSection.innerHTML = "";
    } else if (!submitted) {
      cavSection.style.display = "block";
      cavSection.innerHTML = `
        <div class="p-3" style="background:#fef3c7; border-radius:8px; border-left:4px solid #f59e0b;">
            <div class="fw-bold" style="color:#92400e; font-size:0.9rem;">
                <i class="fas fa-graduation-cap me-1"></i>CAV Requirement — Diploma
            </div>
            <div style="font-size:0.85rem; color:#92400e; margin:0.35rem 0 0.75rem;">
                CAV Overseas (${escapeHtml(String(copies))} ${copies == 1 ? "copy" : "copies"}).
                The student must submit their Diploma to the Registrar&rsquo;s Office before
                this request can be sent to the departments for clearance.
            </div>
            <button type="button" class="btn btn-success btn-sm" onclick="markCavRequirementsSubmitted()">
                <i class="fas fa-check me-1"></i>Requirements Submitted
            </button>
        </div>`;
    } else {
      cavSection.style.display = "block";
      const at = req.cav_requirements_submitted_at
        ? new Date(String(req.cav_requirements_submitted_at).replace(" ", "T")).toLocaleString("en-US", {
            year: "numeric",
            month: "long",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit",
          })
        : "";
      cavSection.innerHTML = `
        <div class="p-3" style="background:#d1fae5; border-radius:8px; border-left:4px solid #10b981;">
            <div class="fw-bold" style="color:#065f46; font-size:0.9rem;">
                <i class="fas fa-check-circle me-1"></i>CAV Requirements Submitted
            </div>
            <div style="font-size:0.85rem; color:#065f46; margin-top:0.25rem;">
                Diploma received${at ? " on <strong>" + escapeHtml(at) + "</strong>" : ""}.
                This request is ready to be sent to all departments for clearance.
            </div>
        </div>`;
    }
  }

  // Whether the "Submit to Departments" button is shown/enabled is decided by
  // updateReviewGating() (CAV hold + per-TOR pages + deselected documents).
}

// Staff confirms the student has submitted the CAV requirements (Diploma).
// The modal then returns to the "Submit to Departments" view.
async function markCavRequirementsSubmitted() {
  if (!pendingReviewId) return;

  const req = allRequests.find((r) => r.request_id == pendingReviewId);
  if (!req) return;

  if (req.cav_requirements_submitted) {
    refreshReviewModal();
    return;
  }

  showProcessing("Submitting CAV requirements...");

  try {
    const response = await axios.post(`${API_BASE}/submit_cav_requirements.php`, {
      request_id: pendingReviewId,
    });

    Swal.close();

    if (response.data.success) {
      req.cav_requirements_submitted = true;
      req.cav_requirements_submitted_at = response.data.submitted_at || null;

      await Swal.fire({
        title: "Requirements Submitted",
        text: response.data.message,
        icon: "success",
        timer: 2000,
        showConfirmButton: false,
      });

      // Go back to the modal that sends the request to all departments
      refreshReviewModal();
    } else {
      Swal.fire("Error", response.data.message || "Failed to record CAV requirements", "error");
    }
  } catch (error) {
    Swal.close();
    Swal.fire("Error", "Failed to connect to server", "error");
  }
}

async function confirmReview() {
  if (!pendingReviewId) return;

  const req = allRequests.find((r) => r.request_id == pendingReviewId);
  if (!req) return;

  const included = reviewDocRows.filter((r) => r.included);
  const removed = reviewDocRows.filter((r) => !r.included);
  const missingTor = included.filter((r) => r.type === "tor" && !(r.pages > 0));

  if (!included.length) {
    Swal.fire(
      "No Documents",
      "At least one document must remain selected for this request.",
      "warning",
    );
    return;
  }

  if (missingTor.length) {
    Swal.fire(
      "TOR Pages Required",
      "Set the number of pages for: " + missingTor.map(docLabel).join(", "),
      "warning",
    );
    return;
  }

  // Deselecting a document removes it from the request permanently
  if (removed.length) {
    const result = await Swal.fire({
      title: "Remove deselected documents?",
      html: `<div style="font-size:0.9rem;">These will be removed from this request:<br><strong>${removed
        .map((r) => escapeHtml(docLabel(r)))
        .join("<br>")}</strong></div>`,
      icon: "question",
      showCancelButton: true,
      confirmButtonText: "Yes, remove and send",
      cancelButtonText: "Go back",
    });
    if (!result.isConfirmed) return;
  }

  reviewModal.hide();
  if (typeof showSubmitLoader === "function") {
    showSubmitLoader("Submitting review...");
  } else {
    Swal.fire({
      toast: true,
      position: "bottom-end",
      title: "Processing...",
      showConfirmButton: false,
      showCancelButton: false,
      allowOutsideClick: false,
      allowEscapeKey: false,
      didOpen: () => Swal.showLoading(),
    });
  }

  try {
    const payload = { request_id: pendingReviewId };
    const hasRowIds = reviewDocRows.every((r) => r.id != null);

    if (hasRowIds) {
      // Page count per TOR row + the documents the staff deselected
      payload.doc_pages = included
        .filter((r) => r.type === "tor")
        .map((r) => ({ id: r.id, pages: r.pages }));
      payload.remove_doc_ids = removed.map((r) => r.id);
    } else {
      // Older API response without junction rows: fall back to one total
      payload.tor_pages = included
        .filter((r) => r.type === "tor")
        .reduce((sum, r) => sum + (r.pages || 0), 0);
    }

    const response = await axios.post(
      `${API_BASE}/review_request.php`,
      payload,
    );
    if (response.data.success) {
      Swal.fire({
        title: "Success!",
        text: response.data.message,
        icon: "success",
        timer: 2500,
        showConfirmButton: false,
      });
      fetchRequests();
      pendingReviewId = null;
      reviewDocRows = [];
    } else {
      Swal.fire(
        "Error",
        response.data.message || "Failed to review request",
        "error",
      );
      // Bring the review back so the missing details can be corrected
      reviewModal.show();
      refreshReviewModal();
    }
  } catch (error) {
    Swal.fire("Error", "Failed to connect to server", "error");
    reviewModal.show();
    refreshReviewModal();
  }
}

function capitalize(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

function escapeHtml(str) {
  if (!str) return "";
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}
