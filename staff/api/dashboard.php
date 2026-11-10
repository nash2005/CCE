<?php
require "../../db.php";

session_start();
if (!isset($_SESSION['user_id']) || $_SESSION['role'] !== 'staff') {
    http_response_code(401);
    echo json_encode(["success" => false, "message" => "Unauthorized"]);
    exit;
}

try {
    $total = $pdo->query("SELECT COUNT(*) FROM tbl_students")->fetchColumn();
    $active = $pdo->query("SELECT COUNT(*) FROM tbl_students s INNER JOIN tbl_users u ON s.user_id = u.user_id WHERE u.status='active'")->fetchColumn();
    $archived = $pdo->query("SELECT COUNT(*) FROM tbl_archived_students")->fetchColumn();

    echo json_encode([
      "total" => $total,
      "active" => $active,
      "archived" => $archived
    ]);
} catch (PDOException $e) {
    error_log("dashboard.php error: " . $e->getMessage());
    echo json_encode(["success" => false, "message" => "A database error occurred."]);
}
