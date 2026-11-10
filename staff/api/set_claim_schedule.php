<?php
/**
 * Set (or update) the claiming schedule of a request.
 *
 * Workflow: the staff records the student's reference number first
 * (submit_reference.php), then picks the claiming window (start + end date)
 * here. The request moves to "Scheduled for Claiming" so the student's
 * progress tracker can display the claiming schedule.
 */
session_start();
header('Content-Type: application/json');

if (!isset($_SESSION['user_id']) || $_SESSION['role'] !== 'staff') {
    echo json_encode(['success' => false, 'message' => 'Unauthorized']);
    exit;
}

require_once "../../db.php";
require_once "../../helpers/csrf.php";
require_once "../../helpers/email_helper.php";
validateCsrfToken();

$input = json_decode(file_get_contents('php://input'), true);

$requestId       = isset($input['request_id']) ? (int)$input['request_id'] : 0;
$scheduleStart   = isset($input['schedule_start']) ? trim($input['schedule_start']) : '';
$scheduleEnd     = isset($input['schedule_end']) ? trim($input['schedule_end']) : '';
$scheduleRemarks = isset($input['schedule_remarks']) ? trim($input['schedule_remarks']) : '';

if ($requestId <= 0) {
    echo json_encode(['success' => false, 'message' => 'Request ID is required']);
    exit;
}

if ($scheduleStart === '' || $scheduleEnd === '') {
    echo json_encode(['success' => false, 'message' => 'Please select both the start and end date of the claiming schedule']);
    exit;
}

// Dates must be real calendar dates in YYYY-MM-DD format
if (!isValidDate($scheduleStart)) {
    echo json_encode(['success' => false, 'message' => 'Invalid start date']);
    exit;
}
if (!isValidDate($scheduleEnd)) {
    echo json_encode(['success' => false, 'message' => 'Invalid end date']);
    exit;
}

if ($scheduleEnd < $scheduleStart) {
    echo json_encode(['success' => false, 'message' => 'The end date must be on or after the start date']);
    exit;
}

try {
    $stmt = $pdo->prepare("
        SELECT request_id, status
        FROM tbl_requests
        WHERE request_id = ?
    ");
    $stmt->execute([$requestId]);
    $request = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$request) {
        echo json_encode(['success' => false, 'message' => 'Request not found']);
        exit;
    }

    if (!in_array($request['status'], ['Ready to Claim', 'Scheduled for Claiming'], true)) {
        echo json_encode(['success' => false, 'message' => 'A claiming schedule can only be set once the request is ready to claim']);
        exit;
    }

    // The reference number (payment) must be recorded before a schedule is set
    $stmtPay = $pdo->prepare("SELECT reference_number, is_paid FROM tbl_request_payments WHERE request_id = ?");
    $stmtPay->execute([$requestId]);
    $pay = $stmtPay->fetch(PDO::FETCH_ASSOC);

    if (!$pay || empty($pay['reference_number']) || (int)$pay['is_paid'] !== 1) {
        echo json_encode(['success' => false, 'message' => 'A reference number must be entered before setting a claiming schedule']);
        exit;
    }
// Get staff_id
    $stmtStaff = $pdo->prepare("SELECT staff_id FROM tbl_staff WHERE user_id = ?");
    $stmtStaff->execute([$_SESSION['user_id']]);
    $staff = $stmtStaff->fetch(PDO::FETCH_ASSOC);
    $staffId = $staff ? $staff['staff_id'] : null;

    $isReschedule = $request['status'] === 'Scheduled for Claiming';

    $stmtUpdate = $pdo->prepare("
        UPDATE tbl_requests
        SET status = 'Scheduled for Claiming',
            staff_id = ?,
            claim_schedule_start = ?,
            claim_schedule_end = ?,
            claim_schedule_remarks = ?
        WHERE request_id = ?
    ");
    $stmtUpdate->execute([
        $staffId,
        $scheduleStart,
        $scheduleEnd,
        $scheduleRemarks !== '' ? $scheduleRemarks : null,
        $requestId
    ]);

    // Notify the student about the claiming schedule (best effort)
    try {
        notifyStudentOfClaimSchedule($pdo, $requestId, $scheduleStart, $scheduleEnd, $scheduleRemarks);
    } catch (Exception $e) {
        error_log("set_claim_schedule.php email error: " . $e->getMessage());
    }

    echo json_encode([
        'success' => true,
        'message' => $isReschedule
            ? 'Claiming schedule updated. The student has been notified.'
            : 'Claiming schedule set. The student has been notified.'
    ]);

} catch (PDOException $e) {
    error_log("set_claim_schedule.php error: " . $e->getMessage());
    echo json_encode(['success' => false, 'message' => 'A database error occurred.']);
}

/**
 * Check that a string is a real calendar date in YYYY-MM-DD format.
 */
function isValidDate($value)
{
    $dt = DateTime::createFromFormat('Y-m-d', $value);
    return $dt && $dt->format('Y-m-d') === $value;
}

/**
 * Email the student the claiming window that was set by the staff.
 */
function notifyStudentOfClaimSchedule($pdo, $requestId, $start, $end, $remarks)
{
    $info = getRequestEmailInfo($pdo, $requestId);
    if (!$info) {
        return false;
    }

    $startFmt = date('F j, Y', strtotime($start));
    $endFmt = date('F j, Y', strtotime($end));
    $span = ($start === $end) ? $startFmt : $startFmt . ' to ' . $endFmt;

    $remarksHtml = '';
    if ($remarks !== '') {
        $remarksHtml = '
        <table width="100%" cellpadding="0" cellspacing="0" style="background:#eff6ff; border-left:4px solid #3b82f6; border-radius:0 6px 6px 0; margin:0 0 10px;">
            <tr>
                <td style="padding:14px 18px;">
                    <p style="color:#1e40af; font-size:13px; line-height:1.6; margin:0;">
                        <strong>Remarks:</strong> ' . htmlspecialchars($remarks) . '
                    </p>
                </td>
            </tr>
        </table>';
    }

    $bodyHtml = '
        <p style="color:#555; font-size:15px; line-height:1.7; margin:0 0 15px;">
            Your requested documents are now <strong>Scheduled for Claiming</strong>. Please visit the
            Registrar\'s Office within the schedule below and bring a valid ID together with your tracking number
            <strong>' . htmlspecialchars($info['tracking_number']) . '</strong>.
        </p>
        <table width="100%" cellpadding="0" cellspacing="0" style="background:#ecfdf5; border-left:4px solid #10b981; border-radius:0 6px 6px 0; margin:0 0 10px;">
            <tr>
                <td style="padding:14px 18px;">
                    <p style="color:#065f46; font-size:13px; line-height:1.6; margin:0;">
                        <strong>Claiming Schedule:</strong> ' . htmlspecialchars($span) . '
                    </p>
                </td>
            </tr>
        </table>' . $remarksHtml;

    return sendNotificationEmail(
        $info['email'],
        $info['name'],
        'Scheduled for Claiming - ' . $info['tracking_number'] . ' | CCES Online Requisition',
        'Scheduled for Claiming',
        $bodyHtml
    );
}
?>