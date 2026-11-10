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
    $stmt = $pdo->prepare("SELECT request_id, status FROM tbl_requests WHERE request_id = ? AND user_id = ?");
    $stmt->execute([$requestId, $_SESSION['user_id']]);
    $req = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$req) {
        echo json_encode(['success' => false, 'message' => 'Request not found']);
        exit;
    }

    // Soft delete
    $stmt = $pdo->prepare("UPDATE tbl_requests SET is_archived = 1 WHERE request_id = ?");
    $stmt->execute([$requestId]);

    echo json_encode(['success' => true, 'message' => 'Request archived successfully']);
} catch (PDOException $e) {
    error_log("archive_request.php error: " . $e->getMessage());
    echo json_encode(["success" => false, "message" => "A database error occurred."]);
}
