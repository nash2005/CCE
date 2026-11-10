<?php
session_start();
header('Content-Type: application/json');

if (!isset($_SESSION['user_id']) || $_SESSION['role'] !== 'staff') {
    echo json_encode(['success' => false, 'message' => 'Unauthorized']);
    exit;
}

require_once "../../db.php";
require_once "../../helpers/csrf.php";
require_once "../../helpers/request_status.php";
validateCsrfToken();

$input = json_decode(file_get_contents('php://input'), true);
$requestId = $input['request_id'] ?? null;

if (!$requestId) {
    echo json_encode(['success' => false, 'message' => 'Missing request_id']);
    exit;
}

try {
    // Verify request is Ready to Claim
    $stmt = $pdo->prepare("SELECT status, claim_schedule_start, claim_schedule_end FROM tbl_requests WHERE request_id = ?");
    $stmt->execute([$requestId]);
    $req = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$req) {
        echo json_encode(['success' => false, 'message' => 'Request not found']);
        exit;
    }

    // New workflow: a claiming schedule must be set before the request can be claimed
    if ($req['status'] !== 'Scheduled for Claiming') {
        $statusMessage = ($req['status'] === 'Ready to Claim')
            ? 'Please set a claiming schedule for this request before marking it as claimed.'
            : 'Request is not Scheduled for Claiming';
        echo json_encode(['success' => false, 'message' => $statusMessage]);
        exit;
    }

    // A request with a claiming schedule stays "Pending" (and cannot be claimed)
    // until the first day of the claiming window
    if (getClaimWindowState($req['claim_schedule_start'], $req['claim_schedule_end']) === 'before') {
        echo json_encode([
            'success' => false,
            'message' => 'The claiming schedule starts on '
                . date('F j, Y', strtotime($req['claim_schedule_start']))
                . '. This request can only be marked as claimed from that day onwards.'
        ]);
        exit;
    }

    // Staff cannot claim a request until a reference number (payment) has been recorded
    $stmtPay = $pdo->prepare("SELECT reference_number, is_paid FROM tbl_request_payments WHERE request_id = ?");
    $stmtPay->execute([$requestId]);
    $pay = $stmtPay->fetch(PDO::FETCH_ASSOC);

    if (!$pay || empty($pay['reference_number']) || (int)$pay['is_paid'] !== 1) {
        echo json_encode(['success' => false, 'message' => 'A reference number must be entered before this request can be claimed']);
        exit;
    }

    // Get staff_id
    $stmtStaff = $pdo->prepare("SELECT staff_id FROM tbl_staff WHERE user_id = ?");
    $stmtStaff->execute([$_SESSION['user_id']]);
    $staff = $stmtStaff->fetch(PDO::FETCH_ASSOC);
    $staffId = $staff ? $staff['staff_id'] : null;

    // Update to Claimed
    $stmtUpdate = $pdo->prepare("UPDATE tbl_requests SET status = 'Claimed', staff_id = ? WHERE request_id = ?");
    $stmtUpdate->execute([$staffId, $requestId]);

    echo json_encode(['success' => true, 'message' => 'Request marked as Claimed']);
} catch (PDOException $e) {
    error_log("claim_request.php error: " . $e->getMessage());
    echo json_encode(['success' => false, 'message' => 'A database error occurred.']);
}
