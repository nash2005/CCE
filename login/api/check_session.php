<?php
session_start();
header('Content-Type: application/json');

if (isset($_SESSION['user_id']) && isset($_SESSION['role'])) {
    $response = [
        "status" => "authenticated",
        "role" => $_SESSION['role']
    ];

    // Include department for department users so frontend can redirect correctly
    if ($_SESSION['role'] === 'departments' && isset($_SESSION['department'])) {
        $response["department"] = $_SESSION['department'];
    }

    echo json_encode($response);
} else {
    echo json_encode([
        "status" => "unauthenticated"
    ]);
}
