<?php
session_start();
require_once "../../db.php";
require_once "../../helpers/csrf.php";
validateCsrfToken();

header('Content-Type: application/json');

if ($_SERVER["REQUEST_METHOD"] !== "POST") {
    echo json_encode(["status" => "error", "message" => "Invalid request"]);
    exit;
}

$data = json_decode(file_get_contents("php://input"), true);
$token = trim($data["token"] ?? "");
$password = $data["password"] ?? "";

if (empty($token) || empty($password)) {
    echo json_encode(["status" => "error", "message" => "Token and password are required"]);
    exit;
}

// Validate password strength
if (strlen($password) < 8) {
    echo json_encode(["status" => "error", "message" => "Password must be at least 8 characters"]);
    exit;
}

if (!preg_match('/[A-Z]/', $password)) {
    echo json_encode(["status" => "error", "message" => "Password must contain at least 1 uppercase letter"]);
    exit;
}

if (!preg_match('/[^A-Za-z0-9]/', $password)) {
    echo json_encode(["status" => "error", "message" => "Password must contain at least 1 special character"]);
    exit;
}

try {
    // Find valid token
    $stmt = $pdo->prepare("SELECT email FROM tbl_password_resets WHERE token = :token AND expires_at > NOW() LIMIT 1");
    $stmt->execute(["token" => $token]);
    $reset = $stmt->fetch();

    if (!$reset) {
        echo json_encode(["status" => "error", "message" => "Invalid or expired reset link. Please request a new one."]);
        exit;
    }

    $email = $reset["email"];

    // Update password
    $hashedPassword = password_hash($password, PASSWORD_DEFAULT);
    $stmt = $pdo->prepare("UPDATE tbl_users SET password = :password WHERE email = :email AND status = 'active'");
    $stmt->execute([
        "password" => $hashedPassword,
        "email" => $email
    ]);

    if ($stmt->rowCount() === 0) {
        echo json_encode(["status" => "error", "message" => "Failed to update password. User may not exist."]);
        exit;
    }

    // Delete all reset tokens for this email
    $stmt = $pdo->prepare("DELETE FROM tbl_password_resets WHERE email = :email");
    $stmt->execute(["email" => $email]);

    echo json_encode(["status" => "success", "message" => "Password reset successfully"]);

} catch (PDOException $e) {
    error_log("Reset password error: " . $e->getMessage());
    echo json_encode(["status" => "error", "message" => "A server error occurred. Please try again later."]);
}
?>
