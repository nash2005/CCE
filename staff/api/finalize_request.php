<?php
session_start();
header('Content-Type: application/json');

if (!isset($_SESSION['user_id']) || $_SESSION['role'] !== 'staff') {
    echo json_encode(['success' => false, 'message' => 'Unauthorized']);
    exit;
}

require_once "../../db.php";
require_once "../../helpers/csrf.php";
require_once "../../helpers/email_helper.php";
validateCsrfToken();

$input = json_decode(file_get_contents('php://input'), true);

$requestId = isset($input['request_id']) ? (int)$input['request_id'] : 0;
$action = isset($input['action']) ? trim($input['action']) : '';
$staffRemarks = isset($input['staff_remarks']) ? trim($input['staff_remarks']) : '';

if ($requestId <= 0) {
    echo json_encode(['success' => false, 'message' => 'Request ID is required']);
    exit;
}

if ($action !== 'Ready to Claim' && $action !== 'Rejected') {
    echo json_encode(['success' => false, 'message' => 'Invalid action']);
    exit;
}

try {
    // Verify request exists and has not been finalized yet
    $stmt = $pdo->prepare("
        SELECT request_id, status, user_id 
        FROM tbl_requests 
        WHERE request_id = ?
    ");
    $stmt->execute([$requestId]);
    $request = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$request) {
        echo json_encode(['success' => false, 'message' => 'Request not found']);
        exit;
    }

    if ($request['status'] !== 'Processing') {
        echo json_encode(['success' => false, 'message' => 'Request has already been finalized or is not in Processing status']);
        exit;
    }

    // Check that all departments have responded (no pending clearances)
    $dcCheck = $pdo->prepare("
        SELECT COUNT(*) FROM tbl_department_clearances 
        WHERE request_id = ? AND status = 'Pending'
    ");
    $dcCheck->execute([$requestId]);
    if ((int)$dcCheck->fetchColumn() > 0) {
        echo json_encode(['success' => false, 'message' => 'Not all departments have responded yet']);
        exit;
    }

    // Get staff_id
    $stmtStaff = $pdo->prepare("SELECT staff_id FROM tbl_staff WHERE user_id = ?");
    $stmtStaff->execute([$_SESSION['user_id']]);
    $staff = $stmtStaff->fetch(PDO::FETCH_ASSOC);
    $staffId = $staff ? $staff['staff_id'] : null;

    $pdo->beginTransaction();

    // Store staff remarks as JSON (readable by buildRemarksObject)
    $remarksJson = json_encode(['staff' => $staffRemarks]);

    if ($action === 'Ready to Claim') {
        $updateStmt = $pdo->prepare("
            UPDATE tbl_requests 
            SET status = 'Ready to Claim', staff_id = ?, remarks = ?, date_released = CURDATE() 
            WHERE request_id = ?
        ");
    } else {
        $updateStmt = $pdo->prepare("
            UPDATE tbl_requests 
            SET status = 'Rejected', staff_id = ?, remarks = ? 
            WHERE request_id = ?
        ");
    }
    $updateStmt->execute([$staffId, $remarksJson, $requestId]);

    $pdo->commit();

    // Notify the student via email (Ready to Claim / Rejected)
    try {
        sendRequestFinalizedEmail($pdo, $requestId, $action);
    } catch (Exception $e) {
        error_log("finalize_request.php email error: " . $e->getMessage());
    }

    $message = ($action === 'Ready to Claim')
        ? 'Request finalized. The student has been notified that their request is ready to claim.'
        : 'Request finalized. The student has been notified of the rejection.';

    echo json_encode([
        'success' => true,
        'message' => $message
    ]);

} catch (PDOException $e) {
    if ($pdo->inTransaction()) $pdo->rollBack();
    error_log("finalize_request.php error: " . $e->getMessage());
    echo json_encode(['success' => false, 'message' => 'A database error occurred.']);
} catch (Exception $e) {
    if ($pdo->inTransaction()) $pdo->rollBack();
    error_log("finalize_request.php error: " . $e->getMessage());
    echo json_encode(['success' => false, 'message' => 'An error occurred.']);
}
?>