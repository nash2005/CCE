<?php
/**
 * CSRF Protection Helper
 *
 * Usage in PHP endpoints:
 *   require_once "../../helpers/csrf.php";
 *   validateCsrfToken();  // call at top of POST endpoints — exits with 403 if invalid
 *
 * Usage in JS (send token with requests):
 *   The token is available via getCsrfToken() in shared/js/csrf.js
 */

/**
 * Generate or retrieve the CSRF token for the current session.
 */
function getCsrfToken() {
    if (session_status() === PHP_SESSION_NONE) {
        session_start();
    }
    if (empty($_SESSION['csrf_token'])) {
        $_SESSION['csrf_token'] = bin2hex(random_bytes(32));
    }
    return $_SESSION['csrf_token'];
}

/**
 * Validate the CSRF token from the request.
 * Checks X-CSRF-Token header first, then falls back to _csrf_token in POST body.
 * Exits with 403 JSON response if invalid.
 */
function validateCsrfToken() {
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
        return; // Only validate POST requests
    }

    $token = $_SERVER['HTTP_X_CSRF_TOKEN'] ?? '';

    // Fallback: check POST body (form data)
    if (empty($token)) {
        $token = $_POST['_csrf_token'] ?? '';
    }

    // Fallback: check JSON body
    if (empty($token)) {
        $input = file_get_contents('php://input');
        $data = json_decode($input, true);
        $token = $data['_csrf_token'] ?? '';
    }

    if (empty($token) || !hash_equals($_SESSION['csrf_token'] ?? '', $token)) {
        http_response_code(403);
        header('Content-Type: application/json');
        echo json_encode(['success' => false, 'message' => 'Invalid or missing security token. Please refresh the page and try again.']);
        exit;
    }
}
