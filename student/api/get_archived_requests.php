<?php
session_start();
header('Content-Type: application/json');

if (!isset($_SESSION['user_id']) || !in_array($_SESSION['role'], ['student', 'alumni'])) {
    echo json_encode(['success' => false, 'message' => 'Not authenticated']);
    exit;
}

require_once '../../db.php';
require_once '../../helpers/price_calculator.php';
require_once '../../helpers/request_helpers.php';
require_once '../../helpers/request_status.php';

$user_id = $_SESSION['user_id'];

try {
    $stmt = $pdo->prepare("
        SELECT r.request_id, r.request_date, r.status, r.student_name, r.course_year,
               r.date_requested, r.date_released, r.remarks,
               r.claim_schedule_start, r.claim_schedule_end, r.claim_schedule_remarks
        FROM tbl_requests r
        WHERE r.user_id = :user_id AND r.is_archived = 1
        ORDER BY r.request_date DESC
    ");
    $stmt->execute([':user_id' => $user_id]);
    $requests = $stmt->fetchAll(PDO::FETCH_ASSOC);

    // A scheduled request stays "Pending" until the first day of the claiming window
    foreach ($requests as &$reqRow) {
        $reqRow = applyClaimWindowStatus($reqRow);
    }
    unset($reqRow);

    foreach ($requests as &$request) {
        $rid = $request['request_id'];
        $request['documents'] = buildDocumentsObject($pdo, $rid);
        $request['clearance'] = buildClearanceObject($pdo, $rid);
        $request['total_price'] = calculateRequestPrice($pdo, $rid);
        if (isset($request['request_date'])) {
            $request['request_date_formatted'] = date('M d, Y h:i A', strtotime($request['request_date']));
        }
    }

    echo json_encode(['success' => true, 'requests' => $requests]);
} catch (PDOException $e) {
    error_log("get_archived_requests.php error: " . $e->getMessage());
    echo json_encode(["success" => false, "message" => "A database error occurred."]);
}
