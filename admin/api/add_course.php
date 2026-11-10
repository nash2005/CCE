<?php
session_start();
header('Content-Type: application/json');
if (!isset($_SESSION['user_id']) || $_SESSION['role'] !== 'admin') {
    http_response_code(403);
    echo json_encode(['success' => false, 'message' => 'Unauthorized']);
    exit;
}
require_once "../../db.php";
require_once "../../helpers/csrf.php";
validateCsrfToken();

$data = json_decode(file_get_contents("php://input"), true);
$course_name = trim($data["course_name"] ?? "");

if (empty($course_name)) {
    echo json_encode(["success" => false, "message" => "Course name is required"]);
    exit;
}

try {
    // Check for duplicate
    $stmt = $pdo->prepare("SELECT COUNT(*) FROM tbl_courses WHERE course_name = ?");
    $stmt->execute([$course_name]);
    if ($stmt->fetchColumn() > 0) {
        echo json_encode(["success" => false, "message" => "Course already exists"]);
        exit;
    }

    $stmt = $pdo->prepare("INSERT INTO tbl_courses (course_name) VALUES (?)");
    $stmt->execute([$course_name]);

    echo json_encode(["success" => true, "message" => "Course added successfully", "course_id" => $pdo->lastInsertId()]);
} catch (PDOException $e) {
    error_log("add_course error: " . $e->getMessage());
    echo json_encode(["success" => false, "message" => "A database error occurred."]);
}
