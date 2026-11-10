<?php
session_start();
header('Content-Type: application/json');
require_once "../../db.php";

if (!isset($_SESSION['user_id']) || $_SESSION['role'] !== 'departments') {
    echo json_encode(['success' => false, 'message' => 'Unauthorized']);
    exit;
}

require_once "../../helpers/csrf.php";
validateCsrfToken();

$data = json_decode(file_get_contents('php://input'), true);
$requestId = $data['request_id'] ?? null;
$action = $data['action'] ?? null;
$reason = $data['reason'] ?? '';

if (!$requestId || !in_array($action, ['Approved', 'Rejected', 'Pending'])) {
    echo json_encode(['success' => false, 'message' => 'Invalid request']);
    exit;
}

if ($action === 'Rejected' && empty($reason)) {
    echo json_encode(['success' => false, 'message' => 'Reason is required for rejection']);
    exit;
}

if ($action === 'Pending' && empty($reason)) {
    echo json_encode(['success' => false, 'message' => 'Remarks are required when setting to pending']);
    exit;
}

try {
    $archiveCheck = $pdo->prepare("SELECT is_archived FROM tbl_requests WHERE request_id = ?");
    $archiveCheck->execute([$requestId]);
    $request = $archiveCheck->fetch(PDO::FETCH_ASSOC);
    if (!$request) {
        echo json_encode(['success' => false, 'message' => 'Request not found']);
        exit;
    }
    if ($request['is_archived']) {
        echo json_encode(['success' => false, 'message' => 'Cannot update an archived request']);
        exit;
    }

    $remarksValue = in_array($action, ['Rejected', 'Pending']) ? $reason : '';
    if ($action === 'Approved') {
        // Record WHO approved and WHEN (used by the student tracker "who approved").
        $stmt = $pdo->prepare("UPDATE tbl_department_clearances SET status = ?, remarks = ?, approved_by = ?, approved_at = NOW() WHERE request_id = ? AND user_id = ?");
        $stmt->execute([$action, $remarksValue, $_SESSION['user_id'], $requestId, $_SESSION['user_id']]);
    } else {
        // Reverting to Pending/Rejected clears any previous approver info.
        $stmt = $pdo->prepare("UPDATE tbl_department_clearances SET status = ?, remarks = ?, approved_by = NULL, approved_at = NULL WHERE request_id = ? AND user_id = ?");
        $stmt->execute([$action, $remarksValue, $requestId, $_SESSION['user_id']]);
    }

    if ($stmt->rowCount() === 0) {
        echo json_encode(['success' => false, 'message' => 'Request not found']);
        exit;
    }

    echo json_encode(['success' => true, 'message' => 'Request ' . strtolower($action) . ' successfully']);
} catch (PDOException $e) {
    error_log("library_update_request error: " . $e->getMessage());
    echo json_encode(['success' => false, 'message' => 'A database error occurred.']);
}
