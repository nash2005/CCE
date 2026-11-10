<?php
session_start();
require_once "../../db.php";
require_once "../../helpers/csrf.php";
validateCsrfToken();

header('Content-Type: application/json');

$MAX_ATTEMPTS = 9;
$LOCKOUT_MINUTES = 5;

if ($_SERVER["REQUEST_METHOD"] !== "POST") {
    echo json_encode(["status" => "error", "message" => "Invalid request"]);
    exit;
}

$username = $_POST["username"] ?? "";
$password = $_POST["password"] ?? "";

if (empty($username) || empty($password)) {
    echo json_encode(["status" => "error", "message" => "All fields are required"]);
    exit;
}

try {
    // Check if account is locked
    $stmt = $pdo->prepare("SELECT attempts, locked_until FROM tbl_login_attempts WHERE email = :email LIMIT 1");
    $stmt->execute(["email" => $username]);
    $attempt = $stmt->fetch();

    if ($attempt && $attempt["locked_until"]) {
        $lockedUntil = strtotime($attempt["locked_until"]);
        if (time() < $lockedUntil) {
            $remaining = ceil(($lockedUntil - time()) / 60);
            echo json_encode([
                "status" => "locked",
                "message" => "Your account is temporarily locked. Please try again in {$remaining} minute(s) or click Forgot Password.",
                "remaining_attempts" => 0
            ]);
            exit;
        } else {
            // Lock expired, reset attempts
            $stmt = $pdo->prepare("UPDATE tbl_login_attempts SET attempts = 0, locked_until = NULL WHERE email = :email");
            $stmt->execute(["email" => $username]);
            $attempt["attempts"] = 0;
        }
    }

    // Find user — try student_number first (tbl_students), then archived alumni (tbl_archived_students), then email (tbl_users)
    $user = null;

    // 1. Check tbl_students by student_number
    $stmt = $pdo->prepare("
        SELECT u.user_id, u.password, r.role_name, u.email
        FROM tbl_students s
        JOIN tbl_users u ON s.user_id = u.user_id
        JOIN tbl_roles r ON u.role_id = r.role_id
        WHERE s.student_number = :username AND u.status = 'active'
        LIMIT 1
    ");
    $stmt->execute(["username" => $username]);
    $user = $stmt->fetch();

    // 2. Check tbl_archived_students by student_number (alumni)
    if (!$user) {
        $stmt = $pdo->prepare("
            SELECT u.user_id, u.password, r.role_name, u.email
            FROM tbl_archived_students a
            JOIN tbl_users u ON a.user_id = u.user_id
            JOIN tbl_roles r ON u.role_id = r.role_id
            WHERE a.student_number = :username AND u.status = 'active'
            LIMIT 1
        ");
        $stmt->execute(["username" => $username]);
        $user = $stmt->fetch();
    }

    // 3. Fallback: check tbl_users by email (admin, staff, departments only — not students/alumni)
    if (!$user) {
        $stmt = $pdo->prepare("
            SELECT u.user_id, u.password, r.role_name, u.email
            FROM tbl_users u
            JOIN tbl_roles r ON u.role_id = r.role_id
            WHERE u.email = :username AND u.status = 'active'
              AND r.role_name NOT IN ('student', 'alumni')
            LIMIT 1
        ");
        $stmt->execute(["username" => $username]);
        $user = $stmt->fetch();
    }

    // Handle failed login (user not found OR wrong password)
    if (!$user || !password_verify($password, $user["password"])) {
        // Increment attempts
        $currentAttempts = ($attempt ? $attempt["attempts"] : 0) + 1;
        $remainingAttempts = $MAX_ATTEMPTS - $currentAttempts;
        $lockedUntil = null;

        if ($currentAttempts >= $MAX_ATTEMPTS) {
            $lockedUntil = date("Y-m-d H:i:s", strtotime("+{$LOCKOUT_MINUTES} minutes"));
            $remainingAttempts = 0;
        }

        // Upsert login attempts
        $stmt = $pdo->prepare("
            INSERT INTO tbl_login_attempts (email, attempts, locked_until, last_attempt)
            VALUES (:email, :attempts, :locked_until, NOW())
            ON DUPLICATE KEY UPDATE attempts = :attempts2, locked_until = :locked_until2, last_attempt = NOW()
        ");
        $stmt->execute([
            "email" => $username,
            "attempts" => $currentAttempts,
            "locked_until" => $lockedUntil,
            "attempts2" => $currentAttempts,
            "locked_until2" => $lockedUntil
        ]);

        if ($currentAttempts >= $MAX_ATTEMPTS) {
            echo json_encode([
                "status" => "locked",
                "message" => "Too many failed attempts. Your account is locked for {$LOCKOUT_MINUTES} minutes. Please try again later or click Forgot Password.",
                "remaining_attempts" => 0
            ]);
        } else {
            echo json_encode([
                "status" => "error",
                "message" => "Incorrect ID number or password. {$remainingAttempts} attempt(s) left before your account is locked for {$LOCKOUT_MINUTES} minutes.",
                "remaining_attempts" => $remainingAttempts
            ]);
        }
        exit;
    }

    // Successful login — reset attempts
    $stmt = $pdo->prepare("DELETE FROM tbl_login_attempts WHERE email = :email");
    $stmt->execute(["email" => $username]);

    // Prevent session fixation
    session_regenerate_id(true);

    // Set session variables
    $_SESSION["user_id"] = $user["user_id"];
    $_SESSION["role"] = $user["role_name"];

    // Determine redirect
    $redirect = "../index.php";
    switch ($user["role_name"]) {
        case "admin":   $redirect = "../../admin/views/dashboard.html";   break;
        case "student": $redirect = "../../student/views/dashboard.html"; break;
        case "alumni":  $redirect = "../../student/views/dashboard.html"; break;
        case "staff":   $redirect = "../../staff/views/dashboard.html";   break;
        case "departments": $redirect = null; break;
    }

    // For department users, use their email as the department identifier
    if ($user["role_name"] === "departments") {
        $_SESSION["department"] = $user["email"];
        $redirect = "../index.php";
        switch ($user["email"]) {
            case "dean":     $redirect = "../../dean/views/dashboard.html";     break;
            case "library":  $redirect = "../../library/views/dashboard.html";  break;
            case "finance":  $redirect = "../../finance/views/dashboard.html";  break;
            case "guidance": $redirect = "../../guidance/views/dashboard.html"; break;
        }
    }

    echo json_encode([
        "status" => "success",
        "message" => "Login successful",
        "redirect" => $redirect
    ]);
} catch (PDOException $e) {
    error_log("Login error: " . $e->getMessage());
    echo json_encode(["status" => "error", "message" => "A server error occurred. Please try again later."]);
}
?>
