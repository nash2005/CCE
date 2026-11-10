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

if (empty($data['user_id'])) {
    echo json_encode(['success' => false, 'message' => 'User ID is required']);
    exit;
}

$userId = (int) $data['user_id'];

try {
    // Get current user info
    $stmt = $pdo->prepare("
        SELECT u.user_id, u.email, r.role_name
        FROM tbl_users u
        JOIN tbl_roles r ON u.role_id = r.role_id
        WHERE u.user_id = ?
    ");
    $stmt->execute([$userId]);
    $user = $stmt->fetch();

    if (!$user) {
        echo json_encode(['success' => false, 'message' => 'User not found']);
        exit;
    }

    $role = $user['role_name'];

    $pdo->beginTransaction();

    // Update email if provided and changed
    if (!empty($data['email']) && $data['email'] !== $user['email']) {
        $checkStmt = $pdo->prepare("SELECT user_id FROM tbl_users WHERE email = ? AND user_id != ?");
        $checkStmt->execute([$data['email'], $userId]);
        if ($checkStmt->fetch()) {
            $pdo->rollBack();
            echo json_encode(['success' => false, 'message' => 'Email already in use']);
            exit;
        }
        $stmt = $pdo->prepare("UPDATE tbl_users SET email = ? WHERE user_id = ?");
        $stmt->execute([$data['email'], $userId]);
    }

    // Update password if provided
    if (!empty($data['password'])) {
        $stmt = $pdo->prepare("UPDATE tbl_users SET password = ? WHERE user_id = ?");
        $stmt->execute([password_hash($data['password'], PASSWORD_DEFAULT), $userId]);
    }

    // Role-specific updates
    if ($role === 'student') {
        $updates = [];
        $params = [];

        if (isset($data['first_name'])) { $updates[] = "first_name = ?"; $params[] = $data['first_name']; }
        if (isset($data['last_name']))  { $updates[] = "last_name = ?";  $params[] = $data['last_name']; }
        if (isset($data['student_number'])) { $updates[] = "student_number = ?"; $params[] = $data['student_number']; }
        if (isset($data['course_id']))  { $updates[] = "course_id = ?";  $params[] = (int)$data['course_id']; }
        if (isset($data['year_level'])) { $updates[] = "year_level = ?"; $params[] = (int)$data['year_level']; }

        if (!empty($updates)) {
            $params[] = $userId;
            $stmt = $pdo->prepare("UPDATE tbl_students SET " . implode(", ", $updates) . " WHERE user_id = ?");
            $stmt->execute($params);
        }

    } elseif ($role === 'staff') {
        $updates = [];
        $params = [];

        if (isset($data['first_name'])) { $updates[] = "first_name = ?"; $params[] = $data['first_name']; }
        if (isset($data['last_name']))  { $updates[] = "last_name = ?";  $params[] = $data['last_name']; }
        if (isset($data['employee_number'])) { $updates[] = "employee_number = ?"; $params[] = $data['employee_number']; }

        if (!empty($updates)) {
            $params[] = $userId;
            $stmt = $pdo->prepare("UPDATE tbl_staff SET " . implode(", ", $updates) . " WHERE user_id = ?");
            $stmt->execute($params);
        }

    } elseif ($role === 'alumni') {
        $updates = [];
        $params = [];

        if (isset($data['course_id']))      { $updates[] = "course_id = ?";      $params[] = (int)$data['course_id']; }
        if (isset($data['graduation_year'])) { $updates[] = "graduation_year = ?"; $params[] = (int)$data['graduation_year']; }

        if (!empty($updates)) {
            $params[] = $userId;
            $stmt = $pdo->prepare("UPDATE tbl_alumni SET " . implode(", ", $updates) . " WHERE user_id = ?");
            $stmt->execute($params);
        }

        // Update names in archived_students
        $nameUpdates = [];
        $nameParams = [];
        if (isset($data['first_name'])) { $nameUpdates[] = "first_name = ?"; $nameParams[] = $data['first_name']; }
        if (isset($data['last_name']))  { $nameUpdates[] = "last_name = ?";  $nameParams[] = $data['last_name']; }

        if (!empty($nameUpdates)) {
            $nameParams[] = $userId;
            $stmt = $pdo->prepare("UPDATE tbl_archived_students SET " . implode(", ", $nameUpdates) . " WHERE user_id = ?");
            $stmt->execute($nameParams);
        }
    }

    $pdo->commit();
    echo json_encode(['success' => true, 'message' => 'User updated successfully']);

} catch (PDOException $e) {
    $pdo->rollBack();
    error_log("edit_user error: " . $e->getMessage());
    echo json_encode(['success' => false, 'message' => 'A database error occurred.']);
}
