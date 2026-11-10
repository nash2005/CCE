<?php
session_start();
header('Content-Type: application/json');
if (!isset($_SESSION['user_id']) || $_SESSION['role'] !== 'admin') {
    http_response_code(403);
    echo json_encode(['success' => false, 'message' => 'Unauthorized']);
    exit;
}
require_once "../../db.php";

try {
    // SQL to get users with proper joins
    $sql = "
        SELECT 
            u.user_id,
            u.email,
            u.status,
            u.created_at,
            r.role_name AS user_type,

            -- student
            s.first_name AS student_first,
            s.last_name AS student_last,
            s.student_number,
            s.course_id AS student_course_id,
            s.year_level AS student_year_level,

            -- staff
            st.first_name AS staff_first,
            st.last_name AS staff_last,
            st.employee_number,

            -- alumni
            a.graduation_year AS alumni_graduation_year,
            a.course_id AS alumni_course_id,
            ars.first_name AS alumni_first,
            ars.last_name AS alumni_last,
            ars.student_number AS alumni_number,

            -- course names
            sc.course_name AS student_course_name,
            ac.course_name AS alumni_course_name

        FROM tbl_users u
        JOIN tbl_roles r ON u.role_id = r.role_id
        LEFT JOIN tbl_students s ON u.user_id = s.user_id
        LEFT JOIN tbl_staff st ON u.user_id = st.user_id
        LEFT JOIN tbl_alumni a ON u.user_id = a.user_id
        LEFT JOIN tbl_archived_students ars ON u.user_id = ars.user_id
        LEFT JOIN tbl_courses sc ON s.course_id = sc.course_id
        LEFT JOIN tbl_courses ac ON a.course_id = ac.course_id
        WHERE r.role_name != 'admin' AND u.status = 'active'
        ORDER BY u.created_at DESC
    ";

    $stmt = $pdo->query($sql);
    $users = [];

    foreach ($stmt as $row) {
        if ($row["user_type"] === "student") {
            $first = $row["student_first"] ?? "N/A";
            $last  = $row["student_last"] ?? "N/A";
            $idnum = $row["student_number"] ?? "N/A";
            $course = $row["student_course_name"] ?? "N/A";
            $course_id = $row["student_course_id"] ?? null;
            $year_level = $row["student_year_level"] ?? "N/A";
        } elseif ($row["user_type"] === "staff") {
            $first = $row["staff_first"] ?? "N/A";
            $last  = $row["staff_last"] ?? "N/A";
            $idnum = $row["employee_number"] ?? "N/A";
            $course = "N/A";
            $course_id = null;
            $year_level = "N/A";
        } else { // alumni
            $first = $row["alumni_first"] ?? "Alumni";
            $last  = $row["alumni_last"] ?? "";
            $idnum = $row["alumni_number"] ?? "N/A";
            $course = $row["alumni_course_name"] ?? "N/A";
            $course_id = $row["alumni_course_id"] ?? null;
            $year_level = $row["alumni_graduation_year"] ?? "N/A";
        }

        $users[] = [
            "user_id"     => $row["user_id"],
            "first_name"  => $first,
            "last_name"   => $last,
            "email"       => $row["email"],
            "user_type"   => $row["user_type"],
            "id_number"   => $idnum,
            "course_name" => $course,
            "course_id"   => $course_id,
            "year_level"  => $year_level,
            "graduation_year" => $year_level, // alias for frontend alumni column
            "status"      => $row["status"],
            "created_at"  => date("M d, Y", strtotime($row["created_at"]))
        ];
    }

    echo json_encode(["success" => true, "users" => $users]);

} catch (PDOException $e) {
    error_log("get_users error: " . $e->getMessage());
    echo json_encode(["success" => false, "message" => "A database error occurred."]);
}
