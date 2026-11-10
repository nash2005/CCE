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
    $data = json_decode(file_get_contents('php://input'), true);
    $studentId = $data['student_id'];
    
    // Start transaction
    $pdo->beginTransaction();
    
    // Get student details
    $stmt = $pdo->prepare("
        SELECT s.*, u.email, u.user_id 
        FROM tbl_students s
        INNER JOIN tbl_users u ON s.user_id = u.user_id
        WHERE s.student_id = ?
    ");
    $stmt->execute([$studentId]);
    $student = $stmt->fetch();
    
    // Insert into archived students
    $stmt = $pdo->prepare("
        INSERT INTO tbl_archived_students (user_id, student_number, first_name, last_name, course, year_level, archived_at) 
        VALUES (?, ?, ?, ?, ?, ?, NOW())
    ");
    $stmt->execute([
        $student['user_id'],
        $student['student_number'],
        $student['first_name'],
        $student['last_name'],
        $student['course_id'],
        $student['year_level']
    ]);
    
    // Update user status to inactive
    $stmt = $pdo->prepare("UPDATE tbl_users SET status = 'inactive' WHERE user_id = ?");
    $stmt->execute([$student['user_id']]);
    
    // Delete from students table
    $stmt = $pdo->prepare("DELETE FROM tbl_students WHERE student_id = ?");
    $stmt->execute([$studentId]);
    
    $pdo->commit();
    
    echo json_encode([
        'success' => true,
        'message' => 'Student archived successfully'
    ]);

} catch (PDOException $e) {
    $pdo->rollBack();
    error_log("archive_student.php error: " . $e->getMessage());
    echo json_encode([
        'success' => false,
        'message' => 'A database error occurred.'
    ]);
}
?>