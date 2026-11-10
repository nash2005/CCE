document.addEventListener("DOMContentLoaded", function () {
  const captchaInput = document.getElementById("captchaInput");
  const captchaAnswer = document.getElementById("captchaAnswer");

  function generateCaptcha() {
    const num1 = Math.floor(Math.random() * 10) + 1;
    const num2 = Math.floor(Math.random() * 10) + 1;
    document.getElementById("captchaQuestion").textContent = `${num1} + ${num2} =`;
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
  loadCourses();

  function loadCourses() {
    axios
      .get("../api/get_courses_public.php")
      .then((res) => {
        const sel = document.getElementById("courseId");
        if (res.data.success && res.data.courses.length) {
          sel.innerHTML = '<option value="" disabled selected>Select course</option>';
          res.data.courses.forEach((c) => {
            const opt = document.createElement("option");
            opt.value = c.course_id;
            opt.textContent = c.course_name;
            sel.appendChild(opt);
          });
        } else {
          sel.innerHTML = '<option value="" disabled selected>No courses available</option>';
        }
      })
      .catch(() => {
        document.getElementById("courseId").innerHTML =
          '<option value="" disabled selected>Error loading courses</option>';
      });
  }

  document
    .getElementById("registrationForm")
    .addEventListener("submit", function (e) {
      e.preventDefault();

      const userAnswer = parseInt(captchaInput.value);
      const correctAnswer = parseInt(captchaAnswer.value);

      if (userAnswer !== correctAnswer) {
        showError("Incorrect CAPTCHA answer. Please try again.");
        generateCaptcha();
        return;
      }

      const submitBtn = document.getElementById("submitBtn");
      submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Submitting...';
      submitBtn.disabled = true;

      const formData = new FormData(this);

      axios
        .post("../api/request_registration.php", formData)
        .then((response) => {
          const data = response.data;
          if (data.status === "success") {
            Swal.fire({
              icon: "success",
              title: "Request Submitted",
              text: data.message,
              confirmButtonColor: "#4a86e8",
            }).then(() => {
              window.location.href = "login.html";
            });
          } else {
            showError(data.message);
            generateCaptcha();
            submitBtn.innerHTML =
              '<i class="fas fa-paper-plane"></i> Submit Registration Request';
            submitBtn.disabled = false;
          }
        })
        .catch(() => {
          showError("An error occurred. Please try again.");
          generateCaptcha();
          submitBtn.innerHTML =
            '<i class="fas fa-paper-plane"></i> Submit Registration Request';
          submitBtn.disabled = false;
        });
    });
});
