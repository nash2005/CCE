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
    $stmt = $pdo->query("SELECT course_id, course_name FROM tbl_courses ORDER BY course_name");
    $courses = $stmt->fetchAll();
    
    echo json_encode([
        'success' => true,
        'data' => $courses
    ]);

} catch (PDOException $e) {
    error_log("get_courses.php error: " . $e->getMessage());
    echo json_encode([
        'success' => false,
        'message' => 'A database error occurred.'
    ]);
}
?>