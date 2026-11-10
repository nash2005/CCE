<?php
session_start();
header('Content-Type: application/json');
require_once "../../db.php";
require_once "../../helpers/price_calculator.php";
require_once "../../helpers/request_helpers.php";

if (!isset($_SESSION['user_id']) || $_SESSION['role'] !== 'departments') {
    echo json_encode(['success' => false, 'message' => 'Unauthorized']);
    exit;
}

try {
    $stmt = $pdo->prepare("
        SELECT dc.request_id, dc.status AS department_status, dc.remarks AS dept_remarks,
               r.student_name, r.course_year, r.date_requested, r.status AS request_status, r.remarks
        FROM tbl_department_clearances dc
        JOIN tbl_requests r ON dc.request_id = r.request_id
        WHERE dc.user_id = ? AND (r.is_archived = 0 OR r.is_archived IS NULL)
        ORDER BY r.date_requested DESC
    ");
    $stmt->execute([$_SESSION['user_id']]);
    $requests = [];
    foreach ($stmt as $row) {
        $rid = $row['request_id'];
        $row['documents_data'] = buildDocumentsObject($pdo, $rid);
        $row['clearance_data'] = buildClearanceObject($pdo, $rid);
        $row['total_price'] = calculateRequestPrice($pdo, $rid);
        $requests[] = $row;
    }
    echo json_encode(['success' => true, 'requests' => $requests]);
} catch (PDOException $e) {
    error_log("dean_get_requests error: " . $e->getMessage());
    echo json_encode(['success' => false, 'message' => 'A database error occurred.']);
}
