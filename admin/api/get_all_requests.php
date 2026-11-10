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
require_once "../../helpers/price_calculator.php";
require_once "../../helpers/request_helpers.php";
require_once "../../helpers/request_status.php";

try {
    $status = isset($_GET['status']) ? $_GET['status'] : 'all';
    $page = isset($_GET['page']) ? max(1, (int)$_GET['page']) : 1;
    $search = isset($_GET['search']) ? trim($_GET['search']) : '';
    $limit = 15;
    $offset = ($page - 1) * $limit;

    $archived = isset($_GET['archived']) ? $_GET['archived'] : '0';
    $where = "WHERE 1=1";
    $params = [];

    if ($archived === '1') {
        $where .= " AND r.is_archived = 1";
    } else {
        $where .= " AND (r.is_archived = 0 OR r.is_archived IS NULL)";
    }

    if ($status === 'pending') {
        // A finalized request ("Ready to Claim", schedule not set yet) and a
        // scheduled request whose window has not opened are all still pending
        $where .= " AND (r.status IN ('Pending', 'Ready to Claim')
                        OR (r.status = 'Scheduled for Claiming'
                            AND (r.claim_schedule_start IS NULL OR r.claim_schedule_start > CURDATE())))";
    } elseif ($status === 'approved') {
        // "Ready to Claim" only counts once the claiming window has started
        $where .= " AND (r.status = 'Claimed'
                        OR (r.status = 'Scheduled for Claiming'
                            AND r.claim_schedule_start IS NOT NULL AND r.claim_schedule_start <= CURDATE()))";
    } elseif ($status === 'rejected') {
        $where .= " AND r.status = 'Rejected'";
    } elseif ($status === 'processing') {
        $where .= " AND r.status = 'Processing'";
    }

    if (!empty($search)) {
        $where .= " AND (r.student_name LIKE :search OR r.course_year LIKE :search2)";
        $params[':search'] = "%$search%";
        $params[':search2'] = "%$search%";
    }

    // Count total
    $countSql = "SELECT COUNT(*) FROM tbl_requests r $where";
    $countStmt = $pdo->prepare($countSql);
    $countStmt->execute($params);
    $total = $countStmt->fetchColumn();
    $totalPages = ceil($total / $limit);

    // Fetch requests
    $sql = "SELECT r.*, u.email as user_email
            FROM tbl_requests r
            LEFT JOIN tbl_users u ON r.user_id = u.user_id
            $where
            ORDER BY r.date_requested DESC
            LIMIT " . (int)$limit . " OFFSET " . (int)$offset;
    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);
    $requests = $stmt->fetchAll(PDO::FETCH_ASSOC);

    // Build documents/clearance from normalized tables
    foreach ($requests as &$req) {
        $rid = $req['request_id'];

        // A scheduled request stays "Pending" until the first day of the claiming window
        $req = applyClaimWindowStatus($req);

        $req['documents'] = buildDocumentsObject($pdo, $rid);
        $req['clearance'] = buildClearanceObject($pdo, $rid);
        $req['remarks'] = buildRemarksObject($pdo, $rid);
        $req['total_price'] = calculateRequestPrice($pdo, $rid);
    }

    echo json_encode([
        'success' => true,
        'data' => $requests,
        'total' => $total,
        'total_pages' => $totalPages,
        'current_page' => $page
    ]);

} catch (PDOException $e) {
    error_log("get_all_requests error: " . $e->getMessage());
    echo json_encode(['success' => false, 'error' => 'A database error occurred.']);
}
