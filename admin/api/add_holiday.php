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

$holiday_name = trim($input['holiday_name'] ?? '');
$holiday_start_date = trim($input['holiday_date'] ?? '');

if (empty($holiday_name)) {
    echo json_encode(['success' => false, 'message' => 'Holiday name is required']);
    exit;
}

// Validate date format (YYYY-MM-DD)
$dateObj = DateTime::createFromFormat('Y-m-d', $holiday_start_date);
if (!$dateObj || $dateObj->format('Y-m-d') !== $holiday_start_date) {
    echo json_encode(['success' => false, 'message' => 'Invalid date format. Use YYYY-MM-DD']);
    exit;
}

$startDate = $dateObj->format('Y-m-d');
$endDate = $startDate;

// Check if this is a date range (Date to Date)
if (isset($input['holiday_end_date']) && !empty($input['holiday_end_date'])) {
    $endDateObj = DateTime::createFromFormat('Y-m-d', $input['holiday_end_date']);
    if (!$endDateObj || $endDateObj->format('Y-m-d') !== $input['holiday_end_date']) {
        echo json_encode(['success' => false, 'message' => 'Invalid end date format. Use YYYY-MM-DD']);
        exit;
    }
    $endDate = $endDateObj->format('Y-m-d');
    if ($startDate > $endDate) {
        echo json_encode(['success' => false, 'message' => 'Start date cannot be after end date']);
        exit;
    }
}

try {
    $currentDate = new DateTime($startDate);
    $endDateDate = new DateTime($endDate);

    // Guard against absurdly large ranges (safety limit: 366 days)
    $days = (int)$currentDate->diff($endDateDate)->days + 1;
    if ($days > 366) {
        echo json_encode(['success' => false, 'message' => 'Date range is too large (max 366 days)']);
        exit;
    }

    // Insert a holiday entry for each date in the range, atomically
    $pdo->beginTransaction();

    $insertStmt = $pdo->prepare("INSERT INTO tbl_holidays (holiday_date, holiday_name, day_of_week) VALUES (?, ?, ?)");
    $checkStmt = $pdo->prepare("SELECT holiday_id FROM tbl_holidays WHERE holiday_date = ? AND is_archived = 0");
    $lastId = 0;

    do {
        $current = $currentDate->format('Y-m-d');

        // Check for duplicate active holiday on same date
        $checkStmt->execute([$current]);
        if ($checkStmt->fetch()) {
            $pdo->rollBack();
            echo json_encode(['success' => false, 'message' => 'A holiday already exists on ' . $current]);
            exit;
        }

        $insertStmt->execute([$current, $holiday_name, $currentDate->format('l')]);
        $lastId = $pdo->lastInsertId();
        $currentDate->modify('+1 day');
    } while ($currentDate <= $endDateDate);

    $pdo->commit();

    echo json_encode([
        'success' => true,
        'message' => $days > 1 ? "Holiday added successfully ({$days} days)" : 'Holiday added successfully',
        'holiday_id' => $lastId
    ]);
} catch (PDOException $e) {
    if ($pdo->inTransaction()) {
        $pdo->rollBack();
    }
    error_log("add_holiday error: " . $e->getMessage());
    echo json_encode(['success' => false, 'message' => 'A database error occurred.']);
}

