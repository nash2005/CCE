<?php
session_start();
header('Content-Type: application/json');

if (!isset($_SESSION['user_id']) || $_SESSION['role'] !== 'staff') {
    echo json_encode(['success' => false, 'message' => 'Unauthorized']);
    exit;
}

require_once "../../db.php";
require_once "../../helpers/price_calculator.php";
require_once "../../helpers/request_helpers.php";
require_once "../../helpers/request_status.php";

try {
    // First, get all requests without any calculated fields
    $stmt = $pdo->query("
        SELECT 
            r.request_id, 
            r.tracking_number, 
            r.user_id, 
            r.student_name, 
            r.course_year,
            r.date_requested, 
            r.date_released, 
            r.claim_schedule_start,
            r.claim_schedule_end,
            r.claim_schedule_remarks,
            r.cav_requirements_submitted,
            r.cav_requirements_submitted_at,
            r.status, 
            r.staff_id, 
            r.remarks
        FROM tbl_requests r
        WHERE (r.is_archived = 0 OR r.is_archived IS NULL)
        ORDER BY r.date_requested DESC
    ");
    $requests = $stmt->fetchAll(PDO::FETCH_ASSOC);

    // A scheduled request stays "Pending" until the first day of the claiming
    // window and only becomes "Ready to Claim" from that day onwards
    foreach ($requests as &$reqRow) {
        $reqRow = applyClaimWindowStatus($reqRow);
    }
    unset($reqRow);

    $result = [];
    foreach ($requests as $req) {
        $rid = $req['request_id'];
        
        // Get payment info separately
        $paymentStmt = $pdo->prepare("
            SELECT is_paid, reference_number 
            FROM tbl_request_payments 
            WHERE request_id = ?
        ");
        $paymentStmt->execute([$rid]);
        $payment = $paymentStmt->fetch(PDO::FETCH_ASSOC);
        
        $req['is_paid'] = $payment ? (int)$payment['is_paid'] : 0;
        $req['reference_number'] = $payment ? $payment['reference_number'] : null;

        // CAV requirement tracking — the staff confirms the student has dropped
        // off their Diploma at the Registrar's Office before it goes to the
        // departments for clearance
        $req['cav_requirements_submitted'] = !empty($req['cav_requirements_submitted']);
        
        // Get documents, clearance, remarks, and price
        $req['documents'] = buildDocumentsObject($pdo, $rid);
        $req['clearance'] = buildClearanceObject($pdo, $rid);
        $req['remarks'] = buildRemarksObject($pdo, $rid);
        $req['total_price'] = calculateRequestPrice($pdo, $rid);
        
        $result[] = $req;
    }

    echo json_encode(['success' => true, 'requests' => $result]);
} catch (PDOException $e) {
    error_log("get_all_requests.php error: " . $e->getMessage());
    echo json_encode(['success' => false, 'message' => 'Database error: ' . $e->getMessage()]);
} catch (Exception $e) {
    error_log("get_all_requests.php error: " . $e->getMessage());
    echo json_encode(['success' => false, 'message' => 'Error: ' . $e->getMessage()]);
}
?>