<?php
require_once __DIR__ . '/../vendor/phpmailer/Exception.php';
require_once __DIR__ . '/../vendor/phpmailer/PHPMailer.php';
require_once __DIR__ . '/../vendor/phpmailer/SMTP.php';

use PHPMailer\PHPMailer\PHPMailer;
use PHPMailer\PHPMailer\Exception;

// ─── SMTP Configuration ───
// Change these to your client's email credentials when deployed
if (!defined('SMTP_EMAIL'))    define('SMTP_EMAIL',    'nashkharl@gmail.com');
if (!defined('SMTP_PASSWORD')) define('SMTP_PASSWORD', 'qdahatnmfeavkxqq');
if (!defined('SMTP_NAME'))     define('SMTP_NAME',     'CCES Online Requisition');

/**
 * Send a professional email notification.
 * @param string $toEmail Recipient email
 * @param string $toName Recipient name
 * @param string $subject Email subject
 * @param string $heading Main heading in the email body
 * @param string $bodyHtml HTML content for the email body (between header and footer)
 * @return bool
 */
function sendNotificationEmail($toEmail, $toName, $subject, $heading, $bodyHtml) {
    if (empty($toEmail) || !filter_var($toEmail, FILTER_VALIDATE_EMAIL)) {
        error_log("sendNotificationEmail: invalid email '$toEmail'");
        return false;
    }

    $currentYear = date('Y');
    $greeting = htmlspecialchars($toName ?: 'Student');

    $html = <<<HTML
<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0; padding:0; background-color:#f4f6f9; font-family:'Segoe UI',Tahoma,Geneva,Verdana,sans-serif;">
    <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f6f9; padding:40px 0;">
        <tr>
            <td align="center">
                <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff; border-radius:12px; overflow:hidden; box-shadow:0 4px 20px rgba(0,0,0,0.08);">
                    <!-- Header -->
                    <tr>
                        <td style="background:linear-gradient(135deg,#667eea 0%,#764ba2 100%); padding:35px 40px; text-align:center;">
                            <h1 style="color:#ffffff; margin:0; font-size:22px; font-weight:700; letter-spacing:0.5px;">
                                CCES Online Requisition
                            </h1>
                            <p style="color:rgba(255,255,255,0.85); margin:8px 0 0; font-size:13px; font-weight:400;">
                                City College of El Salvador
                            </p>
                        </td>
                    </tr>
                    <!-- Body -->
                    <tr>
                        <td style="padding:40px;">
                            <h2 style="color:#2c3e50; margin:0 0 20px; font-size:20px; font-weight:600;">
                                {$heading}
                            </h2>
                            <p style="color:#555; font-size:15px; line-height:1.7; margin:0 0 15px;">
                                Good Day! <strong>{$greeting}</strong>,
                            </p>
                            {$bodyHtml}
                        </td>
                    </tr>
                    <!-- Footer -->
                    <tr>
                        <td style="background:#f8f9fa; padding:25px 40px; text-align:center; border-top:1px solid #e9ecef;">
                            <p style="color:#aaa; font-size:12px; line-height:1.6; margin:0 0 8px;">
                                This is an automated message from the CCES Online Requisition System.<br>
                                Please do not reply to this email.
                            </p>
                            <p style="color:#ccc; font-size:11px; margin:0;">
                                &copy; {$currentYear} City College of El Salvador &mdash; El Salvador City, Misamis Oriental
                            </p>
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
</body>
</html>
HTML;

    try {
        $mail = new PHPMailer(true);
        $mail->isSMTP();
        $mail->Host       = 'smtp.gmail.com';
        $mail->SMTPAuth   = true;
        $mail->Username   = SMTP_EMAIL;
        $mail->Password   = SMTP_PASSWORD;
        $mail->SMTPSecure = PHPMailer::ENCRYPTION_STARTTLS;
        $mail->Port       = 587;

        $mail->setFrom(SMTP_EMAIL, SMTP_NAME);
        $mail->addAddress($toEmail, $toName);

        $mail->isHTML(true);
        $mail->Subject = $subject;
        $mail->Body    = $html;
        $mail->AltBody = strip_tags(str_replace(['<br>', '<br/>', '<br />'], "\n", $bodyHtml));

        $mail->send();
        return true;
    } catch (Exception $e) {
        error_log("sendNotificationEmail error: " . $e->getMessage());
        return false;
    }
}

/**
 * Send request submitted notification
 */
function sendRequestSubmittedEmail($pdo, $requestId, $trackingNumber) {
    $info = getRequestEmailInfo($pdo, $requestId);
    if (!$info) return false;

    $bodyHtml = '
        <p style="color:#555; font-size:15px; line-height:1.7; margin:0 0 20px;">
            Your document request has been successfully submitted and is now being processed.
        </p>
        <table width="100%" cellpadding="0" cellspacing="0" style="background:#f0f4ff; border-radius:8px; margin:0 0 20px;">
            <tr>
                <td style="padding:20px; text-align:center;">
                    <p style="color:#94a3b8; font-size:12px; text-transform:uppercase; letter-spacing:1px; margin:0 0 5px;">Tracking Number</p>
                    <p style="color:#667eea; font-size:28px; font-weight:700; margin:0; letter-spacing:1px;">' . htmlspecialchars($trackingNumber) . '</p>
                </td>
            </tr>
        </table>
        <p style="color:#555; font-size:14px; line-height:1.7; margin:0 0 10px;">
            <strong>Documents Requested:</strong> ' . htmlspecialchars($info['documents_summary']) . '
        </p>
        <p style="color:#555; font-size:14px; line-height:1.7; margin:0 0 20px;">
            Your request will now proceed to department validation. You will receive email updates as your request progresses.
        </p>
        <table width="100%" cellpadding="0" cellspacing="0" style="background:#fff8e1; border-left:4px solid #ffc107; border-radius:0 6px 6px 0; margin:0 0 10px;">
            <tr>
                <td style="padding:14px 18px;">
                    <p style="color:#856404; font-size:13px; line-height:1.6; margin:0;">
                        <strong>Note:</strong> Please save your tracking number <strong>' . htmlspecialchars($trackingNumber) . '</strong> for future reference.
                    </p>
                </td>
            </tr>
        </table>';

    return sendNotificationEmail(
        $info['email'], $info['name'],
        'Request Submitted - ' . $trackingNumber . ' | CCES Online Requisition',
        'Request Submitted Successfully',
        $bodyHtml
    );
}

/**
 * Send request finalized notification (Ready to Claim or Rejected) with total price
 */
function sendRequestFinalizedEmail($pdo, $requestId, $status) {
    $info = getRequestEmailInfo($pdo, $requestId);
    if (!$info) return false;

    $trackingNumber = $info['tracking_number'] ?: 'N/A';
    $totalPrice = number_format((float)$info['total_price'], 2);

    if ($status === 'Ready to Claim') {
        $statusColor = '#10b981';
        $statusIcon = '✅';
        $statusMsg = 'All department clearances for your request have been completed. Please submit your reference number to the Registrar\'s Office to continue.';
        $heading = 'Submit Your Reference Number';
    } else {
        $statusColor = '#ef4444';
        $statusIcon = '❌';
        $statusMsg = 'Unfortunately, your request has been <strong>rejected</strong>. Please visit the Registrar\'s Office for more information.';
        $heading = 'Request Update';
    }

    // The "Status: Ready to Claim" row is intentionally omitted from the
    // Ready-to-Claim email (now a "Submit Your Reference Number" notice, where
    // the status line would be contradictory). The Rejected email keeps it.
    $statusRow = ($status === 'Ready to Claim') ? '' : '
                        <tr>
                            <td style="padding:8px 0; border-bottom:1px solid #e9ecef;">
                                <span style="color:#94a3b8; font-size:12px; text-transform:uppercase;">Status</span><br>
                                <strong style="color:' . $statusColor . '; font-size:16px;">' . $statusIcon . ' ' . htmlspecialchars($status) . '</strong>
                            </td>
                        </tr>';

    $bodyHtml = '
        <p style="color:#555; font-size:15px; line-height:1.7; margin:0 0 20px;">' . $statusMsg . '</p>
        <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc; border-radius:8px; border:1px solid #e2e8f0; margin:0 0 20px;">
            <tr>
                <td style="padding:20px;">
                    <table width="100%" cellpadding="0" cellspacing="0">
                        <tr>
                            <td style="padding:8px 0; border-bottom:1px solid #e9ecef;">
                                <span style="color:#94a3b8; font-size:12px; text-transform:uppercase;">Tracking Number</span><br>
                                <strong style="color:#667eea; font-size:16px;">' . htmlspecialchars($trackingNumber) . '</strong>
                            </td>
                        </tr>' . $statusRow . '
                        <tr>
                            <td style="padding:8px 0; border-bottom:1px solid #e9ecef;">
                                <span style="color:#94a3b8; font-size:12px; text-transform:uppercase;">Documents</span><br>
                                <span style="color:#334155; font-size:14px;">' . htmlspecialchars($info['documents_summary']) . '</span>
                            </td>
                        </tr>
                        <tr>
                            <td style="padding:8px 0;">
                                <span style="color:#94a3b8; font-size:12px; text-transform:uppercase;">Total Amount</span><br>
                                <strong style="color:#2b3a67; font-size:20px;">₱' . $totalPrice . '</strong>
                            </td>
                        </tr>
                    </table>
                </td>
            </tr>
        </table>';

    if ($status === 'Ready to Claim') {
        $bodyHtml .= '
        <table width="100%" cellpadding="0" cellspacing="0" style="background:#ecfdf5; border-left:4px solid #10b981; border-radius:0 6px 6px 0; margin:0 0 10px;">
            <tr>
                <td style="padding:14px 18px;">
                    <p style="color:#065f46; font-size:13px; line-height:1.6; margin:0;">
                        <strong>Submit your Reference Number:</strong> Please proceed to the Registrar\'s Office and submit your reference number to continue your request. Bring your tracking number <strong>' . htmlspecialchars($trackingNumber) . '</strong> for verification.
                    </p>
                </td>
            </tr>
        </table>';
    }

    $subject = ($status === 'Ready to Claim')
        ? 'Submit Reference Number - ' . $trackingNumber . ' | CCES Online Requisition'
        : 'Request ' . $status . ' - ' . $trackingNumber . ' | CCES Online Requisition';

    return sendNotificationEmail(
        $info['email'], $info['name'],
        $subject,
        $heading,
        $bodyHtml
    );
}

/**
 * Helper: get email info for a request
 */
function getRequestEmailInfo($pdo, $requestId) {
    $stmt = $pdo->prepare("
        SELECT r.request_id, r.tracking_number, r.user_id, r.student_name,
               u.email,
               COALESCE(s.first_name, a.first_name, r.student_name) AS first_name,
               COALESCE(s.last_name, a.last_name, '') AS last_name
        FROM tbl_requests r
        JOIN tbl_users u ON r.user_id = u.user_id
        LEFT JOIN tbl_students s ON r.user_id = s.user_id
        LEFT JOIN tbl_archived_students a ON r.user_id = a.user_id
        WHERE r.request_id = ?
    ");
    $stmt->execute([$requestId]);
    $row = $stmt->fetch(PDO::FETCH_ASSOC);
    if (!$row) return null;

    // Get documents summary
    $docStmt = $pdo->prepare("
        SELECT d.document_name, dt.type_name, rd.copies
        FROM tbl_request_documents rd
        JOIN tbl_documents d ON rd.document_id = d.document_id
        JOIN tbl_document_types dt ON d.type_id = dt.type_id
        WHERE rd.request_id = ?
    ");
    $docStmt->execute([$requestId]);
    $docs = $docStmt->fetchAll(PDO::FETCH_ASSOC);

    $docNames = [];
    foreach ($docs as $d) {
        $docNames[] = $d['document_name'];
    }

    // Calculate total price
    require_once __DIR__ . '/price_calculator.php';
    $totalPrice = calculateRequestPrice($pdo, $requestId);

    return [
        'email' => $row['email'],
        'name' => trim($row['first_name'] . ' ' . $row['last_name']),
        'tracking_number' => $row['tracking_number'],
        'documents_summary' => implode(', ', $docNames) ?: 'N/A',
        'total_price' => $totalPrice
    ];
}

/**
 * Send email notification when a student submits a reference number.
 * @param PDO $pdo Database connection
 * @param int $requestId Request ID
 */
function sendReferenceSubmittedEmail($pdo, $requestId) {
    // Get email info for the request
    $info = getRequestEmailInfo($pdo, $requestId);
    if (!$info) {
        error_log("sendReferenceSubmittedEmail: request not found $requestId");
        return false;
    }

    $heading = 'Reference Number Submitted';
    $bodyHtml = '
        <p style="margin:0 0 10px 0;">Good Day! <strong>' . htmlspecialchars($info['name']) . '</strong>,</p>
        <p style="margin:0 0 15px 0;">Your reference number has been successfully submitted. Here are your details:</p>
        <table width="100%" cellpadding="6" cellspacing="0" border="0" style="font-size:14px;">
            <tr>
                <td style="padding:4px 0; color:#64748b;">Tracking Number</td>
                <td style="padding:4px 0; color:#1e40af; font-weight:600;">' . htmlspecialchars($info['tracking_number']) . '</td>
            </tr>
            <tr>
                <td style="padding:4px 0; color:#64748b;">Submitted</td>
                <td style="padding:4px 0; color:#334155;">' . date('M d, Y h:i A') . '</td>
            </tr>
        </table>
        <p style="margin:15px 0 0 0;">Thank you for your cooperation!</p>';

    return sendNotificationEmail(
        $info['email'], $info['name'],
        'Reference Submitted - ' . $info['tracking_number'] . ' | CCES Online Requisition',
        $heading,
        $bodyHtml
    );
}
