<?php
session_start();
require_once "../../helpers/csrf.php";

header('Content-Type: application/json');

echo json_encode(['token' => getCsrfToken()]);
