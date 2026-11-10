<?php
/**
 * Shared helpers to build documents/clearance objects from normalized tables.
 * Returns the same JSON shape the frontend JS expects.
 */

/**
 * Build documents object for a request from junction tables.
 * Returns:
 *   { tor_purpose: [...], certification: [...], diploma: [...],
 *     cav_overseas: bool, cav_copies: int,
 *     doc_rows: [ { id, document_id, document_name, type_name, copies, pages, price } ] }
 * `doc_rows` mirrors the junction table and is what the staff Step 2 review uses
 * to set TOR pages per document and to deselect documents before sending the
 * request to the departments. The array keys keep their legacy shape so all
 * other views (dean/finance/admin/student) continue to work unchanged.
 */
function buildDocumentsObject($pdo, $requestId) {
    $docs = [
        'tor_purpose' => [],
        'certification' => [],
        'diploma' => [],
        'cav_overseas' => false,
        'cav_copies' => 0,
        'doc_rows' => []
    ];

    // One query for every requested document (ordered as the student selected them)
    $stmt = $pdo->prepare("
        SELECT rd.id, rd.document_id, rd.copies, rd.pages,
               d.document_name, d.price, dt.type_name
        FROM tbl_request_documents rd
        JOIN tbl_documents d ON rd.document_id = d.document_id
        JOIN tbl_document_types dt ON d.type_id = dt.type_id
        WHERE rd.request_id = ?
        ORDER BY rd.id
    ");
    $stmt->execute([$requestId]);
    while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
        $type = strtolower($row['type_name']);

        $docs['doc_rows'][] = [
            'id' => (int)$row['id'],
            'document_id' => (int)$row['document_id'],
            'document_name' => $row['document_name'],
            'type_name' => $type,
            'copies' => (int)$row['copies'],
            'pages' => ($row['pages'] !== null && $row['pages'] !== '') ? (int)$row['pages'] : null,
            'price' => (float)$row['price']
        ];

        if ($type === 'tor') {
            $docs['tor_purpose'][] = $row['document_name'];
        } elseif ($type === 'certification') {
            // Diploma lives under the certification type but is listed separately
            if ($row['document_name'] === 'Diploma') {
                $docs['diploma'][] = 'First Copy';
            } else {
                $docs['certification'][] = $row['document_name'];
            }
        } elseif ($type === 'cav') {
            $docs['cav_overseas'] = true;
            $docs['cav_copies'] = (int)$row['copies'];
        }
    }

    return $docs;
}

/**
 * Build clearance object for a request from tbl_department_clearances.
 * Uses tbl_users.email as the department key.
 * Returns: { library: 'Approved', guidance: 'Pending', finance: 'Rejected', dean: 'Approved' }
 */
function buildClearanceObject($pdo, $requestId) {
    $clearance = [];

    $stmt = $pdo->prepare("
        SELECT u.email AS department, dc.status
        FROM tbl_department_clearances dc
        JOIN tbl_users u ON dc.user_id = u.user_id
        WHERE dc.request_id = ?
    ");
    $stmt->execute([$requestId]);

    while ($row = $stmt->fetch()) {
        $clearance[$row['department']] = $row['status'];
    }

    return $clearance;
}

/**
 * Build a detailed clearance object (who approved + when) for the student
 * tracker's "Dept. Clearance" step. Uses tbl_users.email as the department key
 * (matching buildClearanceObject) and joins the approver's identity/timestamp.
 *
 * Returns: {
 *   dean:     { status: 'Approved', approved_by: 9,  approver: 'dean',     approved_at: 'Oct 12, 2026 3:04 PM' },
 *   library:  { status: 'Pending',  approved_by: null, approver: null,     approved_at: null },
 *   ...
 * }
 * approver is the approver's email (department name) so the student sees which
 * department approved; approved_at is a human-readable timestamp.
 */
function buildClearanceDetailsObject($pdo, $requestId) {
    $details = [];

    $stmt = $pdo->prepare("
        SELECT u.email AS department,
               dc.status,
               dc.approved_by,
               ua.email AS approver_email,
               dc.approved_at
        FROM tbl_department_clearances dc
        JOIN tbl_users u ON dc.user_id = u.user_id
        LEFT JOIN tbl_users ua ON dc.approved_by = ua.user_id
        WHERE dc.request_id = ?
    ");
    $stmt->execute([$requestId]);

    while ($row = $stmt->fetch()) {
        $approvedAt = null;
        if (!empty($row['approved_at'])) {
            $ts = strtotime($row['approved_at']);
            if ($ts !== false) {
                $approvedAt = date('M d, Y g:i A', $ts);
            } else {
                $approvedAt = $row['approved_at'];
            }
        }
        $details[$row['department']] = [
            'status'      => $row['status'],
            'approved_by' => $row['approved_by'] !== null ? (int)$row['approved_by'] : null,
            'approver'    => $row['approver_email'] !== null ? $row['approver_email'] : null,
            'approved_at' => $approvedAt,
        ];
    }

    return $details;
}

/**
 * Build remarks object from tbl_department_clearances.
 * Returns: { finance: 'reason...', dean: '', staff: 'remark...' }
 */
function buildRemarksObject($pdo, $requestId) {
    $remarks = [];

    $stmt = $pdo->prepare("
        SELECT u.email AS department, dc.remarks
        FROM tbl_department_clearances dc
        JOIN tbl_users u ON dc.user_id = u.user_id
        WHERE dc.request_id = ? AND dc.remarks != ''
    ");
    $stmt->execute([$requestId]);
    while ($row = $stmt->fetch()) {
        $remarks[$row['department']] = $row['remarks'];
    }

    // Staff remarks from tbl_requests.remarks (may contain JSON with 'staff' key)
    $stmt = $pdo->prepare("SELECT remarks FROM tbl_requests WHERE request_id = ?");
    $stmt->execute([$requestId]);
    $req = $stmt->fetch();
    if ($req && !empty($req['remarks'])) {
        $reqRemarks = json_decode($req['remarks'], true);
        if (is_array($reqRemarks) && isset($reqRemarks['staff'])) {
            $remarks['staff'] = $reqRemarks['staff'];
        } elseif (!is_array($reqRemarks)) {
            $remarks['staff'] = $req['remarks'];
        }
    }

    return $remarks;
}
