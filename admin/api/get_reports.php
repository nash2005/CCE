<?php
session_start();
header("Access-Control-Allow-Origin: *");
header("Content-Type: application/json");
if (!isset($_SESSION['user_id']) || $_SESSION['role'] !== 'admin') {
    http_response_code(403);
    echo json_encode(['success' => false, 'message' => 'Unauthorized']);
    exit;
}

require_once "../../db.php";

try {
    $month = isset($_GET['month']) ? (int)$_GET['month'] : 0;
    $year = isset($_GET['year']) ? (int)$_GET['year'] : 0;
    $date_from = isset($_GET['date_from']) ? $_GET['date_from'] : '';
    $date_to = isset($_GET['date_to']) ? $_GET['date_to'] : '';
    $course = isset($_GET['course']) ? (int)$_GET['course'] : 0;

    // Build date filter for requests
    $dateWhere = "";
    $dateParams = [];

    if (!empty($date_from) && !empty($date_to)) {
        $dateWhere = " AND r.date_requested BETWEEN :date_from AND :date_to";
        $dateParams[':date_from'] = $date_from;
        $dateParams[':date_to'] = $date_to;
    } elseif ($year > 0 && $month > 0) {
        $dateWhere = " AND YEAR(r.date_requested) = :year AND MONTH(r.date_requested) = :month";
        $dateParams[':year'] = $year;
        $dateParams[':month'] = $month;
    } elseif ($year > 0) {
        $dateWhere = " AND YEAR(r.date_requested) = :year";
        $dateParams[':year'] = $year;
    } elseif ($month > 0) {
        $dateWhere = " AND MONTH(r.date_requested) = :month";
        $dateParams[':month'] = $month;
    }

    // Build course filter
    $courseJoin = "";
    $courseWhere = "";
    if ($course > 0) {
        // Join with students table to filter by course
        $courseJoin = " INNER JOIN tbl_students s ON r.user_id = s.user_id ";
        $courseWhere = " AND s.course_id = :course ";
        $dateParams[':course'] = $course;
    }

    // === Available courses for filter ===
    $stmtCourses = $pdo->query("SELECT course_id, course_name FROM tbl_courses ORDER BY course_name");
    $availableCourses = $stmtCourses->fetchAll(PDO::FETCH_ASSOC);

    // === Summary counts ===
    // Total accounts
    $stmt = $pdo->query("SELECT COUNT(*) FROM tbl_users WHERE status = 'active'");
    $totalAccounts = $stmt->fetchColumn();

    // Total requests (filtered, exclude archived)
    $stmt = $pdo->prepare("SELECT COUNT(*) FROM tbl_requests r $courseJoin WHERE r.is_archived = 0 $courseWhere $dateWhere");
    $stmt->execute($dateParams);
    $totalRequests = $stmt->fetchColumn();

    // Approved ("Ready to Claim" only once the claiming window has started + Claimed)
    $stmt = $pdo->prepare("SELECT COUNT(*) FROM tbl_requests r $courseJoin WHERE r.is_archived = 0 AND (r.status = 'Claimed'
        OR (r.status = 'Scheduled for Claiming' AND r.claim_schedule_start IS NOT NULL AND r.claim_schedule_start <= CURDATE())) $courseWhere $dateWhere");
    $stmt->execute($dateParams);
    $totalApproved = $stmt->fetchColumn();

    // Rejected
    $stmt = $pdo->prepare("SELECT COUNT(*) FROM tbl_requests r $courseJoin WHERE r.is_archived = 0 AND r.status = 'Rejected' $courseWhere $dateWhere");
    $stmt->execute($dateParams);
    $totalRejected = $stmt->fetchColumn();

    // Pending (finalized requests waiting for their claiming schedule and
    // scheduled requests whose window has not opened are still pending)
    $stmt = $pdo->prepare("SELECT COUNT(*) FROM tbl_requests r $courseJoin WHERE r.is_archived = 0 AND (r.status IN ('Pending', 'Ready to Claim')
        OR (r.status = 'Scheduled for Claiming' AND (r.claim_schedule_start IS NULL OR r.claim_schedule_start > CURDATE()))) $courseWhere $dateWhere");
    $stmt->execute($dateParams);
    $totalPending = $stmt->fetchColumn();

    // Processing
    $stmt = $pdo->prepare("SELECT COUNT(*) FROM tbl_requests r $courseJoin WHERE r.is_archived = 0 AND r.status = 'Processing' $courseWhere $dateWhere");
    $stmt->execute($dateParams);
    $totalProcessing = $stmt->fetchColumn();

    // === Monthly trend (last 12 months or filtered year) ===
    $trendYear = $year > 0 ? $year : date('Y');
    
    // Prepare trend query with course filter
    $trendWhere = "r.is_archived = 0 AND YEAR(r.date_requested) = :year";
    if ($course > 0) {
        $trendWhere .= " AND s.course_id = :course";
    }
    
    $stmtTrend = $pdo->prepare("
        SELECT
            MONTH(r.date_requested) as month,
            COUNT(*) as total,
            SUM(CASE WHEN r.status = 'Claimed'
                          OR (r.status = 'Scheduled for Claiming' AND r.claim_schedule_start IS NOT NULL AND r.claim_schedule_start <= CURDATE())
                     THEN 1 ELSE 0 END) as approved,
            SUM(CASE WHEN r.status = 'Rejected' THEN 1 ELSE 0 END) as rejected,
            SUM(CASE WHEN r.status IN ('Pending', 'Ready to Claim')
                          OR (r.status = 'Scheduled for Claiming' AND (r.claim_schedule_start IS NULL OR r.claim_schedule_start > CURDATE()))
                     THEN 1 ELSE 0 END) as pending
        FROM tbl_requests r
        " . ($course > 0 ? "INNER JOIN tbl_students s ON r.user_id = s.user_id " : "") . "
        WHERE $trendWhere
        GROUP BY MONTH(r.date_requested)
        ORDER BY MONTH(r.date_requested)
    ");
    
    $trendParams = [':year' => $trendYear];
    if ($course > 0) {
        $trendParams[':course'] = $course;
    }
    $stmtTrend->execute($trendParams);
    $monthlyTrend = $stmtTrend->fetchAll(PDO::FETCH_ASSOC);

    // Fill all 12 months
    $months = [];
    for ($i = 1; $i <= 12; $i++) {
        $months[$i] = ['month' => $i, 'total' => 0, 'approved' => 0, 'rejected' => 0, 'pending' => 0];
    }
    foreach ($monthlyTrend as $row) {
        $months[(int)$row['month']] = $row;
    }

    // === Accounts by role ===
    $stmtRoles = $pdo->query("
        SELECT r.role_name, COUNT(*) as count
        FROM tbl_users u
        JOIN tbl_roles r ON u.role_id = r.role_id
        WHERE u.status = 'active'
        GROUP BY r.role_name
    ");
    $accountsByRole = $stmtRoles->fetchAll(PDO::FETCH_ASSOC);

    // === Available years for filter ===
    $stmtYears = $pdo->query("SELECT DISTINCT YEAR(date_requested) as yr FROM tbl_requests ORDER BY yr DESC");
    $availableYears = $stmtYears->fetchAll(PDO::FETCH_COLUMN);

    echo json_encode([
        'success' => true,
        'summary' => [
            'total_accounts' => (int)$totalAccounts,
            'total_requests' => (int)$totalRequests,
            'total_approved' => (int)$totalApproved,
            'total_rejected' => (int)$totalRejected,
            'total_pending' => (int)$totalPending,
            'total_processing' => (int)$totalProcessing
        ],
        'monthly_trend' => array_values($months),
        'accounts_by_role' => $accountsByRole,
        'trend_year' => (int)$trendYear,
        'available_years' => $availableYears,
        'available_courses' => $availableCourses
    ]);

} catch (PDOException $e) {
    error_log("get_reports error: " . $e->getMessage());
    echo json_encode(['success' => false, 'error' => 'A database error occurred.']);
}