<?php
session_start();
if (!isset($_SESSION['user_id']) || $_SESSION['role'] !== 'staff') {
    http_response_code(401);
    header('Content-Type: application/json');
    echo json_encode(['success' => false, 'message' => 'Unauthorized']);
    exit;
}

require_once '../../db.php';
require_once '../../helpers/request_status.php';

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET');

try {
    // Get pending requests
    // A request with a claiming schedule is still treated as pending until the
    // first day of the claiming window
    $stmt = $pdo->query("
        SELECT 
            r.request_id,
            r.certification_type,
            r.status,
            r.claim_schedule_start,
            r.claim_schedule_end,
            u.user_id,
            s.first_name,
            s.last_name,
            a.graduation_year,
            rc.category_name,
            q.queue_number
        FROM tbl_requests r
        INNER JOIN tbl_users u ON r.user_id = u.user_id
        LEFT JOIN tbl_students s ON u.user_id = s.user_id
        LEFT JOIN tbl_alumni a ON u.user_id = a.user_id
        LEFT JOIN tbl_request_categories rc ON r.category_id = rc.category_id
        LEFT JOIN tbl_queue q ON r.request_id = q.request_id
        WHERE r.status IN ('Pending', 'Ready to Claim')
           OR (r.status = 'Scheduled for Claiming'
               AND (r.claim_schedule_start IS NULL OR r.claim_schedule_start > CURDATE()))
        ORDER BY r.request_date DESC
        LIMIT 10
    ");
    
    $requests = $stmt->fetchAll();
    
    $formattedRequests = [];
    foreach ($requests as $req) {
        $req = applyClaimWindowStatus($req);
        $studentName = ($req['first_name'] ?? '') . ' ' . ($req['last_name'] ?? 'Student');
        if (empty(trim($studentName))) {
            $studentName = 'Student User';
        }
        
        $docType = $req['certification_type'] ?? $req['category_name'] ?? 'Document Request';
        $queueNumber = $req['queue_number'] ?? 'Q-' . (101 + count($formattedRequests));
        
        $formattedRequests[] = [
            'queue_number' => $queueNumber,
            'student_name' => $studentName,
            'document_type' => $docType,
            'status' => $req['status']
        ];
    }

    echo json_encode([
        'success' => true,
        'data' => $formattedRequests
    ]);

} catch (PDOException $e) {
    // TEMPORARY DEBUG MODE - Remove after diagnosis
    error_log("get_requests.php error: " . $e->getMessage());
    echo json_encode([
        'success' => false,
        'message' => 'Database error: ' . $e->getMessage()
    ]);
}
?>