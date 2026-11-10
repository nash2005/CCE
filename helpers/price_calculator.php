<?php
/**
 * Calculate total price for a request using the normalized junction tables.
 * Accepts either a request_id (int) to query from DB, or a documents array (legacy support).
 */
function calculateRequestPrice($pdo, $requestId) {
    // If passed an array (legacy), handle backward compat
    if (is_array($requestId)) {
        return calculateFromArray($pdo, $requestId);
    }

    // If passed a string that looks like JSON, decode and use array method
    if (is_string($requestId)) {
        $decoded = json_decode($requestId, true);
        if (is_array($decoded)) {
            return calculateFromArray($pdo, $decoded);
        }
        // Otherwise treat as request_id
        $requestId = (int)$requestId;
    }

    if (empty($requestId)) return 0;

    $totalPrice = 0;

    // Get the user_id for this request (to look up TOR pages)
    $userStmt = $pdo->prepare("SELECT user_id FROM tbl_requests WHERE request_id = ?");
    $userStmt->execute([$requestId]);
    $userId = $userStmt->fetchColumn();

    // Get TOR pages for this student (0 if not set)
    $torPages = 0;
    if ($userId) {
        $torStmt = $pdo->prepare("SELECT total_pages FROM tbl_student_tor_pages WHERE user_id = ?");
        $torStmt->execute([$userId]);
        $torPages = (int)$torStmt->fetchColumn();
    }

    // All document prices from single junction table
    // TOR documents: price * pages * copies (pages set per TOR row by staff
    //   during the Step 2 review; legacy rows fall back to the student's
    //   stored total, then to the flat document price)
    // Other documents: price * copies
    $stmt = $pdo->prepare("
        SELECT d.price, rd.copies, rd.pages, dt.type_name
        FROM tbl_request_documents rd
        JOIN tbl_documents d ON rd.document_id = d.document_id
        JOIN tbl_document_types dt ON d.type_id = dt.type_id
        WHERE rd.request_id = ?
    ");
    $stmt->execute([$requestId]);
    while ($row = $stmt->fetch()) {
        if ($row['type_name'] === 'tor') {
            $rowPages = (int)($row['pages'] ?? 0);
            if ($rowPages > 0) {
                $totalPrice += (float)$row['price'] * $rowPages * (int)$row['copies'];
            } elseif ($torPages > 0) {
                // Reviewed before per-TOR page counts existed
                $totalPrice += (float)$row['price'] * $torPages * (int)$row['copies'];
            } else {
                $totalPrice += (float)$row['price'] * (int)$row['copies'];
            }
        } else {
            $totalPrice += (float)$row['price'] * (int)$row['copies'];
        }
    }

    return $totalPrice;
}

/**
 * Legacy: calculate from a documents array (backward compat for old code paths).
 */
function calculateFromArray($pdo, $documents) {
    if (empty($documents)) return 0;
    $totalPrice = 0;

    if (!empty($documents['tor_purpose']) && is_array($documents['tor_purpose'])) {
        foreach ($documents['tor_purpose'] as $torName) {
            $stmt = $pdo->prepare("SELECT price FROM tbl_documents WHERE document_name = ? LIMIT 1");
            $stmt->execute([$torName]);
            $row = $stmt->fetch();
            $totalPrice += $row ? (float)$row['price'] : 100.00;
        }
    }

    if (!empty($documents['certification']) && is_array($documents['certification'])) {
        foreach ($documents['certification'] as $certName) {
            $stmt = $pdo->prepare("SELECT price FROM tbl_documents WHERE document_name = ? LIMIT 1");
            $stmt->execute([$certName]);
            $row = $stmt->fetch();
            $totalPrice += $row ? (float)$row['price'] : 200.00;
        }
    }

    if (!empty($documents['diploma']) && is_array($documents['diploma'])) {
        foreach ($documents['diploma'] as $dipName) {
            $stmt = $pdo->prepare("SELECT price FROM tbl_documents WHERE document_name = 'Diploma' LIMIT 1");
            $stmt->execute();
            $row = $stmt->fetch();
            $totalPrice += $row ? (float)$row['price'] : 200.00;
        }
    }

    if (!empty($documents['cav_overseas'])) {
        $copies = max(1, (int)($documents['cav_copies'] ?? 1));
        $stmt = $pdo->prepare("SELECT price FROM tbl_documents WHERE document_name = 'CAV Overseas' LIMIT 1");
        $stmt->execute();
        $row = $stmt->fetch();
        $totalPrice += ($row ? (float)$row['price'] : 200.00) * $copies;
    }

    return $totalPrice;
}
