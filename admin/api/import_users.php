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

if (empty($data['role']) || empty($data['users']) || !is_array($data['users'])) {
    echo json_encode(['success' => false, 'message' => 'Invalid request data']);
    exit;
}

$role = $data['role'];
$users = $data['users'];

// Validate role
if (!in_array($role, ['student', 'alumni', 'staff'])) {
    echo json_encode(['success' => false, 'message' => 'Invalid role']);
    exit;
}

try {
    // Get role_id
    $roleStmt = $pdo->prepare("SELECT role_id FROM tbl_roles WHERE role_name = ?");
    $roleStmt->execute([$role]);
    $role_id = $roleStmt->fetchColumn();

    if (!$role_id) {
        echo json_encode(['success' => false, 'message' => 'Role not found']);
        exit;
    }

    // Pre-load courses for name -> id lookup
    $courseMap = [];
    $courseStmt = $pdo->query("SELECT course_id, course_name FROM tbl_courses");
    foreach ($courseStmt as $c) {
        $courseMap[strtolower(trim($c['course_name']))] = $c['course_id'];
    }

    // Pre-load existing emails to skip duplicates
    $existingEmails = [];
    $emailStmt = $pdo->query("SELECT LOWER(email) AS email FROM tbl_users");
    foreach ($emailStmt as $e) {
        $existingEmails[$e['email']] = true;
    }

    $imported = 0;
    $skipped = 0;

    $pdo->beginTransaction();

    foreach ($users as $user) {
        $email = trim($user['email'] ?? '');
        $password = trim($user['password'] ?? '');
        $firstName = trim($user['first_name'] ?? '');
        $lastName = trim($user['last_name'] ?? '');
        $studentNumber = trim($user['student_number'] ?? '');
        $employeeNumber = trim($user['employee_number'] ?? '');

        // Skip only rows that have no name - cannot import those
        if (!$firstName || !$lastName) {
            $skipped++;
            continue;
        }

        // Default password if the file did not provide one
        if (!$password) {
            $password = 'CCE#2024';
        }

        // Blank email (common in client export files): the database requires a
        // non-empty unique email (it is also the login username), so assign a
        // temporary placeholder built from the ID/employee number. Students can
        // update it later from their profile.
        if (!$email) {
            $base = $studentNumber !== '' ? $studentNumber : ($employeeNumber !== '' ? $employeeNumber : 'pending');
            $safeBase = preg_replace('/[^A-Za-z0-9._-]/', '', $base);
            if ($safeBase === '') $safeBase = 'pending';
            $email = $safeBase . '@noemail.local';
            // Guarantee uniqueness even if the same ID appears more than once
            if (isset($existingEmails[strtolower($email)])) {
                $email = $safeBase . '.' . strtolower(substr(md5(uniqid('', true)), 0, 8)) . '@noemail.local';
            }
        }

        // Skip duplicate emails
        if (isset($existingEmails[strtolower($email)])) {
            $skipped++;
            continue;
        }

        // Insert user
        $stmt = $pdo->prepare("INSERT INTO tbl_users (role_id, email, password, status) VALUES (?, ?, ?, 'active')");
        $stmt->execute([$role_id, $email, password_hash($password, PASSWORD_DEFAULT)]);
        $userId = $pdo->lastInsertId();

        // Mark email as used
        $existingEmails[strtolower($email)] = true;

        if ($role === 'student') {
            $studentNumber = trim($user['student_number'] ?? '');
            $yearLevel = (int)($user['year_level'] ?? 1);
            $courseName = trim($user['course'] ?? '');
            $courseId = resolveCourseId($courseName, $courseMap);

            $stmt = $pdo->prepare("INSERT INTO tbl_students (user_id, student_number, course_id, first_name, last_name, year_level) VALUES (?, ?, ?, ?, ?, ?)");
            $stmt->execute([$userId, $studentNumber, $courseId, $firstName, $lastName, $yearLevel]);

        } elseif ($role === 'alumni') {
            $studentNumber = trim($user['student_number'] ?? '');
            $gradYear = (int)($user['graduation_year'] ?? date('Y'));
            $courseName = trim($user['course'] ?? '');
            $courseId = resolveCourseId($courseName, $courseMap);

            $stmt = $pdo->prepare("INSERT INTO tbl_alumni (user_id, course_id, graduation_year) VALUES (?, ?, ?)");
            $stmt->execute([$userId, $courseId, $gradYear]);

            // Also create archived_students record for name storage
            $stmt = $pdo->prepare("INSERT INTO tbl_archived_students (user_id, student_number, first_name, last_name, course, year_level) VALUES (?, ?, ?, ?, ?, ?)");
            $stmt->execute([$userId, $studentNumber, $firstName, $lastName, $courseName, '']);

        } elseif ($role === 'staff') {
            $employeeNumber = trim($user['employee_number'] ?? '');

            $stmt = $pdo->prepare("INSERT INTO tbl_staff (user_id, first_name, last_name, employee_number) VALUES (?, ?, ?, ?)");
            $stmt->execute([$userId, $firstName, $lastName, $employeeNumber]);
        }

        $imported++;
    }

    $pdo->commit();
    echo json_encode([
        'success' => true,
        'message' => "Import completed",
        'imported' => $imported,
        'skipped' => $skipped
    ]);

} catch (PDOException $e) {
    $pdo->rollBack();
    error_log("import_users error: " . $e->getMessage());
    echo json_encode(['success' => false, 'message' => 'A database error occurred during import.']);
}

/**
 * Resolve a course name (from Excel) to a course_id.
 * Tries exact match first, then partial/fuzzy match.
 */
function resolveCourseId($name, $courseMap) {
    if (!$name) return null;

    $lower = strtolower(trim($name));

    // Exact match
    if (isset($courseMap[$lower])) return $courseMap[$lower];

    // Try matching by numeric id
    if (is_numeric($name)) {
        foreach ($courseMap as $cName => $cId) {
            if ((int)$cId === (int)$name) return $cId;
        }
    }

    // Partial match (course name contains the input or vice versa)
    foreach ($courseMap as $cName => $cId) {
        if (strpos($cName, $lower) !== false || strpos($lower, $cName) !== false) {
            return $cId;
        }
    }

    // Return first course as fallback if nothing matches
    $ids = array_values($courseMap);
    return $ids ? $ids[0] : null;
}
