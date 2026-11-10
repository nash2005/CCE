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

// Validate input
if (empty($data["user_id"])) {
    echo json_encode(["success" => false, "message" => "User ID is required"]);
    exit;
}

// Use provided graduation year or default to current year
$graduation_year = !empty($data["graduation_year"]) ? (int)$data["graduation_year"] : (int)date("Y");

try {
    $pdo->beginTransaction();

    // Get student info
    $stmt = $pdo->prepare("SELECT * FROM tbl_students WHERE user_id = ?");
    $stmt->execute([$data["user_id"]]);
    $student = $stmt->fetch();

    if (!$student) {
        throw new Exception("Student not found");
    }

    // Get course name for archiving
    $stmt = $pdo->prepare("SELECT course_name FROM tbl_courses WHERE course_id = ?");
    $stmt->execute([$student["course_id"]]);
    $course_name = $stmt->fetchColumn() ?? "N/A";

    // 1️⃣ Insert into tbl_alumni
    $stmt = $pdo->prepare("
        INSERT INTO tbl_alumni (user_id, course_id, graduation_year)
        VALUES (?, ?, ?)
    ");
    $stmt->execute([
        $student["user_id"],
        $student["course_id"],
        $graduation_year
    ]);

    // 2️⃣ Update user role to alumni (role_id = 3)
    $pdo->prepare("UPDATE tbl_users SET role_id = 3 WHERE user_id = ?")
        ->execute([$student["user_id"]]);

    // 3️⃣ Archive student
    $pdo->prepare("
        INSERT INTO tbl_archived_students
        (user_id, student_number, first_name, last_name, course, year_level)
        VALUES (?, ?, ?, ?, ?, ?)
    ")->execute([
        $student["user_id"],
        $student["student_number"],
        $student["first_name"],
        $student["last_name"],
        $course_name,
        $student["year_level"]
    ]);

    // 4️⃣ Remove from tbl_students
    $pdo->prepare("DELETE FROM tbl_students WHERE user_id = ?")
        ->execute([$student["user_id"]]);

    $pdo->commit();
    echo json_encode(["success" => true]);

} catch (Exception $e) {
    $pdo->rollBack();
    error_log("graduate_student error: " . $e->getMessage());
    echo json_encode(["success" => false, "message" => "An error occurred while processing graduation."]);
}
