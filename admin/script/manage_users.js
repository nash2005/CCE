document.addEventListener("DOMContentLoaded", () => {
  loadUsers();
  setupFilterButtons();
  setupFilters();
  setupAddUserModal();
  setupImportModal();
  setupEditUserForm();
  setupAddCourseModal();
});

// ============================================================
// Global state
// ============================================================
let allUsers = [];
let importParsedUsers = []; // validated rows ready for import

// ============================================================
// Load & display users
// ============================================================
function loadUsers() {
  const spinner = document.getElementById("loadingSpinner");
  const tbody = document.getElementById("usersTableBody");
  const userCount = document.getElementById("userCount");
  spinner.classList.add("active");

  axios
    .get("../api/get_users.php")
    .then((res) => {
      spinner.classList.remove("active");
      if (res.data.success && res.data.users.length > 0) {
        allUsers = res.data.users;
        populateCourseFilter();
        displayUsersByRole("all");
      } else {
        tbody.innerHTML = '<tr><td colspan="6" class="empty-state">No users found</td></tr>';
        userCount.textContent = "Total Users: 0";
      }
    })
    .catch(() => {
      spinner.classList.remove("active");
      tbody.innerHTML = '<tr><td colspan="7" class="empty-state">Error loading users</td></tr>';
      userCount.textContent = "Total Users: 0";
    });
}

function displayUsersByRole(role) {
  const tbody = document.getElementById("usersTableBody");
  let filtered = role === "all" ? allUsers.slice() : allUsers.filter((u) => u.user_type === role);
  filtered = applyFilters(filtered);

  const colCount = updateTableHeader(role);

  const countEl = document.getElementById("userCount");
  if (countEl) countEl.textContent = `Showing ${filtered.length} of ${allUsers.length} user${allUsers.length === 1 ? "" : "s"}`;

  if (filtered.length === 0) {
    tbody.innerHTML = `<tr><td colspan="${colCount}" class="empty-state">No ${escapeHtml(role)} users match the current filters</td></tr>`;
    return;
  }

  let html = "";
  filtered.forEach((user) => {
    if (role === "all") html += generateAllUsersRow(user);
    else if (role === "student") html += generateStudentRow(user);
    else if (role === "staff") html += generateStaffRow(user);
    else if (role === "alumni") html += generateAlumniRow(user);
  });
  tbody.innerHTML = html;
}

function updateTableHeader(role) {
  const thead = document.querySelector("#usersTable thead tr");
  const headers = {
    all: "<th>Role</th><th>Name</th><th>ID Number</th><th>Email</th><th>Status</th><th>Actions</th>",
    student: "<th>Student Number</th><th>First Name</th><th>Last Name</th><th>Course</th><th>Year Level</th><th>Actions</th>",
    staff: "<th>First Name</th><th>Last Name</th><th>Employee Number</th><th>Actions</th>",
    alumni: "<th>Student Number</th><th>First Name</th><th>Last Name</th><th>Course</th><th>Graduation Year</th><th>Actions</th>",
  };
  const h = headers[role] || headers.all;
  thead.innerHTML = h;
  return h.split("<th").length - 1;
}

function generateAllUsersRow(u) {
  const sc = u.status === "active" ? "text-success" : "text-danger";
  const name = [u.first_name, u.last_name].filter(Boolean).join(" ");
  return `<tr>
    <td><span class="user-role-badge ${getRoleClass(u.user_type)}">${escapeHtml(capitalize(u.user_type))}</span></td>
    <td>${escapeHtml(name || "N/A")}</td>
    <td>${escapeHtml(u.id_number || "N/A")}</td>
    <td>${escapeHtml(u.email)}</td>
    <td class="${sc}">${escapeHtml(capitalize(u.status))}</td>
    <td>${actionBtns(u)}</td></tr>`;
}
function generateStudentRow(u) {
  return `<tr><td>${escapeHtml(u.id_number||"N/A")}</td><td>${escapeHtml(u.first_name||"N/A")}</td><td>${escapeHtml(u.last_name||"N/A")}</td><td>${escapeHtml(u.course_name||"N/A")}</td><td>${escapeHtml(u.year_level||"N/A")}</td><td>${actionBtns(u, true)}</td></tr>`;
}
function generateStaffRow(u) {
  return `<tr><td>${escapeHtml(u.first_name||"N/A")}</td><td>${escapeHtml(u.last_name||"N/A")}</td><td>${escapeHtml(u.id_number||"N/A")}</td><td>${actionBtns(u)}</td></tr>`;
}
function generateAlumniRow(u) {
  return `<tr><td>${escapeHtml(u.id_number||"N/A")}</td><td>${escapeHtml(u.first_name||"N/A")}</td><td>${escapeHtml(u.last_name||"N/A")}</td><td>${escapeHtml(u.course_name||"N/A")}</td><td>${escapeHtml(u.graduation_year||"N/A")}</td><td>${actionBtns(u)}</td></tr>`;
}

function actionBtns(u, showGrad) {
  let h = `<button class="btn btn-sm btn-outline-primary" onclick="editUser(${parseInt(u.user_id)})"><i class="fas fa-edit"></i></button> `;
  h += `<button class="btn btn-sm btn-outline-danger" onclick="deleteUser(${parseInt(u.user_id)},'${escapeHtml(u.first_name)} ${escapeHtml(u.last_name)}')"><i class="fas fa-trash"></i></button>`;
  if (showGrad) {
    h += ` <button class="btn btn-sm btn-outline-success" onclick="showGraduateModal(${parseInt(u.user_id)},'${escapeHtml(u.first_name)}','${escapeHtml(u.last_name)}','${escapeHtml(u.id_number)}','${escapeHtml(u.course_name)}',${parseInt(u.year_level)})"><i class="fas fa-graduation-cap"></i> Graduate</button>`;
  }
  return h;
}

// ============================================================
// 2-step Add User Modal
// ============================================================
function setupAddUserModal() {
  const modal = new bootstrap.Modal(document.getElementById("addUserModal"));
  const step1 = document.getElementById("addStep1");
  const step2 = document.getElementById("addStep2");

  // Open modal -> always reset to step 1
  document.getElementById("addUserBtn").addEventListener("click", () => {
    showAddStep(1);
    document.getElementById("addUserForm").reset();
    document.getElementById("extraFields").innerHTML = "";
    modal.show();
  });

  // Role card click -> go to step 2
  document.querySelectorAll(".role-card").forEach((card) => {
    card.addEventListener("click", () => {
      document.querySelectorAll(".role-card").forEach((c) => c.classList.remove("selected"));
      card.classList.add("selected");
      const role = card.dataset.role;
      document.getElementById("userRole").value = role;
      document.getElementById("selectedRoleLabel").textContent = capitalize(role);
      buildAddExtraFields(role);
      showAddStep(2);
    });
  });

  // Back button
  document.getElementById("addBackBtn").addEventListener("click", () => showAddStep(1));

  // Submit
  document.getElementById("addUserForm").addEventListener("submit", (e) => {
    e.preventDefault();
    const role = document.getElementById("userRole").value;
    const data = {
      first_name: document.getElementById("userFirstName").value.trim(),
      last_name: document.getElementById("userLastName").value.trim(),
      email: document.getElementById("userEmail").value.trim(),
      password: document.getElementById("userPassword").value,
      role: role,
      extra: {},
    };

    if (role === "student") {
      data.extra.student_number = document.getElementById("studentNumber").value.trim();
      data.extra.course_id = document.getElementById("studentCourse").value;
      data.extra.year_level = document.getElementById("yearLevel").value;
    } else if (role === "alumni") {
      data.extra.student_number = document.getElementById("studentNumber").value.trim();
      data.extra.course_id = document.getElementById("alumniCourse").value;
      data.extra.graduation_year = document.getElementById("graduationYear").value;
    } else if (role === "staff") {
      data.extra.employee_number = document.getElementById("employeeNumber").value.trim();
    }

    axios.post("../api/add_user.php", data).then((res) => {
      if (res.data.success) {
        Swal.fire("Success", res.data.message, "success");
        modal.hide();
        loadUsers();
      } else {
        Swal.fire("Error", res.data.message, "error");
      }
    }).catch(() => Swal.fire("Error", "Something went wrong", "error"));
  });
}

function showAddStep(step) {
  const s1 = document.getElementById("addStep1");
  const s2 = document.getElementById("addStep2");
  const dot1 = document.getElementById("stepDot1");
  const dot2 = document.getElementById("stepDot2");
  const lbl1 = document.getElementById("stepLabel1");
  const lbl2 = document.getElementById("stepLabel2");
  const line = document.getElementById("stepLine");

  if (step === 1) {
    s1.style.display = "";
    s2.style.display = "none";
    dot1.className = "step-dot active";
    dot1.innerHTML = "1";
    dot2.className = "step-dot";
    lbl1.className = "step-label active";
    lbl2.className = "step-label";
    line.className = "step-line";
  } else {
    s1.style.display = "none";
    s2.style.display = "";
    dot1.className = "step-dot done";
    dot1.innerHTML = '<i class="fas fa-check" style="font-size:0.75rem;"></i>';
    dot2.className = "step-dot active";
    lbl1.className = "step-label";
    lbl2.className = "step-label active";
    line.className = "step-line active";
  }
}

function buildAddExtraFields(role) {
  const ef = document.getElementById("extraFields");
  ef.innerHTML = "";

  if (role === "student") {
    ef.innerHTML = `
      <div class="row g-3">
        <div class="col-sm-6"><label class="form-label">Student Number <span class="text-danger">*</span></label><input type="text" class="form-control" id="studentNumber" required></div>
        <div class="col-sm-6"><label class="form-label">Year Level <span class="text-danger">*</span></label>
          <select class="form-select" id="yearLevel" required><option value="1">1st Year</option><option value="2">2nd Year</option><option value="3">3rd Year</option><option value="4">4th Year</option><option value="5">5th Year</option></select></div>
      </div>
      <div class="mt-3"><label class="form-label">Course <span class="text-danger">*</span></label><select class="form-select" id="studentCourse" required></select></div>`;
    loadCoursesIntoSelect("studentCourse");
  } else if (role === "alumni") {
    ef.innerHTML = `
      <div class="row g-3">
        <div class="col-sm-6"><label class="form-label">Student Number <span class="text-danger">*</span></label><input type="text" class="form-control" id="studentNumber" required></div>
        <div class="col-sm-6"><label class="form-label">Graduation Year <span class="text-danger">*</span></label><input type="number" class="form-control" id="graduationYear" value="${new Date().getFullYear()}" required></div>
      </div>
      <div class="mt-3"><label class="form-label">Course <span class="text-danger">*</span></label><select class="form-select" id="alumniCourse" required></select></div>`;
    loadCoursesIntoSelect("alumniCourse");
  } else if (role === "staff") {
    ef.innerHTML = `<div class="mt-0"><label class="form-label">Employee Number <span class="text-danger">*</span></label><input type="text" class="form-control" id="employeeNumber" required></div>`;
  }
}

// ============================================================
// Import from Excel
// ============================================================
const IMPORT_COLUMNS = {
  student: { required: ["first_name", "last_name", "email", "password", "student_number", "course", "year_level"], label: "Student" },
  alumni:  { required: ["first_name", "last_name", "email", "password", "student_number", "course", "graduation_year"], label: "Alumni" },
  staff:   { required: ["first_name", "last_name", "email", "password", "employee_number"], label: "Staff" },
};

// Alternate header labels (from external/other-system Excel files) accepted for each
// required column. Values are in normalized form (see normalizeHeader): lowercase,
// spaces/dashes -> "_", symbols stripped.
const HEADER_ALIASES = {
  student: {
    first_name: ["firstname", "fname", "givenname", "given_name"],
    last_name: ["lastname", "lname", "surname", "familyname", "family_name"],
    email: ["emailaddress", "email_address"],
    password: ["pass"],
    student_number: ["idnumber", "id_number", "id_no", "idno", "studentno", "student_no", "studentnum", "studentnumber", "studentid", "student_id"],
    course: ["program", "courseprogram", "course_program", "coursename", "course_name"],
    year_level: ["yearlevel", "year", "yrlevel", "year_lvl"],
  },
  alumni: {
    first_name: ["firstname", "fname", "givenname", "given_name"],
    last_name: ["lastname", "lname", "surname", "familyname", "family_name"],
    email: ["emailaddress", "email_address"],
    password: ["pass"],
    student_number: ["idnumber", "id_number", "id_no", "idno", "studentno", "student_no", "studentnum", "studentnumber", "studentid", "student_id"],
    course: ["program", "courseprogram", "course_program", "coursename", "course_name"],
    graduation_year: ["graduationyear", "gradyear", "year_graduated", "batch"],
  },
  staff: {
    first_name: ["firstname", "fname", "givenname", "given_name"],
    last_name: ["lastname", "lname", "surname", "familyname", "family_name"],
    email: ["emailaddress", "email_address"],
    password: ["pass"],
    employee_number: ["employeenumber", "emp_no", "empno", "employee_no", "employeeid", "employee_id"],
  },
};

function setupImportModal() {
  const modal = new bootstrap.Modal(document.getElementById("importUserModal"));
  const roleSelect = document.getElementById("importRole");
  const guideDiv = document.getElementById("importColumnGuide");
  const uploadSection = document.getElementById("importUploadSection");
  const dropzone = document.getElementById("importDropzone");
  const fileInput = document.getElementById("importFileInput");

  document.getElementById("importUserBtn").addEventListener("click", () => {
    resetImportModal();
    modal.show();
  });

  // Role selection -> show columns + upload
  roleSelect.addEventListener("change", () => {
    const role = roleSelect.value;
    if (!role) {
      guideDiv.style.display = "none";
      uploadSection.style.display = "none";
      return;
    }
    const cols = IMPORT_COLUMNS[role].required;
    const mayCols = ["password", "year_level"];
    const mustCols = cols.filter((c) => !mayCols.includes(c));
    const chip = (c) => '<code style="background:#d1fae5;padding:0.1rem 0.4rem;border-radius:3px;margin:0.15rem;display:inline-block;">' + escapeHtml(c) + "</code>";
    let info = "<strong>Required columns (first row):</strong><br>" + mustCols.map(chip).join(" ");
    if (cols.some((c) => mayCols.includes(c))) {
      info += "<br><strong>Optional (auto-filled when missing):</strong><br>" + mayCols.filter((c) => cols.includes(c)).map(chip).join(" ");
    }
    info += '<br><small class="text-muted mt-1 d-block">Extra columns are ignored. Column order does not matter. The header row is auto-detected (a title/logo row above it is skipped). Alternate labels are recognized (e.g. <code>Idnumber</code>, <code>Fullname</code>, <code>Emailaddress</code>). A combined <code>Fullname</code> column is split automatically. Rows with a blank email still import &mdash; a temporary email is auto-assigned so the student can log in and update it later from their profile. If there is no <code>password</code> column, the default password is <code>CCE#2024</code>. You can change each row&rsquo;s year level (1&ndash;5) in the preview before importing, or use <strong>Apply to all</strong> to set the same year for every row.</small>';
    document.getElementById("importColumnsInfo").innerHTML = info;
    guideDiv.style.display = "";
    uploadSection.style.display = "";
    // reset file & preview
    fileInput.value = "";
    document.getElementById("importPreview").style.display = "none";
    document.getElementById("importFooter").style.display = "none";
    dropzone.querySelector("i").className = "fas fa-cloud-upload-alt d-block";
    dropzone.classList.remove("has-file");
    dropzone.querySelector("p").innerHTML = 'Drag & drop your <strong>.xlsx</strong> or <strong>.xls</strong> file here';
  });

  // Dropzone click
  dropzone.addEventListener("click", () => fileInput.click());

  // Drag & drop
  dropzone.addEventListener("dragover", (e) => { e.preventDefault(); dropzone.classList.add("drag-over"); });
  dropzone.addEventListener("dragleave", () => dropzone.classList.remove("drag-over"));
  dropzone.addEventListener("drop", (e) => {
    e.preventDefault();
    dropzone.classList.remove("drag-over");
    if (e.dataTransfer.files.length) handleImportFile(e.dataTransfer.files[0]);
  });

  fileInput.addEventListener("change", () => {
    if (fileInput.files.length) handleImportFile(fileInput.files[0]);
  });

  document.getElementById("importChangeFile").addEventListener("click", () => {
    fileInput.value = "";
    document.getElementById("importPreview").style.display = "none";
    document.getElementById("importFooter").style.display = "none";
    document.getElementById("importStep1").style.display = "";
    dropzone.querySelector("i").className = "fas fa-cloud-upload-alt d-block";
    dropzone.classList.remove("has-file");
    dropzone.querySelector("p").innerHTML = 'Drag & drop your <strong>.xlsx</strong> or <strong>.xls</strong> file here';
  });

  // Submit import
  document.getElementById("importSubmitBtn").addEventListener("click", submitImport);

  // Editable year level (1-5) inside the preview table
  document.getElementById("importPreviewTable").addEventListener("change", (e) => {
    if (e.target && e.target.classList && e.target.classList.contains("year-level-select")) {
      const idx = parseInt(e.target.getAttribute("data-idx"), 10);
      if (importParsedUsers[idx]) importParsedUsers[idx].data.year_level = e.target.value;
    }
  });

  // Apply one year level to every row at once
  document.getElementById("importSetAllBtn").addEventListener("click", () => {
    const year = document.getElementById("importSetAllYear").value;
    if (!year || !importParsedUsers.length) return;
    importParsedUsers.forEach((u) => { u.data.year_level = year; });
    document.getElementById("importSetAllYear").value = "";
    const role = document.getElementById("importRole").value;
    const errorCount = importParsedUsers.filter((u) => u.errors.length > 0).length;
    renderImportPreview(role, errorCount);
  });
}

function resetImportModal() {
  document.getElementById("importRole").value = "";
  document.getElementById("importColumnGuide").style.display = "none";
  document.getElementById("importUploadSection").style.display = "none";
  document.getElementById("importPreview").style.display = "none";
  document.getElementById("importFooter").style.display = "none";
  document.getElementById("importStep1").style.display = "";
  document.getElementById("importFileInput").value = "";
  importParsedUsers = [];
}

function handleImportFile(file) {
  const role = document.getElementById("importRole").value;
  if (!role) return;

  const dropzone = document.getElementById("importDropzone");
  dropzone.classList.add("has-file");
  dropzone.querySelector("i").className = "fas fa-file-excel d-block";
  dropzone.querySelector("p").innerHTML = '<span class="file-name">' + escapeHtml(file.name) + "</span>";

  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const wb = XLSX.read(e.target.result, { type: "array" });
      const sheet = wb.Sheets[wb.SheetNames[0]];
      const grid = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" });
      if (!grid.length) {
        Swal.fire("Empty file", "The Excel file has no data rows.", "warning");
        return;
      }

      // Some client files have a title/instructions row above the real column
      // headers, so detect the row that actually contains the headers.
      const headerIdx = findHeaderRowIndex(grid, role);
      const keys = grid[headerIdx];

      // Rebuild the data rows as objects keyed by the detected header names.
      const rows = [];
      for (let i = headerIdx + 1; i < grid.length; i++) {
        const row = grid[i] || [];
        const hasData = row.some((cell) => String(cell || "").trim() !== "");
        if (!hasData) continue; // skip blank rows
        const obj = {};
        keys.forEach((k, c) => { obj[k] = row[c] !== undefined && row[c] !== null ? String(row[c]) : ""; });
        rows.push(obj);
      }

      if (!rows.length) {
        Swal.fire("Empty file", "The Excel file has no data rows after the header row.", "warning");
        return;
      }
      processImportRows(rows, role);
    } catch (err) {
      Swal.fire("Parse error", "Could not read the Excel file. Make sure it is a valid .xlsx or .xls.", "error");
    }
  };
  reader.readAsArrayBuffer(file);
}

// Find the row that contains the column headers: the first row with the most
// recognized column labels. Falls back to row 0 when nothing is recognized so
// processImportRows can still show helpful "missing columns" guidance.
function findHeaderRowIndex(grid, role) {
  const tokens = recognizedHeaderTokens(role);
  let bestIdx = 0;
  let bestScore = -1;
  grid.forEach((row, idx) => {
    let score = 0;
    row.forEach((cell) => {
      if (cell !== undefined && cell !== null && tokens.has(normalizeHeader(String(cell)))) score++;
    });
    if (score > bestScore) { bestScore = score; bestIdx = idx; }
  });
  return bestIdx;
}

// Every accepted header label for the given role, in normalized form.
function recognizedHeaderTokens(role) {
  const tokens = new Set();
  const cols = IMPORT_COLUMNS[role].required;
  cols.forEach((c) => tokens.add(c));
  tokens.add("fullname");
  tokens.add("full_name");
  const aliases = HEADER_ALIASES[role] || {};
  cols.forEach((c) => (aliases[c] || []).forEach((a) => tokens.add(a)));
  return tokens;
}

function normalizeHeader(h) {
  return String(h).toLowerCase().trim().replace(/[\s\-]+/g, "_").replace(/[^a-z0-9_]/g, "");
}

// Resolve an actual Excel header to a required column key (or "fullname" for a
// combined name column). Exact names work first, then known alternate labels.
function resolveHeader(header, role) {
  const h = normalizeHeader(header);

  if (h === "fullname" || h === "full_name") return "fullname";

  const reqCols = IMPORT_COLUMNS[role].required;
  if (reqCols.includes(h)) return h;

  const aliases = HEADER_ALIASES[role] || {};
  for (const col of reqCols) {
    if ((aliases[col] || []).includes(h)) return col;
  }
  return null;
}

// Split a combined name column into first/last. Supports:
//   "Lastname, Firstname Middlename"   and   "Firstname Middlename Lastname"
function splitFullName(full) {
  if (!full) return { first_name: "", last_name: "" };
  const comma = full.indexOf(",");
  if (comma !== -1) {
    return { last_name: full.slice(0, comma).trim(), first_name: full.slice(comma + 1).trim() };
  }
  const parts = full.trim().split(/\s+/);
  const last = parts.pop() || "";
  return { first_name: parts.join(" "), last_name: last };
}

function processImportRows(rows, role) {
  const reqCols = IMPORT_COLUMNS[role].required;

  // Map actual headers to our expected keys (exact names and alternate labels)
  const actualHeaders = Object.keys(rows[0]);
  const headerMap = {};
  let fullNameHeader = null;
  actualHeaders.forEach((h) => {
    const key = resolveHeader(h, role);
    if (key === "fullname") {
      if (!fullNameHeader) fullNameHeader = h;
    } else if (key && !headerMap[key]) {
      headerMap[key] = h;
    }
  });

  // If first/last names only exist as a combined "fullname" column, use it for both.
  if (fullNameHeader && (!headerMap.first_name || !headerMap.last_name)) {
    if (!headerMap.first_name) headerMap.first_name = fullNameHeader;
    if (!headerMap.last_name) headerMap.last_name = fullNameHeader;
  }

  // Columns that get a safe default when the file has no such column at all:
  // password -> derived from the ID/employee number; year_level -> 1.
  const optionalCols = ["password", "year_level"];

  const missingCols = reqCols.filter((c) => !headerMap[c] && !optionalCols.includes(c));
  if (missingCols.length) {
    Swal.fire("Missing columns", "Your Excel is missing these required columns:<br><strong>" + missingCols.join(", ") + "</strong>", "error");
    return;
  }

  // Parse and validate each row
  importParsedUsers = [];
  let errorCount = 0;

  rows.forEach((row, idx) => {
    const mapped = {};
    reqCols.forEach((col) => { mapped[col] = String(row[headerMap[col]] || "").trim(); });

    // Combined "fullname" column -> split into first_name / last_name
    const full = fullNameHeader ? String(row[fullNameHeader] || "").trim() : "";
    if (full) {
      const sameSource = headerMap.first_name && headerMap.first_name === headerMap.last_name;
      const parts = splitFullName(full);
      if (sameSource) {
        mapped.first_name = parts.first_name;
        mapped.last_name = parts.last_name;
      } else {
        if (!mapped.first_name) mapped.first_name = parts.first_name;
        if (!mapped.last_name) mapped.last_name = parts.last_name;
      }
    }

    // No password column in the file? Default to "CCE#2024" so students can
    // log in and change it later from their profile.
    if (!mapped.password) {
      mapped.password = "CCE#2024";
    }

    // No year_level column in the file? Default to 1.
    if (!headerMap.year_level) {
      mapped.year_level = mapped.year_level || "1";
    }

    const errors = [];
    if (!mapped.first_name) errors.push("missing first_name");
    if (!mapped.last_name) errors.push("missing last_name");

    importParsedUsers.push({ data: mapped, row: idx + 2, errors: errors });
    if (errors.length) errorCount++;
  });

  renderImportPreview(role, errorCount);
}

function renderImportPreview(role, errorCount) {
  const reqCols = IMPORT_COLUMNS[role].required;
  const total = importParsedUsers.length;
  const valid = total - errorCount;

  document.getElementById("importStep1").style.display = "none";
  document.getElementById("importPreview").style.display = "";
  document.getElementById("importFooter").style.display = "";

  document.getElementById("importTotalBadge").textContent = total + " users";
  document.getElementById("importValidBadge").textContent = valid + " valid";
  const errBadge = document.getElementById("importErrorBadge");
  if (errorCount > 0) { errBadge.textContent = errorCount + " errors"; errBadge.style.display = ""; }
  else { errBadge.style.display = "none"; }

  document.getElementById("importCountLabel").textContent = valid;
  document.getElementById("importSubmitBtn").disabled = valid === 0;

  // Show/hide the "Set all Year Levels" quick action (only for roles that have year_level)
  const setAllRow = document.getElementById("importSetAllRow");
  if (setAllRow) setAllRow.style.display = reqCols.includes("year_level") ? "" : "none";

  // Build preview table
  let html = '<table class="table table-sm table-bordered"><thead><tr><th>#</th>';
  reqCols.forEach((c) => { html += "<th>" + escapeHtml(c) + "</th>"; });
  html += "<th>Status</th></tr></thead><tbody>";

  importParsedUsers.forEach((item, idx) => {
    const hasErr = item.errors.length > 0;
    html += '<tr class="' + (hasErr ? "table-danger" : "") + '">';
    html += "<td>" + item.row + "</td>";
    reqCols.forEach((c) => {
      let val = item.data[c];
      if (c === "password" && val) val = "••••";
      if (c === "year_level") {
        const current = String(val || "1");
        let opts = "";
        for (let y = 1; y <= 5; y++) {
          const sel = current === String(y) ? " selected" : "";
          opts += '<option value="' + y + '"' + sel + ">" + y + "</option>";
        }
        html += '<td><select class="form-select form-select-sm year-level-select" data-idx="' + idx + '">' + opts + "</select></td>";
      } else {
        html += "<td>" + escapeHtml(val || "") + "</td>";
      }
    });
    html += "<td>" + (hasErr ? '<span class="text-danger" title="' + escapeHtml(item.errors.join(", ")) + '"><i class="fas fa-exclamation-circle"></i> ' + escapeHtml(item.errors.join(", ")) + "</span>" : '<span class="text-success"><i class="fas fa-check-circle"></i></span>') + "</td>";
    html += "</tr>";
  });
  html += "</tbody></table>";
  document.getElementById("importPreviewTable").innerHTML = html;
}

const IMPORT_CHUNK_SIZE = 100;

function submitImport() {
  const role = document.getElementById("importRole").value;
  const validUsers = importParsedUsers.filter((u) => u.errors.length === 0);

  if (!validUsers.length) {
    Swal.fire("No valid users", "There are no valid rows to import.", "warning");
    return;
  }

  const btn = document.getElementById("importSubmitBtn");
  const total = validUsers.length;
  btn.disabled = true;

  let imported = 0;
  let skipped = 0;
  let sent = 0;

  const progress = () => {
    btn.innerHTML = '<i class="fas fa-spinner fa-spin me-1"></i> Importing... ' + sent + "/" + total;
  };

  // Send in small sequential batches so large imports (thousands of students)
  // do not exceed the PHP execution time limit on shared hosting. Each batch
  // is its own request/transaction.
  const sendBatch = (start) =>
    axios
      .post("../api/import_users.php", {
        role: role,
        users: validUsers.slice(start, start + IMPORT_CHUNK_SIZE).map((u) => u.data),
      })
      .then((res) => {
        if (res.data.success) {
          imported += res.data.imported || 0;
          skipped += res.data.skipped || 0;
        } else {
          throw new Error(res.data.message || "Import failed");
        }
      });

  (async () => {
    try {
      for (let start = 0; start < total; start += IMPORT_CHUNK_SIZE) {
        sent = Math.min(start + IMPORT_CHUNK_SIZE, total);
        progress();
        await sendBatch(start);
      }
      btn.disabled = false;
      btn.innerHTML = '<i class="fas fa-file-import me-1"></i> Import <span id="importCountLabel">' + total + "</span> Users";
      const skippedMsg = skipped > 0 ? `<br>${skipped} skipped (duplicate email).` : "";
      Swal.fire("Import Complete", `${imported} of ${total} users imported successfully.${skippedMsg}`, "success");
      bootstrap.Modal.getInstance(document.getElementById("importUserModal")).hide();
      loadUsers();
    } catch (err) {
      btn.disabled = false;
      btn.innerHTML = '<i class="fas fa-file-import me-1"></i> Import';
      const partial = imported > 0 ? `<br>${imported} users were already imported before the error, so please re-import only the remaining rows.` : "";
      Swal.fire("Error", (err && err.message ? err.message : "Something went wrong during import") + partial, "error");
    }
  })();
}

// ============================================================
// Graduate Student
// ============================================================
function showGraduateModal(userId, firstName, lastName, studentNumber, course, yearLevel) {
  const existing = document.getElementById("graduateModal");
  if (existing) existing.remove();

  document.body.insertAdjacentHTML("beforeend", `
    <div class="modal fade" id="graduateModal" tabindex="-1">
      <div class="modal-dialog"><div class="modal-content">
        <div class="modal-header"><h5 class="modal-title">Graduate Student</h5><button type="button" class="btn-close" data-bs-dismiss="modal"></button></div>
        <div class="modal-body">
          <div class="mb-3"><label class="form-label">Student Information</label>
            <div class="form-control bg-light"><strong>Name:</strong> ${escapeHtml(firstName)} ${escapeHtml(lastName)}<br><strong>Student Number:</strong> ${escapeHtml(studentNumber)}<br><strong>Course:</strong> ${escapeHtml(course)}<br><strong>Year Level:</strong> ${escapeHtml(String(yearLevel))}</div></div>
          <div class="mb-3"><label for="graduationYear" class="form-label">Graduation Year *</label><input type="number" class="form-control" id="graduationYear" min="2000" max="2040" value="${new Date().getFullYear()}" required></div>
        </div>
        <div class="modal-footer"><button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button>
          <button type="button" class="btn btn-success" onclick="graduateStudent(${parseInt(userId)})"><i class="fas fa-graduation-cap"></i> Graduate Student</button></div>
      </div></div>
    </div>`);
  new bootstrap.Modal(document.getElementById("graduateModal")).show();
}

function graduateStudent(userId) {
  const year = document.getElementById("graduationYear").value;
  if (!year) { Swal.fire("Error", "Please enter graduation year", "error"); return; }

  Swal.fire({
    title: "Graduate Student?", text: "This will move the student to Alumni", icon: "question",
    showCancelButton: true, confirmButtonText: "Yes, Graduate",
    preConfirm: () => axios.post("../api/graduate_student.php", { user_id: userId, graduation_year: year }).then((r) => r.data).catch((e) => Swal.showValidationMessage(e)),
  }).then((result) => {
    if (result.isConfirmed && result.value.success) {
      Swal.fire("Graduated!", "Student is now Alumni", "success");
      bootstrap.Modal.getInstance(document.getElementById("graduateModal")).hide();
      loadUsers();
    }
  });
}

// ============================================================
// Filter buttons
// ============================================================
function setupFilterButtons() {
  const buttons = document.querySelectorAll(".filter-btn");
  buttons.forEach((btn) => {
    btn.addEventListener("click", () => {
      buttons.forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      displayUsersByRole(btn.dataset.role);
    });
  });
}

// ============================================================
// Search / Course / Year level filters
// ============================================================
function applyFilters(list) {
  const q = ((document.getElementById("userSearchInput") || {}).value || "").trim().toLowerCase();
  const cid = (document.getElementById("userCourseFilter") || {}).value || "";
  const yr = (document.getElementById("userYearFilter") || {}).value || "";

  if (q) {
    list = list.filter((u) =>
      ((u.first_name || "") + " " + (u.last_name || "")).toLowerCase().includes(q) ||
      (u.email || "").toLowerCase().includes(q) ||
      (u.id_number || "").toLowerCase().includes(q)
    );
  }
  if (cid) list = list.filter((u) => String(u.course_id || "") === String(cid));
  if (yr) list = list.filter((u) => String(u.year_level || "") === String(yr));
  return list;
}

function setupFilters() {
  const search = document.getElementById("userSearchInput");
  const courseSel = document.getElementById("userCourseFilter");
  const yearSel = document.getElementById("userYearFilter");
  const clearBtn = document.getElementById("clearUserFiltersBtn");
  if (!search || !courseSel || !yearSel) return;

  const refresh = () => {
    const active = document.querySelector(".filter-btn.active");
    displayUsersByRole(active ? active.dataset.role : "all");
  };

  search.addEventListener("input", refresh);
  courseSel.addEventListener("change", refresh);
  yearSel.addEventListener("change", refresh);
  if (clearBtn) {
    clearBtn.addEventListener("click", () => {
      search.value = "";
      courseSel.value = "";
      yearSel.value = "";
      refresh();
    });
  }
}

function populateCourseFilter() {
  const courseSel = document.getElementById("userCourseFilter");
  if (!courseSel) return;
  const seen = {};
  const prev = courseSel.value;
  courseSel.innerHTML = '<option value="">All Courses</option>';
  (allUsers || []).forEach((u) => {
    if (u.course_id && !seen[String(u.course_id)]) {
      seen[String(u.course_id)] = true;
      const opt = document.createElement("option");
      opt.value = u.course_id;
      opt.textContent = u.course_name;
      courseSel.appendChild(opt);
    }
  });
  if (prev && [...courseSel.options].some((o) => o.value === prev)) courseSel.value = prev;
  else courseSel.value = "";
}

// ============================================================
// Delete user
// ============================================================
function deleteUser(userId, userName) {
  Swal.fire({
    title: `Delete ${userName}?`, icon: "warning", showCancelButton: true, confirmButtonText: "Yes, delete!",
    preConfirm: () => axios.post("../api/soft_delete_user.php", { user_id: userId }).then((r) => r.data).catch((e) => Swal.showValidationMessage(e)),
  }).then((result) => {
    if (result.isConfirmed && result.value.success) { Swal.fire("Deleted!", "User deleted", "success"); loadUsers(); }
  });
}

// ============================================================
// Edit user
// ============================================================
function editUser(userId) {
  var user = allUsers.find((u) => parseInt(u.user_id) === userId);
  if (!user) { Swal.fire("Error", "User not found", "error"); return; }

  document.getElementById("editUserId").value = user.user_id;
  document.getElementById("editUserRole").value = user.user_type;
  document.getElementById("editFirstName").value = user.first_name || "";
  document.getElementById("editLastName").value = user.last_name || "";
  document.getElementById("editEmail").value = user.email || "";
  document.getElementById("editPassword").value = "";

  var extra = document.getElementById("editExtraFields");
  extra.innerHTML = "";

  if (user.user_type === "student") {
    extra.innerHTML =
      '<div class="mb-3"><label class="form-label">Student Number</label><input type="text" class="form-control" id="editStudentNumber" value="' + escapeHtml(user.id_number || "") + '"></div>' +
      '<div class="mb-3"><label class="form-label">Course</label><select class="form-select" id="editCourse"></select></div>' +
      '<div class="mb-3"><label class="form-label">Year Level</label><select class="form-select" id="editYearLevel">' +
      [1,2,3,4,5].map((y) => '<option value="'+y+'"'+(user.year_level==y?' selected':'')+'>'+y+["st","nd","rd","th","th"][y-1]+' Year</option>').join("") + "</select></div>";
    loadCoursesIntoSelect("editCourse", user.course_id);
  } else if (user.user_type === "staff") {
    extra.innerHTML = '<div class="mb-3"><label class="form-label">Employee Number</label><input type="text" class="form-control" id="editEmployeeNumber" value="' + escapeHtml(user.id_number || "") + '"></div>';
  } else if (user.user_type === "alumni") {
    extra.innerHTML =
      '<div class="mb-3"><label class="form-label">Course</label><select class="form-select" id="editAlumniCourse"></select></div>' +
      '<div class="mb-3"><label class="form-label">Graduation Year</label><input type="number" class="form-control" id="editGraduationYear" min="2000" max="2040" value="' + escapeHtml(String(user.graduation_year || "")) + '"></div>';
    loadCoursesIntoSelect("editAlumniCourse", user.course_id);
  }

  new bootstrap.Modal(document.getElementById("editUserModal")).show();
}

function setupEditUserForm() {
  document.getElementById("editUserForm").addEventListener("submit", (e) => {
    e.preventDefault();
    const role = document.getElementById("editUserRole").value;
    const data = {
      user_id: document.getElementById("editUserId").value,
      first_name: document.getElementById("editFirstName").value,
      last_name: document.getElementById("editLastName").value,
      email: document.getElementById("editEmail").value,
    };
    const pw = document.getElementById("editPassword").value;
    if (pw) data.password = pw;

    if (role === "student") {
      data.student_number = document.getElementById("editStudentNumber").value;
      data.course_id = document.getElementById("editCourse").value;
      data.year_level = document.getElementById("editYearLevel").value;
    } else if (role === "staff") {
      data.employee_number = document.getElementById("editEmployeeNumber").value;
    } else if (role === "alumni") {
      data.course_id = document.getElementById("editAlumniCourse").value;
      data.graduation_year = document.getElementById("editGraduationYear").value;
    }

    axios.post("../api/edit_user.php", data).then((res) => {
      if (res.data.success) {
        Swal.fire("Success", res.data.message, "success");
        bootstrap.Modal.getInstance(document.getElementById("editUserModal")).hide();
        loadUsers();
      } else { Swal.fire("Error", res.data.message, "error"); }
    }).catch(() => Swal.fire("Error", "Something went wrong", "error"));
  });
}

// ============================================================
// Helpers
// ============================================================
function loadCoursesIntoSelect(selectId, selectedId) {
  axios.get("../api/get_courses.php").then((res) => {
    if (!res.data.success) return;
    const sel = document.getElementById(selectId);
    if (!sel) return;
    sel.innerHTML = '<option value="">Select Course</option>';
    res.data.courses.forEach((c) => {
      const opt = document.createElement("option");
      opt.value = c.course_id;
      opt.textContent = c.course_name;
      if (selectedId && String(c.course_id) === String(selectedId)) opt.selected = true;
      sel.appendChild(opt);
    });
  });
}

function capitalize(s) { return s ? s.charAt(0).toUpperCase() + s.slice(1) : ""; }
function getRoleClass(t) { return { student: "role-student", alumni: "role-alumni", staff: "role-staff" }[t] || "role-admin"; }

// ============================================================
// Add Course Modal
// ============================================================
function setupAddCourseModal() {
  const modal = new bootstrap.Modal(document.getElementById("addCourseModal"));

  document.getElementById("addCourseBtn").addEventListener("click", () => {
    loadCourseList();
    document.getElementById("addCourseForm").reset();
    modal.show();
  });

  document.getElementById("addCourseForm").addEventListener("submit", (e) => {
    e.preventDefault();
    const courseName = document.getElementById("courseName").value.trim();
    if (!courseName) return;

    axios.post("../api/add_course.php", { course_name: courseName }).then((res) => {
      if (res.data.success) {
        Swal.fire("Success", res.data.message, "success");
        document.getElementById("addCourseForm").reset();
        loadCourseList();
      } else {
        Swal.fire("Error", res.data.message, "error");
      }
    }).catch(() => Swal.fire("Error", "Something went wrong", "error"));
  });
}

function loadCourseList() {
  axios.get("../api/get_courses.php").then((res) => {
    const list = document.getElementById("courseList");
    if (res.data.success && res.data.courses.length > 0) {
      list.innerHTML = res.data.courses.map((c) =>
        '<li class="list-group-item">' + escapeHtml(c.course_name) + '</li>'
      ).join("");
    } else {
      list.innerHTML = '<li class="list-group-item text-muted">No courses found</li>';
    }
  });
}

// ============================================================
// Sidebar loader
// ============================================================
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
      if (link.getAttribute("href") === "manage_users.html") link.classList.add("active");
    });
    var logoutBtn = document.getElementById("logoutBtnTopbar");
    if (logoutBtn)
      logoutBtn.addEventListener("click", function (e) {
        e.preventDefault();
        if (window.appLogout) window.appLogout("../api/logout.php");
        else { sessionStorage.clear(); window.location.href = "../../index.php"; }
      });
  });
