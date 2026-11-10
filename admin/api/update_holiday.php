<?php
session_start();
header('Content-Type: application/json');

if (!isset($_SESSION['user_id']) || $_SESSION['role'] !== 'admin') {
    http_response_code(403);
    echo json_encode(['success' => false, 'message' => 'Unauthorized']);
    exit;
}

require_once '../../db.php';
require_once '../../helpers/csrf.php';
validateCsrfToken();

$input = json_decode(file_get_contents('php://input'), true);

$holiday_id = intval($input['holiday_id'] ?? 0);
$holiday_name = trim($input['holiday_name'] ?? '');
$holiday_date = trim($input['holiday_date'] ?? '');

if ($holiday_id <= 0) {
    echo json_encode(['success' => false, 'message' => 'Invalid holiday ID']);
    exit;
}
if (empty($holiday_name)) {
    echo json_encode(['success' => false, 'message' => 'Holiday name is required']);
    exit;
}

$dateObj = DateTime::createFromFormat('Y-m-d', $holiday_date);
if (!$dateObj || $dateObj->format('Y-m-d') !== $holiday_date) {
    echo json_encode(['success' => false, 'message' => 'Invalid date format. Use YYYY-MM-DD']);
    exit;
}

try {
    // Make sure this holiday row exists
    $exist = $pdo->prepare("SELECT holiday_id FROM tbl_holidays WHERE holiday_id = ?");
    $exist->execute([$holiday_id]);
    if (!$exist->fetch()) {
        echo json_encode(['success' => false, 'message' => 'Holiday not found']);
        exit;
    }

    // Check for duplicate active holiday on the new date (excluding this row)
    $check = $pdo->prepare("SELECT holiday_id FROM tbl_holidays WHERE holiday_date = ? AND is_archived = 0 AND holiday_id != ?");
    $check->execute([$holiday_date, $holiday_id]);
    if ($check->fetch()) {
        echo json_encode(['success' => false, 'message' => 'Another holiday already exists on this date']);
        exit;
    }

    // Simple in-place update (one row per day — no orphan range rows possible)
    $stmt = $pdo->prepare("UPDATE tbl_holidays SET holiday_date = ?, holiday_name = ?, day_of_week = ? WHERE holiday_id = ?");
    $stmt->execute([
        $holiday_date,
        $holiday_name,
        $dateObj->format('l'),
        $holiday_id
    ]);

    echo json_encode(['success' => true, 'message' => 'Holiday updated successfully']);
} catch (PDOException $e) {
    error_log("update_holiday error: " . $e->getMessage());
    echo json_encode(['success' => false, 'message' => 'A database error occurred.']);
}

