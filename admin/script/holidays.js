document.addEventListener('DOMContentLoaded', () => {
  loadHolidays();
  setupFilterButtons();
  setupAddHoliday();
  setupEditHoliday();
  setupArchiveHoliday();
});

let allHolidays = [];
let currentFilter = 'all';

function loadHolidays() {
  var tbody = document.getElementById('holidaysTableBody');
  tbody.innerHTML = '<tr><td colspan="4" class="empty-state"><div class="spinner-border text-primary"></div><p class="mt-2 text-muted mb-0">Loading holidays...</p></td></tr>';
  axios.get('../api/get_holidays.php', { params: { status: currentFilter } })
    .then(function (res) {
      if (res.data.success) {
        allHolidays = res.data.holidays;
        displayHolidays(allHolidays);
      } else {
        tbody.innerHTML = '<tr><td colspan="4" class="empty-state">Error loading holidays</td></tr>';
      }
    })
    .catch(function () {
      tbody.innerHTML = '<tr><td colspan="4" class="empty-state">Error loading holidays</td></tr>';
    });
}

function displayHolidays(holidays) {
  var tbody = document.getElementById('holidaysTableBody');
  if (!holidays || holidays.length === 0) {
    tbody.innerHTML = '<tr><td colspan="4" class="empty-state">No holidays found</td></tr>';
    return;
  }
  var html = '';
  holidays.forEach(function (h) {
    var statusClass = h.is_archived ? 'status-archived' : 'status-active';
    var statusLabel = h.is_archived ? 'Archived' : 'Active';
    var dateStr = h.holiday_date || 'N/A';
    var dateParts = dateStr.split('-');
    var formattedDate = dateParts.length === 3 ? dateParts[1] + '/' + dateParts[2] + '/' + dateParts[0].slice(2, 4) : dateStr;
    var hid = parseInt(h.holiday_id);
    html += '<tr><td><span class="date-badge">' + formattedDate + '</span></td>';
    html += '<td>' + escapeHtml(h.holiday_name || 'N/A') + '</td>';
    html += '<td><span class="badge ' + statusClass + '">' + statusLabel + '</span></td>';
    html += '<td><button class="icon-btn icon-btn-edit" onclick="openEditHoliday(' + hid + ')" title="Edit"><i class="fas fa-edit"></i></button> ';
    html += '<button class="icon-btn icon-btn-archive" onclick="openArchiveHoliday(' + hid + ')" title="Archive"><i class="fas fa-archive"></i></button></td></tr>';
  });
  tbody.innerHTML = html;
}

function setupFilterButtons() {
  var buttons = document.querySelectorAll('.filter-btn');
  buttons.forEach(function (btn) {
    btn.addEventListener('click', function () {
      buttons.forEach(function (b) { b.classList.remove('active'); });
      btn.classList.add('active');
      currentFilter = btn.dataset.filter;
      loadHolidays();
    });
  });
}

function setupAddHoliday() {
  var addBtn = document.getElementById('addHolidayBtn');
  var modalEl = document.getElementById('addHolidayModal');
  var modal = new bootstrap.Modal(modalEl);
  var form = document.getElementById('addHolidayForm');

  addBtn.addEventListener('click', function () {
    form.reset();
    modal.show();
  });

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var startDate = document.getElementById('holidayDate').value;
    var endDate = document.getElementById('holidayEndDate').value || startDate;

    if (new Date(startDate) > new Date(endDate)) {
      Swal.fire('Error', 'Start date cannot be after end date', 'error');
      return;
    }

    var data = {
      holiday_name: document.getElementById('holidayName').value,
      holiday_date: startDate,
      holiday_end_date: endDate,
      _csrf_token: getCsrfToken()
    };

    axios.post('../api/add_holiday.php', data)
      .then(function (res) {
        if (res.data.success) {
          Swal.fire('Success', res.data.message, 'success').then(function () {
            modal.hide();
            form.reset();
            loadHolidays();
          });
        } else {
          Swal.fire('Error', res.data.message, 'error');
        }
      })
      .catch(function () {
        Swal.fire('Error', 'Something went wrong', 'error');
      });
  });
}

function setupEditHoliday() {
  var form = document.getElementById('editHolidayForm');
  var modalEl = document.getElementById('editHolidayModal');
  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var holidayId = parseInt(document.getElementById('editHolidayId').value);
    if (isNaN(holidayId)) {
      Swal.fire('Error', 'Please select a holiday to edit', 'error');
      return;
    }
    var data = {
      holiday_id: holidayId,
      holiday_date: document.getElementById('editHolidayDate').value,
      holiday_name: document.getElementById('editHolidayName').value,
      _csrf_token: getCsrfToken()
    };
    axios.post('../api/update_holiday.php', data)
      .then(function (res) {
        if (res.data.success) {
          Swal.fire('Success', res.data.message, 'success').then(function () {
            bootstrap.Modal.getInstance(modalEl).hide();
            loadHolidays();
          });
        } else {
          Swal.fire('Error', res.data.message, 'error');
        }
      })
      .catch(function () {
        Swal.fire('Error', 'Something went wrong', 'error');
      });
  });
}

function setupArchiveHoliday() {
  var confirmBtn = document.getElementById('confirmArchiveBtn');
  var modalEl = document.getElementById('confirmArchiveModal');
  var modal = new bootstrap.Modal(modalEl);

  window.openArchiveHoliday = function (holidayId) {
    var holiday = allHolidays.find(function (h) { return parseInt(h.holiday_id) === holidayId; });
    if (!holiday) return;
    document.getElementById('archiveHolidayName').textContent = holiday.holiday_name;
    document.getElementById('archiveHolidayId').value = holidayId;
    modal.show();
  };

  confirmBtn.addEventListener('click', function () {
    var holidayId = parseInt(document.getElementById('archiveHolidayId').value);
    if (isNaN(holidayId)) {
      Swal.fire('Error', 'No holiday selected', 'error');
      return;
    }
    axios.post('../api/archive_holiday.php', { holiday_id: holidayId, _csrf_token: getCsrfToken() })
      .then(function (res) {
        if (res.data.success) {
          Swal.fire('Success', res.data.message, 'success').then(function () {
            modal.hide();
            loadHolidays();
          });
        } else {
          Swal.fire('Error', res.data.message, 'error');
        }
      })
      .catch(function () {
        Swal.fire('Error', 'Something went wrong', 'error');
      });
  });
}

function openEditHoliday(holidayId) {
  var holiday = allHolidays.find(function (h) { return parseInt(h.holiday_id) === holidayId; });
  if (!holiday) return;
  document.getElementById('editHolidayId').value = holiday.holiday_id;
  document.getElementById('editHolidayDate').value = holiday.holiday_date || '';
  document.getElementById('editHolidayName').value = holiday.holiday_name || '';
  new bootstrap.Modal(document.getElementById('editHolidayModal')).show();
}

function escapeHtml(str) {
  if (!str) return '';
  var div = document.createElement('div');
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
    container.querySelectorAll(".navbar-link, .navbar-dropdown-menu a").forEach(function (link) {
      if (link.getAttribute("href") === "holidays.html") link.classList.add("active");
    });
    var logoutBtn = document.getElementById("logoutBtnTopbar");
    if (logoutBtn)
      logoutBtn.addEventListener("click", function (e) {
        e.preventDefault();
        if (window.appLogout) { window.appLogout("../api/logout.php"); }
        else { sessionStorage.clear(); window.location.href = "../../index.php"; }
      });
  });

