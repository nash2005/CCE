<?php
session_start();
if (!isset($_SESSION['user_id']) || $_SESSION['role'] !== 'staff') {
    http_response_code(401);
    header('Content-Type: application/json');
    echo json_encode(['success' => false, 'message' => 'Unauthorized']);
    exit;
}

require_once 'db.php';

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET');

try {
    $search = isset($_GET['search']) ? $_GET['search'] : '';
    $course = isset($_GET['course']) ? $_GET['course'] : '';
    $year = isset($_GET['year']) ? $_GET['year'] : '';
    
    // Base query
    $sql = "SELECT s.*, u.email, u.status, c.course_name 
            FROM tbl_students s
            INNER JOIN tbl_users u ON s.user_id = u.user_id
            LEFT JOIN tbl_courses c ON s.course_id = c.course_id
            WHERE 1=1";
    
    $params = [];
    
    // Add filters
    if (!empty($search)) {
        $sql .= " AND (s.first_name LIKE ? OR s.last_name LIKE ? OR s.student_number LIKE ? OR u.email LIKE ?)";
        $searchTerm = "%$search%";
        $params[] = $searchTerm;
        $params[] = $searchTerm;
        $params[] = $searchTerm;
        $params[] = $searchTerm;
    }
    
    if (!empty($course)) {
        $sql .= " AND s.course_id = ?";
        $params[] = $course;
    }
    
    if (!empty($year)) {
        $sql .= " AND s.year_level = ?";
        $params[] = $year;
    }
    
    $sql .= " ORDER BY s.last_name ASC";
    
    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);
    $students = $stmt->fetchAll();
    
    echo json_encode([
        'success' => true,
        'data' => $students
    ]);

} catch (PDOException $e) {
    error_log("get_students.php error: " . $e->getMessage());
    echo json_encode([
        'success' => false,
        'message' => 'A database error occurred.'
    ]);
}
?>