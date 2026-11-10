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
    
    // Base query
    $sql = "SELECT a.*, u.email, u.status, c.course_name,
            s.first_name, s.last_name, s.student_number
            FROM tbl_alumni a
            INNER JOIN tbl_users u ON a.user_id = u.user_id
            LEFT JOIN tbl_courses c ON a.course_id = c.course_id
            LEFT JOIN tbl_students s ON a.user_id = s.user_id
            WHERE 1=1";
    
    $params = [];
    
    if (!empty($search)) {
        $sql .= " AND (s.first_name LIKE ? OR s.last_name LIKE ? OR s.student_number LIKE ? OR u.email LIKE ?)";
        $searchTerm = "%$search%";
        $params[] = $searchTerm;
        $params[] = $searchTerm;
        $params[] = $searchTerm;
        $params[] = $searchTerm;
    }
    
    if (!empty($course)) {
        $sql .= " AND a.course_id = ?";
        $params[] = $course;
    }
    
    $sql .= " ORDER BY a.graduation_year DESC";
    
    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);
    $alumni = $stmt->fetchAll();
    
    echo json_encode([
        'success' => true,
        'data' => $alumni
    ]);

} catch (PDOException $e) {
    error_log("get_alumni.php error: " . $e->getMessage());
    echo json_encode([
        'success' => false,
        'message' => 'A database error occurred.'
    ]);
}
?>