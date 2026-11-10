<?php
require_once "../../db.php";

header('Content-Type: application/json');

try {
    $stmt = $pdo->query("SELECT course_id, course_name FROM tbl_courses ORDER BY course_name");
    echo json_encode(["success" => true, "courses" => $stmt->fetchAll()]);
} catch (PDOException $e) {
    error_log("get_courses_public error: " . $e->getMessage());
    echo json_encode(["success" => false, "message" => "Failed to load courses."]);
}
