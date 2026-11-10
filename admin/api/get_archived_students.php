<?php
session_start();
header('Content-Type: application/json');
if (!isset($_SESSION['user_id']) || $_SESSION['role'] !== 'admin') {
    http_response_code(403);
    echo json_encode(['success' => false, 'message' => 'Unauthorized']);
    exit;
}
require_once "../../db.php";

try {
    $sql = "SELECT * FROM tbl_archived_students ORDER BY archived_at DESC";
    $stmt = $pdo->query($sql);
    $archived = $stmt->fetchAll(PDO::FETCH_ASSOC);

    echo json_encode(["success" => true, "archived" => $archived]);

} catch (PDOException $e) {
    error_log("get_archived_students error: " . $e->getMessage());
    echo json_encode(["success" => false, "message" => "A database error occurred."]);
}
