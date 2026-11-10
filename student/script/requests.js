// API Configuration
const API_BASE_URL = "../api";
let myRequests = [];

// Initialize page
document.addEventListener("DOMContentLoaded", function () {
  console.log("My Requests page initializing...");
  loadSidebar();
  loadStudentData();
  loadMyRequests();
  setupEventListeners();
  setDefaultDates();

  // Load TOR page info for the request form
  loadTorPageInfo();

  // Populate the "Last school attended" year picker
  populateLastSchoolYears();

  // Add New Request button — block if pending request exists
  document.getElementById("addRequestBtn").addEventListener("click", function () {
    const hasPending = myRequests.some(
      (r) => r.status === "Pending" || r.status === "Processing"
    );
    if (hasPending) {
      Swal.fire({
        title: "You have a pending request",
        text: "Please wait for your current request to be processed before submitting a new one.",
        icon: "warning",
        confirmButtonColor: "#667eea",
      });
      return;
    }
    const modal = new bootstrap.Modal(document.getElementById("requestModal"));
    modal.show();
    goToStep(1);
  });
});

// Load sidebar component
function loadSidebar() {
  const container = document.getElementById("sidebar-container");
  if (!container) return;
  fetch("sidebar.html")
    .then((response) => response.text())
    .then((html) => {
      var temp = document.createElement("div");
      temp.innerHTML = html;
      // Show topbar + horizontal navbar, no sidebar
      var topbar = temp.querySelector(".topbar");
      var navbar = temp.querySelector(".student-navbar");
      if (topbar) container.appendChild(topbar);
      if (navbar) container.appendChild(navbar);
      // Adjust content: full width, offset for topbar + navbar
      var content = document.querySelector(".content") || document.querySelector(".main-content");
      if (content) {
        content.style.marginLeft = "0";
        content.style.marginTop = "calc(var(--cces-topbar-height) + 40px)";
        content.style.padding = "1.5rem";
      }
      // Highlight active nav item
      document.querySelectorAll(".navbar-dropdown-menu a").forEach(function (link) {
        if (link.getAttribute("href") === "requests.html") link.classList.add("active");
      });
      // Bind logout
      var logoutBtnTopbar = document.getElementById("logoutBtnTopbar");
      if (logoutBtnTopbar) {
        logoutBtnTopbar.addEventListener("click", function (e) {
          e.preventDefault();
          if (window.appLogout) { window.appLogout("../api/logout.php"); }
          else { sessionStorage.clear(); window.location.href = "../../index.php"; }
        });
      }
      var cachedData = sessionStorage.getItem("studentData");
      if (cachedData) {
        try { updateSidebarInfo(JSON.parse(cachedData)); } catch (e) {}
      }
      // Setup notification bell
      setupNotifBell();
    })
    .catch((error) => console.error("Error loading navigation:", error));
}

function setupNotifBell() {
  var bell = document.getElementById('notifBell');
  var dropdown = document.getElementById('notifDropdown');
  if (!bell || !dropdown) return;
  bell.addEventListener('click', function(e) {
    e.stopPropagation();
    dropdown.classList.toggle('open');
  });
  document.addEventListener('click', function(e) {
    if (dropdown && !dropdown.contains(e.target) && e.target !== bell && !bell.contains(e.target)) {
      dropdown.classList.remove('open');
    }
  });
}

function notifTimeAgo(dateStr) {
  if (!dateStr) return '';
  var d = new Date(dateStr);
  if (isNaN(d)) return '';
  var now = new Date();
  var diff = Math.floor((now - d) / 1000);
  if (diff < 60) return 'Just now';
  if (diff < 3600) return Math.floor(diff / 60) + 'm ago';
  if (diff < 86400) return Math.floor(diff / 3600) + 'h ago';
  var days = Math.floor(diff / 86400);
  return days === 1 ? '1 day ago' : days + ' days ago';
}

function buildNotificationsFromRequests(requests) {
  var badge = document.getElementById('notifBadge');
  var list = document.getElementById('notifList');
  if (!list) return;
  var notifications = [];
  var deptNames = { dean: "Dean's Office", library: 'Library', finance: 'Finance Office', guidance: 'Guidance Office' };
  var cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 15);

  (requests || []).forEach(function(req) {
    var reqDate = req.request_date ? new Date(req.request_date) : null;
    if (reqDate && reqDate < cutoff) return;

    var cl = req.clearance || {};
    var remarks = req.remarks || {};
    if (typeof remarks === 'string') { try { remarks = JSON.parse(remarks); } catch(e) { remarks = {}; } }
    var rnum = 'REQ-' + String(req.request_id).padStart(6, '0');
    var dateStr = req.date_released || req.request_date || '';

    for (var key in deptNames) {
      var status = (cl[key] || '').toLowerCase();
      if (status === 'pending' && remarks[key]) {
        notifications.push({ icon: 'fas fa-exclamation-triangle', color: '#f59e0b', title: deptNames[key] + ' — Lacking Requirements', message: remarks[key], reqNum: rnum, date: req.request_date });
      }
      if (status === 'rejected' && remarks[key]) {
        notifications.push({ icon: 'fas fa-times-circle', color: '#ef4444', title: deptNames[key] + ' — Rejected', message: remarks[key], reqNum: rnum, date: req.request_date });
      }
    }

    var st = getRawStatusForReq(req);
    if (st === 'scheduled for claiming') {
      // Pending until the first day of the schedule span, ready from that day on
      if (isClaimWindowOpen(req)) {
        var readySpan = getClaimScheduleSpan(req);
        notifications.push({ icon: 'fas fa-check-circle', color: '#10b981', title: 'Ready to Claim', message: 'Your documents are ready at the Registrar\'s Office' + (readySpan ? ': ' + readySpan : '') + '.', reqNum: rnum, date: dateStr });
      } else {
        var notifSpan = getClaimScheduleSpan(req);
        notifications.push({ icon: 'fas fa-calendar-check', color: '#0ea5e9', title: 'Scheduled for Claiming', message: 'Your documents are scheduled for claiming' + (notifSpan ? ': ' + notifSpan : '') + '. The status becomes Ready to Claim on the first day of the schedule.', reqNum: rnum, date: dateStr });
      }
    } else if (st === 'ready to claim') {
      notifications.push({ icon: 'fas fa-check-circle', color: '#10b981', title: 'Ready to Claim', message: 'Your documents are ready at the Registrar\'s Office. Please submit your reference number to continue.', reqNum: rnum, date: dateStr });
    }
    if (st === 'claimed') {
      notifications.push({ icon: 'fas fa-box-open', color: '#6366f1', title: 'Claimed', message: 'You have claimed your documents. Transaction completed.', reqNum: rnum, date: dateStr });
    }
  });

  if (badge) {
    if (notifications.length > 0) { badge.textContent = notifications.length; badge.style.display = 'inline-block'; }
    else { badge.style.display = 'none'; }
  }
  if (notifications.length === 0) {
    list.innerHTML = '<div class="notif-empty"><i class="fas fa-check-circle me-1"></i>No new notifications</div>';
    return;
  }
  list.innerHTML = notifications.map(function(n) {
    return '<div class="notif-item">' +
      '<div class="notif-item-inner">' +
        '<i class="' + n.icon + ' notif-icon" style="color:' + n.color + ';"></i>' +
        '<div class="notif-body">' +
          '<div class="notif-title">' + escapeHtml(n.title) + '</div>' +
          '<div class="notif-msg">' + escapeHtml(n.message) + '</div>' +
          '<div class="notif-meta"><span>' + escapeHtml(n.reqNum) + '</span><span>' + notifTimeAgo(n.date) + '</span></div>' +
        '</div>' +
      '</div>' +
    '</div>';
  }).join('');
}

// Update sidebar with student info
function updateSidebarInfo(data) {
  const sidebarName = document.getElementById("sidebarStudentName");
  const sidebarRole = document.getElementById("sidebarStudentRole");

  if (sidebarName) {
    const fullName =
      data.student?.full_name ||
      `${data.student?.first_name || ""} ${data.student?.last_name || ""}`.trim() ||
      data.user?.email?.split("@")[0] ||
      "Student";
    sidebarName.textContent = fullName;
  }

  if (sidebarRole) {
    let role = "Student";
    if (data.user?.role_id === 1) role = "Admin";
    else if (data.user?.role_id === 2) role = "Student";
    else if (data.user?.role_id === 3) role = "Alumni";
    else if (data.user?.role_id === 4) role = "Staff";
    sidebarRole.textContent = role;
  }
}

// Load student data and populate form
function loadStudentData() {
  const cachedData = sessionStorage.getItem("studentData");

  if (cachedData) {
    try {
      const data = JSON.parse(cachedData);
      console.log("Using cached data for request form:", data);
      populateStudentInfo(data);
      return;
    } catch (e) {
      console.log("Cache error, fetching fresh data");
    }
  }

  axios
    .get(API_BASE_URL + "/get_student_data.php", {
      timeout: 10000,
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
    })
    .then(function (response) {
      console.log("Student Data Response:", response.data);

      if (response.data.success) {
        populateStudentInfo(response.data);
        sessionStorage.setItem("studentData", JSON.stringify(response.data));
        updateSidebarInfo(response.data);
      } else {
        Swal.fire({
          title: "Error",
          text: "Failed to load student data",
          icon: "error",
          confirmButtonColor: "#667eea",
        });
      }
    })
    .catch(function (error) {
      console.error("Error loading student data:", error);
      Swal.fire({
        title: "Connection Error",
        text: "Cannot connect to server. Please try again.",
        icon: "error",
        confirmButtonColor: "#667eea",
      });
    });
}

// Populate student information in the form
function populateStudentInfo(data) {
  const student = data.student || {};
  const user = data.user || {};

  const fullName =
    student.full_name ||
    `${student.first_name || ""} ${student.last_name || ""}`.trim() ||
    user.email?.split("@")[0] ||
    "";

  let courseYear = "";
  if (student.course && student.year_level) {
    const suffix =
      student.year_level === 1
        ? "st"
        : student.year_level === 2
          ? "nd"
          : student.year_level === 3
            ? "rd"
            : "th";
    courseYear = `${student.course} - ${student.year_level}${suffix} Year`;
  } else if (student.course) {
    courseYear = student.course;
  } else if (student.year_level) {
    const suffix =
      student.year_level === 1
        ? "st"
        : student.year_level === 2
          ? "nd"
          : student.year_level === 3
            ? "rd"
            : "th";
    courseYear = `${student.year_level}${suffix} Year`;
  }

  const studentNameField = document.getElementById("studentName");
  const courseYearField = document.getElementById("courseYear");
  const emailField = document.getElementById("emailAddress");

  if (studentNameField) studentNameField.value = fullName;
  if (courseYearField) courseYearField.value = courseYear;
  if (emailField) emailField.value = user.email || "";
}

// Load TOR page info
let studentTorPages = 0;
function loadTorPageInfo() {
  axios.get(API_BASE_URL + "/get_tor_pages.php").then(function (res) {
    if (res.data.success) {
      studentTorPages = res.data.total_pages;
      const torLabels = document.querySelectorAll('input[name="tor_purpose[]"]');
      torLabels.forEach(function (cb) {
        const label = cb.parentElement.querySelector("label");
        if (!label) return;
        const priceSpan = label.querySelector("span");
        if (priceSpan) {
          priceSpan.textContent = "(\u20B1100.00 per page)";
        }
      });
    }
  }).catch(function () {});
}

// Set default dates
function setDefaultDates() {
  const today = new Date();
  const formattedDate = today.toISOString().split("T")[0];

  const dateRequestedField = document.getElementById("dateRequested");
  if (dateRequestedField) {
    dateRequestedField.value = formattedDate;
  }

  // Estimated date release range: 10 days to 15 days from today
  const estStart = new Date(today);
  estStart.setDate(estStart.getDate() + 10);
  const estEnd = new Date(today);
  estEnd.setDate(estEnd.getDate() + 15);

  const estField = document.getElementById("estimatedDateRelease");
  if (estField) {
    estField.value = formatDateRange(estStart, estEnd);
  }
}

// Format date range like "May 7 - 12" or "May 28 - Jun 2"
function formatDateRange(start, end) {
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const sMonth = months[start.getMonth()];
  const eMonth = months[end.getMonth()];
  const sDay = start.getDate();
  const eDay = end.getDate();

  if (sMonth === eMonth) {
    return sMonth + " " + sDay + " - " + eDay;
  }
  return sMonth + " " + sDay + " - " + eMonth + " " + eDay;
}

// ─── Multi-step request form wizard ───
let currentStep = 1;
const TOTAL_STEPS = 3;

// Document options that are unavailable when the student is not enrolled
// Note: CAV is now available for students who are not enrolled
const ENROLLMENT_RESTRICTED_IDS = [
  "certEnrollment",
  "certRegistration",
];

// Show the given step (1-3) and update stepper + footer buttons
function goToStep(step) {
  step = Math.min(Math.max(step, 1), TOTAL_STEPS);
  currentStep = step;

  document.querySelectorAll("#requestForm .form-step").forEach((el) => {
    el.classList.toggle("active", Number(el.dataset.step) === step);
  });

  document.querySelectorAll("#formStepper .step-item").forEach((el) => {
    const s = Number(el.dataset.step);
    el.classList.toggle("active", s === step);
    el.classList.toggle("done", s < step);
  });

  document.querySelectorAll("#formStepper .step-line").forEach((el) => {
    el.classList.toggle("done", Number(el.dataset.line) < step);
  });

  const backBtn = document.getElementById("btnBackStep");
  const nextBtn = document.getElementById("btnNextStep");
  const submitBtn = document.getElementById("btnSubmitStep");
  if (backBtn) backBtn.style.display = step > 1 ? "" : "none";
  if (nextBtn) nextBtn.style.display = step < TOTAL_STEPS ? "" : "none";
  if (submitBtn) submitBtn.style.display = step === TOTAL_STEPS ? "" : "none";

  if (step === 2) applyEnrollmentRestrictions();
  if (step === 3) renderPreview();

  // Scroll the modal body back to the top on each step change
  const modalBody = document.querySelector("#requestModal .modal-body");
  if (modalBody) modalBody.scrollTop = 0;
}

// Populate the "Last school attended" year pickers (current year down to 1950)
function populateLastSchoolYears() {
  const from = document.getElementById("lastSchoolYearFrom");
  const to = document.getElementById("lastSchoolYearTo");
  if (!from || !to) return;
  const thisYear = new Date().getFullYear();
  let fromOptions = '<option value="">From</option>';
  for (let y = thisYear; y >= 1950; y--) {
    fromOptions += '<option value="' + y + '">' + y + "</option>";
  }
  from.innerHTML = fromOptions;
  let toOptions = '<option value="">To</option>';
  for (let y = thisYear; y >= 1950; y--) {
    toOptions += '<option value="' + y + '">' + y + "</option>";
  }
  to.innerHTML = toOptions;

  // When "From" changes, disable "To" options earlier than the chosen From year
  from.addEventListener("change", function () {
    const fromVal = parseInt(this.value, 10);
    to.querySelectorAll("option").forEach(function (opt) {
      if (!opt.value) return; // keep the "To" placeholder
      const y = parseInt(opt.value, 10);
      opt.disabled = !isNaN(fromVal) && y < fromVal;
    });
    // If current "To" is now invalid, reset it
    const toVal = parseInt(to.value, 10);
    if (!isNaN(fromVal) && !isNaN(toVal) && toVal < fromVal) {
      to.value = "";
    }
  });
}

// Validate step 1 (information & enrollment status) before advancing
function validateStep1() {
  const contactNumber = document.getElementById("contactNumber")?.value?.trim();
  if (!contactNumber) {
    Swal.fire({
      title: "Validation Error",
      text: "Please enter your contact number",
      icon: "warning",
      confirmButtonColor: "#667eea",
    });
    return false;
  }

  // Validate both year pickers (valid 4-digit year + From <= To)
  const fromYear = document.getElementById("lastSchoolYearFrom")?.value || "";
  const toYear = document.getElementById("lastSchoolYearTo")?.value || "";

  if ((fromYear && !/^\d{4}$/.test(fromYear)) || (toYear && !/^\d{4}$/.test(toYear))) {
    Swal.fire({
      title: "Validation Error",
      text: "Please select a valid school year (YYYY format) for the last school attended.",
      icon: "warning",
      confirmButtonColor: "#667eea",
    });
    return false;
  }

  if (fromYear && toYear && parseInt(fromYear, 10) > parseInt(toYear, 10)) {
    Swal.fire({
      title: "Validation Error",
      text: "The last school year 'From' year must not be greater than the 'To' year.",
      icon: "warning",
      confirmButtonColor: "#667eea",
    });
    return false;
  }

  return true;
}

// Validate step 2 (document selection) — at least one document required
function validateStep2() {
  const docs = collectSelectedDocuments();
  if (
    docs.tor_purpose.length === 0 &&
    docs.certification.length === 0 &&
    docs.diploma.length === 0 &&
    !docs.others &&
    !docs.cav_overseas
  ) {
    Swal.fire({
      title: "Validation Error",
      text: "Please select at least one document to request",
      icon: "warning",
      confirmButtonColor: "#667eea",
    });
    return false;
  }
  return true;
}

function nextStep() {
  if (currentStep === 1 && !validateStep1()) return;
  if (currentStep === 2 && !validateStep2()) return;
  goToStep(currentStep + 1);
}

function previousStep() {
  goToStep(currentStep - 1);
}

// Enable/disable enrollment-restricted documents based on the radio selection
function applyEnrollmentRestrictions() {
  const notEnrolled = document.getElementById("notEnrolled")?.checked === true;

  ENROLLMENT_RESTRICTED_IDS.forEach((id) => {
    const cb = document.getElementById(id);
    if (!cb) return;
    const item = cb.closest(".checkbox-item");
    if (notEnrolled) {
      cb.checked = false;
      cb.disabled = true;
      if (item) item.classList.add("disabled");
    } else {
      cb.disabled = false;
      if (item) item.classList.remove("disabled");
    }
  });

  // CAV remains selectable for non-enrolled students (copies input included)
  // per requirement — only Certificate of Enrollment / Registration are restricted.

  const notice = document.getElementById("restrictedNotice");
  if (notice) notice.style.display = notEnrolled ? "flex" : "none";

  updateCavNote();
}

// Show the "submit your Diploma to the Registrar" reminder whenever the
// CAV Overseas document is part of the request
function updateCavNote() {
  const cavCheckbox = document.getElementById("cavOverseas");
  const note = document.getElementById("cavDiplomaNote");
  if (!note) return;
  const show = !!(cavCheckbox && cavCheckbox.checked && !cavCheckbox.disabled);
  note.style.display = show ? "block" : "none";
}

// Collect the currently selected documents from the form
function collectSelectedDocuments() {
  const torPurposes = [];
  document
    .querySelectorAll('input[name="tor_purpose[]"]:checked')
    .forEach((cb) => {
      if (cb.value === "Others") {
        const torOthersText = document.getElementById("torOthersText")?.value;
        if (torOthersText) {
          torPurposes.push("Others: " + torOthersText);
        } else {
          torPurposes.push("Others");
        }
      } else {
        torPurposes.push(cb.value);
      }
    });

  const selectedDocs = {
    tor_purpose: torPurposes,
    certification: [],
    diploma: [],
    others: document.getElementById("others")?.value || "",
    cav_overseas: document.getElementById("cavOverseas")?.checked || false,
    cav_copies: document.getElementById("cavCopies")?.value || "1",
  };

  document
    .querySelectorAll('input[name="certification[]"]:checked')
    .forEach((cb) => {
      selectedDocs.certification.push(cb.value);
    });

  document.querySelectorAll('input[name="diploma[]"]:checked').forEach((cb) => {
    selectedDocs.diploma.push(cb.value);
  });

  return selectedDocs;
}

// Render the step 3 preview of the request
function renderPreview() {
  const container = document.getElementById("requestPreview");
  if (!container) return;

  const esc = function (v) {
    return typeof escapeHtml === "function"
      ? escapeHtml(String(v ?? ""))
      : String(v ?? "");
  };
  const val = function (id) {
    return document.getElementById(id)?.value || "";
  };

  const docs = collectSelectedDocuments();
  const enrollment =
    document.querySelector('input[name="enrollment_status"]:checked')?.value ||
    "Currently enrolled";

  const fromY = val("lastSchoolYearFrom");
  const toY = val("lastSchoolYearTo");
  const lastSchool = fromY && toY ? fromY + "-" + toY : fromY || toY;

  const row = function (label, value) {
    return (
      '<div class="detail-row"><div class="detail-label">' +
      esc(label) +
      '</div><div class="detail-value">' +
      (value ? esc(value) : "&mdash;") +
      "</div></div>"
    );
  };

  const tags = [];
  docs.tor_purpose.forEach((d) =>
    tags.push('<span class="document-tag">TOR: ' + esc(d) + "</span>"),
  );
  docs.certification.forEach((d) =>
    tags.push('<span class="document-tag">' + esc(d) + "</span>"),
  );
  docs.diploma.forEach((d) =>
    tags.push('<span class="document-tag">Diploma: ' + esc(d) + "</span>"),
  );
  if (docs.others) {
    tags.push('<span class="document-tag">Others: ' + esc(docs.others) + "</span>");
  }
  if (docs.cav_overseas) {
    const copies = Number(docs.cav_copies || 1);
    tags.push(
      '<span class="document-tag">CAV Overseas (' +
        copies +
        (copies === 1 ? " copy" : " copies") +
        ")</span>",
    );
  }

  container.innerHTML =
    '<div class="form-section"><div class="form-section-title">' +
    '<i class="fas fa-user-graduate"></i> Student Information</div>' +
    row("Student Name", val("studentName")) +
    row("Course and Year", val("courseYear")) +
    row("Current Address", val("currentAddress")) +
    row("Cellphone #", val("contactNumber")) +
    row("Email Address", val("emailAddress")) +
    "</div>" +
    '<div class="form-section"><div class="form-section-title">' +
    '<i class="fas fa-check-circle"></i> Enrollment Status</div>' +
    row("Status", enrollment) +
    row("Last school attended", lastSchool) +
    "</div>" +
    '<div class="form-section"><div class="form-section-title">' +
    '<i class="fas fa-file-alt"></i> Documents Requested</div>' +
    '<div class="documents-list">' +
    (tags.join(" ") || '<span class="text-muted">No documents selected</span>') +
    "</div>" +
    // CAV requests require the student's Diploma at the Registrar's Office
    (docs.cav_overseas
      ? '<div class="info-message" style="background:#e8f4fd; color:#1e40af; border-left:3px solid #3b82f6; margin-top:1rem;">' +
        '<i class="fas fa-graduation-cap"></i>' +
        "<span><strong>CAV Requirement:</strong> Please submit your Diploma to the " +
        "Registrar&rsquo;s Office. Your CAV request cannot be processed until the " +
        "diploma has been submitted.</span></div>"
      : "") +
    "</div>";
}

// Setup event listeners
function setupEventListeners() {
  // TOR Others checkbox toggle
  const torOthersCheckbox = document.getElementById("torOthers");
  const torOthersInput = document.getElementById("torOthersInput");

  if (torOthersCheckbox && torOthersInput) {
    torOthersCheckbox.addEventListener("change", function () {
      torOthersInput.style.display = this.checked ? "block" : "none";
      if (!this.checked) {
        document.getElementById("torOthersText").value = "";
      }
    });
  }

  // Enrollment status change → refresh restricted documents
  document
    .querySelectorAll('input[name="enrollment_status"]')
    .forEach((radio) => {
      radio.addEventListener("change", applyEnrollmentRestrictions);
    });

  // CAV selection → show the diploma-submission reminder
  const cavOverseasCb = document.getElementById("cavOverseas");
  if (cavOverseasCb) {
    cavOverseasCb.addEventListener("change", updateCavNote);
  }

  // Reset form when modal is hidden
  const requestModal = document.getElementById("requestModal");
  if (requestModal) {
    requestModal.addEventListener("hidden.bs.modal", function () {
      document.getElementById("requestForm").reset();
      if (torOthersInput) torOthersInput.style.display = "none";
      loadStudentData(); // Reload student data
      setDefaultDates(); // Reset dates
      applyEnrollmentRestrictions(); // Re-enable restricted documents
      goToStep(1); // Restart at step 1
    });
  }
}

// Load my requests
function loadMyRequests() {
  const tbody = document.getElementById("requestsTableBody");

  axios
    .get(API_BASE_URL + "/get_my_requests.php")
    .then(function (response) {
      if (response.data.success) {
        myRequests = response.data.requests || [];
        displayRequests(myRequests);
        buildNotificationsFromRequests(myRequests);
      } else {
        tbody.innerHTML = `<tr><td colspan="7" class="text-center text-danger">${escapeHtml(response.data.message)}</td></tr>`;
      }
    })
    .catch(function (error) {
      console.error("Error loading requests:", error);
      tbody.innerHTML =
        '<tr><td colspan="7" class="text-center text-danger">Error loading requests. Please try again.</td></tr>';
    });
}

// --- Claiming window helpers ---
// A request with a claiming schedule keeps the "Pending" status until the FIRST
// DAY of the schedule span and only becomes "Ready to Claim" from that day on.
function getRawStatusForReq(req) {
  return ((req && (req.raw_status || req.status)) || "").toLowerCase();
}

function isScheduledRequest(req) {
  return (
    getRawStatusForReq(req) === "scheduled for claiming" ||
    !!(req && req.claim_schedule_start)
  );
}

function isClaimWindowOpen(req) {
  if (!isScheduledRequest(req)) return false;
  if (typeof req.claim_window_state === "string" && req.claim_window_state !== "") {
    return req.claim_window_state !== "before";
  }
  // Fallback: compare today with the first day of the schedule span
  const start = String(req.claim_schedule_start || "").slice(0, 10);
  if (!start) return true;
  const now = new Date();
  const today =
    now.getFullYear() +
    "-" +
    String(now.getMonth() + 1).padStart(2, "0") +
    "-" +
    String(now.getDate()).padStart(2, "0");
  return today >= start;
}

// Status to display: a finalized request and a scheduled request both show
// PENDING until the claiming window opens — "Ready to Claim" only appears
// on/after the first day of the schedule span
function getDisplayStatus(req) {
  const raw = getRawStatusForReq(req);
  const finalized = raw === "scheduled for claiming" || raw === "ready to claim";
  if (finalized) {
    return isClaimWindowOpen(req) ? "Ready to Claim" : "Pending";
  }
  return req.status || "Pending";
}

// Display requests in table
function displayRequests(requests) {
  const tbody = document.getElementById("requestsTableBody");

  if (!requests || requests.length === 0) {
    tbody.innerHTML =
      '<tr><td colspan="7" class="text-center">No requests found. Click "Add New Request" to create one.</td></tr>';
    return;
  }

  let html = "";
  requests.forEach((request) => {
    const requestId = request.request_id;
    const dateRequested =
      request.request_date_formatted ||
      new Date(request.request_date).toLocaleString();
    const status = request.status || "Pending";
    // Scheduled requests stay "Pending" until the first day of the claiming span
    const displayStatus = getDisplayStatus(request);
    const dateReleased = request.date_released || "Not yet released";

    // Format documents
    let documentsList = "";
    if (request.documents) {
      const docs = [];
      if (
        request.documents.tor_purpose &&
        request.documents.tor_purpose.length > 0
      ) {
        request.documents.tor_purpose.forEach((p) => docs.push("TOR: " + escapeHtml(p)));
      }
      if (
        request.documents.certification &&
        request.documents.certification.length > 0
      ) {
        request.documents.certification.forEach((c) => docs.push(escapeHtml(c)));
      }
      if (request.documents.diploma && request.documents.diploma.length > 0) {
        request.documents.diploma.forEach((d) => docs.push("Diploma: " + escapeHtml(d)));
      }
      if (request.documents.others && request.documents.others.trim()) {
        docs.push(escapeHtml(request.documents.others));
      }
      if (request.documents.cav_overseas) {
        docs.push(`CAV Overseas (${escapeHtml(String(request.documents.cav_copies || 1))} copy)`);
      }

      documentsList = docs
        .map((d) => `<span class="document-tag">${d}</span>`)
        .join("");
    }

    // Status badge class
    let statusClass = "badge-pending";
    if (displayStatus === "Approved") statusClass = "badge-approved";
    else if (displayStatus === "Processing") statusClass = "badge-processing";
    else if (displayStatus === "Ready to Claim") statusClass = "badge-ready";
    else if (displayStatus === "Scheduled for Claiming") statusClass = "badge-ready";
    else if (displayStatus === "Ready for Release") statusClass = "badge-ready";
    else if (displayStatus === "Claimed") statusClass = "badge-approved";
    else if (displayStatus === "Released") statusClass = "badge-released";
    else if (displayStatus === "Rejected") statusClass = "badge-rejected";

    const trackingNum = request.tracking_number || ('#' + requestId);
    html += `
            <tr>
                <td>${escapeHtml(trackingNum)}</td>
                <td>${escapeHtml(dateRequested)}</td>
                <td><div class="documents-list">${documentsList || "No documents selected"}</div></td>
                <td>${(() => {
                    const docs = request.documents || {};
                    const hasTor = docs.tor_purpose && docs.tor_purpose.length > 0;
                    const st = getRawStatusForReq(request);
                    if (hasTor && st === 'pending') {
                        return '<span style="color:#b85c00; font-style:italic;">Pending</span>';
                    }
                    return '<strong style="color: #2b3a67;">\u20B1' + parseFloat(request.total_price || 0).toFixed(2) + '</strong>';
                })()}</td>
                <td><span class="badge-status ${statusClass}">${escapeHtml(displayStatus)}</span></td>
                <td>${escapeHtml(dateReleased)}</td>
                <td>
                    <div class="action-buttons">
                        <button class="btn-action btn-view" onclick="viewRequest(${parseInt(requestId) || 0})" title="View Details">
                            <i class="fas fa-eye"></i>
                        </button>
                        <button class="btn-action" style="background:#fef2f2;color:#dc2626;" onclick="archiveRequest(${parseInt(requestId) || 0})" title="Archive Request">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </td>
            </tr>
        `;
  });

  tbody.innerHTML = html;
}

// Submit request
function submitRequest() {
  // Validate required fields
  const contactNumber = document.getElementById("contactNumber")?.value;
  if (!contactNumber) {
    Swal.fire({
      title: "Validation Error",
      text: "Please enter your contact number",
      icon: "warning",
      confirmButtonColor: "#667eea",
    });
    return;
  }

  // Get selected documents
  const selectedDocs = collectSelectedDocuments();

  // Check if at least one document is selected
  if (
    selectedDocs.tor_purpose.length === 0 &&
    selectedDocs.certification.length === 0 &&
    selectedDocs.diploma.length === 0 &&
    !selectedDocs.others &&
    !selectedDocs.cav_overseas
  ) {
    Swal.fire({
      title: "Validation Error",
      text: "Please select at least one document to request",
      icon: "warning",
      confirmButtonColor: "#667eea",
    });
    return;
  }

  // Clearance status
  const clearanceStatus = {
    library: "Pending",
    guidance: "Pending",
    finance: "Pending",
    dean: "Pending",
  };

  // Prepare request data
  const requestData = {
    student_name: document.getElementById("studentName")?.value || "",
    course_year: document.getElementById("courseYear")?.value || "",
    current_address: document.getElementById("currentAddress")?.value || "",
    enrollment_status:
      document.querySelector('input[name="enrollment_status"]:checked')
        ?.value || "Currently enrolled",
    last_school_year:
      document.getElementById("lastSchoolYearFrom")?.value && document.getElementById("lastSchoolYearTo")?.value
        ? `${document.getElementById("lastSchoolYearFrom").value}-${document.getElementById("lastSchoolYearTo").value}`
        : "",
    contact_number: contactNumber,
    email: document.getElementById("emailAddress")?.value || "",
    documents: selectedDocs,
    clearance: clearanceStatus,
    date_requested: document.getElementById("dateRequested")?.value || "",
  };

  // Show the lower-right submission loading toast while the request is processed
  if (typeof showSubmitLoader === "function") {
    showSubmitLoader("Submitting your request...");
  } else {
    Swal.fire({
      toast: true,
      position: "bottom-end",
      title: "Please wait",
      html: "Submitting your request...",
      showConfirmButton: false,
      showCancelButton: false,
      allowOutsideClick: false,
      allowEscapeKey: false,
      didOpen: () => Swal.showLoading(),
    });
  }

  // Smoothly close the request form while the request is being processed
  const requestModal = bootstrap.Modal.getInstance(
    document.getElementById("requestModal"),
  );
  if (requestModal) requestModal.hide();

  // Send request to server
  axios
    .post(API_BASE_URL + "/submit_request.php", requestData)
    .then(function (response) {
      Swal.close();

      if (response.data.success) {
        const trackingNum = response.data.tracking_number || '';
        Swal.fire({
          title: "Request Submitted!",
          html: trackingNum
            ? 'Your tracking number is:<br><strong style="font-size:1.5rem;color:#667eea;">' + escapeHtml(trackingNum) + '</strong><br><small class="text-muted">Please save this for your reference.</small>'
            : "Your document request has been submitted successfully",
          icon: "success",
          confirmButtonColor: "#667eea",
        }).then(() => {
          // Reload requests
          loadMyRequests();
        });
      } else {
        Swal.fire({
          title: "Error",
          text: response.data.message || "Failed to submit request",
          icon: "error",
          confirmButtonColor: "#667eea",
        });
      }
    })
    .catch(function (error) {
      Swal.close();
      console.error("Submit request error:", error);

      Swal.fire({
        title: "Connection Error",
        text: "Cannot connect to server. Please try again.",
        icon: "error",
        confirmButtonColor: "#667eea",
      });
    });
}

// View request details
function viewRequest(requestId) {
  axios
    .get(API_BASE_URL + "/get_my_requests.php")
    .then(function (response) {
      if (response.data.success) {
        const request = response.data.requests.find(
          (r) => r.request_id == requestId,
        );
        if (request) {
          showRequestDetails(request);
        } else {
          Swal.fire("Error", "Request not found", "error");
        }
      }
    })
    .catch(function (error) {
      console.error("Error fetching request details:", error);
      Swal.fire("Error", "Failed to load request details", "error");
    });
}

// Show request details in modal
function showRequestDetails(request) {
  const status = request.status || "Pending";
  // Scheduled requests keep showing "Pending" until the claiming window opens
  const rawStatus = getRawStatusForReq(request);
  const isScheduledReq = isScheduledRequest(request);
  const claimWindowOpen = isClaimWindowOpen(request);
  const displayStatus = getDisplayStatus(request);

  // Parse clearance data
  let clearance = request.clearance || {};
  if (typeof clearance === "string") {
    try { clearance = JSON.parse(clearance); } catch (e) { clearance = {}; }
  }

  // Parse remarks data
  let remarks = request.remarks || {};
  if (typeof remarks === "string") {
    try { remarks = JSON.parse(remarks); } catch (e) { remarks = {}; }
  }

  // Department display config
  const departments = [
    { key: "dean", label: "Dean", icon: "fas fa-user-tie" },
    { key: "guidance", label: "Guidance", icon: "fas fa-users" },
    { key: "finance", label: "Finance", icon: "fas fa-coins" },
    { key: "library", label: "Library", icon: "fas fa-book" },
  ];

  // Build clearance items HTML
  let clearanceHtml = "";
  departments.forEach(function (dept) {
    const deptStatus = clearance[dept.key] || "Pending";
    const statusLower = deptStatus.toLowerCase();
    let badgeClass = "clearance-badge-pending";
    let badgeIcon = "";
    if (statusLower === "approved") {
      badgeClass = "clearance-badge-approved";
      badgeIcon = '<i class="fas fa-check"></i>';
    } else if (statusLower === "rejected") {
      badgeClass = "clearance-badge-rejected";
      badgeIcon = '<i class="fas fa-times"></i>';
    }

    let reasonHtml = "";
    if (statusLower === "rejected" && remarks[dept.key]) {
      reasonHtml = '<div class="rejection-reason"><i class="fas fa-info-circle"></i> ' + escapeHtml(remarks[dept.key]) + "</div>";
    } else if (statusLower === "pending" && remarks[dept.key]) {
      reasonHtml = '<div style="font-size:0.8rem;color:#856404;margin-top:0.3rem;padding-left:0.25rem;font-style:italic;"><i class="fas fa-exclamation-triangle"></i> ' + escapeHtml(remarks[dept.key]) + "</div>";
    }

    clearanceHtml += '<div class="view-clearance-item">' +
      '<div class="dept-header">' +
        '<span class="dept-name"><i class="' + dept.icon + '"></i> ' + escapeHtml(dept.label) + "</span>" +
        '<span class="clearance-badge ' + badgeClass + '">' + badgeIcon + " " + escapeHtml(deptStatus) + "</span>" +
      "</div>" +
      reasonHtml +
    "</div>";
  });

  // Build feedback section
  let feedbackHtml = "";

  // Check if any department has pending remarks
  let pendingDetails = "";
  departments.forEach(function (dept) {
    const deptStatus = (clearance[dept.key] || "").toLowerCase();
    if (deptStatus === "pending" && remarks[dept.key]) {
      pendingDetails += "<li><strong>" + escapeHtml(dept.label) + ":</strong> " + escapeHtml(remarks[dept.key]) + "</li>";
    }
  });
  if (pendingDetails) {
    feedbackHtml += '<div class="feedback-box" style="background:#fff3cd;border:1px solid #ffeeba;color:#856404;border-left:4px solid #f0ad4e;">' +
      '<div class="feedback-title"><i class="fas fa-exclamation-triangle"></i> Lacking Requirements</div>' +
      '<p style="margin:0 0 0.5rem 0;font-size:0.85rem;">Please comply with the following department remarks:</p>' +
      '<ul style="margin:0 0 0 1rem;padding:0;">' + pendingDetails + "</ul>" +
    "</div>";
  }

  if (isScheduledReq) {
    // A claiming schedule is set: pending until the first day, ready afterwards
    var scheduleSpan = getClaimScheduleSpan(request);
    feedbackHtml += '<div class="feedback-box feedback-box-success">' +
      '<div class="feedback-title"><i class="fas fa-calendar-check"></i> ' +
        (claimWindowOpen ? "Ready to Claim" : "Scheduled for Claiming") +
      "</div>" +
      (claimWindowOpen
        ? "Your documents are ready. Please claim them at the Registrar's Office"
        : "Your documents are scheduled for claiming at the Registrar's Office") +
      (scheduleSpan ? " on <strong>" + escapeHtml(scheduleSpan) + "</strong>" : "") + "." +
      (request.claim_schedule_remarks ? '<div style="margin-top:0.4rem;font-size:0.85rem;color:#334155;"><strong>Remarks:</strong> ' + escapeHtml(request.claim_schedule_remarks) + "</div>" : "") +
      (claimWindowOpen
        ? ""
        : '<div style="margin-top:0.4rem;font-size:0.85rem;"><i class="fas fa-hourglass-half"></i> Your request stays <strong>Pending</strong> and becomes <strong>Ready to Claim</strong> on the first day of the schedule.</div>') +
    "</div>";
  } else if (!isScheduledReq && rawStatus === "ready to claim") {
    // Finalized by the staff, claiming schedule not set yet (step 4):
    // the status shows Pending but the student is prompted for the reference number
    feedbackHtml += '<div class="feedback-box feedback-box-success">' +
      '<div class="feedback-title"><i class="fas fa-receipt"></i> Submit Reference Number</div>' +
      "Your documents are ready. Please submit your reference number at the Registrar's Office to continue." +
    "</div>";
  } else if (status === "Rejected") {
    let rejectionDetails = "";
    departments.forEach(function (dept) {
      const deptStatus = (clearance[dept.key] || "").toLowerCase();
      if (deptStatus === "rejected" && remarks[dept.key]) {
        rejectionDetails += "<li><strong>" + escapeHtml(dept.label) + ":</strong> " + escapeHtml(remarks[dept.key]) + "</li>";
      }
    });
    feedbackHtml = '<div class="feedback-box feedback-box-danger">' +
      '<div class="feedback-title"><i class="fas fa-exclamation-circle"></i> Request Rejected</div>' +
      (rejectionDetails ? "<ul style=\"margin:0.5rem 0 0 1rem;padding:0;\">" + rejectionDetails + "</ul>" : "Your request has been rejected. Please contact the Registrar's Office for details.") +
    "</div>";
  }

  // Staff remarks
  if (remarks.staff) {
    feedbackHtml += '<div class="feedback-box feedback-box-info">' +
      '<div class="feedback-title"><i class="fas fa-comment-alt"></i> Staff Remarks</div>' +
      escapeHtml(remarks.staff) +
    "</div>";
  }

  // Build overall status badge
  let statusClass = "badge-pending";
  if (displayStatus === "Approved") statusClass = "badge-approved";
  else if (displayStatus === "Processing") statusClass = "badge-processing";
  else if (displayStatus === "Ready for Release" || displayStatus === "Ready to Claim" || displayStatus === "Scheduled for Claiming") statusClass = "badge-ready";
  else if (displayStatus === "Released") statusClass = "badge-released";
  else if (displayStatus === "Rejected") statusClass = "badge-rejected";

  const detailsHtml =
    '<div class="detail-row">' +
      '<div class="detail-label">Tracking No.:</div>' +
      '<div class="detail-value"><strong style="color:#667eea;">' + escapeHtml(request.tracking_number || '#' + request.request_id) + "</strong></div>" +
    "</div>" +
    '<div class="detail-row">' +
      '<div class="detail-label">Date Requested:</div>' +
      '<div class="detail-value">' + escapeHtml(new Date(request.request_date).toLocaleString()) + "</div>" +
    "</div>" +
    '<div class="detail-row">' +
      '<div class="detail-label">Student Name:</div>' +
      '<div class="detail-value">' + escapeHtml(request.student_name || "N/A") + "</div>" +
    "</div>" +
    '<div class="detail-row">' +
      '<div class="detail-label">Course & Year:</div>' +
      '<div class="detail-value">' + escapeHtml(request.course_year || "N/A") + "</div>" +
    "</div>" +
    '<div class="detail-row">' +
      '<div class="detail-label">Documents:</div>' +
      '<div class="detail-value"><div class="documents-list">' + formatDocumentsForDisplay(request.documents) + "</div></div>" +
    "</div>" +
    // CAV requests require the student to submit their Diploma to the Registrar
    ((request.documents && request.documents.cav_overseas)
      ? '<div class="feedback-box" style="background:#e8f4fd;border:1px solid #bee5eb;color:#1e40af;border-left:4px solid #3b82f6;">' +
        '<div class="feedback-title"><i class="fas fa-graduation-cap"></i> CAV Requirement</div>' +
        "<p style=\"margin:0;\">Please submit your Diploma to the Registrar&rsquo;s Office. Your CAV request cannot be processed until the diploma has been submitted.</p>" +
        "</div>"
      : "") +
    '<div class="detail-row">' +
      '<div class="detail-label">Total Price:</div>' +
      '<div class="detail-value">' + (function() {
          var docs = request.documents || {};
          var hasTor = docs.tor_purpose && docs.tor_purpose.length > 0;
          var st = (request.status || '').toLowerCase();
          if (hasTor && st === 'pending') {
              return '<span style="color:#b85c00; font-style:italic;">Pending</span>';
          }
          return '<strong style="color: #2b3a67; font-size: 1.1rem;">\u20B1' + parseFloat(request.total_price || 0).toFixed(2) + '</strong>';
      })() + "</div>" +
    "</div>" +
    '<div class="detail-row">' +
      '<div class="detail-label">Date Released:</div>' +
      '<div class="detail-value">' + escapeHtml(request.date_released || "Not yet released") + "</div>" +
    "</div>" +
    '<div class="detail-row">' +
      '<div class="detail-label">Claiming Schedule:</div>' +
      '<div class="detail-value">' + (getClaimScheduleSpan(request) ? '<strong style="color:#b85c00;">' + escapeHtml(getClaimScheduleSpan(request)) + "</strong>" : '<span style="color:#94a3b8;">Not yet scheduled</span>') + "</div>" +
    "</div>" +

    // Clearance Status Section
    '<div class="view-section-title"><i class="fas fa-check-double"></i> Clearance Status</div>' +
    '<div class="view-clearance-grid">' + clearanceHtml + "</div>" +

    // Overall Status Section
    '<div class="view-section-title"><i class="fas fa-info-circle"></i> Overall Status</div>' +
    '<div class="detail-row">' +
      '<div class="detail-label">Status:</div>' +
      '<div class="detail-value"><span class="badge-status ' + statusClass + '">' + escapeHtml(displayStatus) + "</span></div>" +
    "</div>" +

    // Feedback
    feedbackHtml;

  // Add claim slip button once the request is ready to claim / scheduled
  if (status === "Ready to Claim" || status === "Scheduled for Claiming" || status === "Claimed" || isScheduledReq) {
    detailsHtml += '<div class="text-center mt-3"><button class="btn btn-outline-primary" onclick="printClaimSlip(' + request.request_id + ')"><i class="fas fa-print me-1"></i>Print Claim Slip</button></div>';
  }

  document.getElementById("viewRequestDetails").innerHTML = detailsHtml;

  const viewModal = new bootstrap.Modal(
    document.getElementById("viewRequestModal"),
  );
  viewModal.show();
}

// --- Claiming schedule helpers ---
function formatShortDate(value) {
  if (!value) return "";
  var raw = String(value).trim();
  var d = new Date(raw.length <= 10 ? raw + "T00:00:00" : raw);
  if (isNaN(d)) return raw;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function getClaimScheduleSpan(request) {
  if (!request || !request.claim_schedule_start || !request.claim_schedule_end) return "";
  var start = formatShortDate(request.claim_schedule_start);
  var end = formatShortDate(request.claim_schedule_end);
  if (!start || !end) return "";
  return start === end ? start : start + " \u2013 " + end;
}

// Format documents for display
function formatDocumentsForDisplay(documents) {
  if (!documents) return "No documents selected";

  const docs = [];
  if (documents.tor_purpose && documents.tor_purpose.length > 0) {
    documents.tor_purpose.forEach((p) =>
      docs.push(`<span class="document-tag">TOR: ${escapeHtml(p)}</span>`),
    );
  }
  if (documents.certification && documents.certification.length > 0) {
    documents.certification.forEach((c) =>
      docs.push(`<span class="document-tag">${escapeHtml(c)}</span>`),
    );
  }
  if (documents.diploma && documents.diploma.length > 0) {
    documents.diploma.forEach((d) =>
      docs.push(`<span class="document-tag">Diploma: ${escapeHtml(d)}</span>`),
    );
  }
  if (documents.others && documents.others.trim()) {
    docs.push(`<span class="document-tag">${escapeHtml(documents.others)}</span>`);
  }
  if (documents.cav_overseas) {
    docs.push(
      `<span class="document-tag">CAV Overseas (${escapeHtml(String(documents.cav_copies || 1))} copy)</span>`,
    );
  }

  return docs.join(" ") || "No documents selected";
}

// Print claim slip
function printClaimSlip(requestId) {
  const req = myRequests.find(r => r.request_id == requestId);
  if (!req) return;
  sessionStorage.setItem('claimSlipData', JSON.stringify({
    tracking_number: req.tracking_number || ('#' + req.request_id),
    student_name: req.student_name,
    course_year: req.course_year,
    date_requested: req.date_requested,
    date_released: req.date_released,
    total_price: req.total_price,
    documents: req.documents
  }));
  window.open('/REQUEST/shared/claim_slip.html', '_blank');
}

// Archive (soft delete) a request
function archiveRequest(requestId) {
  Swal.fire({
    title: "Archive Request?",
    text: "This request will be moved to your archived requests.",
    icon: "warning",
    showCancelButton: true,
    confirmButtonColor: "#dc2626",
    cancelButtonColor: "#6c757d",
    confirmButtonText: "Yes, archive it",
  }).then((result) => {
    if (result.isConfirmed) {
      if (typeof showSubmitLoader === "function") {
        showSubmitLoader("Archiving request...");
      } else {
        Swal.fire({
          toast: true,
          position: "bottom-end",
          title: "Archiving...",
          showConfirmButton: false,
          showCancelButton: false,
          allowOutsideClick: false,
          allowEscapeKey: false,
          didOpen: () => Swal.showLoading(),
        });
      }

      axios
        .post(API_BASE_URL + "/archive_request.php", { request_id: requestId })
        .then(function (response) {
          if (response.data.success) {
            Swal.fire({
              title: "Archived!",
              text: "Request has been archived.",
              icon: "success",
              timer: 2000,
              showConfirmButton: false,
            });
            loadMyRequests();
          } else {
            Swal.fire("Error", escapeHtml(response.data.message), "error");
          }
        })
        .catch(function () {
          Swal.fire("Error", "Failed to connect to server", "error");
        });
    }
  });
}
