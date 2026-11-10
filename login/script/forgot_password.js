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
      captchaInput.classList.add(user === correct ? "correct" : "wrong");
    }
  });

  function showError(message) {
    document.getElementById("errorText").textContent = message;
    document.getElementById("errorMessage").className = "alert alert-danger";
    document.getElementById("errorMessage").style.display = "block";
    setTimeout(() => {
      document.getElementById("errorMessage").style.display = "none";
    }, 5000);
  }

  generateCaptcha();

  document
    .getElementById("forgotPasswordForm")
    .addEventListener("submit", function (e) {
      e.preventDefault();

      const userAnswer = parseInt(captchaInput.value);
      const correctAnswer = parseInt(captchaAnswer.value);

      if (userAnswer !== correctAnswer) {
        showError("Incorrect CAPTCHA answer. Please try again.");
        generateCaptcha();
        return;
      }

      const submitBtn = document.querySelector('button[type="submit"]');
      submitBtn.innerHTML =
        '<i class="fas fa-spinner fa-spin"></i> Sending...';
      submitBtn.disabled = true;

      const formData = new FormData(this);

      axios
        .post("../api/forgot_password.php", formData)
        .then((response) => {
          const data = response.data;

          if (data.status === "success") {
            Swal.fire({
              icon: "success",
              title: "Email Sent",
              text: data.message,
              confirmButtonColor: "#4a86e8",
            }).then(() => {
              window.location.href = "login.html";
            });
          } else {
            showError(data.message);
            generateCaptcha();
            submitBtn.innerHTML =
              '<i class="fas fa-paper-plane"></i> Send Reset Link';
            submitBtn.disabled = false;
          }
        })
        .catch(() => {
          showError("An error occurred. Please try again.");
          generateCaptcha();
          submitBtn.innerHTML =
            '<i class="fas fa-paper-plane"></i> Send Reset Link';
          submitBtn.disabled = false;
        });
    });
});
