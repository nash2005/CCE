<?php
session_start();
header('Content-Type: application/json');
if (!isset($_SESSION['user_id']) || $_SESSION['role'] !== 'admin') {
    http_response_code(403);
    echo json_encode(['success' => false, 'message' => 'Unauthorized']);
    exit;
}
require_once "../../db.php";

try {
    $stmt = $pdo->query("SELECT course_id, course_name FROM tbl_courses ORDER BY course_name");
    echo json_encode(["success" => true, "courses" => $stmt->fetchAll()]);
} catch (PDOException $e) {
    error_log("get_courses error: " . $e->getMessage());
    echo json_encode(["success" => false, "message" => "A database error occurred."]);
}
