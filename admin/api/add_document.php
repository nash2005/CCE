<?php
session_start();
header('Content-Type: application/json');

if (!isset($_SESSION['user_id']) || $_SESSION['role'] !== 'admin') {
    echo json_encode(['success' => false, 'message' => 'Unauthorized']);
    exit;
}

require_once "../../db.php";
require_once "../../helpers/csrf.php";
validateCsrfToken();

$input = json_decode(file_get_contents('php://input'), true);

$documentName = trim($input['document_name'] ?? '');
$typeId = (int)($input['type_id'] ?? 0);
$price = $input['price'] ?? null;

if (empty($documentName) || $typeId <= 0) {
    echo json_encode(['success' => false, 'message' => 'Document name and type are required']);
    exit;
}

if ($price === null || $price === '' || (float)$price < 0) {
    echo json_encode(['success' => false, 'message' => 'A valid price is required']);
    exit;
}

try {
    // Check for duplicate name within the same type
    $check = $pdo->prepare("SELECT document_id FROM tbl_documents WHERE document_name = ? AND type_id = ?");
    $check->execute([$documentName, $typeId]);
    if ($check->fetch()) {
        echo json_encode(['success' => false, 'message' => 'A document with this name already exists under the same type']);
        exit;
    }

    $stmt = $pdo->prepare("INSERT INTO tbl_documents (type_id, document_name, price) VALUES (?, ?, ?)");
    $stmt->execute([$typeId, $documentName, (float)$price]);

    echo json_encode(['success' => true, 'message' => 'Document added successfully']);
} catch (PDOException $e) {
    error_log("add_document error: " . $e->getMessage());
    echo json_encode(['success' => false, 'message' => 'A database error occurred.']);
}
