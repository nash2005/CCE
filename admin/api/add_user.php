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

try {
    $pdo->beginTransaction();

    $roleStmt = $pdo->prepare("SELECT role_id FROM tbl_roles WHERE role_name = ?");
    $roleStmt->execute([$data["role"]]);
    $role_id = $roleStmt->fetchColumn();

    $stmt = $pdo->prepare("
        INSERT INTO tbl_users (role_id, email, password, status)
        VALUES (?, ?, ?, 'active')
    ");
    $stmt->execute([
        $role_id,
        $data["email"],
        password_hash($data["password"], PASSWORD_DEFAULT)
    ]);

    $user_id = $pdo->lastInsertId();

    if ($data["role"] === "student") {
        $stmt = $pdo->prepare("
            INSERT INTO tbl_students (user_id, student_number, course_id, first_name, last_name, year_level)
            VALUES (?, ?, ?, ?, ?, ?)
        ");
        $stmt->execute([
            $user_id,
            $data["extra"]["student_number"],
            $data["extra"]["course_id"],
            $data["first_name"],
            $data["last_name"],
            $data["extra"]["year_level"]
        ]);
    }

    if ($data["role"] === "alumni") {
        $stmt = $pdo->prepare("
            INSERT INTO tbl_alumni (user_id, course_id, graduation_year)
            VALUES (?, ?, ?)
        ");
        $stmt->execute([
            $user_id,
            $data["extra"]["course_id"],
            $data["extra"]["graduation_year"]
        ]);
    }

    if ($data["role"] === "staff") {
        $stmt = $pdo->prepare("
            INSERT INTO tbl_staff (user_id, first_name, last_name)
            VALUES (?, ?, ?)
        ");
        $stmt->execute([
            $user_id,
            $data["first_name"],
            $data["last_name"]
        ]);
    }

    $pdo->commit();
    echo json_encode(["success" => true, "message" => "User added successfully"]);

} catch (PDOException $e) {
    $pdo->rollBack();
    error_log("add_user error: " . $e->getMessage());
    echo json_encode(["success" => false, "message" => "A database error occurred. Please try again."]);
}
