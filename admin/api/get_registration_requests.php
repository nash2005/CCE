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
    $status = $_GET['status'] ?? 'all';

    $sql = "SELECT r.*, c.course_name
            FROM tbl_registration_requests r
            JOIN tbl_courses c ON r.course_id = c.course_id";

    if ($status !== 'all') {
        $sql .= " WHERE r.status = :status";
    }
    $sql .= " ORDER BY r.created_at DESC";

    $stmt = $pdo->prepare($sql);
    if ($status !== 'all') {
        $stmt->execute(["status" => $status]);
    } else {
        $stmt->execute();
    }

    $requests = $stmt->fetchAll();

    // Count by status
    $countStmt = $pdo->query("SELECT status, COUNT(*) as cnt FROM tbl_registration_requests GROUP BY status");
    $counts = ["pending" => 0, "approved" => 0, "rejected" => 0];
    while ($row = $countStmt->fetch()) {
        $counts[$row['status']] = (int)$row['cnt'];
    }

    echo json_encode([
        "success" => true,
        "requests" => $requests,
        "counts" => $counts
    ]);
} catch (PDOException $e) {
    error_log("get_registration_requests error: " . $e->getMessage());
    echo json_encode(["success" => false, "message" => "A database error occurred."]);
}
