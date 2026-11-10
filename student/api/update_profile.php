<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST');
header('Access-Control-Allow-Headers: Content-Type');

require_once '../../db.php';

session_start();

if (!isset($_SESSION['user_id']) || !in_array($_SESSION['role'], ['student', 'alumni'])) {
    echo json_encode(['success' => false, 'message' => 'Not authenticated']);
    exit;
}

require_once '../../helpers/csrf.php';
validateCsrfToken();

$user_id = $_SESSION['user_id'];
$data = json_decode(file_get_contents('php://input'), true);

if (!$data) {
    echo json_encode(['success' => false, 'message' => 'Invalid input']);
    exit;
}

try {
    $pdo->beginTransaction();
    
    // Update user email if provided and not empty
    if (isset($data['email']) && !empty($data['email'])) {
        $stmt = $pdo->prepare("UPDATE tbl_users SET email = ? WHERE user_id = ?");
        $stmt->execute([$data['email'], $user_id]);
    }
    
    // Get course_id from course name
    $course_id = null;
    if (!empty($data['course'])) {
        $stmt = $pdo->prepare("SELECT course_id FROM tbl_courses WHERE course_name = ?");
        $stmt->execute([$data['course']]);
        $course = $stmt->fetch();
        if ($course) {
            $course_id = $course['course_id'];
        }
    }
    
    // Check if user exists in tbl_students
    $stmt = $pdo->prepare("SELECT * FROM tbl_students WHERE user_id = ?");
    $stmt->execute([$user_id]);
    $student = $stmt->fetch();
    
    if ($student) {
        // Update existing student record
        $stmt = $pdo->prepare("UPDATE tbl_students 
                              SET first_name = ?, last_name = ?, course_id = ?, year_level = ? 
                              WHERE user_id = ?");
        $stmt->execute([
            $data['first_name'],
            $data['last_name'],
            $course_id,
            $data['year_level'],
            $user_id
        ]);
    } else {
        // Check if user is in tbl_alumni
        $stmt = $pdo->prepare("SELECT * FROM tbl_alumni WHERE user_id = ?");
        $stmt->execute([$user_id]);
        $alumni = $stmt->fetch();
        
        if ($alumni) {
            // Update alumni record
            $stmt = $pdo->prepare("UPDATE tbl_alumni SET course_id = ? WHERE user_id = ?");
            $stmt->execute([$course_id, $user_id]);
        } else {
            // Generate student number
            $student_number = 'STU-' . str_pad($user_id, 6, '0', STR_PAD_LEFT);
            
            // Insert new student record
            $stmt = $pdo->prepare("INSERT INTO tbl_students 
                                  (user_id, student_number, first_name, last_name, course_id, year_level) 
                                  VALUES (?, ?, ?, ?, ?, ?)");
            $stmt->execute([
                $user_id,
                $student_number,
                $data['first_name'],
                $data['last_name'],
                $course_id,
                $data['year_level']
            ]);
        }
    }
    
    $pdo->commit();
    
    echo json_encode(['success' => true, 'message' => 'Profile updated successfully']);

} catch (PDOException $e) {
    $pdo->rollBack();
    error_log("update_profile.php error: " . $e->getMessage());
    echo json_encode(["success" => false, "message" => "A database error occurred."]);
}
?>