<?php
session_start();
header('Content-Type: application/json');

if (!isset($_SESSION['user_id']) || $_SESSION['role'] !== 'staff') {
    echo json_encode(['success' => false, 'message' => 'Unauthorized']);
    exit;
}

require_once "../../db.php";

$month = $_GET['month'] ?? 0;
$year = $_GET['year'] ?? 0;
$dateFrom = $_GET['date_from'] ?? '';
$dateTo = $_GET['date_to'] ?? '';

try {
    // Build WHERE clause for filters
    $where = "WHERE (is_archived = 0 OR is_archived IS NULL)
        AND EXISTS (SELECT 1 FROM tbl_department_clearances dc WHERE dc.request_id = tbl_requests.request_id)";
    $params = [];

    if ($month > 0) {
        $where .= " AND MONTH(date_requested) = ?";
        $params[] = $month;
    }
    if ($year > 0) {
        $where .= " AND YEAR(date_requested) = ?";
        $params[] = $year;
    }
    if (!empty($dateFrom)) {
        $where .= " AND DATE(date_requested) >= ?";
        $params[] = $dateFrom;
    }
    if (!empty($dateTo)) {
        $where .= " AND DATE(date_requested) <= ?";
        $params[] = $dateTo;
    }

    // Summary counts
    // "Ready to Claim" is only shown once the claiming window has started:
    // a finalized request (schedule not set yet) and a scheduled request
    // whose window has not opened are still pending
    $stmt = $pdo->prepare("
        SELECT
            COUNT(*) AS total,
            SUM(CASE WHEN status IN ('Pending', 'Ready to Claim')
                     OR (status = 'Scheduled for Claiming' AND (claim_schedule_start IS NULL OR claim_schedule_start > CURDATE()))
                     THEN 1 ELSE 0 END) AS pending,
            SUM(CASE WHEN status = 'Scheduled for Claiming' AND claim_schedule_start IS NOT NULL AND claim_schedule_start <= CURDATE()
                     THEN 1 ELSE 0 END) AS ready,
            SUM(CASE WHEN status = 'Claimed' THEN 1 ELSE 0 END) AS claimed,
            SUM(CASE WHEN status = 'Rejected' THEN 1 ELSE 0 END) AS rejected
        FROM tbl_requests $where
    ");
    $stmt->execute($params);
    $summary = $stmt->fetch(PDO::FETCH_ASSOC);

    // Available years
    $yearsStmt = $pdo->query("SELECT DISTINCT YEAR(date_requested) AS y FROM tbl_requests WHERE date_requested IS NOT NULL ORDER BY y DESC");
    $availableYears = $yearsStmt->fetchAll(PDO::FETCH_COLUMN);

    // Monthly trend for chart
    $trendYear = $year > 0 ? $year : date('Y');
    $trendWhere = "WHERE (is_archived = 0 OR is_archived IS NULL)
        AND EXISTS (SELECT 1 FROM tbl_department_clearances dc WHERE dc.request_id = tbl_requests.request_id)
        AND YEAR(date_requested) = ?";
    $trendParams = [$trendYear];

    $trendStmt = $pdo->prepare("
        SELECT
            MONTH(date_requested) AS m,
            COUNT(*) AS total,
            SUM(CASE WHEN status IN ('Pending', 'Ready to Claim')
                     OR (status = 'Scheduled for Claiming' AND (claim_schedule_start IS NULL OR claim_schedule_start > CURDATE()))
                     THEN 1 ELSE 0 END) AS pending,
            SUM(CASE WHEN status = 'Scheduled for Claiming' AND claim_schedule_start IS NOT NULL AND claim_schedule_start <= CURDATE()
                     THEN 1 ELSE 0 END) AS ready,
            SUM(CASE WHEN status = 'Claimed' THEN 1 ELSE 0 END) AS claimed,
            SUM(CASE WHEN status = 'Rejected' THEN 1 ELSE 0 END) AS rejected
        FROM tbl_requests $trendWhere
        GROUP BY MONTH(date_requested)
        ORDER BY m
    ");
    $trendStmt->execute($trendParams);
    $trendRaw = $trendStmt->fetchAll(PDO::FETCH_ASSOC);

    // Fill all 12 months
    $monthly = [];
    for ($i = 1; $i <= 12; $i++) {
        $monthly[$i] = ['total' => 0, 'pending' => 0, 'ready' => 0, 'claimed' => 0, 'rejected' => 0];
    }
    foreach ($trendRaw as $row) {
        $monthly[(int)$row['m']] = [
            'total' => (int)$row['total'],
            'pending' => (int)$row['pending'],
            'ready' => (int)$row['ready'],
            'claimed' => (int)$row['claimed'],
            'rejected' => (int)$row['rejected']
        ];
    }

    echo json_encode([
        'success' => true,
        'summary' => [
            'total' => (int)$summary['total'],
            'pending' => (int)$summary['pending'],
            'ready' => (int)$summary['ready'],
            'claimed' => (int)$summary['claimed'],
            'rejected' => (int)$summary['rejected']
        ],
        'monthly_trend' => array_values($monthly),
        'trend_year' => $trendYear,
        'available_years' => $availableYears
    ]);
} catch (PDOException $e) {
    error_log("get_reports.php error: " . $e->getMessage());
    echo json_encode(['success' => false, 'message' => 'A database error occurred.']);
}
