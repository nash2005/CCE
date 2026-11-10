<?php
session_start();
if (!isset($_SESSION['user_id']) || !in_array($_SESSION['role'], ['student', 'alumni'])) {
    http_response_code(401);
    header('Content-Type: application/json');
    echo json_encode(['success' => false, 'message' => 'Unauthorized']);
    exit;
}

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET');
header('Access-Control-Allow-Headers: Content-Type');

require_once '../../db.php';

try {
    $stmt = $pdo->query("SELECT * FROM tbl_request_types ORDER BY type_name");
    $types = $stmt->fetchAll();
    
    echo json_encode([
        'success' => true,
        'types' => $types
    ]);

} catch (PDOException $e) {
    error_log("Database error: " . $e->getMessage());
    echo json_encode(['success' => false, 'message' => 'Database error']);
}
?>