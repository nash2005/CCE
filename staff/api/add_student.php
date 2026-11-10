<?php
session_start();
if (!isset($_SESSION['user_id']) || $_SESSION['role'] !== 'staff') {
    http_response_code(401);
    header('Content-Type: application/json');
    echo json_encode(['success' => false, 'message' => 'Unauthorized']);
    exit;
}

require_once '../../db.php';
require_once '../../helpers/csrf.php';
validateCsrfToken();

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST');

try {
    $data = $_POST;
    
    // Start transaction
    $pdo->beginTransaction();
    
    // Hash password
    $hashedPassword = password_hash($data['password'], PASSWORD_DEFAULT);
    
    // Insert into tbl_users
    $stmt = $pdo->prepare("
        INSERT INTO tbl_users (role_id, email, password, status, created_at) 
        VALUES (2, ?, ?, 'active', NOW())
    ");
    $stmt->execute([$data['email'], $hashedPassword]);
    $userId = $pdo->lastInsertId();
    
    // Insert into tbl_students
    $stmt = $pdo->prepare("
        INSERT INTO tbl_students (user_id, student_number, first_name, last_name, course_id, year_level) 
        VALUES (?, ?, ?, ?, ?, ?)
    ");
    $stmt->execute([
        $userId,
        $data['student_number'],
        $data['first_name'],
        $data['last_name'],
        $data['course_id'],
        $data['year_level']
    ]);
    
    $pdo->commit();
    
    echo json_encode([
        'success' => true,
        'message' => 'Student added successfully'
    ]);

} catch (PDOException $e) {
    $pdo->rollBack();
    error_log("add_student.php error: " . $e->getMessage());
    echo json_encode([
        'success' => false,
        'message' => 'A database error occurred.'
    ]);
}
?>