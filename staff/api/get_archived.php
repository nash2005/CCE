<?php
session_start();
if (!isset($_SESSION['user_id']) || $_SESSION['role'] !== 'staff') {
    http_response_code(401);
    header('Content-Type: application/json');
    echo json_encode(['success' => false, 'message' => 'Unauthorized']);
    exit;
}

require_once 'db.php';

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET');

try {
    $search = isset($_GET['search']) ? $_GET['search'] : '';
    $dateFilter = isset($_GET['date_filter']) ? $_GET['date_filter'] : '';
    
    // Base query
    $sql = "SELECT * FROM tbl_archived_students WHERE 1=1";
    $params = [];
    
    if (!empty($search)) {
        $sql .= " AND (first_name LIKE ? OR last_name LIKE ? OR student_number LIKE ?)";
        $searchTerm = "%$search%";
        $params[] = $searchTerm;
        $params[] = $searchTerm;
        $params[] = $searchTerm;
    }
    
    if (!empty($dateFilter)) {
        switch ($dateFilter) {
            case 'today':
                $sql .= " AND DATE(archived_at) = CURDATE()";
                break;
            case 'week':
                $sql .= " AND YEARWEEK(archived_at) = YEARWEEK(CURDATE())";
                break;
            case 'month':
                $sql .= " AND MONTH(archived_at) = MONTH(CURDATE()) AND YEAR(archived_at) = YEAR(CURDATE())";
                break;
            case 'year':
                $sql .= " AND YEAR(archived_at) = YEAR(CURDATE())";
                break;
        }
    }
    
    $sql .= " ORDER BY archived_at DESC";
    
    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);
    $archived = $stmt->fetchAll();
    
    echo json_encode([
        'success' => true,
        'data' => $archived
    ]);

} catch (PDOException $e) {
    error_log("get_archived.php error: " . $e->getMessage());
    echo json_encode([
        'success' => false,
        'message' => 'A database error occurred.'
    ]);
}
?>