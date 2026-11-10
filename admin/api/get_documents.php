<?php
session_start();
header('Content-Type: application/json');

if (!isset($_SESSION['user_id']) || $_SESSION['role'] !== 'admin') {
    echo json_encode(['success' => false, 'message' => 'Unauthorized']);
    exit;
}

require_once "../../db.php";

try {
    $typeFilter = $_GET['type'] ?? 'all';

    $sql = "SELECT d.document_id, d.document_name, d.price, dt.type_id, dt.type_name
            FROM tbl_documents d
            JOIN tbl_document_types dt ON d.type_id = dt.type_id";
    $params = [];

    if ($typeFilter !== 'all') {
        $sql .= " WHERE dt.type_name = ?";
        $params[] = $typeFilter;
    }

    $sql .= " ORDER BY dt.type_name, d.document_name";

    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);
    $documents = $stmt->fetchAll(PDO::FETCH_ASSOC);

    // Get document types for filter
    $types = $pdo->query("SELECT type_id, type_name FROM tbl_document_types ORDER BY type_name")->fetchAll(PDO::FETCH_ASSOC);

    echo json_encode([
        'success' => true,
        'documents' => $documents,
        'types' => $types
    ]);
} catch (PDOException $e) {
    error_log("get_documents error: " . $e->getMessage());
    echo json_encode(['success' => false, 'message' => 'A database error occurred.']);
}
