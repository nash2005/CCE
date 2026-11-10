<?php
session_start();
if (!isset($_SESSION['user_id']) || $_SESSION['role'] !== 'staff') {
    http_response_code(401);
    header('Content-Type: application/json');
    echo json_encode(['success' => false, 'message' => 'Unauthorized']);
    exit;
}

require_once '../../db.php';

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET');

try {
    // Get a random student with their details
    $stmt = $pdo->query("
        SELECT 
            s.student_id,
            s.student_number,
            s.first_name,
            s.last_name,
            s.year_level,
            c.course_name,
            u.email,
            u.status
        FROM tbl_students s
        INNER JOIN tbl_users u ON s.user_id = u.user_id
        LEFT JOIN tbl_courses c ON s.course_id = c.course_id
        WHERE u.status = 'active'
        ORDER BY RAND()
        LIMIT 1
    ");
    
    $student = $stmt->fetch();

    if ($student) {
        echo json_encode([
            'success' => true,
            'data' => [
                'name' => $student['first_name'] . ' ' . $student['last_name'],
                'course' => $student['course_name'] ?? 'BS Information Technology',
                'year' => $student['year_level'] . 'rd Year',
                'student_id' => $student['student_number'],
                'email' => $student['email']
            ]
        ]);
    } else {
        echo json_encode([
            'success' => false,
            'message' => 'No active students found'
        ]);
    }

} catch (PDOException $e) {
    error_log("get_student_details.php error: " . $e->getMessage());
    echo json_encode([
        'success' => false,
        'message' => 'A database error occurred.'
    ]);
}
?>