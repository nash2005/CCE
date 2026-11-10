<?php
session_start();
if (!isset($_SESSION['user_id']) || $_SESSION['role'] !== 'staff') {
    http_response_code(401);
    header('Content-Type: application/json');
    echo json_encode(['success' => false, 'message' => 'Unauthorized']);
    exit;
}

require_once '../../db.php';
require_once '../../helpers/csrf.php';
validateCsrfToken();

header('Content-Type: application/json');

try {
    // Ensure counter table exists
    $pdo->exec("
        CREATE TABLE IF NOT EXISTS tbl_queue_counter (
            id INT PRIMARY KEY DEFAULT 1,
            current_number INT NOT NULL DEFAULT 1,
            served_today INT NOT NULL DEFAULT 0,
            last_reset DATE NOT NULL DEFAULT (CURDATE())
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    ");
    $pdo->exec("INSERT IGNORE INTO tbl_queue_counter (id, current_number, served_today, last_reset) VALUES (1, 1, 0, CURDATE())");

    // Auto-reset served_today if it's a new day
    $pdo->exec("UPDATE tbl_queue_counter SET served_today = 0, last_reset = CURDATE() WHERE id = 1 AND last_reset < CURDATE()");

    $input = json_decode(file_get_contents('php://input'), true);
    $action = $input['action'] ?? '';

    switch ($action) {

        case 'next':
            $pdo->exec("UPDATE tbl_queue_counter SET current_number = current_number + 1, served_today = served_today + 1 WHERE id = 1");
            $row = $pdo->query("SELECT current_number, served_today FROM tbl_queue_counter WHERE id = 1")->fetch();
            echo json_encode([
                'success'        => true,
                'current_number' => (int)$row['current_number'],
                'served_today'   => (int)$row['served_today'],
            ]);
            break;

        case 'restart':
            $pdo->exec("UPDATE tbl_queue_counter SET current_number = 1, served_today = 0 WHERE id = 1");
            echo json_encode(['success' => true, 'message' => 'Queue restarted. Now serving #1.']);
            break;

        default:
            echo json_encode(['success' => false, 'message' => 'Invalid action']);
    }

} catch (PDOException $e) {
    error_log("update_queue.php error: " . $e->getMessage());
    echo json_encode(['success' => false, 'message' => 'A database error occurred.']);
}
