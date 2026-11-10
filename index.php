<?php
session_start();

// If user is already logged in, redirect to their dashboard
if (isset($_SESSION['user_id']) && isset($_SESSION['role'])) {
    $redirect = "login/views/login.html";
    switch ($_SESSION['role']) {
        case "admin":
            $redirect = "admin/views/dashboard.html";
            break;
        case "student":
        case "alumni":
            $redirect = "student/views/dashboard.html";
            break;
        case "staff":
            $redirect = "staff/views/dashboard.html";
            break;
        case "departments":
            switch ($_SESSION['department'] ?? '') {
                case "dean":     $redirect = "dean/views/dashboard.html";     break;
                case "library":  $redirect = "library/views/dashboard.html";  break;
                case "finance":  $redirect = "finance/views/dashboard.html";  break;
                case "guidance": $redirect = "guidance/views/dashboard.html"; break;
            }
            break;
    }

    header("Location: $redirect");
    exit;
}

// Not logged in — redirect to login page
header("Location: login/views/login.html");
exit;
