document.addEventListener("DOMContentLoaded", function () {
  const passwordInput = document.getElementById("password");
  const confirmInput = document.getElementById("confirmPassword");
  const reqLength = document.getElementById("reqLength");
  const reqUpper = document.getElementById("reqUpper");
  const reqSpecial = document.getElementById("reqSpecial");

  // Get token from URL
  const urlParams = new URLSearchParams(window.location.search);
  const token = urlParams.get("token");

  if (!token) {
    Swal.fire({
      icon: "error",
      title: "Invalid Link",
      text: "This password reset link is invalid or missing a token.",
      confirmButtonColor: "#4a86e8",
    }).then(() => {
      window.location.href = "login.html";
    });
    return;
  }

  function validatePassword(pw) {
    return {
      length: pw.length >= 8,
      upper: /[A-Z]/.test(pw),
      special: /[^A-Za-z0-9]/.test(pw),
    };
  }

  function updateRequirements() {
    const v = validatePassword(passwordInput.value);

    reqLength.className = "req-item " + (v.length ? "req-pass" : "req-fail");
    reqLength.querySelector("i").className =
      "fas " + (v.length ? "fa-check-circle" : "fa-circle");

    reqUpper.className = "req-item " + (v.upper ? "req-pass" : "req-fail");
    reqUpper.querySelector("i").className =
      "fas " + (v.upper ? "fa-check-circle" : "fa-circle");

    reqSpecial.className =
      "req-item " + (v.special ? "req-pass" : "req-fail");
    reqSpecial.querySelector("i").className =
      "fas " + (v.special ? "fa-check-circle" : "fa-circle");
  }

  passwordInput.addEventListener("input", updateRequirements);

  // Toggle password visibility
  document.querySelectorAll(".toggle-password").forEach(function (btn) {
    btn.addEventListener("click", function () {
      var target = document.getElementById(this.dataset.target);
      var icon = this.querySelector("i");
      if (target.type === "password") {
        target.type = "text";
        icon.classList.replace("fa-eye", "fa-eye-slash");
      } else {
        target.type = "password";
        icon.classList.replace("fa-eye-slash", "fa-eye");
      }
    });
  });

  function showError(message) {
    document.getElementById("errorText").textContent = message;
    document.getElementById("errorMessage").className = "alert alert-danger";
    document.getElementById("errorMessage").style.display = "block";
    setTimeout(() => {
      document.getElementById("errorMessage").style.display = "none";
    }, 5000);
  }

  document
    .getElementById("resetPasswordForm")
    .addEventListener("submit", function (e) {
      e.preventDefault();

      const password = passwordInput.value;
      const confirmPassword = confirmInput.value;

      const v = validatePassword(password);

      if (!v.length || !v.upper || !v.special) {
        showError(
          "Password must be at least 8 characters with 1 uppercase letter and 1 special character."
        );
        return;
      }

      if (password !== confirmPassword) {
        showError("Passwords do not match.");
        return;
      }

      const submitBtn = document.querySelector('button[type="submit"]');
      submitBtn.innerHTML =
        '<i class="fas fa-spinner fa-spin"></i> Resetting...';
      submitBtn.disabled = true;

      axios
        .post("../api/reset_password.php", {
          token: token,
          password: password,
        })
        .then((response) => {
          const data = response.data;

          if (data.status === "success") {
            Swal.fire({
              icon: "success",
              title: "Password Reset",
              text: "Your password has been reset successfully.",
              confirmButtonColor: "#4a86e8",
            }).then(() => {
              window.location.href = "login.html";
            });
          } else {
            showError(data.message);
            submitBtn.innerHTML =
              '<i class="fas fa-key"></i> Reset Password';
            submitBtn.disabled = false;
          }
        })
        .catch(() => {
          showError("An error occurred. Please try again.");
          submitBtn.innerHTML =
            '<i class="fas fa-key"></i> Reset Password';
          submitBtn.disabled = false;
        });
    });
});
