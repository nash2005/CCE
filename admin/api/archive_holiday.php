<?php
session_start();
header('Content-Type: application/json');

if (!isset($_SESSION['user_id']) || $_SESSION['role'] !== 'admin') {
    http_response_code(403);
    echo json_encode(['success' => false, 'message' => 'Unauthorized']);
    exit;
}

require_once '../../db.php';
require_once '../../helpers/csrf.php';
validateCsrfToken();

$input = json_decode(file_get_contents('php://input'), true);

$holiday_id = intval($input['holiday_id'] ?? 0);

if ($holiday_id <= 0) {
    echo json_encode(['success' => false, 'message' => 'Invalid holiday ID']);
    exit;
}

try {
    // Soft archive the holiday
    $stmt = $pdo->prepare("UPDATE tbl_holidays SET is_archived = 1 WHERE holiday_id = ?");
    $stmt->execute([$holiday_id]);

    if ($stmt->rowCount() === 0) {
        echo json_encode(['success' => false, 'message' => 'Holiday not found']);
        exit;
    }

    echo json_encode(['success' => true, 'message' => 'Holiday archived successfully']);
} catch (PDOException $e) {
    error_log("archive_holiday error: " . $e->getMessage());
    echo json_encode(['success' => false, 'message' => 'A database error occurred.']);
}
