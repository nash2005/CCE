<?php
session_start();
header('Content-Type: application/json');

if (!isset($_SESSION['user_id']) || $_SESSION['role'] !== 'staff') {
    echo json_encode(['success' => false, 'message' => 'Unauthorized']);
    exit;
}

require_once "../../db.php";
require_once "../../helpers/csrf.php";
validateCsrfToken();

$data = json_decode(file_get_contents("php://input"), true);
$user_id = (int)($data['user_id'] ?? 0);
$total_pages = (int)($data['total_pages'] ?? 0);

if ($user_id <= 0) {
    echo json_encode(['success' => false, 'message' => 'User ID is required']);
    exit;
}
if ($total_pages <= 0) {
    echo json_encode(['success' => false, 'message' => 'Total pages must be greater than 0']);
    exit;
}

try {
    $stmt = $pdo->prepare("
        INSERT INTO tbl_student_tor_pages (user_id, total_pages, updated_by, updated_at)
        VALUES (?, ?, ?, NOW())
        ON DUPLICATE KEY UPDATE total_pages = VALUES(total_pages), updated_by = VALUES(updated_by), updated_at = NOW()
    ");
    $stmt->execute([$user_id, $total_pages, $_SESSION['user_id']]);

    echo json_encode(['success' => true, 'message' => "TOR pages set to {$total_pages}"]);
} catch (PDOException $e) {
    error_log("set_tor_pages error: " . $e->getMessage());
    echo json_encode(['success' => false, 'message' => 'A database error occurred.']);
}
