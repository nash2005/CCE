<?php
session_start();
if (!isset($_SESSION['user_id']) || $_SESSION['role'] !== 'staff') {
    http_response_code(401);
    header('Content-Type: application/json');
    echo json_encode(['success' => false, 'message' => 'Unauthorized']);
    exit;
}

require_once 'db.php';

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET');

try {
    // Get total students
    $stmt = $pdo->query("SELECT COUNT(*) as total FROM tbl_students");
    $total = $stmt->fetch()['total'];
    
    // Get active students
    $stmt = $pdo->query("
        SELECT COUNT(*) as active 
        FROM tbl_students s 
        INNER JOIN tbl_users u ON s.user_id = u.user_id 
        WHERE u.status = 'active'
    ");
    $active = $stmt->fetch()['active'];
    
    // Get archived students
    $stmt = $pdo->query("SELECT COUNT(*) as archived FROM tbl_archived_students");
    $archived = $stmt->fetch()['archived'];

    echo json_encode([
        'success' => true,
        'total' => (int)$total,
        'active' => (int)$active,
        'archived' => (int)$archived
    ]);

} catch (PDOException $e) {
    error_log("get_dashboard_stats.php error: " . $e->getMessage());
    echo json_encode([
        'success' => false,
        'message' => 'A database error occurred.'
    ]);
}
?>