<?php
session_start();
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

require_once '../../db.php';
require_once '../../helpers/request_helpers.php';
require_once '../../helpers/email_helper.php';

if (!isset($_SESSION['user_id']) || !in_array($_SESSION['role'], ['student', 'alumni'])) {
    echo json_encode(['success' => false, 'message' => 'Not authenticated']);
    exit;
}

require_once '../../helpers/csrf.php';
validateCsrfToken();

$user_id = $_SESSION['user_id'];
$input = json_decode(file_get_contents('php://input'), true);

if (!$input) {
    echo json_encode(['success' => false, 'message' => 'Invalid request data']);
    exit;
}

try {
    // Check for existing pending request with overlapping documents
    $documents = $input['documents'] ?? [];
    $checkStmt = $pdo->prepare("
        SELECT r.request_id FROM tbl_requests r
        WHERE r.user_id = :user_id AND r.status IN ('Pending', 'Processing')
          AND (r.is_archived = 0 OR r.is_archived IS NULL)
    ");
    $checkStmt->execute([':user_id' => $user_id]);
    $pendingRequests = $checkStmt->fetchAll(PDO::FETCH_COLUMN);

    if (!empty($pendingRequests)) {
        $requestedTor = $documents['tor_purpose'] ?? [];
        $requestedCert = $documents['certification'] ?? [];
        $requestedDiploma = $documents['diploma'] ?? [];
        $requestedCav = !empty($documents['cav_overseas']);

        foreach ($pendingRequests as $pendingId) {
            // Check TOR overlap
            if (!empty($requestedTor)) {
                $torCheck = $pdo->prepare("
                    SELECT d.document_name FROM tbl_request_documents rd
                    JOIN tbl_documents d ON rd.document_id = d.document_id
                    JOIN tbl_document_types dt ON d.type_id = dt.type_id
                    WHERE rd.request_id = ? AND dt.type_name = 'tor'
                ");
                $torCheck->execute([$pendingId]);
                $existingTor = $torCheck->fetchAll(PDO::FETCH_COLUMN);
                $overlap = array_intersect($requestedTor, $existingTor);
                if (!empty($overlap)) {
                    echo json_encode(['success' => false, 'message' => 'You already have a pending request for: ' . implode(', ', $overlap)]);
                    exit;
                }
            }

            // Check certification overlap
            if (!empty($requestedCert)) {
                $certCheck = $pdo->prepare("
                    SELECT d.document_name FROM tbl_request_documents rd
                    JOIN tbl_documents d ON rd.document_id = d.document_id
                    JOIN tbl_document_types dt ON d.type_id = dt.type_id
                    WHERE rd.request_id = ? AND dt.type_name = 'certification' AND d.document_name != 'Diploma'
                ");
                $certCheck->execute([$pendingId]);
                $existingCert = $certCheck->fetchAll(PDO::FETCH_COLUMN);
                $overlap = array_intersect($requestedCert, $existingCert);
                if (!empty($overlap)) {
                    echo json_encode(['success' => false, 'message' => 'You already have a pending request for: ' . implode(', ', $overlap)]);
                    exit;
                }
            }

            // Check diploma overlap
            if (!empty($requestedDiploma)) {
                $dipCheck = $pdo->prepare("
                    SELECT d.document_name FROM tbl_request_documents rd
                    JOIN tbl_documents d ON rd.document_id = d.document_id
                    WHERE rd.request_id = ? AND d.document_name = 'Diploma'
                ");
                $dipCheck->execute([$pendingId]);
                if ($dipCheck->rowCount() > 0) {
                    echo json_encode(['success' => false, 'message' => 'You already have a pending request for Diploma']);
                    exit;
                }
            }

            // Check CAV overlap
            if ($requestedCav) {
                $cavCheck = $pdo->prepare("
                    SELECT rd.id FROM tbl_request_documents rd
                    JOIN tbl_documents d ON rd.document_id = d.document_id
                    WHERE rd.request_id = ? AND d.document_name = 'CAV Overseas'
                ");
                $cavCheck->execute([$pendingId]);
                if ($cavCheck->rowCount() > 0) {
                    echo json_encode(['success' => false, 'message' => 'You already have a pending request for CAV Overseas']);
                    exit;
                }
            }
        }
    }

    // ─── Holidays Check: block requests during regular holidays ───
    $date_requested = $input['date_requested'] ?? date('Y-m-d');
    $dateObj = DateTime::createFromFormat('Y-m-d', $date_requested);
    if ($dateObj) {
        $holidayDate = $dateObj->format('Y-m-d');
        $holidayCheck = $pdo->prepare("
            SELECT COUNT(*) FROM tbl_holidays
            WHERE holiday_date = ? AND is_active = 1 AND is_archived = 0
        ");
        $holidayCheck->execute([$holidayDate]);
        if ((int)$holidayCheck->fetchColumn() > 0) {
            echo json_encode([
                'success' => false,
                'message' => 'Requests cannot be submitted on ' . $date_requested . ' because it is a regular holiday.'
            ]);
            exit;
        }
    }

    $pdo->beginTransaction();

    // 1. Insert the request
    $stmt = $pdo->prepare("INSERT INTO tbl_requests (
        user_id, student_name, course_year, last_school_year,
        date_requested, request_date, status, remarks
    ) VALUES (
        :user_id, :student_name, :course_year, :last_school_year,
        :date_requested, NOW(), 'Pending', ''
    )");
    $stmt->execute([
        ':user_id' => $user_id,
        ':student_name' => $input['student_name'] ?? '',
        ':course_year' => $input['course_year'] ?? '',
        ':last_school_year' => $input['last_school_year'] ?? '',
        ':date_requested' => $date_requested
    ]);
    $request_id = $pdo->lastInsertId();

    // 1b. Generate tracking number (REQ-YYYY-NNNN)
    $year = date('Y');
    $seqStmt = $pdo->prepare("SELECT tracking_number FROM tbl_requests WHERE tracking_number LIKE ? ORDER BY tracking_number DESC LIMIT 1");
    $seqStmt->execute(["REQ-{$year}-%"]);
    $lastTracking = $seqStmt->fetchColumn();
    if ($lastTracking) {
        $lastSeq = (int)substr($lastTracking, -4);
        $nextSeq = $lastSeq + 1;
    } else {
        $nextSeq = 1;
    }
    $trackingNumber = "REQ-{$year}-" . str_pad($nextSeq, 4, '0', STR_PAD_LEFT);
    $pdo->prepare("UPDATE tbl_requests SET tracking_number = ? WHERE request_id = ?")->execute([$trackingNumber, $request_id]);

    // 2. Insert TOR selections into junction table
    if (!empty($documents['tor_purpose']) && is_array($documents['tor_purpose'])) {
        $docStmt = $pdo->prepare("INSERT INTO tbl_request_documents (request_id, document_id, copies)
            SELECT ?, document_id, 1 FROM tbl_documents WHERE document_name = ?");
        foreach ($documents['tor_purpose'] as $torName) {
            $docStmt->execute([$request_id, $torName]);
        }
    }

    // 3. Insert certification selections into junction table
    if (!empty($documents['certification']) && is_array($documents['certification'])) {
        $docStmt = $pdo->prepare("INSERT INTO tbl_request_documents (request_id, document_id, copies)
            SELECT ?, document_id, 1 FROM tbl_documents WHERE document_name = ?");
        foreach ($documents['certification'] as $certName) {
            $docStmt->execute([$request_id, $certName]);
        }
    }

    // 4. Insert diploma selections
    if (!empty($documents['diploma']) && is_array($documents['diploma'])) {
        $docStmt = $pdo->prepare("INSERT INTO tbl_request_documents (request_id, document_id, copies)
            SELECT ?, document_id, 1 FROM tbl_documents WHERE document_name = 'Diploma'");
        foreach ($documents['diploma'] as $dipName) {
            $docStmt->execute([$request_id]);
        }
    }

    // 5. Insert CAV Overseas as a document with copies
    if (!empty($documents['cav_overseas'])) {
        $cavCopies = max(1, (int)($documents['cav_copies'] ?? 1));
        $cavStmt = $pdo->prepare("INSERT INTO tbl_request_documents (request_id, document_id, copies)
            SELECT ?, document_id, ? FROM tbl_documents WHERE document_name = 'CAV Overseas'");
        $cavStmt->execute([$request_id, $cavCopies]);
    }

    // 6. Department clearances are now created during Step 2 (staff review) via staff/api/review_request.php

    $pdo->commit();

    // Send email notification (non-blocking — don't fail the request if email fails)
    try {
        sendRequestSubmittedEmail($pdo, $request_id, $trackingNumber);
    } catch (Exception $e) {
        error_log("Email notification failed for request $request_id: " . $e->getMessage());
    }

    // Build response using helpers
    $new_request = $pdo->prepare("SELECT * FROM tbl_requests WHERE request_id = ?");
    $new_request->execute([$request_id]);
    $result = $new_request->fetch(PDO::FETCH_ASSOC);
    if ($result) {
        $result['documents'] = buildDocumentsObject($pdo, $request_id);
        $result['clearance'] = buildClearanceObject($pdo, $request_id);
        if (isset($result['request_date'])) {
            $result['request_date_formatted'] = date('M d, Y h:i A', strtotime($result['request_date']));
        }
    }

    echo json_encode([
        'success' => true,
        'message' => 'Request submitted successfully',
        'tracking_number' => $trackingNumber,
        'request' => $result
    ]);

} catch (PDOException $e) {
    $pdo->rollBack();
    error_log("submit_request.php error: " . $e->getMessage());
    echo json_encode(["success" => false, "message" => "A database error occurred."]);
}
?>
