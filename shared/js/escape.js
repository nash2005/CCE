/**
 * Escapes HTML special characters to prevent XSS when inserting into innerHTML.
 * @param {*} str - Value to escape (converted to string)
 * @returns {string} Escaped string safe for HTML insertion
 */
function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
