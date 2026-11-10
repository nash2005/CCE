<?php
session_start();
header('Content-Type: application/json');
require_once "../../db.php";

if (!isset($_SESSION['user_id']) || $_SESSION['role'] !== 'departments') {
    echo json_encode(['success' => false, 'message' => 'Unauthorized']);
    exit;
}

try {
    $stmt = $pdo->prepare("
        SELECT dc.status FROM tbl_department_clearances dc
        JOIN tbl_requests r ON dc.request_id = r.request_id
        WHERE dc.user_id = ? AND (r.is_archived = 0 OR r.is_archived IS NULL)
    ");
    $stmt->execute([$_SESSION['user_id']]);
    $pending = 0; $approved = 0; $rejected = 0; $total = 0;
    foreach ($stmt as $row) {
        $total++;
        switch ($row['status']) {
            case 'Pending':  $pending++;  break;
            case 'Approved': $approved++; break;
            case 'Rejected': $rejected++; break;
        }
    }
    echo json_encode(['success' => true, 'pending' => $pending, 'approved' => $approved, 'rejected' => $rejected, 'total' => $total]);
} catch (PDOException $e) {
    error_log("guidance_dashboard error: " . $e->getMessage());
    echo json_encode(['success' => false, 'message' => 'A database error occurred.']);
}
