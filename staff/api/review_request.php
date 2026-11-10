<?php
session_start();
header('Content-Type: application/json');

if (!isset($_SESSION['user_id']) || $_SESSION['role'] !== 'staff') {
    echo json_encode(['success' => false, 'message' => 'Unauthorized']);
    exit;
}

require_once "../../db.php";
require_once "../../helpers/csrf.php";
validateCsrfToken();

$data = json_decode(file_get_contents("php://input"), true);
$request_id = (int)($data['request_id'] ?? 0);

// Per-TOR page counts keyed by tbl_request_documents.id — the staff sets these
// one TOR at a time in the "Set TOR Pages" modal of the Step 2 review
$doc_pages = [];
if (isset($data['doc_pages']) && is_array($data['doc_pages'])) {
    foreach ($data['doc_pages'] as $entry) {
        if (!is_array($entry)) continue;
        $docRowId = (int)($entry['id'] ?? 0);
        $pages = (int)($entry['pages'] ?? 0);
        if ($docRowId > 0 && $pages > 0) {
            $doc_pages[$docRowId] = $pages;
        }
    }
}

// Documents the staff deselected in the review modal — removed permanently
$removeRequested = [];
if (isset($data['remove_doc_ids']) && is_array($data['remove_doc_ids'])) {
    foreach ($data['remove_doc_ids'] as $docRowId) {
        $docRowId = (int)$docRowId;
        if ($docRowId > 0) {
            $removeRequested[$docRowId] = $docRowId;
        }
    }
}

// Legacy single overall page count (older clients): applied to every TOR row
$legacy_tor_pages = isset($data['tor_pages']) ? (int)$data['tor_pages'] : null;

if ($request_id <= 0) {
    echo json_encode(['success' => false, 'message' => 'Request ID is required']);
    exit;
}

try {
    // Verify request exists and is in Pending status with no department clearances yet
    $stmt = $pdo->prepare("SELECT r.request_id, r.user_id, r.status, r.cav_requirements_submitted
        FROM tbl_requests r WHERE r.request_id = ?");
    $stmt->execute([$request_id]);
    $request = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$request) {
        echo json_encode(['success' => false, 'message' => 'Request not found']);
        exit;
    }

    if ($request['status'] !== 'Pending') {
        echo json_encode(['success' => false, 'message' => 'Request has already been reviewed']);
        exit;
    }

    // Check if department clearances already exist (already reviewed)
    $dcCheck = $pdo->prepare("SELECT COUNT(*) FROM tbl_department_clearances WHERE request_id = ?");
    $dcCheck->execute([$request_id]);
    if ((int)$dcCheck->fetchColumn() > 0) {
        echo json_encode(['success' => false, 'message' => 'Request has already been sent to departments']);
        exit;
    }

    // Current document selections for this request
    $docStmt = $pdo->prepare("
        SELECT rd.id, rd.pages, rd.copies, d.document_name, dt.type_name
        FROM tbl_request_documents rd
        JOIN tbl_documents d ON rd.document_id = d.document_id
        JOIN tbl_document_types dt ON d.type_id = dt.type_id
        WHERE rd.request_id = ?
        ORDER BY rd.id
    ");
    $docStmt->execute([$request_id]);
    $docRows = $docStmt->fetchAll(PDO::FETCH_ASSOC);

    // Only rows that belong to this request can be deselected/removed
    $removeIds = [];
    foreach ($removeRequested as $docRowId) {
        foreach ($docRows as $row) {
            if ((int)$row['id'] === $docRowId) {
                $removeIds[$docRowId] = $docRowId;
                break;
            }
        }
    }

    $keptRows = [];
    foreach ($docRows as $row) {
        if (!isset($removeIds[(int)$row['id']])) {
            $keptRows[] = $row;
        }
    }

    if (!count($keptRows)) {
        echo json_encode(['success' => false, 'message' => 'At least one document must remain selected for this request.']);
        exit;
    }

    // Every TOR still on the request must have a page count before it can be
    // sent to the departments (staff sets these one by one in the review modal)
    $torUpdates = [];
    $torTotalPages = 0;
    foreach ($keptRows as $row) {
        if ($row['type_name'] !== 'tor') continue;

        $docRowId = (int)$row['id'];
        $storedPages = ($row['pages'] !== null && $row['pages'] !== '') ? (int)$row['pages'] : null;
        $pages = $doc_pages[$docRowId] ?? $legacy_tor_pages ?? $storedPages;

        if ($pages === null || $pages <= 0) {
            echo json_encode([
                'success' => false,
                'message' => 'Set the number of pages for TOR "' . $row['document_name'] . '" before sending this request to the departments.'
            ]);
            exit;
        }

        $torUpdates[$docRowId] = $pages;
        $torTotalPages += $pages * max(1, (int)$row['copies']);
    }

    // CAV requests may only go to the departments once the Diploma requirement
    // has been confirmed (mirrors the "Requirements Submitted" step in the modal)
    $hasCav = false;
    foreach ($keptRows as $row) {
        if ($row['type_name'] === 'cav') {
            $hasCav = true;
            break;
        }
    }
    if ($hasCav && empty($request['cav_requirements_submitted'])) {
        echo json_encode(['success' => false, 'message' => 'Confirm that the CAV requirements (Diploma) were submitted before sending this request to the departments.']);
        exit;
    }

    $pdo->beginTransaction();

    // Remove the documents the staff deselected in the review
    if ($removeIds) {
        $delStmt = $pdo->prepare("DELETE FROM tbl_request_documents WHERE id = ? AND request_id = ?");
        foreach ($removeIds as $docRowId) {
            $delStmt->execute([$docRowId, $request_id]);
        }
    }

    // Record the page count of each TOR
    if ($torUpdates) {
        $updStmt = $pdo->prepare("UPDATE tbl_request_documents SET pages = ? WHERE id = ? AND request_id = ?");
        foreach ($torUpdates as $docRowId => $pages) {
            $updStmt->execute([$pages, $docRowId, $request_id]);
        }

        // Keep the student-level total in sync (used by the tracker and as the
        // pricing fallback for rows reviewed before per-row pages existed)
        $torStmt = $pdo->prepare("
            INSERT INTO tbl_student_tor_pages (user_id, total_pages, updated_by, updated_at)
            VALUES (?, ?, ?, NOW())
            ON DUPLICATE KEY UPDATE total_pages = VALUES(total_pages), updated_by = VALUES(updated_by), updated_at = NOW()
        ");
        $torStmt->execute([$request['user_id'], $torTotalPages, $_SESSION['user_id']]);
    }

    // Update request status to Processing
    $updateStmt = $pdo->prepare("UPDATE tbl_requests SET status = 'Processing' WHERE request_id = ?");
    $updateStmt->execute([$request_id]);

    // Create department clearance records for all active department users (role_id = 5)
    $deptUsers = $pdo->query("SELECT user_id FROM tbl_users WHERE role_id = 5 AND status = 'active'")->fetchAll(PDO::FETCH_COLUMN);
    $dcStmt = $pdo->prepare("INSERT INTO tbl_department_clearances (user_id, request_id, status, remarks)
        VALUES (?, ?, 'Pending', '')");
    foreach ($deptUsers as $deptUserId) {
        $dcStmt->execute([$deptUserId, $request_id]);
    }

    $pdo->commit();

    echo json_encode([
        'success' => true,
        'message' => 'Request reviewed and sent to departments for clearance',
        'total_tor_pages' => $torTotalPages,
        'removed_documents' => count($removeIds)
    ]);

} catch (PDOException $e) {
    if ($pdo->inTransaction()) $pdo->rollBack();
    error_log("review_request.php error: " . $e->getMessage());
    echo json_encode(['success' => false, 'message' => 'A database error occurred.']);
}
