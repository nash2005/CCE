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

$id     = intval($data['id'] ?? 0);
$action = $data['action'] ?? '';
$remarks = trim($data['remarks'] ?? '');

if ($id <= 0 || !in_array($action, ['approve', 'reject'])) {
    echo json_encode(["success" => false, "message" => "Invalid request."]);
    exit;
}

try {
    // Get the registration request
    $stmt = $pdo->prepare("SELECT * FROM tbl_registration_requests WHERE id = :id AND status = 'pending' LIMIT 1");
    $stmt->execute(["id" => $id]);
    $request = $stmt->fetch();

    if (!$request) {
        echo json_encode(["success" => false, "message" => "Registration request not found or already processed."]);
        exit;
    }

    if ($action === 'reject') {
        $stmt = $pdo->prepare("UPDATE tbl_registration_requests SET status = 'rejected', admin_remarks = :remarks, processed_at = NOW() WHERE id = :id");
        $stmt->execute(["remarks" => $remarks, "id" => $id]);
        echo json_encode(["success" => true, "message" => "Registration request rejected."]);
        exit;
    }

    // Approve: create user account + student record
    $email    = $data['email'] ?? '';
    $password = $data['password'] ?? '';

    if (empty($email) || empty($password)) {
        echo json_encode(["success" => false, "message" => "Email and password are required for approval."]);
        exit;
    }

    // Check email uniqueness
    $stmt = $pdo->prepare("SELECT user_id FROM tbl_users WHERE email = :email LIMIT 1");
    $stmt->execute(["email" => $email]);
    if ($stmt->fetch()) {
        echo json_encode(["success" => false, "message" => "This email is already in use."]);
        exit;
    }

    // Check student number uniqueness
    $stmt = $pdo->prepare("SELECT student_id FROM tbl_students WHERE student_number = :sn LIMIT 1");
    $stmt->execute(["sn" => $request['student_number']]);
    if ($stmt->fetch()) {
        echo json_encode(["success" => false, "message" => "This Student ID is already registered."]);
        exit;
    }

    $pdo->beginTransaction();

    // Create user
    $roleStmt = $pdo->prepare("SELECT role_id FROM tbl_roles WHERE role_name = 'student'");
    $roleStmt->execute();
    $role_id = $roleStmt->fetchColumn();

    $stmt = $pdo->prepare("INSERT INTO tbl_users (role_id, email, password, status) VALUES (?, ?, ?, 'active')");
    $stmt->execute([$role_id, $email, password_hash($password, PASSWORD_DEFAULT)]);
    $user_id = $pdo->lastInsertId();

    // Create student record
    $stmt = $pdo->prepare("INSERT INTO tbl_students (user_id, student_number, course_id, first_name, last_name, year_level) VALUES (?, ?, ?, ?, ?, ?)");
    $stmt->execute([
        $user_id,
        $request['student_number'],
        $request['course_id'],
        $request['first_name'],
        $request['last_name'],
        $request['year_level']
    ]);

    // Update registration request
    $stmt = $pdo->prepare("UPDATE tbl_registration_requests SET status = 'approved', admin_remarks = :remarks, processed_at = NOW() WHERE id = :id");
    $stmt->execute(["remarks" => $remarks, "id" => $id]);

    $pdo->commit();

    echo json_encode(["success" => true, "message" => "Student account created successfully."]);

} catch (PDOException $e) {
    if ($pdo->inTransaction()) {
        $pdo->rollBack();
    }
    error_log("process_registration error: " . $e->getMessage());
    echo json_encode(["success" => false, "message" => "A database error occurred. Please try again."]);
}
