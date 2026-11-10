<?php
session_start();
header('Content-Type: application/json');

if (!isset($_SESSION['user_id']) || $_SESSION['role'] !== 'staff') {
    echo json_encode(['success' => false, 'message' => 'Unauthorized']);
    exit;
}

require_once '../../db.php';
require_once '../../helpers/csrf.php';
validateCsrfToken();

$input = json_decode(file_get_contents('php://input'), true);
$requestId = intval($input['request_id'] ?? 0);

if ($requestId <= 0) {
    echo json_encode(['success' => false, 'message' => 'Request ID is required']);
    exit;
}

try {
    // Verify request exists and get user info
    $stmt = $pdo->prepare("
        SELECT r.request_id, r.status, r.user_id, r.student_name, u.email,
               COALESCE(s.first_name, a.first_name, r.student_name) AS first_name,
               COALESCE(s.last_name, a.last_name, '') AS last_name
        FROM tbl_requests r
        JOIN tbl_users u ON r.user_id = u.user_id
        LEFT JOIN tbl_students s ON r.user_id = s.user_id
        LEFT JOIN tbl_archived_students a ON r.user_id = a.user_id
        WHERE r.request_id = ?
    ");
    $stmt->execute([$requestId]);
    $request = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$request) {
        echo json_encode(['success' => false, 'message' => 'Request not found']);
        exit;
    }

    // Check if request is in a sendable state (Pending or Processing)
    if (!in_array($request['status'], ['Pending', 'Processing'])) {
        echo json_encode(['success' => false, 'message' => 'This request cannot be sent back from its current status']);
        exit;
    }

    // Update status to Sent Back
    $updateStmt = $pdo->prepare("UPDATE tbl_requests SET status = 'Sent Back' WHERE request_id = ?");
    $updateStmt->execute([$requestId]);

    // Build the reference number prompt message
    $heading = 'Request Sent Back — Submit Reference Number';
    $bodyHtml = '
        <p style="margin:0 0 10px 0;">Good Day! <strong>' . htmlspecialchars($request['first_name'] . ' ' . $request['last_name']) . '</strong>,</p>
        <p style="margin:0 0 15px 0;">Your request has been sent back by the staff for further action.</p>
        <table width="100%" cellpadding="6" cellspacing="0" border="0" style="font-size:14px;">
            <tr>
                <td style="padding:4px 0; color:#64748b;">Tracking Number</td>
                <td style="padding:4px 0; color:#1e40af; font-weight:600;">' . htmlspecialchars($request['request_id']) . '</td>
            </tr>
            <tr>
                <td style="padding:4px 0; color:#64748b;">Action Required</td>
                <td style="padding:4px 0; color:#334155;">Please visit the Registrar\'s Office and submit your reference number to continue your request.</td>
            </tr>
        </table>
        <p style="margin:15px 0 0 0;">If you have questions, please contact the Registrar\'s Office.</p>';

    // Send email notification to student
    try {
        require_once '../../helpers/email_helper.php';
        sendNotificationEmail(
            $request['email'],
            trim($request['first_name'] . ' ' . $request['last_name']),
            'Request ' . $request['request_id'] . ' Sent Back — Submit Reference Number | CCES Online Requisition',
            $heading,
            $bodyHtml
        );
    } catch (Exception $e) {
        error_log("Email notification failed for send_back on request $requestId: " . $e->getMessage());
    }

    echo json_encode([
        'success' => true,
        'message' => 'Request sent back successfully. Student has been notified.',
        'status' => 'Sent Back'
    ]);
} catch (PDOException $e) {
    error_log("send_back error: " . $e->getMessage());
    echo json_encode(['success' => false, 'message' => 'A database error occurred.']);
}
