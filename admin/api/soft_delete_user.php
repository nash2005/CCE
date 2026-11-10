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
$user_id = $data["user_id"];

try {
    $pdo->beginTransaction();

    // check role
    $stmt = $pdo->prepare("
        SELECT r.role_name
        FROM tbl_users u
        JOIN tbl_roles r ON u.role_id = r.role_id
        WHERE u.user_id = ?
    ");
    $stmt->execute([$user_id]);
    $role = $stmt->fetchColumn();

    if ($role === "student") {

        // get student info with course name
        $stmt = $pdo->prepare("
            SELECT s.*, c.course_name
            FROM tbl_students s
            JOIN tbl_courses c ON s.course_id = c.course_id
            WHERE s.user_id = ?
        ");
        $stmt->execute([$user_id]);
        $student = $stmt->fetch();

        // archive student
        $stmt = $pdo->prepare("
            INSERT INTO tbl_archived_students
            (user_id, student_number, first_name, last_name, course, year_level)
            VALUES (?, ?, ?, ?, ?, ?)
        ");
        $stmt->execute([
            $student["user_id"],
            $student["student_number"],
            $student["first_name"],
            $student["last_name"],
            $student["course_name"],
            $student["year_level"]
        ]);

        // remove from active students
        $pdo->prepare("DELETE FROM tbl_students WHERE user_id = ?")
            ->execute([$user_id]);
    }

    // soft delete user
    $pdo->prepare("UPDATE tbl_users SET status = 'inactive' WHERE user_id = ?")
        ->execute([$user_id]);

    $pdo->commit();
    echo json_encode(["success" => true]);

} catch (PDOException $e) {
    $pdo->rollBack();
    error_log("soft_delete_user error: " . $e->getMessage());
    echo json_encode(["success" => false, "message" => "A database error occurred."]);
}
