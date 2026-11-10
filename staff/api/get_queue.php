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

try {
    // Auto-create counter table if missing
    $pdo->exec("
        CREATE TABLE IF NOT EXISTS tbl_queue_counter (
            id INT PRIMARY KEY DEFAULT 1,
            current_number INT NOT NULL DEFAULT 1,
            served_today INT NOT NULL DEFAULT 0,
            last_reset DATE NOT NULL DEFAULT (CURDATE())
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    ");

    // Ensure a row exists
    $pdo->exec("INSERT IGNORE INTO tbl_queue_counter (id, current_number, served_today, last_reset) VALUES (1, 1, 0, CURDATE())");

    // Auto-reset served_today if it's a new day
    $pdo->exec("UPDATE tbl_queue_counter SET served_today = 0, last_reset = CURDATE() WHERE id = 1 AND last_reset < CURDATE()");

    $row = $pdo->query("SELECT current_number, served_today FROM tbl_queue_counter WHERE id = 1")->fetch();

    echo json_encode([
        'success'        => true,
        'current_number' => (int)$row['current_number'],
        'served_today'   => (int)$row['served_today'],
    ]);

} catch (PDOException $e) {
    error_log("get_queue.php error: " . $e->getMessage());
    echo json_encode(['success' => false, 'message' => 'A database error occurred.']);
}
