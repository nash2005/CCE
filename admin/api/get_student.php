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
    $id = (int)($_GET["user_id"] ?? 0);

    $stmt = $pdo->prepare("
        SELECT s.first_name, s.last_name, s.student_number, s.course_id
        FROM tbl_students s
        WHERE s.user_id = ?
    ");
    $stmt->execute([$id]);

    echo json_encode(["success" => true, "student" => $stmt->fetch()]);
} catch (PDOException $e) {
    error_log("get_student error: " . $e->getMessage());
    echo json_encode(["success" => false, "message" => "A database error occurred."]);
}
