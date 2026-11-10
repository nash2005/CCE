axios
  .get("../api/dashboard.php")
  .then((response) => {
    document.getElementById("totalStudents").innerText = response.data.students;
    document.getElementById("totalAlumni").innerText = response.data.alumni;
    document.getElementById("totalStaff").innerText = response.data.staff;
  })
  .catch((error) => console.error(error));
document.addEventListener("click", function (e) {
  if (e.target.closest("#logoutBtn")) {
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

        window.appLogout("../api/logout.php");
      }
    });
  }
});

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
    // Highlight active nav
    container.querySelectorAll(".navbar-link").forEach(function(link) {
      if (link.getAttribute("href") === "dashboard.html") link.classList.add("active");
    });
    // Logout
    var logoutBtn = document.getElementById("logoutBtnTopbar");
    if (logoutBtn) logoutBtn.addEventListener("click", function(e) {
      e.preventDefault();
      if (window.appLogout) { window.appLogout("../api/logout.php"); }
      else { sessionStorage.clear(); window.location.href = "../../index.php"; }
    });
  });
