document.addEventListener("DOMContentLoaded", () => {
  loadDocuments();
  setupFilterButtons();
  setupAddDocument();
});

let allDocuments = [];
let documentTypes = [];
let currentFilter = "all";

function loadDocuments() {
  var spinner = document.getElementById("loadingSpinner");
  var tbody = document.getElementById("documentsTableBody");
  var docCount = document.getElementById("docCount");
  spinner.classList.add("active");

  axios
    .get("../api/get_documents.php", { params: { type: currentFilter } })
    .then(function (res) {
      spinner.classList.remove("active");
      if (res.data.success) {
        allDocuments = res.data.documents;
        documentTypes = res.data.types;
        displayDocuments(allDocuments);
        docCount.textContent = "Total Documents: " + allDocuments.length;
        populateTypeDropdown();
      } else {
        tbody.innerHTML =
          '<tr><td colspan="5" class="empty-state">Error loading documents</td></tr>';
        docCount.textContent = "Total Documents: 0";
      }
    })
    .catch(function () {
      spinner.classList.remove("active");
      tbody.innerHTML =
        '<tr><td colspan="5" class="empty-state">Error loading documents</td></tr>';
      docCount.textContent = "Total Documents: 0";
    });
}

function displayDocuments(docs) {
  var tbody = document.getElementById("documentsTableBody");

  if (docs.length === 0) {
    tbody.innerHTML =
      '<tr><td colspan="5" class="empty-state">No documents found</td></tr>';
    return;
  }

  var html = "";
  docs.forEach(function (doc, index) {
    var typeClass = "type-" + doc.type_name;
    var typeLabel = doc.type_name.toUpperCase();
    if (doc.type_name === "certification") typeLabel = "Certification";

    html +=
      "<tr>" +
      "<td>" + (index + 1) + "</td>" +
      "<td>" + escapeHtml(doc.document_name) + "</td>" +
      '<td><span class="type-badge ' + typeClass + '">' + typeLabel + "</span></td>" +
      "<td>₱" + parseFloat(doc.price).toFixed(2) + "</td>" +
      '<td><button class="btn btn-sm btn-outline-primary" onclick="openEditPrice(' + parseInt(doc.document_id) + ')"><i class="fas fa-edit"></i></button></td>' +
      "</tr>";
  });

  tbody.innerHTML = html;
}

function setupFilterButtons() {
  var buttons = document.querySelectorAll(".filter-btn");
  buttons.forEach(function (btn) {
    btn.addEventListener("click", function () {
      buttons.forEach(function (b) { b.classList.remove("active"); });
      btn.classList.add("active");
      currentFilter = btn.dataset.type;
      loadDocuments();
    });
  });
}

function populateTypeDropdown() {
  var select = document.getElementById("docType");
  if (select.options.length > 1) return;
  documentTypes.forEach(function (type) {
    var option = document.createElement("option");
    option.value = type.type_id;
    option.textContent = type.type_name.toUpperCase();
    if (type.type_name === "certification") option.textContent = "Certification";
    select.appendChild(option);
  });
}

function setupAddDocument() {
  var addDocBtn = document.getElementById("addDocBtn");
  var addDocModal = new bootstrap.Modal(document.getElementById("addDocModal"));
  var addDocForm = document.getElementById("addDocForm");

  addDocBtn.addEventListener("click", function () {
    addDocModal.show();
  });

  addDocForm.addEventListener("submit", function (e) {
    e.preventDefault();

    var data = {
      document_name: document.getElementById("docName").value,
      type_id: document.getElementById("docType").value,
      price: document.getElementById("docPrice").value,
    };

    axios
      .post("../api/add_document.php", data)
      .then(function (res) {
        if (res.data.success) {
          Swal.fire("Success", res.data.message, "success");
          addDocForm.reset();
          addDocModal.hide();
          loadDocuments();
        } else {
          Swal.fire("Error", res.data.message, "error");
        }
      })
      .catch(function () {
        Swal.fire("Error", "Something went wrong", "error");
      });
  });
}

function openEditPrice(docId) {
  var doc = allDocuments.find(function (d) { return parseInt(d.document_id) === docId; });
  if (!doc) return;
  document.getElementById("editDocId").value = doc.document_id;
  document.getElementById("editDocName").textContent = doc.document_name;
  document.getElementById("editDocPrice").value = parseFloat(doc.price).toFixed(2);
  new bootstrap.Modal(document.getElementById("editPriceModal")).show();
}

document.addEventListener("DOMContentLoaded", function () {
  document.getElementById("editPriceForm").addEventListener("submit", function (e) {
    e.preventDefault();
    var data = {
      document_id: document.getElementById("editDocId").value,
      price: document.getElementById("editDocPrice").value,
    };
    axios.post("../api/update_document_price.php", data).then(function (res) {
      if (res.data.success) {
        Swal.fire("Success", res.data.message, "success");
        bootstrap.Modal.getInstance(document.getElementById("editPriceModal")).hide();
        loadDocuments();
      } else {
        Swal.fire("Error", res.data.message, "error");
      }
    }).catch(function () {
      Swal.fire("Error", "Something went wrong", "error");
    });
  });
});

function escapeHtml(str) {
  var div = document.createElement("div");
  div.appendChild(document.createTextNode(str));
  return div.innerHTML;
}

// Sidebar
fetch("../views/sidebar.html")
  .then(function (res) { return res.text(); })
  .then(function (html) {
    var temp = document.createElement("div");
    temp.innerHTML = html;
    var container = document.getElementById("sidebar-container");
    var topbar = temp.querySelector(".topbar");
    var navbar = temp.querySelector(".admin-navbar");
    if (topbar) container.appendChild(topbar);
    if (navbar) container.appendChild(navbar);
    container.querySelectorAll(".navbar-link").forEach(function (link) {
      if (link.getAttribute("href") === "documents.html") link.classList.add("active");
    });
    var logoutBtn = document.getElementById("logoutBtnTopbar");
    if (logoutBtn)
      logoutBtn.addEventListener("click", function (e) {
        e.preventDefault();
        if (window.appLogout) { window.appLogout("../api/logout.php"); }
        else { sessionStorage.clear(); window.location.href = "../../index.php"; }
      });
  });
