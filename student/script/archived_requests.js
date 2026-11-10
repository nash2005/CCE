const API_BASE_URL = "../api";

document.addEventListener("DOMContentLoaded", function () {
  loadSidebar();
  loadArchivedRequests();
});

function loadSidebar() {
  const container = document.getElementById("sidebar-container");
  if (!container) return;
  fetch("sidebar.html")
    .then((r) => r.text())
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
        if (link.getAttribute("href") === "archived_requests.html") link.classList.add("active");
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
      var cached = sessionStorage.getItem("studentData");
      if (cached) {
        try {
          var d = JSON.parse(cached);
          var nameEl = document.getElementById("sidebarStudentName");
          if (nameEl) nameEl.textContent = d.student?.full_name || "Student";
        } catch (e) {}
      }
    });
}

function loadArchivedRequests() {
  const tbody = document.getElementById("requestsTableBody");

  axios
    .get(API_BASE_URL + "/get_archived_requests.php")
    .then(function (response) {
      if (response.data.success) {
        displayRequests(response.data.requests);
      } else {
        tbody.innerHTML =
          '<tr><td colspan="6" class="text-center text-danger">' +
          escapeHtml(response.data.message) +
          "</td></tr>";
      }
    })
    .catch(function () {
      tbody.innerHTML =
        '<tr><td colspan="6" class="text-center text-danger">Error loading archived requests.</td></tr>';
    });
}

function displayRequests(requests) {
  const tbody = document.getElementById("requestsTableBody");

  if (!requests || requests.length === 0) {
    tbody.innerHTML =
      '<tr><td colspan="6"><div class="empty-state"><i class="fas fa-archive"></i><p>No archived requests</p></div></td></tr>';
    return;
  }

  let html = "";
  requests.forEach(function (req) {
    const dateRequested =
      req.request_date_formatted ||
      new Date(req.request_date).toLocaleString();
    const status = req.status || "Pending";

    let docTags = "";
    if (req.documents) {
      const docs = [];
      if (req.documents.tor_purpose)
        req.documents.tor_purpose.forEach((p) => docs.push("TOR: " + escapeHtml(p)));
      if (req.documents.certification)
        req.documents.certification.forEach((c) => docs.push(escapeHtml(c)));
      if (req.documents.diploma)
        req.documents.diploma.forEach((d) => docs.push("Diploma: " + escapeHtml(d)));
      if (req.documents.others) docs.push(escapeHtml(req.documents.others));
      if (req.documents.cav_overseas)
        docs.push("CAV Overseas (" + escapeHtml(String(req.documents.cav_copies || 1)) + ")");
      docTags = docs
        .map((d) => '<span class="document-tag">' + d + "</span>")
        .join("");
    }

    let statusClass = "badge-pending";
    if (status === "Ready to Claim") statusClass = "badge-ready";
    else if (status === "Claimed") statusClass = "badge-claimed";
    else if (status === "Rejected") statusClass = "badge-rejected";
    else if (status === "Released") statusClass = "badge-released";

    html +=
      "<tr>" +
      "<td>#" + escapeHtml(String(req.request_id)) + "</td>" +
      "<td>" + escapeHtml(dateRequested) + "</td>" +
      "<td>" + (docTags || "N/A") + "</td>" +
      "<td><strong style='color:#2b3a67;'>₱" + parseFloat(req.total_price || 0).toFixed(2) + "</strong></td>" +
      "<td><span class='badge-status " + statusClass + "'>" + escapeHtml(status) + "</span></td>" +
      "<td><button class='btn-action btn-restore' onclick='restoreRequest(" + (parseInt(req.request_id) || 0) + ")' title='Restore'><i class='fas fa-undo'></i></button></td>" +
      "</tr>";
  });

  tbody.innerHTML = html;
}

function restoreRequest(requestId) {
  Swal.fire({
    title: "Restore Request?",
    text: "This request will be moved back to your active requests.",
    icon: "question",
    showCancelButton: true,
    confirmButtonColor: "#10b981",
    confirmButtonText: "Yes, restore it",
  }).then(function (result) {
    if (result.isConfirmed) {
      axios
        .post(API_BASE_URL + "/restore_request.php", {
          request_id: requestId,
        })
        .then(function (response) {
          if (response.data.success) {
            Swal.fire({
              title: "Restored!",
              text: "Request has been restored.",
              icon: "success",
              timer: 2000,
              showConfirmButton: false,
            });
            loadArchivedRequests();
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
