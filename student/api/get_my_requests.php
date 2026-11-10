<?php
session_start();
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

require_once '../../db.php';
require_once '../../helpers/price_calculator.php';
require_once '../../helpers/request_helpers.php';
require_once '../../helpers/request_status.php';

if (!isset($_SESSION['user_id']) || !in_array($_SESSION['role'], ['student', 'alumni'])) {
    echo json_encode(['success' => false, 'message' => 'Not authenticated. Please log in again.']);
    exit;
}

$user_id = $_SESSION['user_id'];

try {
    $query = "SELECT
                r.request_id,
                r.tracking_number,
                r.request_date,
                r.status,
                r.student_name,
                r.course_year,
                r.date_requested,
                r.date_released,
                r.claim_schedule_start,
                r.claim_schedule_end,
                r.claim_schedule_remarks,
                r.cav_requirements_submitted,
                r.remarks
              FROM tbl_requests r
              WHERE r.user_id = :user_id AND (r.is_archived = 0 OR r.is_archived IS NULL)
              ORDER BY
                CASE
                  -- Waiting for the claiming window: a finalized request
                  -- (Ready to Claim, schedule not set yet) and a scheduled
                  -- request whose window has not started are all still pending
                  WHEN r.status IN ('Ready to Claim', 'Scheduled for Claiming')
                       AND (r.claim_schedule_start IS NULL
                            OR r.claim_schedule_start > CURDATE()) THEN 1
                  -- Window already started: the request is ready to claim
                  WHEN r.status IN ('Ready to Claim', 'Scheduled for Claiming') THEN 3
                  WHEN r.status = 'Pending' THEN 1
                  WHEN r.status = 'Processing' THEN 2
                  WHEN r.status = 'Claimed' THEN 5
                  WHEN r.status = 'Rejected' THEN 6
                  ELSE 3
                END,
                r.request_date DESC";

    $stmt = $pdo->prepare($query);
    $stmt->execute([':user_id' => $user_id]);
    $requests = $stmt->fetchAll(PDO::FETCH_ASSOC);

    // A scheduled request stays "Pending" in the UI until the first day of the
    // claiming window and only becomes "Ready to Claim" from that day onwards
    foreach ($requests as &$reqRow) {
        $reqRow = applyClaimWindowStatus($reqRow);
    }
    unset($reqRow);

    foreach ($requests as &$request) {
        $rid = $request['request_id'];

        // Build documents object from junction tables
        $request['documents'] = buildDocumentsObject($pdo, $rid);

        // Build clearance object from department tables
        $request['clearance'] = buildClearanceObject($pdo, $rid);

        // Build detailed clearance (who approved + when) for the tracker
        $request['clearance_details'] = buildClearanceDetailsObject($pdo, $rid);

        // Build remarks from department clearances + staff
        $request['remarks'] = buildRemarksObject($pdo, $rid);

        // Calculate total price from junction tables
        $request['total_price'] = calculateRequestPrice($pdo, $rid);

        // Total TOR pages for this request (set per TOR by staff at Step 2)
        $torStmt = $pdo->prepare("
            SELECT COALESCE(SUM(rd.pages * rd.copies), 0)
            FROM tbl_request_documents rd
            JOIN tbl_documents d ON rd.document_id = d.document_id
            JOIN tbl_document_types dt ON d.type_id = dt.type_id
            WHERE rd.request_id = ? AND dt.type_name = 'tor'
        ");
        $torStmt->execute([$rid]);
        $request['tor_pages'] = (int)$torStmt->fetchColumn();

        // Payment / reference number info (used by the "Submit Reference Number" tracker step)
        $payStmt = $pdo->prepare("SELECT is_paid, reference_number, paid_at FROM tbl_request_payments WHERE request_id = ?");
        $payStmt->execute([$rid]);
        $payment = $payStmt->fetch(PDO::FETCH_ASSOC);
        $request['is_paid'] = $payment ? (int)$payment['is_paid'] : 0;
        $request['reference_number'] = $payment ? $payment['reference_number'] : null;
        $request['paid_at'] = $payment ? $payment['paid_at'] : null;

        // Format date for display
        if (isset($request['request_date'])) {
            $request['request_date_formatted'] = date('M d, Y h:i A', strtotime($request['request_date']));
        }
    }

    echo json_encode([
        'success' => true,
        'requests' => $requests
    ]);

} catch (PDOException $e) {
    error_log("get_my_requests.php error: " . $e->getMessage());
    echo json_encode(["success" => false, "message" => "A database error occurred."]);
}
?>
