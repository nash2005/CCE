document.addEventListener("DOMContentLoaded", function () {
  const captchaInput = document.getElementById("captchaInput");
  const captchaAnswer = document.getElementById("captchaAnswer");

  function generateCaptcha() {
    const num1 = Math.floor(Math.random() * 10) + 1;
    const num2 = Math.floor(Math.random() * 10) + 1;

    document.getElementById("captchaQuestion").textContent =
      `${num1} + ${num2} =`;

    captchaAnswer.value = num1 + num2;

    captchaInput.value = "";
    captchaInput.classList.remove("correct", "wrong");
  }

  captchaInput.addEventListener("input", () => {
    const user = parseInt(captchaInput.value);
    const correct = parseInt(captchaAnswer.value);

    captchaInput.classList.remove("correct", "wrong");

    if (!isNaN(user)) {
      if (user === correct) {
        captchaInput.classList.add("correct");
      } else {
        captchaInput.classList.add("wrong");
      }
    }
  });

  function showError(message) {
    document.getElementById("errorText").innerHTML = message;
    document.getElementById("errorMessage").className = "alert alert-danger";
    document.getElementById("errorMessage").style.display = "block";
    setTimeout(() => {
      document.getElementById("errorMessage").style.display = "none";
    }, 8000);
  }

  function showWarning(message) {
    document.getElementById("errorText").innerHTML = message;
    document.getElementById("errorMessage").className = "alert alert-warning";
    document.getElementById("errorMessage").style.display = "block";
    setTimeout(() => {
      document.getElementById("errorMessage").style.display = "none";
    }, 8000);
  }

  function showSuccess(message) {
    document.getElementById("errorText").textContent = message;
    document.getElementById("errorMessage").className = "alert alert-success";
    document.getElementById("errorMessage").style.display = "block";
  }

  generateCaptcha();

  // Toggle password visibility
  document
    .getElementById("togglePassword")
    .addEventListener("click", function () {
      var passwordInput = document.getElementById("password");
      var icon = this.querySelector("i");
      if (passwordInput.type === "password") {
        passwordInput.type = "text";
        icon.classList.replace("fa-eye", "fa-eye-slash");
      } else {
        passwordInput.type = "password";
        icon.classList.replace("fa-eye-slash", "fa-eye");
      }
    });

  // Terms and Conditions
  var agreeCheckbox = document.getElementById("agreeTerms");
  var signInBtn = document.getElementById("signInBtn");
  var termsModal = new bootstrap.Modal(document.getElementById("termsModal"));

  // Auto-check the terms checkbox by default
  agreeCheckbox.checked = true;
  signInBtn.disabled = false;

  // Only uncheck when user manually clicks the checkbox
  agreeCheckbox.addEventListener("change", function () {
    // If user unchecks it, disable the button
    if (!this.checked) {
      signInBtn.disabled = true;
    } else {
      signInBtn.disabled = false;
    }
  });

  document.getElementById("openTerms").addEventListener("click", function (e) {
    e.preventDefault();
    termsModal.show();
  });

  document
    .getElementById("acceptTermsBtn")
    .addEventListener("click", function () {
      agreeCheckbox.checked = true;
      signInBtn.disabled = false;
      termsModal.hide();
    });

  document.getElementById("loginForm").addEventListener("submit", function (e) {
    e.preventDefault();

    const userAnswer = parseInt(captchaInput.value);
    const correctAnswer = parseInt(captchaAnswer.value);

    if (userAnswer !== correctAnswer) {
      showError("Incorrect CAPTCHA answer. Please try again.");
      generateCaptcha();
      return;
    }

    const formData = new FormData(this);

    axios
      .post("../api/login.php", formData)
      .then((response) => {
        const data = response.data;

        if (data.status === "success") {
          Swal.fire({
            icon: "success",
            title: "Login successfully",
            timer: 800,
            showConfirmButton: false,
          });

          document.querySelector("button[type='submit']").innerHTML =
            "<i class='fas fa-spinner fa-spin'></i> Loading...";
          document.querySelector("button[type='submit']").disabled = true;

          setTimeout(() => {
            window.location.href = data.redirect;
          }, 2000);
        } else if (data.status === "locked") {
          Swal.fire({
            icon: "error",
            title: "Account Locked",
            html:
              data.message +
              '<br><br><a href="forgot_password.html" style="color: #4a86e8; font-weight: 600;">Click here to reset your password</a>',
            confirmButtonColor: "#4a86e8",
          });
          generateCaptcha();
        } else {
          var msg = data.message;
          if (data.remaining_attempts !== undefined) {
            msg +=
              ' <a href="forgot_password.html" style="color: #856404; font-weight: 600; text-decoration: underline;">Forgot Password?</a>';
          }
          showWarning(msg);
          generateCaptcha();
        }
      })
      .catch(() => {
        showError("An error occurred. Please try again.");
      });
  });
});
