<?php
session_start();
header('Content-Type: application/json');

if (!isset($_SESSION['user_id']) || !in_array($_SESSION['role'], ['student', 'alumni'])) {
    echo json_encode(['success' => false, 'message' => 'Not authenticated']);
    exit;
}

require_once '../../db.php';
require_once '../../helpers/csrf.php';
validateCsrfToken();

$data = json_decode(file_get_contents('php://input'), true);

$currentPassword = $data['current_password'] ?? '';
$newPassword = $data['new_password'] ?? '';

if (empty($currentPassword) || empty($newPassword)) {
    echo json_encode(['success' => false, 'message' => 'All fields are required']);
    exit;
}

// Validate new password requirements
if (strlen($newPassword) < 8) {
    echo json_encode(['success' => false, 'message' => 'Password must be at least 8 characters']);
    exit;
}
if (!preg_match('/[A-Z]/', $newPassword)) {
    echo json_encode(['success' => false, 'message' => 'Password must contain at least 1 uppercase letter']);
    exit;
}
if (!preg_match('/[^a-zA-Z0-9]/', $newPassword)) {
    echo json_encode(['success' => false, 'message' => 'Password must contain at least 1 special character']);
    exit;
}

try {
    $stmt = $pdo->prepare("SELECT password FROM tbl_users WHERE user_id = ?");
    $stmt->execute([$_SESSION['user_id']]);
    $user = $stmt->fetch();

    if (!$user || !password_verify($currentPassword, $user['password'])) {
        echo json_encode(['success' => false, 'message' => 'Current password is incorrect']);
        exit;
    }

    $hashed = password_hash($newPassword, PASSWORD_DEFAULT);
    $stmt = $pdo->prepare("UPDATE tbl_users SET password = ? WHERE user_id = ?");
    $stmt->execute([$hashed, $_SESSION['user_id']]);

    echo json_encode(['success' => true, 'message' => 'Password changed successfully']);
} catch (PDOException $e) {
    error_log("change_password.php error: " . $e->getMessage());
    echo json_encode(["success" => false, "message" => "A database error occurred."]);
}
