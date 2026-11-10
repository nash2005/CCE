/**
 * Submission loading toast (shared helper).
 *
 * Every action that sends data to the server — submitting a document request,
 * saving a profile, changing a password, recording a reference number,
 * saving a claiming schedule, finalizing a request ... — uses this instead of a
 * big centered "Please wait" dialog. The card slides in at the lower-right
 * corner of the screen, the ring spinner keeps rotating and the bar at the
 * bottom keeps sweeping, so the user can tell the submission is still being
 * processed while the page behind stays visible and usable.
 *
 * Usage:
 *   showSubmitLoader("Submitting your request...", "Submitting");
 *   ...
 *   closeSubmitLoader();
 *
 * Styles live in shared/css/theme.css (.swal2-toast / .submit-loading-*).
 */
(function () {
  var DEFAULT_TITLE = "Please wait";

  function escapeText(value) {
    if (value === null || value === undefined) return "";
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function buildLoadingHtml(message, title) {
    var msg = escapeText(message);
    return (
      '<div class="submit-loading-wrap">' +
        '<span class="submit-loading-spinner" aria-hidden="true"></span>' +
        '<span class="submit-loading-text">' +
          '<span class="submit-loading-title">' + escapeText(title || DEFAULT_TITLE) + "</span>" +
          (msg ? '<span class="submit-loading-msg">' + msg + "</span>" : "") +
        "</span>" +
      "</div>" +
      '<span class="submit-loading-bar" aria-hidden="true"></span>'
    );
  }

  /**
   * Show the lower-right loading toast.
   * @param {string} [message] - What is being submitted, e.g. "Submitting your request..."
   * @param {string} [title]   - Bold heading of the toast (defaults to "Please wait")
   * @returns {Promise|undefined} SweetAlert2 promise for the toast
   */
  window.showSubmitLoader = function (message, title) {
    if (typeof Swal === "undefined") return;
    return Swal.fire({
      toast: true,
      position: "bottom-end",
      html: buildLoadingHtml(message, title),
      showConfirmButton: false,
      showCloseButton: false,
      showCancelButton: false,
      allowOutsideClick: false,
      allowEscapeKey: false,
      allowEnterKey: false,
      focusConfirm: false,
      didOpen: function (popup) {
        popup.setAttribute("role", "status");
        popup.setAttribute("aria-live", "polite");
        popup.setAttribute("aria-busy", "true");
      },
    });
  };

  /**
   * Close the toast opened by showSubmitLoader().
   * Safe to call when nothing is open (it never closes another dialog).
   */
  window.closeSubmitLoader = function () {
    if (typeof Swal === "undefined") return;
    if (!Swal.isVisible()) return;
    if (document.querySelector(".submit-loading-wrap")) Swal.close();
  };
})();