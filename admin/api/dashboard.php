<?php
session_start();
header("Access-Control-Allow-Origin: *");
header("Content-Type: application/json");
if (!isset($_SESSION['user_id']) || $_SESSION['role'] !== 'admin') {
    http_response_code(403);
    echo json_encode(['success' => false, 'message' => 'Unauthorized']);
    exit;
}

require_once "../../db.php";

try {

    // STUDENTS
    $studentStmt = $pdo->prepare("
        SELECT COUNT(*) 
        FROM tbl_users u
        JOIN tbl_roles r ON u.role_id = r.role_id
        WHERE r.role_name = 'student'
    ");
    $studentStmt->execute();
    $students = $studentStmt->fetchColumn();

    // ALUMNI
    $alumniStmt = $pdo->prepare("
        SELECT COUNT(*) 
        FROM tbl_users u
        JOIN tbl_roles r ON u.role_id = r.role_id
        WHERE r.role_name = 'alumni'
    ");
    $alumniStmt->execute();
    $alumni = $alumniStmt->fetchColumn();

    // STAFF
    $staffStmt = $pdo->prepare("
        SELECT COUNT(*)
        FROM tbl_users u
        JOIN tbl_roles r ON u.role_id = r.role_id
        WHERE r.role_name = 'staff'
    ");
    $staffStmt->execute();
    $staff = $staffStmt->fetchColumn();

    echo json_encode([
        "students" => $students,
        "alumni" => $alumni,
        "staff" => $staff
    ]);

} catch (PDOException $e) {
    error_log("admin dashboard error: " . $e->getMessage());
    echo json_encode(["error" => "A database error occurred."]);
}
