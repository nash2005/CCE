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

$input = json_decode(file_get_contents('php://input'), true);
$requestId = $input['request_id'] ?? null;

if (!$requestId) {
    echo json_encode(['success' => false, 'message' => 'Missing request_id']);
    exit;
}

try {
    // Verify the request belongs to this user
    $stmt = $pdo->prepare("SELECT request_id FROM tbl_requests WHERE request_id = ? AND user_id = ? AND is_archived = 1");
    $stmt->execute([$requestId, $_SESSION['user_id']]);

    if (!$stmt->fetch()) {
        echo json_encode(['success' => false, 'message' => 'Request not found']);
        exit;
    }

    $pdo->prepare("UPDATE tbl_requests SET is_archived = 0 WHERE request_id = ?")->execute([$requestId]);

    echo json_encode(['success' => true, 'message' => 'Request restored successfully']);
} catch (PDOException $e) {
    error_log("restore_request.php error: " . $e->getMessage());
    echo json_encode(["success" => false, "message" => "A database error occurred."]);
}
