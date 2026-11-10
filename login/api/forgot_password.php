<?php
session_start();
require_once "../../db.php";
require_once "../../helpers/csrf.php";
require_once "../../vendor/phpmailer/Exception.php";
require_once "../../vendor/phpmailer/PHPMailer.php";
require_once "../../vendor/phpmailer/SMTP.php";

use PHPMailer\PHPMailer\PHPMailer;
use PHPMailer\PHPMailer\Exception;

header('Content-Type: application/json');
validateCsrfToken();

if ($_SERVER["REQUEST_METHOD"] !== "POST") {
    echo json_encode(["status" => "error", "message" => "Invalid request"]);
    exit;
}

$email = trim($_POST["email"] ?? "");

if (empty($email)) {
    echo json_encode(["status" => "error", "message" => "Email is required"]);
    exit;
}

if (!filter_var($email, FILTER_VALIDATE_EMAIL) && !preg_match('/^[a-zA-Z0-9._\-]+$/', $email)) {
    echo json_encode(["status" => "error", "message" => "Invalid email format"]);
    exit;
}

// ─── Gmail SMTP Configuration ───
// To make this work:
// 1. Go to https://myaccount.google.com/security
// 2. Enable 2-Step Verification
// 3. Go to App Passwords (search "App Passwords" in Google Account)
// 4. Create an app password for "Mail" and paste it below
define('SMTP_EMAIL',    'nashkharl@gmail.com');
define('SMTP_PASSWORD', 'qdahatnmfeavkxqq');
define('SMTP_NAME',     'CCES Online Requisition');

try {
    // Check if user exists and is active, and get their full name
    $stmt = $pdo->prepare("
        SELECT u.user_id, u.email, u.role_id,
               COALESCE(s.first_name, st.first_name, '') AS first_name,
               COALESCE(s.last_name, st.last_name, '') AS last_name
        FROM tbl_users u
        LEFT JOIN tbl_students s ON u.user_id = s.user_id
        LEFT JOIN tbl_staff st ON u.user_id = st.user_id
        WHERE u.email = :email AND u.status = 'active'
        LIMIT 1
    ");
    $stmt->execute(["email" => $email]);
    $user = $stmt->fetch();

    if (!$user) {
        echo json_encode(["status" => "error", "message" => "This email is not registered in our system."]);
        exit;
    }

    $fullName = trim($user['first_name'] . ' ' . $user['last_name']);
    if (empty($fullName)) {
        $fullName = $user['email'];
    }

    // Generate secure token
    $token = bin2hex(random_bytes(32));
    $expiresAt = date("Y-m-d H:i:s", strtotime("+1 hour"));

    // Delete any existing reset tokens for this email
    $stmt = $pdo->prepare("DELETE FROM tbl_password_resets WHERE email = :email");
    $stmt->execute(["email" => $email]);

    // Insert new token
    $stmt = $pdo->prepare("INSERT INTO tbl_password_resets (email, token, expires_at) VALUES (:email, :token, :expires_at)");
    $stmt->execute([
        "email" => $email,
        "token" => $token,
        "expires_at" => $expiresAt
    ]);

    // Build reset link
    $protocol = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') ? 'https' : 'http';
    $host = $_SERVER['HTTP_HOST'];
    $resetLink = "{$protocol}://{$host}/REQUEST/login/views/reset_password.html?token={$token}";
    $currentYear = date('Y');
    $greeting = htmlspecialchars($fullName);

    // Send email via PHPMailer + Gmail SMTP
    $mail = new PHPMailer(true);

    $mail->isSMTP();
    $mail->Host       = 'smtp.gmail.com';
    $mail->SMTPAuth   = true;
    $mail->Username   = SMTP_EMAIL;
    $mail->Password   = SMTP_PASSWORD;
    $mail->SMTPSecure = PHPMailer::ENCRYPTION_STARTTLS;
    $mail->Port       = 587;

    $mail->setFrom(SMTP_EMAIL, SMTP_NAME);
    $mail->addAddress($user["email"]);

    $mail->isHTML(true);
    $mail->Subject = "Password Reset Request - CCES Online Requisition";
    $mail->Body = <<<HTML
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
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
                                Password Reset Request
                            </h2>

                            <p style="color:#555; font-size:15px; line-height:1.7; margin:0 0 15px;">
                                Good Day! <strong>{$greeting}</strong>,
                            </p>

                            <p style="color:#555; font-size:15px; line-height:1.7; margin:0 0 25px;">
                                We received a request to reset the password associated with your account.
                                Please click the button below to create a new password.
                            </p>

                            <!-- CTA Button -->
                            <table width="100%" cellpadding="0" cellspacing="0">
                                <tr>
                                    <td align="center" style="padding:10px 0 30px;">
                                        <a href="{$resetLink}"
                                           style="display:inline-block; background:linear-gradient(135deg,#667eea 0%,#764ba2 100%); color:#ffffff; text-decoration:none; padding:14px 40px; border-radius:8px; font-size:15px; font-weight:600; letter-spacing:0.3px;">
                                            Reset My Password
                                        </a>
                                    </td>
                                </tr>
                            </table>

                            <!-- Divider -->
                            <table width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 25px;">
                                <tr>
                                    <td style="border-top:1px solid #e9ecef;"></td>
                                </tr>
                            </table>

                            <p style="color:#888; font-size:13px; line-height:1.6; margin:0 0 10px;">
                                If the button above does not work, copy and paste this link into your browser:
                            </p>
                            <p style="background:#f8f9fa; padding:12px 16px; border-radius:6px; word-break:break-all; margin:0 0 25px;">
                                <a href="{$resetLink}" style="color:#667eea; font-size:13px; text-decoration:none;">{$resetLink}</a>
                            </p>

                            <!-- Security Notice -->
                            <table width="100%" cellpadding="0" cellspacing="0" style="background:#fff8e1; border-left:4px solid #ffc107; border-radius:0 6px 6px 0; margin:0 0 10px;">
                                <tr>
                                    <td style="padding:14px 18px;">
                                        <p style="color:#856404; font-size:13px; line-height:1.6; margin:0;">
                                            <strong>Security Notice:</strong> This link will expire in <strong>1 hour</strong>.
                                            If you did not request a password reset, please disregard this email.
                                            Your account remains secure.
                                        </p>
                                    </td>
                                </tr>
                            </table>
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

    $mail->AltBody = "Password Reset Request\n\n"
        . "Good Day! " . $fullName . ",\n\n"
        . "We received a request to reset your password for the CCES Online Requisition system.\n"
        . "Click the link below to reset your password:\n\n"
        . $resetLink . "\n\n"
        . "This link will expire in 1 hour.\n"
        . "If you did not request this, please ignore this email.\n\n"
        . "City College of El Salvador - CCES Online Requisition";

    $mail->send();

    echo json_encode(["status" => "success", "message" => "A password reset link has been sent to your email."]);

} catch (Exception $e) {
    error_log("Forgot password email error: " . $e->getMessage());
    echo json_encode(["status" => "error", "message" => "Failed to send email. Please try again later."]);
} catch (PDOException $e) {
    error_log("Forgot password error: " . $e->getMessage());
    echo json_encode(["status" => "error", "message" => "A server error occurred. Please try again later."]);
}
?>
