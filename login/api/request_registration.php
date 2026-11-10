<?php
session_start();
require_once "../../db.php";
require_once "../../helpers/csrf.php";

header('Content-Type: application/json');
validateCsrfToken();

if ($_SERVER["REQUEST_METHOD"] !== "POST") {
    echo json_encode(["status" => "error", "message" => "Invalid request"]);
    exit;
}

$student_number = trim($_POST["student_number"] ?? "");
$first_name     = trim($_POST["first_name"] ?? "");
$last_name      = trim($_POST["last_name"] ?? "");
$course_id      = intval($_POST["course_id"] ?? 0);
$year_level     = intval($_POST["year_level"] ?? 0);

if (empty($student_number) || empty($first_name) || empty($last_name) || $course_id <= 0 || $year_level <= 0) {
    echo json_encode(["status" => "error", "message" => "All fields are required."]);
    exit;
}

if ($year_level < 1 || $year_level > 5) {
    echo json_encode(["status" => "error", "message" => "Invalid year level."]);
    exit;
}

try {
    // Check if student number already exists in tbl_students
    $stmt = $pdo->prepare("SELECT student_id FROM tbl_students WHERE student_number = :sn LIMIT 1");
    $stmt->execute(["sn" => $student_number]);
    if ($stmt->fetch()) {
        echo json_encode(["status" => "error", "message" => "This Student ID is already registered in the system."]);
        exit;
    }

    // Check for duplicate pending registration request
    $stmt = $pdo->prepare("SELECT id FROM tbl_registration_requests WHERE student_number = :sn AND status = 'pending' LIMIT 1");
    $stmt->execute(["sn" => $student_number]);
    if ($stmt->fetch()) {
        echo json_encode(["status" => "error", "message" => "A registration request for this Student ID is already pending."]);
        exit;
    }

    // Validate course exists
    $stmt = $pdo->prepare("SELECT course_id FROM tbl_courses WHERE course_id = :cid LIMIT 1");
    $stmt->execute(["cid" => $course_id]);
    if (!$stmt->fetch()) {
        echo json_encode(["status" => "error", "message" => "Invalid course selected."]);
        exit;
    }

    // Insert registration request
    $stmt = $pdo->prepare("
        INSERT INTO tbl_registration_requests (student_number, first_name, last_name, course_id, year_level)
        VALUES (:sn, :fn, :ln, :cid, :yl)
    ");
    $stmt->execute([
        "sn"  => $student_number,
        "fn"  => $first_name,
        "ln"  => $last_name,
        "cid" => $course_id,
        "yl"  => $year_level
    ]);

    echo json_encode(["status" => "success", "message" => "Your registration request has been submitted. Please wait for admin approval."]);

} catch (PDOException $e) {
    error_log("request_registration error: " . $e->getMessage());
    echo json_encode(["status" => "error", "message" => "A server error occurred. Please try again later."]);
}
