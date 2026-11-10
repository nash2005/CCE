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
$request_id = (int)($data['request_id'] ?? 0);

if ($request_id <= 0) {
    echo json_encode(['success' => false, 'message' => 'Request ID is required']);
    exit;
}

try {
    $stmt = $pdo->prepare("SELECT request_id, status FROM tbl_requests WHERE request_id = ?");
    $stmt->execute([$request_id]);
    $request = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$request) {
        echo json_encode(['success' => false, 'message' => 'Request not found']);
        exit;
    }

    // Only a request still waiting for the Step 2 review can be confirmed
    if ($request['status'] !== 'Pending') {
        echo json_encode(['success' => false, 'message' => 'Request has already been sent to departments']);
        exit;
    }

    $dcCheck = $pdo->prepare("SELECT COUNT(*) FROM tbl_department_clearances WHERE request_id = ?");
    $dcCheck->execute([$request_id]);
    if ((int)$dcCheck->fetchColumn() > 0) {
        echo json_encode(['success' => false, 'message' => 'Request has already been sent to departments']);
        exit;
    }

    // The request must actually contain a CAV document
    $cavCheck = $pdo->prepare("
        SELECT COUNT(*) FROM tbl_request_documents rd
        JOIN tbl_documents d ON rd.document_id = d.document_id
        JOIN tbl_document_types dt ON d.type_id = dt.type_id
        WHERE rd.request_id = ? AND dt.type_name = 'cav'
    ");
    $cavCheck->execute([$request_id]);
    if ((int)$cavCheck->fetchColumn() === 0) {
        echo json_encode(['success' => false, 'message' => 'This request does not include a CAV document']);
        exit;
    }

    $pdo->prepare("
        UPDATE tbl_requests
        SET cav_requirements_submitted = 1, cav_requirements_submitted_at = NOW()
        WHERE request_id = ?
    ")->execute([$request_id]);

    $atStmt = $pdo->prepare("SELECT cav_requirements_submitted_at FROM tbl_requests WHERE request_id = ?");
    $atStmt->execute([$request_id]);
    $submittedAt = $atStmt->fetchColumn();

    echo json_encode([
        'success' => true,
        'message' => 'CAV requirements submitted. You may now send this request to all departments for clearance.',
        'submitted_at' => $submittedAt
    ]);
} catch (PDOException $e) {
    error_log("submit_cav_requirements.php error: " . $e->getMessage());
    echo json_encode(['success' => false, 'message' => 'A database error occurred.']);
}
?>