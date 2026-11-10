<?php
session_start();
header('Content-Type: application/json');

if (!isset($_SESSION['user_id']) || $_SESSION['role'] !== 'staff') {
    echo json_encode(['success' => false, 'message' => 'Unauthorized']);
    exit;
}

require_once "../../db.php";

$input = json_decode(file_get_contents('php://input'), true);

if (!$input || !isset($input['request_id']) || !isset($input['reference_number'])) {
    echo json_encode(['success' => false, 'message' => 'Missing required fields']);
    exit;
}

$requestId = (int)$input['request_id'];
$referenceNumber = trim($input['reference_number']);

if (empty($referenceNumber)) {
    echo json_encode(['success' => false, 'message' => 'Reference number cannot be empty']);
    exit;
}

try {
    // Check if request exists and is ready to claim
    $stmt = $pdo->prepare("
        SELECT request_id, status, user_id 
        FROM tbl_requests 
        WHERE request_id = ? AND status = 'Ready to Claim'
    ");
    $stmt->execute([$requestId]);
    $request = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$request) {
        echo json_encode(['success' => false, 'message' => 'Request not found or not ready to claim']);
        exit;
    }

    // Check if already paid
    $stmtCheck = $pdo->prepare("
        SELECT id, reference_number, is_paid 
        FROM tbl_request_payments 
        WHERE request_id = ?
    ");
    $stmtCheck->execute([$requestId]);
    $existing = $stmtCheck->fetch(PDO::FETCH_ASSOC);

    if ($existing && $existing['is_paid'] == 1) {
        echo json_encode(['success' => false, 'message' => 'This request has already been marked as paid']);
        exit;
    }

    // Get staff_id
    $stmtStaff = $pdo->prepare("SELECT staff_id FROM tbl_staff WHERE user_id = ?");
    $stmtStaff->execute([$_SESSION['user_id']]);
    $staff = $stmtStaff->fetch(PDO::FETCH_ASSOC);
    $staffId = $staff ? $staff['staff_id'] : null;

    // Insert or update payment record
    if ($existing) {
        $stmtUpdate = $pdo->prepare("
            UPDATE tbl_request_payments 
            SET reference_number = ?, is_paid = 1, paid_at = NOW(), staff_id = ?
            WHERE request_id = ?
        ");
        $stmtUpdate->execute([
            $referenceNumber,
            $staffId,
            $requestId
        ]);
    } else {
        $stmtInsert = $pdo->prepare("
            INSERT INTO tbl_request_payments (request_id, reference_number, is_paid, paid_at, staff_id) 
            VALUES (?, ?, 1, NOW(), ?)
        ");
        $stmtInsert->execute([
            $requestId,
            $referenceNumber,
            $staffId
        ]);
    }

    echo json_encode([
        'success' => true, 
        'message' => 'Reference number submitted successfully. Payment marked as PAID.'
    ]);

    // Send email notification to student — non-blocking
    try {
        require_once '../../helpers/email_helper.php';
        sendReferenceSubmittedEmail($pdo, $requestId);
    } catch (Exception $e) {
        error_log("Email notification failed for reference submission on request $requestId: " . $e->getMessage());
    }



} catch (PDOException $e) {
    error_log("submit_reference.php error: " . $e->getMessage());
    echo json_encode(['success' => false, 'message' => 'A database error occurred: ' . $e->getMessage()]);
} catch (Exception $e) {
    error_log("submit_reference.php error: " . $e->getMessage());
    echo json_encode(['success' => false, 'message' => 'An error occurred: ' . $e->getMessage()]);
}
?>