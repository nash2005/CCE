<?php
session_start();
header('Content-Type: application/json');

if (!isset($_SESSION['user_id']) || $_SESSION['role'] !== 'admin') {
    http_response_code(403);
    echo json_encode(['success' => false, 'message' => 'Unauthorized']);
    exit;
}

require_once "../../db.php";
require_once "../../helpers/csrf.php";
validateCsrfToken();

$input = json_decode(file_get_contents('php://input'), true);

$documentId = intval($input['document_id'] ?? 0);
$price = $input['price'] ?? null;

if ($documentId <= 0) {
    echo json_encode(['success' => false, 'message' => 'Invalid document ID']);
    exit;
}

if ($price === null || $price === '' || (float)$price < 0) {
    echo json_encode(['success' => false, 'message' => 'A valid price is required']);
    exit;
}

try {
    $stmt = $pdo->prepare("UPDATE tbl_documents SET price = ? WHERE document_id = ?");
    $stmt->execute([(float)$price, $documentId]);

    if ($stmt->rowCount() === 0) {
        echo json_encode(['success' => false, 'message' => 'Document not found']);
        exit;
    }

    echo json_encode(['success' => true, 'message' => 'Price updated successfully']);
} catch (PDOException $e) {
    error_log("update_document_price error: " . $e->getMessage());
    echo json_encode(['success' => false, 'message' => 'A database error occurred.']);
}
