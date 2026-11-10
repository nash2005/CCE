const API_BASE = "../api";
const MONTH_NAMES = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];
let trendChart, statusChart, rolesChart, comparisonChart;
let lastReportData = null;

document.addEventListener("DOMContentLoaded", function () {
  loadSidebar();
  loadReports();
});

function loadSidebar() {
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
      container.querySelectorAll(".navbar-link").forEach(function (link) {
        if (link.getAttribute("href") === "reports.html")
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
    });
}

async function loadReports() {
  const dateFrom = document.getElementById("filterDateFrom").value;
  const dateTo = document.getElementById("filterDateTo").value;
  const course = document.getElementById("filterCourse").value;

  try {
    const res = await axios.get(`${API_BASE}/get_reports.php`, {
      params: { date_from: dateFrom, date_to: dateTo, course },
    });

    if (!res.data.success) {
      console.error("Reports error:", res.data.error);
      return;
    }

    const data = res.data;
    lastReportData = data;

    // Populate course filter
    populateCourses(data.available_courses);

    // Update summary cards
    document.getElementById("totalAccounts").textContent =
      data.summary.total_accounts;
    document.getElementById("totalRequests").textContent =
      data.summary.total_requests;
    document.getElementById("totalApproved").textContent =
      data.summary.total_approved;
    document.getElementById("totalRejected").textContent =
      data.summary.total_rejected;

    // Render charts
    renderTrendChart(data.monthly_trend, data.trend_year);
    renderStatusChart(data.summary);
    renderRolesChart(data.accounts_by_role);
    renderComparisonChart(data.monthly_trend, data.trend_year);
  } catch (err) {
    console.error("Error loading reports:", err);
  }
}

function populateCourses(courses) {
  const sel = document.getElementById("filterCourse");
  const current = sel.value;
  // Clear existing options except the first "All Courses" option
  while (sel.options.length > 1) {
    sel.remove(1);
  }
  if (courses && courses.length > 0) {
    courses.forEach((c) => {
      sel.innerHTML += `<option value="${c.course_id}">${c.course_name}</option>`;
    });
  }
  if (current) sel.value = current;
}

function renderTrendChart(monthlyData, year) {
  const ctx = document.getElementById("trendChart").getContext("2d");
  document.getElementById("trendYearLabel").textContent = `(${year})`;

  if (trendChart) trendChart.destroy();

  trendChart = new Chart(ctx, {
    type: "bar",
    data: {
      labels: MONTH_NAMES,
      datasets: [
        {
          label: "Total",
          data: monthlyData.map((m) => parseInt(m.total)),
          backgroundColor: "rgba(59,130,246,0.7)",
          borderRadius: 4,
        },
        {
          label: "Approved",
          data: monthlyData.map((m) => parseInt(m.approved)),
          backgroundColor: "rgba(16,185,129,0.7)",
          borderRadius: 4,
        },
        {
          label: "Rejected",
          data: monthlyData.map((m) => parseInt(m.rejected)),
          backgroundColor: "rgba(239,68,68,0.7)",
          borderRadius: 4,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: "top",
          labels: { usePointStyle: true, padding: 15 },
        },
      },
      scales: {
        y: {
          beginAtZero: true,
          ticks: { stepSize: 1 },
          grid: { color: "rgba(0,0,0,0.05)" },
        },
        x: {
          grid: { display: false },
        },
      },
    },
  });
}

function renderStatusChart(summary) {
  const ctx = document.getElementById("statusChart").getContext("2d");

  if (statusChart) statusChart.destroy();

  statusChart = new Chart(ctx, {
    type: "doughnut",
    data: {
      labels: ["Approved", "Rejected", "Pending", "Processing"],
      datasets: [
        {
          data: [
            summary.total_approved,
            summary.total_rejected,
            summary.total_pending,
            summary.total_processing,
          ],
          backgroundColor: ["#10b981", "#ef4444", "#f59e0b", "#3b82f6"],
          borderWidth: 0,
          hoverOffset: 8,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: "65%",
      plugins: {
        legend: {
          position: "bottom",
          labels: { usePointStyle: true, padding: 12, font: { size: 12 } },
        },
      },
    },
  });
}

function renderRolesChart(roleData) {
  const ctx = document.getElementById("rolesChart").getContext("2d");

  if (rolesChart) rolesChart.destroy();

  const colors = {
    student: "#3b82f6",
    alumni: "#8b5cf6",
    staff: "#10b981",
    admin: "#f59e0b",
    cashier: "#ec4899",
    dean: "#06b6d4",
    library: "#84cc16",
    finance: "#f97316",
    guidance: "#6366f1",
  };

  const labels = roleData.map((r) => capitalize(r.role_name));
  const data = roleData.map((r) => parseInt(r.count));
  const bgColors = roleData.map((r) => colors[r.role_name] || "#94a3b8");

  rolesChart = new Chart(ctx, {
    type: "doughnut",
    data: {
      labels: labels,
      datasets: [
        {
          data: data,
          backgroundColor: bgColors,
          borderWidth: 0,
          hoverOffset: 8,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: "55%",
      plugins: {
        legend: {
          position: "right",
          labels: { usePointStyle: true, padding: 10, font: { size: 11 } },
        },
      },
    },
  });
}

function renderComparisonChart(monthlyData, year) {
  const ctx = document.getElementById("comparisonChart").getContext("2d");

  if (comparisonChart) comparisonChart.destroy();

  comparisonChart = new Chart(ctx, {
    type: "line",
    data: {
      labels: MONTH_NAMES,
      datasets: [
        {
          label: "Approved",
          data: monthlyData.map((m) => parseInt(m.approved)),
          borderColor: "#10b981",
          backgroundColor: "rgba(16,185,129,0.1)",
          fill: true,
          tension: 0.4,
          pointRadius: 4,
          pointBackgroundColor: "#10b981",
        },
        {
          label: "Rejected",
          data: monthlyData.map((m) => parseInt(m.rejected)),
          borderColor: "#ef4444",
          backgroundColor: "rgba(239,68,68,0.1)",
          fill: true,
          tension: 0.4,
          pointRadius: 4,
          pointBackgroundColor: "#ef4444",
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: "top",
          labels: { usePointStyle: true, padding: 15 },
        },
      },
      scales: {
        y: {
          beginAtZero: true,
          ticks: { stepSize: 1 },
          grid: { color: "rgba(0,0,0,0.05)" },
        },
        x: { grid: { display: false } },
      },
    },
  });
}

function applyFilters() {
  loadReports();
}

function resetFilters() {
  document.getElementById("filterDateFrom").value = "";
  document.getElementById("filterDateTo").value = "";
  document.getElementById("filterCourse").value = "0";
  loadReports();
}

function capitalize(str) {
  return str ? str.charAt(0).toUpperCase() + str.slice(1) : "";
}

function generatePDF() {
  if (!lastReportData) {
    Swal.fire("Error", "No report data loaded yet.", "error");
    return;
  }

  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();
  const data = lastReportData;
  const now = new Date();
  const dateStr = now.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  const timeStr = now.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
  });

  // Get filter values
  const dateFrom = document.getElementById("filterDateFrom").value;
  const dateTo = document.getElementById("filterDateTo").value;
  const course = document.getElementById("filterCourse");
  const courseName =
    course.value !== "0"
      ? course.options[course.selectedIndex].text
      : "All Courses";

  // Format dates for display
  const formatDate = (dateStr) => {
    if (!dateStr) return "";
    const d = new Date(dateStr + "T00:00:00");
    return d.toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  // ===== HEADER WITH LOGO =====
  // Add logo (centered at top)
  const logoPath = "../../images/1.png";

  // Try to add the logo image
  try {
    doc.addImage(logoPath, "PNG", 80, 10, 40, 40);
  } catch (e) {
    // If logo fails to load, continue without it
    console.log("Logo not found, continuing without logo");
  }

  // School Name - position adjusted to accommodate logo
  doc.setFontSize(18);
  doc.setFont(undefined, "bold");
  doc.text("CITY COLLEGE OF EL SALVADOR", 105, 55, { align: "center" });

  doc.setFontSize(14);
  doc.setFont(undefined, "bold");
  doc.text("CCES Online Requisition", 105, 63, { align: "center" });

  doc.setFontSize(12);
  doc.setFont(undefined, "bold");
  doc.text("ADMINISTRATIVE REPORT", 105, 71, { align: "center" });

  // Generated date and time
  doc.setFontSize(10);
  doc.setFont(undefined, "normal");
  doc.setTextColor(100);
  doc.text(`Generated: ${dateStr} | ${timeStr}`, 105, 79, { align: "center" });
  doc.setTextColor(0);

  // ===== REPORT FILTERS =====
  let yPos = 91;
  doc.setFontSize(11);
  doc.setFont(undefined, "bold");
  doc.text("REPORT FILTERS", 14, yPos);
  yPos += 6;

  doc.setFont(undefined, "normal");
  doc.setFontSize(10);

  // Course
  doc.text("Course", 14, yPos);
  doc.setFont(undefined, "bold");
  doc.text(courseName, 70, yPos);
  yPos += 6;

  // Date From
  doc.setFont(undefined, "normal");
  doc.text("Date From", 14, yPos);
  doc.setFont(undefined, "bold");
  doc.text(formatDate(dateFrom) || "N/A", 70, yPos);
  yPos += 6;

  // Date To
  doc.setFont(undefined, "normal");
  doc.text("Date To", 14, yPos);
  doc.setFont(undefined, "bold");
  doc.text(formatDate(dateTo) || "N/A", 70, yPos);
  yPos += 6;

  // Report Type
  doc.setFont(undefined, "normal");
  doc.text("Report Type", 14, yPos);
  doc.setFont(undefined, "bold");
  doc.text("Summary Report", 70, yPos);
  yPos += 10;

  // ===== OVERVIEW CARDS (Summary Cards) =====
  doc.setFontSize(11);
  doc.setFont(undefined, "bold");
  doc.text("OVERVIEW", 14, yPos);
  yPos += 8;

  // Draw 4 mini cards
  const cardWidth = 42;
  const cardHeight = 30;
  const startX = 14;
  const cardY = yPos;

  // Card 1: Total Accounts
  doc.setDrawColor(200, 200, 200);
  doc.setFillColor(255, 255, 255);
  doc.roundedRect(startX, cardY, cardWidth, cardHeight, 2, 2, "FD");
  doc.setFontSize(16);
  doc.setFont(undefined, "bold");
  doc.setTextColor(59, 130, 246);
  doc.text(
    data.summary.total_accounts.toString(),
    startX + cardWidth / 2,
    cardY + 14,
    { align: "center" },
  );
  doc.setFontSize(8);
  doc.setFont(undefined, "normal");
  doc.setTextColor(100, 100, 100);
  doc.text("TOTAL ACCOUNTS", startX + cardWidth / 2, cardY + 24, {
    align: "center",
  });

  // Card 2: Total Requests
  doc.setDrawColor(200, 200, 200);
  doc.setFillColor(255, 255, 255);
  doc.roundedRect(
    startX + cardWidth + 8,
    cardY,
    cardWidth,
    cardHeight,
    2,
    2,
    "FD",
  );
  doc.setFontSize(16);
  doc.setFont(undefined, "bold");
  doc.setTextColor(139, 92, 246);
  doc.text(
    data.summary.total_requests.toString(),
    startX + cardWidth + 8 + cardWidth / 2,
    cardY + 14,
    { align: "center" },
  );
  doc.setFontSize(8);
  doc.setFont(undefined, "normal");
  doc.setTextColor(100, 100, 100);
  doc.text(
    "TOTAL REQUESTS",
    startX + cardWidth + 8 + cardWidth / 2,
    cardY + 24,
    {
      align: "center",
    },
  );

  // Card 3: Approved
  doc.setDrawColor(200, 200, 200);
  doc.setFillColor(255, 255, 255);
  doc.roundedRect(
    startX + (cardWidth + 8) * 2,
    cardY,
    cardWidth,
    cardHeight,
    2,
    2,
    "FD",
  );
  doc.setFontSize(16);
  doc.setFont(undefined, "bold");
  doc.setTextColor(16, 185, 129);
  doc.text(
    data.summary.total_approved.toString(),
    startX + (cardWidth + 8) * 2 + cardWidth / 2,
    cardY + 14,
    { align: "center" },
  );
  doc.setFontSize(8);
  doc.setFont(undefined, "normal");
  doc.setTextColor(100, 100, 100);
  doc.text(
    "APPROVED",
    startX + (cardWidth + 8) * 2 + cardWidth / 2,
    cardY + 24,
    { align: "center" },
  );

  // Card 4: Rejected
  doc.setDrawColor(200, 200, 200);
  doc.setFillColor(255, 255, 255);
  doc.roundedRect(
    startX + (cardWidth + 8) * 3,
    cardY,
    cardWidth,
    cardHeight,
    2,
    2,
    "FD",
  );
  doc.setFontSize(16);
  doc.setFont(undefined, "bold");
  doc.setTextColor(239, 68, 68);
  doc.text(
    data.summary.total_rejected.toString(),
    startX + (cardWidth + 8) * 3 + cardWidth / 2,
    cardY + 14,
    { align: "center" },
  );
  doc.setFontSize(8);
  doc.setFont(undefined, "normal");
  doc.setTextColor(100, 100, 100);
  doc.text(
    "REJECTED",
    startX + (cardWidth + 8) * 3 + cardWidth / 2,
    cardY + 24,
    { align: "center" },
  );

  doc.setTextColor(0);
  yPos = cardY + cardHeight + 12;

  // ===== DETAILED SUMMARY TABLE =====
  doc.setFontSize(11);
  doc.setFont(undefined, "bold");
  doc.text("DETAILED SUMMARY", 14, yPos);
  yPos += 6;

  doc.autoTable({
    startY: yPos,
    head: [["Metric", "Count"]],
    body: [
      ["Total Accounts", data.summary.total_accounts],
      ["Total Requests", data.summary.total_requests],
      ["Approved", data.summary.total_approved],
      ["Rejected", data.summary.total_rejected],
      ["Pending", data.summary.total_pending],
      ["Processing", data.summary.total_processing],
    ],
    theme: "grid",
    headStyles: {
      fillColor: [59, 130, 246],
      textColor: [255, 255, 255],
      fontSize: 10,
      halign: "center",
    },
    styles: {
      fontSize: 10,
      halign: "center",
    },
    columnStyles: {
      0: { halign: "left", cellWidth: 80 },
      1: { halign: "center", cellWidth: 40 },
    },
    margin: { left: 14, right: 14 },
  });

  // Footer
  const pageCount = doc.internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(150);
    doc.text(
      "Generated by CCES Online Requisition System",
      105,
      doc.internal.pageSize.height - 10,
      { align: "center" },
    );
    doc.text(
      `Page ${i} of ${pageCount}`,
      doc.internal.pageSize.width - 14,
      doc.internal.pageSize.height - 10,
      { align: "right" },
    );
    doc.setTextColor(0);
  }

  doc.save("Admin_Report_" + now.toISOString().slice(0, 10) + ".pdf");
}
