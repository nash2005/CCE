<?php
session_start();
header('Content-Type: application/json');

if (!isset($_SESSION['user_id']) || $_SESSION['role'] !== 'staff') {
    echo json_encode(['success' => false, 'message' => 'Unauthorized']);
    exit;
}

require_once "../../db.php";

$user_id = isset($_GET['user_id']) ? (int)$_GET['user_id'] : 0;
if ($user_id <= 0) {
    echo json_encode(['success' => false, 'message' => 'User ID is required']);
    exit;
}

try {
    $stmt = $pdo->prepare("SELECT total_pages, updated_at FROM tbl_student_tor_pages WHERE user_id = ?");
    $stmt->execute([$user_id]);
    $row = $stmt->fetch(PDO::FETCH_ASSOC);

    echo json_encode([
        'success' => true,
        'total_pages' => $row ? (int)$row['total_pages'] : 0,
        'updated_at' => $row ? $row['updated_at'] : null
    ]);
} catch (PDOException $e) {
    error_log("get_tor_pages error: " . $e->getMessage());
    echo json_encode(['success' => false, 'message' => 'A database error occurred.']);
}
