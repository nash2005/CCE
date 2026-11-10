<?php
session_start();
require_once "../../db.php";

// Check if student is logged in
if (!isset($_SESSION['user_id']) || !isset($_SESSION['role']) || !in_array($_SESSION['role'], ['student', 'alumni'])) {
    echo json_encode(["success" => false, "message" => "Unauthorized access"]);
    exit;
}

$user_id = $_SESSION['user_id'];

try {
    // Get request statistics
    // A finalized request ("Ready to Claim", schedule not set yet) and a
    // scheduled request whose window has not opened are still "pending"
    $stmt = $pdo->prepare("
        SELECT
            COUNT(*) as total,
            SUM(CASE WHEN status IN ('pending', 'Ready to Claim')
                      OR (status = 'Scheduled for Claiming' AND claim_schedule_start IS NOT NULL AND claim_schedule_start > CURDATE())
                     THEN 1 ELSE 0 END) as pending,
            SUM(CASE WHEN status = 'processing' THEN 1 ELSE 0 END) as processing,
            SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed,
            SUM(CASE WHEN status = 'rejected' THEN 1 ELSE 0 END) as rejected
        FROM tbl_requests
        WHERE user_id = ?
    ");
    $stmt->execute([$user_id]);
    $stats = $stmt->fetch(PDO::FETCH_ASSOC);

    echo json_encode([
        "success" => true,
        "stats" => [
            "total" => (int)$stats["total"],
            "pending" => (int)$stats["pending"],
            "processing" => (int)$stats["processing"],
            "completed" => (int)$stats["completed"],
            "rejected" => (int)$stats["rejected"]
        ],
        "chartData" => [
            "pending" => (int)$stats["pending"],
            "processing" => (int)$stats["processing"],
            "completed" => (int)$stats["completed"],
            "rejected" => (int)$stats["rejected"]
        ]
    ]);

} catch (PDOException $e) {
    error_log("get_student_requests.php error: " . $e->getMessage());
    echo json_encode(["success" => false, "message" => "A database error occurred."]);
}
