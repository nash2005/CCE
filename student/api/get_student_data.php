<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET');
header('Access-Control-Allow-Headers: Content-Type');

require_once '../../db.php';

session_start();

if (!isset($_SESSION['user_id']) || !in_array($_SESSION['role'], ['student', 'alumni'])) {
    http_response_code(401);
    echo json_encode(['success' => false, 'message' => 'Unauthorized. Please log in.']);
    exit;
}

$user_id = $_SESSION['user_id'];

try {
    // Get user information from tbl_users
    $stmt = $pdo->prepare("SELECT u.*, r.role_name 
                          FROM tbl_users u 
                          LEFT JOIN tbl_roles r ON u.role_id = r.role_id 
                          WHERE u.user_id = ?");
    $stmt->execute([$user_id]);
    $user = $stmt->fetch();
    
    if (!$user) {
        echo json_encode(['success' => false, 'message' => 'User not found']);
        exit;
    }

    // FIRST: Try to get student data from tbl_students (primary source)
    $stmt = $pdo->prepare("SELECT s.*, c.course_name 
                          FROM tbl_students s 
                          LEFT JOIN tbl_courses c ON s.course_id = c.course_id 
                          WHERE s.user_id = ?");
    $stmt->execute([$user_id]);
    $student = $stmt->fetch();

    // SECOND: If not found in tbl_students, try tbl_archived_students (your data is here)
    if (!$student) {
        $stmt = $pdo->prepare("SELECT * FROM tbl_archived_students WHERE user_id = ?");
        $stmt->execute([$user_id]);
        $archived = $stmt->fetch();
        
        if ($archived) {
            $student = [
                'student_id' => $archived['archived_student_id'],
                'student_number' => $archived['student_number'],
                'first_name' => $archived['first_name'],
                'last_name' => $archived['last_name'],
                'course_name' => $archived['course'],
                'year_level' => $archived['year_level'],
                'user_id' => $archived['user_id']
            ];
        }
    }

    // THIRD: If user is alumni (role_id = 3), get from tbl_alumni
    if (!$student && $user['role_id'] == 3) {
        $stmt = $pdo->prepare("SELECT a.*, c.course_name 
                              FROM tbl_alumni a 
                              LEFT JOIN tbl_courses c ON a.course_id = c.course_id 
                              WHERE a.user_id = ?");
        $stmt->execute([$user_id]);
        $alumni = $stmt->fetch();
        
        if ($alumni) {
            $student = [
                'student_id' => $alumni['alumni_id'],
                'student_number' => 'ALU-' . str_pad($user_id, 6, '0', STR_PAD_LEFT),
                'first_name' => explode('@', $user['email'])[0],
                'last_name' => '',
                'course_name' => $alumni['course_name'] ?? 'Not Assigned',
                'year_level' => 'Graduated ' . ($alumni['graduation_year'] ?? ''),
                'user_id' => $user_id
            ];
        }
    }

    // Get request statistics from tbl_requests
    // A scheduled request is still counted as pending until the first day of the
    // claiming window (it is only "ready to claim" from that day onwards)
    $stmt = $pdo->prepare("SELECT 
                            COUNT(*) as total,
                            SUM(CASE WHEN LOWER(status) = 'pending'
                                      OR (status = 'Scheduled for Claiming' AND claim_schedule_start IS NOT NULL AND claim_schedule_start > CURDATE())
                                     THEN 1 ELSE 0 END) as pending,
                            SUM(CASE WHEN LOWER(status) IN ('completed', 'approved', 'released') THEN 1 ELSE 0 END) as completed
                          FROM tbl_requests 
                          WHERE user_id = ?");
    $stmt->execute([$user_id]);
    $stats = $stmt->fetch();

    // Format full name
    $full_name = '';
    if ($student) {
        $full_name = trim(($student['first_name'] ?? '') . ' ' . ($student['last_name'] ?? ''));
    }
    if (empty($full_name)) {
        $full_name = explode('@', $user['email'])[0];
    }

    // Debug log
    error_log("Student data for user $user_id: " . print_r($student, true));

    $response = [
        'success' => true,
        'user' => [
            'user_id' => $user['user_id'],
            'email' => $user['email'],
            'role' => $user['role_name'] ?? 'student',
            'role_id' => $user['role_id'],
            'status' => $user['status'] ?? 'active',
            'created_at' => $user['created_at']
        ],
        'student' => [
            'student_id' => $student['student_id'] ?? null,
            'first_name' => $student['first_name'] ?? '',
            'last_name' => $student['last_name'] ?? '',
            'student_number' => $student['student_number'] ?? 'Not Assigned',
            'course' => $student['course_name'] ?? $student['course'] ?? 'Not Assigned',
            'course_id' => $student['course_id'] ?? null,
            'year_level' => $student['year_level'] ?? '',
            'full_name' => $full_name
        ],
        'requests' => [
            'total' => (int)($stats['total'] ?? 0),
            'pending' => (int)($stats['pending'] ?? 0),
            'completed' => (int)($stats['completed'] ?? 0)
        ]
    ];

    echo json_encode($response);

} catch (PDOException $e) {
    error_log("get_student_data.php error: " . $e->getMessage());
    echo json_encode(["success" => false, "message" => "A database error occurred."]);
}
?>