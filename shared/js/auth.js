(function () {
  var LOGIN_URL = "/REQUEST/login/views/login.html";
  var CHECK_URL = "/REQUEST/login/api/check_session.php";

  // On logout from any tab, this key gets set in localStorage
  var LOGOUT_KEY = "app_logout";

  // Map each role to its allowed URL path prefix(es)
  var ROLE_PATHS = {
    admin:       ["/REQUEST/admin/"],
    student:     ["/REQUEST/student/"],
    alumni:      ["/REQUEST/student/"],
    staff:       ["/REQUEST/staff/"],
    departments: ["/REQUEST/dean/", "/REQUEST/library/", "/REQUEST/finance/", "/REQUEST/guidance/"]
  };

  // Map each role to its correct dashboard
  var ROLE_DASHBOARD = {
    admin:   "/REQUEST/admin/views/dashboard.html",
    student: "/REQUEST/student/views/dashboard.html",
    alumni:  "/REQUEST/student/views/dashboard.html",
    staff:   "/REQUEST/staff/views/dashboard.html"
  };

  // Listen for logout events from other tabs
  window.addEventListener("storage", function (e) {
    if (e.key === LOGOUT_KEY) {
      window.location.href = LOGIN_URL;
    }
  });

  // Check session on page load + enforce role-based access
  axios
    .get(CHECK_URL)
    .then(function (response) {
      if (response.data.status !== "authenticated") {
        window.location.href = LOGIN_URL;
        return;
      }

      var role = response.data.role;
      var path = window.location.pathname.toLowerCase();
      var allowedPaths = ROLE_PATHS[role];

      // Check if current path is allowed for this role
      if (allowedPaths) {
        var isAllowed = false;
        for (var i = 0; i < allowedPaths.length; i++) {
          if (path.indexOf(allowedPaths[i].toLowerCase()) === 0) {
            isAllowed = true;
            break;
          }
        }

        if (!isAllowed) {
          // Redirect to user's correct dashboard
          var dashboard = ROLE_DASHBOARD[role];

          // For department users, redirect based on their department
          if (role === "departments" && response.data.department) {
            dashboard = "/REQUEST/" + response.data.department + "/views/dashboard.html";
          }

          if (dashboard) {
            window.location.href = dashboard;
          } else {
            window.location.href = LOGIN_URL;
          }
        }
      }
    })
    .catch(function () {
      window.location.href = LOGIN_URL;
    });

  // Broadcast logout to all tabs (with confirmation)
  window.appLogout = function (logoutApiUrl) {
    // Check if SweetAlert2 is available
    if (typeof Swal !== 'undefined') {
      return Swal.fire({
        title: 'Are you sure you want to logout?',
        icon: 'question',
        showCancelButton: true,
        confirmButtonColor: '#667eea',
        cancelButtonColor: '#6c757d',
        confirmButtonText: 'Yes, logout',
        cancelButtonText: 'Cancel'
      }).then(function (result) {
        if (result.isConfirmed) {
          return axios.post(logoutApiUrl).finally(function () {
            localStorage.setItem(LOGOUT_KEY, Date.now().toString());
            localStorage.removeItem(LOGOUT_KEY);
            sessionStorage.clear();
            window.location.href = LOGIN_URL;
          });
        }
      });
    }
    // Fallback if SweetAlert2 not loaded
    if (!confirm('Are you sure you want to logout?')) return;
    return axios
      .post(logoutApiUrl)
      .finally(function () {
        localStorage.setItem(LOGOUT_KEY, Date.now().toString());
        localStorage.removeItem(LOGOUT_KEY);
        sessionStorage.clear();
        window.location.href = LOGIN_URL;
      });
  };

  // ===== Mobile navigation =====
  document.addEventListener("click", function (e) {
    // Hamburger toggle (admin/staff navbars only)
    var toggler = e.target.closest("#navbarToggler");
    if (toggler) {
      e.preventDefault();
      var nav = document.querySelector(".admin-navbar, .staff-navbar");
      if (nav) {
        nav.classList.toggle("show");
        var icon = toggler.querySelector("i");
        if (icon) {
          icon.classList.toggle("fa-bars");
          icon.classList.toggle("fa-times");
        }
      }
      return;
    }

    // Mobile dropdown toggle — tap to open/close (all navbars)
    if (window.innerWidth <= 768) {
      var link = e.target.closest(".navbar-link");
      if (link) {
        var dropdown = link.closest(".navbar-dropdown");
        var menu = dropdown ? dropdown.querySelector(".navbar-dropdown-menu") : null;
        if (menu) {
          e.preventDefault();
          document.querySelectorAll(".navbar-dropdown.open").forEach(function (d) {
            if (d !== dropdown) d.classList.remove("open");
          });
          dropdown.classList.toggle("open");
        }
      } else {
        // Tap outside closes open dropdowns
        if (!e.target.closest(".navbar-dropdown-menu")) {
          document.querySelectorAll(".navbar-dropdown.open").forEach(function (d) {
            d.classList.remove("open");
          });
        }
      }
    }
  });
})();
