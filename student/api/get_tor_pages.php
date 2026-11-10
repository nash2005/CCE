<?php
session_start();
header('Content-Type: application/json');

if (!isset($_SESSION['user_id']) || !in_array($_SESSION['role'], ['student', 'alumni'])) {
    echo json_encode(['success' => false, 'message' => 'Not authenticated']);
    exit;
}

require_once '../../db.php';

try {
    $stmt = $pdo->prepare("SELECT total_pages FROM tbl_student_tor_pages WHERE user_id = ?");
    $stmt->execute([$_SESSION['user_id']]);
    $row = $stmt->fetch(PDO::FETCH_ASSOC);

    echo json_encode([
        'success' => true,
        'total_pages' => $row ? (int)$row['total_pages'] : 0
    ]);
} catch (PDOException $e) {
    error_log("get_tor_pages error: " . $e->getMessage());
    echo json_encode(['success' => false, 'message' => 'A database error occurred.']);
}
