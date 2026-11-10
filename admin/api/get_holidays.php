<?php
session_start();
header('Content-Type: application/json');

if (!isset($_SESSION['user_id']) || $_SESSION['role'] !== 'admin') {
    http_response_code(403);
    echo json_encode(['success' => false, 'message' => 'Unauthorized']);
    exit;
}

require_once '../../db.php';

try {
    // List holidays with optional filtering
    // GET params: status=active|archived|all (default: all)
    $status = $_GET['status'] ?? 'all';

    $sql = "SELECT holiday_id, holiday_date, holiday_name, day_of_week,
                   is_active, created_at, is_archived
            FROM tbl_holidays
            WHERE 1=1";
    $params = [];

    if ($status !== 'all') {
        $sql .= " AND is_archived = " . ($status === 'active' ? '0' : '1');
    }

    $sql .= " ORDER BY holiday_date ASC";

    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);
    $holidays = $stmt->fetchAll(PDO::FETCH_ASSOC);

    echo json_encode([
        'success' => true,
        'holidays' => $holidays,
        'filter' => $status
    ]);
} catch (PDOException $e) {
    error_log("get_holidays error: " . $e->getMessage());
    echo json_encode(['success' => false, 'message' => 'A database error occurred.']);
}
