-- phpMyAdmin SQL Dump
-- version 5.2.1
-- https://www.phpmyadmin.net/
--
-- Host: 127.0.0.1
-- Generation Time: Aug 13, 2026 at 01:28 PM
-- Server version: 10.4.32-MariaDB
-- PHP Version: 8.2.12

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
START TRANSACTION;
SET time_zone = "+00:00";


/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;

--
-- Database: `request`
--

-- --------------------------------------------------------

--
-- Table structure for table `tbl_alumni`
--

CREATE TABLE `tbl_alumni` (
  `alumni_id` int(11) NOT NULL,
  `user_id` int(11) NOT NULL,
  `course_id` int(11) DEFAULT NULL,
  `graduation_year` int(11) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `tbl_archived_students`
--

CREATE TABLE `tbl_archived_students` (
  `archived_student_id` int(11) NOT NULL,
  `user_id` int(11) NOT NULL,
  `student_number` varchar(50) NOT NULL,
  `first_name` varchar(100) DEFAULT NULL,
  `last_name` varchar(100) DEFAULT NULL,
  `course` varchar(100) DEFAULT NULL,
  `year_level` int(11) DEFAULT NULL,
  `archived_at` datetime DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `tbl_courses`
--

CREATE TABLE `tbl_courses` (
  `course_id` int(11) NOT NULL,
  `course_name` varchar(255) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `tbl_courses`
--

INSERT INTO `tbl_courses` (`course_id`, `course_name`) VALUES
(1, 'Bachelor of Arts in English Language'),
(2, 'Bachelor of Public Administration'),
(3, 'Bachelor of Science in Entrepreneurship'),
(4, 'Bachelor of Science in Office Administration'),
(5, 'Bachelor of Science in Social Work');

-- --------------------------------------------------------

--
-- Table structure for table `tbl_department_clearances`
--

CREATE TABLE `tbl_department_clearances` (
  `user_id` int(11) NOT NULL,
  `request_id` int(11) NOT NULL,
  `status` varchar(50) DEFAULT 'Pending',
  `remarks` text DEFAULT '',
  `approved_by` int(11) DEFAULT NULL,
  `approved_at` datetime DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `tbl_department_clearances`
--

INSERT INTO `tbl_department_clearances` (`user_id`, `request_id`, `status`, `remarks`) VALUES
(9, 1, 'Approved', ''),
(10, 1, 'Pending', ''),
(11, 1, 'Pending', ''),
(12, 1, 'Pending', ''),
(9, 2, 'Pending', ''),
(10, 2, 'Pending', ''),
(11, 2, 'Pending', ''),
(12, 2, 'Pending', ''),
(9, 3, 'Approved', ''),
(10, 3, 'Approved', ''),
(11, 3, 'Approved', ''),
(12, 3, 'Approved', ''),
(9, 4, 'Approved', ''),
(10, 4, 'Approved', ''),
(11, 4, 'Approved', ''),
(12, 4, 'Approved', ''),
(9, 5, 'Pending', ''),
(10, 5, 'Pending', ''),
(11, 5, 'Pending', ''),
(12, 5, 'Pending', ''),
(9, 6, 'Pending', ''),
(10, 6, 'Pending', ''),
(11, 6, 'Pending', ''),
(12, 6, 'Pending', ''),
(9, 7, 'Pending', ''),
(10, 7, 'Pending', ''),
(11, 7, 'Pending', ''),
(12, 7, 'Pending', ''),
(9, 9, 'Approved', ''),
(10, 9, 'Approved', ''),
(11, 9, 'Approved', ''),
(12, 9, 'Approved', ''),
(9, 10, 'Approved', ''),
(10, 10, 'Approved', ''),
(11, 10, 'Approved', ''),
(12, 10, 'Approved', '');

-- --------------------------------------------------------

--
-- Table structure for table `tbl_documents`
--

CREATE TABLE `tbl_documents` (
  `document_id` int(11) NOT NULL,
  `type_id` int(11) NOT NULL,
  `document_name` varchar(255) NOT NULL,
  `price` decimal(10,2) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `tbl_documents`
--

INSERT INTO `tbl_documents` (`document_id`, `type_id`, `document_name`, `price`) VALUES
(1, 1, 'Reference', 100.00),
(2, 1, 'Board Examination', 100.00),
(3, 1, 'Employment', 100.00),
(4, 1, 'Transfer Credential/Honorable Dismissal', 100.00),
(5, 2, 'Certificate of Enrollment', 200.00),
(6, 2, 'Certificate of Registration', 200.00),
(7, 2, 'Highest Educational Attainment', 200.00),
(8, 2, 'Number of Units Earned', 200.00),
(9, 2, 'Certificate of Completion', 200.00),
(10, 2, 'Grades with weighted average', 200.00),
(11, 2, 'General Weighted Average', 200.00),
(12, 2, 'Certified True Copy', 200.00),
(13, 2, 'Final Grades', 200.00),
(14, 2, 'Diploma', 200.00),
(15, 3, 'CAV Overseas', 200.00);

-- --------------------------------------------------------

--
-- Table structure for table `tbl_document_types`
--

CREATE TABLE `tbl_document_types` (
  `type_id` int(11) NOT NULL,
  `type_name` varchar(100) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `tbl_document_types`
--

INSERT INTO `tbl_document_types` (`type_id`, `type_name`) VALUES
(1, 'tor'),
(2, 'certification'),
(3, 'cav');

-- Table structure for table `tbl_holidays`
-- Stores regular holidays in the Philippines.
-- Students cannot submit new requests if the requested date falls on a regular holiday.
CREATE TABLE `tbl_holidays` (
  `holiday_id` int(11) NOT NULL AUTO_INCREMENT,
  `holiday_date` date NOT NULL,
  `holiday_name` varchar(255) NOT NULL,
  `day_of_week` varchar(20) DEFAULT NULL,
  `is_active` tinyint(1) NOT NULL DEFAULT '1',
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  `updated_at` datetime NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `is_archived` tinyint(1) NOT NULL DEFAULT '0',
  PRIMARY KEY (`holiday_id`),
  UNIQUE KEY `unique_active` (`holiday_date`,`holiday_name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Dumping data for table `tbl_holidays`
-- Pre-populated with Philippines regular public holidays for 2026.
INSERT INTO `tbl_holidays` (`holiday_id`, `holiday_date`, `holiday_name`, `day_of_week`, `is_active`, `created_at`, `updated_at`, `is_archived`) VALUES
(1, '2026-01-01', 'New Year''s Day', 'Thursday', 1, '2026-01-01 00:00:00', '2026-01-01 00:00:00', 0),
(2, '2026-04-02', 'Maundy Thursday', 'Thursday', 1, '2026-01-01 00:00:00', '2026-01-01 00:00:00', 0),
(3, '2026-04-03', 'Good Friday', 'Friday', 1, '2026-01-01 00:00:00', '2026-01-01 00:00:00', 0),
(4, '2026-04-09', 'Araw ng Kagitingan', 'Thursday', 1, '2026-01-01 00:00:00', '2026-01-01 00:00:00', 0),
(5, '2026-05-01', 'Labor Day', 'Friday', 1, '2026-01-01 00:00:00', '2026-01-01 00:00:00', 0),
(6, '2026-06-12', 'Independence Day', 'Friday', 1, '2026-01-01 00:00:00', '2026-01-01 00:00:00', 0),
(7, '2026-08-31', 'National Heroes Day', 'Monday', 1, '2026-01-01 00:00:00', '2026-01-01 00:00:00', 0),
(8, '2026-11-30', 'Bonifacio Day', 'Monday', 1, '2026-01-01 00:00:00', '2026-01-01 00:00:00', 0),
(9, '2026-12-25', 'Christmas Day', 'Friday', 1, '2026-01-01 00:00:00', '2026-01-01 00:00:00', 0),
(10, '2026-12-30', 'Rizal Day', 'Wednesday', 1, '2026-01-01 00:00:00', '2026-01-01 00:00:00', 0);

-- --------------------------------------------------------

--
-- Table structure for table `tbl_login_attempts`
--

CREATE TABLE `tbl_login_attempts` (
  `id` int(11) NOT NULL,
  `email` varchar(150) NOT NULL,
  `attempts` int(11) NOT NULL DEFAULT 0,
  `locked_until` datetime DEFAULT NULL,
  `last_attempt` datetime DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `tbl_login_attempts`
--

INSERT INTO `tbl_login_attempts` (`id`, `email`, `attempts`, `locked_until`, `last_attempt`) VALUES
(4, 'khma.dumapias.coc@phinmaed.com', 3, NULL, '2026-08-12 16:25:24'),
(6, 'student@gmail.com', 1, NULL, '2026-06-08 18:28:24');

-- --------------------------------------------------------

--
-- Table structure for table `tbl_password_resets`
--

CREATE TABLE `tbl_password_resets` (
  `id` int(11) NOT NULL,
  `email` varchar(150) NOT NULL,
  `token` varchar(255) NOT NULL,
  `expires_at` datetime NOT NULL,
  `created_at` datetime DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `tbl_password_resets`
--

INSERT INTO `tbl_password_resets` (`id`, `email`, `token`, `expires_at`, `created_at`) VALUES
(4, 'khma.dumapias.coc@phinmaed.com', 'cb20c61458315b6a6f1bbe55a3e33665e9a405937f31162f745cfe40e19dd05d', '2026-06-08 14:17:29', '2026-06-08 19:17:29');

-- --------------------------------------------------------

--
-- Table structure for table `tbl_queue_counter`
--

CREATE TABLE `tbl_queue_counter` (
  `id` int(11) NOT NULL DEFAULT 1,
  `current_number` int(11) NOT NULL DEFAULT 1,
  `served_today` int(11) NOT NULL DEFAULT 0,
  `last_reset` date NOT NULL DEFAULT curdate()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `tbl_queue_counter`
--

INSERT INTO `tbl_queue_counter` (`id`, `current_number`, `served_today`, `last_reset`) VALUES
(1, 1, 0, '2026-08-12');

-- --------------------------------------------------------

--
-- Table structure for table `tbl_registration_requests`
--

CREATE TABLE `tbl_registration_requests` (
  `id` int(11) NOT NULL,
  `student_number` varchar(50) NOT NULL,
  `first_name` varchar(100) NOT NULL,
  `last_name` varchar(100) NOT NULL,
  `course_id` int(11) NOT NULL,
  `year_level` int(11) NOT NULL,
  `status` varchar(20) NOT NULL DEFAULT 'pending',
  `admin_remarks` text NOT NULL DEFAULT '',
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  `processed_at` datetime NOT NULL DEFAULT '1000-01-01 00:00:00'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `tbl_registration_requests`
--

INSERT INTO `tbl_registration_requests` (`id`, `student_number`, `first_name`, `last_name`, `course_id`, `year_level`, `status`, `admin_remarks`, `created_at`, `processed_at`) VALUES
(1, '02-2122-033233', 'Kharl', 'Dumapias', 1, 1, 'pending', '', '2026-04-27 18:20:49', '0000-00-00 00:00:00');

-- --------------------------------------------------------

--
-- Table structure for table `tbl_requests`
--

CREATE TABLE `tbl_requests` (
  `request_id` int(11) NOT NULL,
  `tracking_number` varchar(20) DEFAULT NULL,
  `user_id` int(11) NOT NULL,
  `request_date` datetime DEFAULT current_timestamp(),
  `status` varchar(50) DEFAULT 'Pending',
  `staff_id` int(11) DEFAULT NULL,
  `student_name` varchar(255) DEFAULT NULL,
  `course_year` varchar(255) DEFAULT NULL,
  `date_requested` date DEFAULT NULL,
  `date_released` date DEFAULT NULL,
  `claim_schedule_start` date DEFAULT NULL,
  `claim_schedule_end` date DEFAULT NULL,
  `claim_schedule_remarks` text DEFAULT NULL,
  `cav_requirements_submitted` tinyint(1) NOT NULL DEFAULT 0,
  `cav_requirements_submitted_at` datetime DEFAULT NULL,
  `remarks` text DEFAULT '',
  `is_archived` tinyint(1) NOT NULL DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `tbl_requests`
--

INSERT INTO `tbl_requests` (`request_id`, `tracking_number`, `user_id`, `request_date`, `status`, `staff_id`, `student_name`, `course_year`, `date_requested`, `date_released`, `remarks`, `is_archived`) VALUES
(1, NULL, 7, '2026-03-27 20:16:46', 'Pending', NULL, 'Kharl Nash Dumapias', 'Bachelor of Arts in English Language - 1st Year', '2026-03-27', NULL, '', 1),
(2, NULL, 7, '2026-03-28 11:18:43', 'Pending', NULL, 'Kharl Nash Dumapias', 'Bachelor of Arts in English Language - 1st Year', '2026-03-28', NULL, '', 1),
(3, NULL, 7, '2026-03-28 11:49:21', 'Claimed', 1, 'Kharl Nash Dumapias', 'Bachelor of Arts in English Language - 1th Year', '2026-03-28', '2026-03-28', '{\"staff\":\"CLAIM AT REGISTRAR\"}', 0),
(4, NULL, 13, '2026-04-23 22:36:47', 'Claimed', 1, 'Andrew Lago', 'Bachelor of Arts in English Language - 1st Year', '2026-04-23', '2026-04-23', '{\"staff\":\"Claim at the registrar office\"}', 0),
(5, NULL, 7, '2026-04-27 19:19:16', 'Pending', NULL, 'Kharl Nash Dumapias', 'Bachelor of Arts in English Language - 1st Year', '2026-04-27', NULL, '', 1),
(6, 'REQ-2026-0001', 7, '2026-06-08 18:29:06', 'Pending', NULL, 'Kharl Nash Dumapias', 'Bachelor of Arts in English Language - 1st Year', '2026-06-08', NULL, '', 1),
(7, 'REQ-2026-0002', 7, '2026-06-08 18:55:35', 'Processing', NULL, 'Kharl Nash Dumapias', 'Bachelor of Arts in English Language - 1st Year', '2026-06-08', NULL, '', 1),
(8, 'REQ-2026-0003', 7, '2026-06-08 19:18:13', 'Pending', NULL, 'Kharl Nash Dumapias', 'Bachelor of Arts in English Language - 1st Year', '2026-06-08', NULL, '', 1),
(9, 'REQ-2026-0004', 7, '2026-06-08 19:39:39', 'Claimed', 1, 'Kharl Nash Dumapias', 'Bachelor of Arts in English Language - 1st Year', '2026-06-08', '2026-07-13', '[]', 0),
(10, 'REQ-2026-0005', 7, '2026-08-12 16:25:47', 'Claimed', 1, 'Kharl Nash Dumapias', 'Bachelor of Arts in English Language - 1st Year', '2026-08-12', '2026-08-12', '{\"staff\":\"\"}', 0);

-- --------------------------------------------------------

--
-- Table structure for table `tbl_request_documents`
--

CREATE TABLE `tbl_request_documents` (
  `id` int(11) NOT NULL,
  `request_id` int(11) NOT NULL,
  `document_id` int(11) NOT NULL,
  `copies` int(11) NOT NULL DEFAULT 1,
  `pages` int(11) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `tbl_request_documents`
--

INSERT INTO `tbl_request_documents` (`id`, `request_id`, `document_id`, `copies`) VALUES
(1, 1, 6, 1),
(2, 2, 2, 1),
(3, 3, 3, 1),
(4, 3, 6, 1),
(5, 3, 7, 1),
(6, 4, 2, 1),
(7, 5, 2, 1),
(8, 6, 1, 1),
(9, 7, 1, 1),
(10, 8, 1, 1),
(11, 9, 1, 1),
(12, 10, 1, 1);

-- --------------------------------------------------------

--
-- Table structure for table `tbl_request_payments`
--

CREATE TABLE `tbl_request_payments` (
  `id` int(11) NOT NULL,
  `request_id` int(11) NOT NULL,
  `reference_number` varchar(100) DEFAULT NULL,
  `is_paid` tinyint(1) NOT NULL DEFAULT 0,
  `paid_at` datetime DEFAULT NULL,
  `staff_id` int(11) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `tbl_request_payments`
--

INSERT INTO `tbl_request_payments` (`id`, `request_id`, `reference_number`, `is_paid`, `paid_at`, `staff_id`) VALUES
(1, 9, 'dsa', 1, '2026-07-13 18:43:22', 1),
(2, 10, 'gwaposinash', 1, '2026-08-12 16:53:13', 1);

-- --------------------------------------------------------

--
-- Table structure for table `tbl_roles`
--

CREATE TABLE `tbl_roles` (
  `role_id` int(11) NOT NULL,
  `role_name` varchar(100) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `tbl_roles`
--

INSERT INTO `tbl_roles` (`role_id`, `role_name`) VALUES
(1, 'admin'),
(2, 'student'),
(3, 'alumni'),
(4, 'staff'),
(5, 'departments');

-- --------------------------------------------------------

--
-- Table structure for table `tbl_staff`
--

CREATE TABLE `tbl_staff` (
  `staff_id` int(11) NOT NULL,
  `user_id` int(11) NOT NULL,
  `first_name` varchar(100) DEFAULT NULL,
  `last_name` varchar(100) DEFAULT NULL,
  `employee_number` varchar(50) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `tbl_staff`
--

INSERT INTO `tbl_staff` (`staff_id`, `user_id`, `first_name`, `last_name`, `employee_number`) VALUES
(1, 8, 'staff', 'ko', '1111');

-- --------------------------------------------------------

--
-- Table structure for table `tbl_students`
--

CREATE TABLE `tbl_students` (
  `student_id` int(11) NOT NULL,
  `user_id` int(11) NOT NULL,
  `student_number` varchar(50) NOT NULL,
  `course_id` int(11) DEFAULT NULL,
  `first_name` varchar(100) DEFAULT NULL,
  `last_name` varchar(100) DEFAULT NULL,
  `year_level` int(11) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `tbl_students`
--

INSERT INTO `tbl_students` (`student_id`, `user_id`, `student_number`, `course_id`, `first_name`, `last_name`, `year_level`) VALUES
(5, 7, '02-2122-033234', 1, 'Kharl Nash', 'Dumapias', 1),
(6, 13, '303032', 1, 'Andrew', 'Lago', 1);

-- --------------------------------------------------------

--
-- Table structure for table `tbl_student_tor_pages`
--

CREATE TABLE `tbl_student_tor_pages` (
  `user_id` int(11) NOT NULL,
  `total_pages` int(11) NOT NULL DEFAULT 0,
  `updated_by` int(11) DEFAULT NULL,
  `updated_at` datetime DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `tbl_student_tor_pages`
--

INSERT INTO `tbl_student_tor_pages` (`user_id`, `total_pages`, `updated_by`, `updated_at`) VALUES
(7, 3, 8, '2026-08-12 16:26:47');

-- --------------------------------------------------------

--
-- Table structure for table `tbl_users`
--

CREATE TABLE `tbl_users` (
  `user_id` int(11) NOT NULL,
  `role_id` int(11) NOT NULL,
  `email` varchar(150) NOT NULL,
  `password` varchar(255) NOT NULL,
  `status` varchar(50) DEFAULT NULL,
  `created_at` datetime DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `tbl_users`
--

INSERT INTO `tbl_users` (`user_id`, `role_id`, `email`, `password`, `status`, `created_at`) VALUES
(1, 1, 'admin', '$2y$10$H3SgS.Yue8JOt8/wEMklcOOELasQ3o.t7KQI8dnwXsA.dBW9q.TG2', 'active', '2026-02-05 14:21:43'),
(7, 2, 'khma.dumapias.coc@phinmaed.com', '$2y$10$YPc8dMJLDClYkhN6MxJmTO.ZNGcrrELaAau.7Q2lLQRobJJ65baGK', 'active', '2026-02-11 22:00:14'),
(8, 4, 'test1@gmail.com', '$2y$10$fYH3ax1tgf0.jGBNW9a0HOahUoEBp9Z7TQ01IOOBtcwRwG1iIl6De', 'active', '2026-02-18 21:49:11'),
(9, 5, 'dean', '$2y$10$PhrPNQMfSYt2Jrt7yBb3QegGvW2ax2BZMQinmcHwVoXZ8hL0g3HmG', 'active', '2026-03-09 21:03:19'),
(10, 5, 'library', '$2y$10$PhrPNQMfSYt2Jrt7yBb3QegGvW2ax2BZMQinmcHwVoXZ8hL0g3HmG', 'active', '2026-03-09 21:03:19'),
(11, 5, 'finance', '$2y$10$PhrPNQMfSYt2Jrt7yBb3QegGvW2ax2BZMQinmcHwVoXZ8hL0g3HmG', 'active', '2026-03-09 21:03:19'),
(12, 5, 'guidance', '$2y$10$PhrPNQMfSYt2Jrt7yBb3QegGvW2ax2BZMQinmcHwVoXZ8hL0g3HmG', 'active', '2026-03-09 21:03:19'),
(13, 2, 'student@gmail.com', '$2y$10$ZfXAe0tHacXeCf.PdmpTVuNcpRfBbUV2VHii4rC1pN94UbCajL88K', 'active', '2026-04-23 22:35:50');

--
-- Indexes for dumped tables
--

--
-- Indexes for table `tbl_alumni`
--
ALTER TABLE `tbl_alumni`
  ADD PRIMARY KEY (`alumni_id`),
  ADD UNIQUE KEY `user_id` (`user_id`),
  ADD KEY `tbl_alumni_ibfk_2` (`course_id`);

--
-- Indexes for table `tbl_archived_students`
--
ALTER TABLE `tbl_archived_students`
  ADD PRIMARY KEY (`archived_student_id`),
  ADD UNIQUE KEY `user_id` (`user_id`),
  ADD UNIQUE KEY `student_number` (`student_number`);

--
-- Indexes for table `tbl_courses`
--
ALTER TABLE `tbl_courses`
  ADD PRIMARY KEY (`course_id`);

--
-- Indexes for table `tbl_department_clearances`
--
ALTER TABLE `tbl_department_clearances`
  ADD PRIMARY KEY (`request_id`,`user_id`),
  ADD KEY `tbl_dc_ibfk_2` (`user_id`);

--
-- Indexes for table `tbl_documents`
--
ALTER TABLE `tbl_documents`
  ADD PRIMARY KEY (`document_id`),
  ADD KEY `tbl_documents_ibfk_1` (`type_id`);

--
-- Indexes for table `tbl_document_types`
--
ALTER TABLE `tbl_document_types`
  ADD PRIMARY KEY (`type_id`);

--
-- Indexes for table `tbl_login_attempts`
--
ALTER TABLE `tbl_login_attempts`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `email` (`email`);

--
-- Indexes for table `tbl_password_resets`
--
ALTER TABLE `tbl_password_resets`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_token` (`token`),
  ADD KEY `idx_email` (`email`);

--
-- Indexes for table `tbl_queue_counter`
--
ALTER TABLE `tbl_queue_counter`
  ADD PRIMARY KEY (`id`);

--
-- Indexes for table `tbl_registration_requests`
--
ALTER TABLE `tbl_registration_requests`
  ADD PRIMARY KEY (`id`),
  ADD KEY `fk_reg_course` (`course_id`);

--
-- Indexes for table `tbl_requests`
--
ALTER TABLE `tbl_requests`
  ADD PRIMARY KEY (`request_id`),
  ADD UNIQUE KEY `tracking_number` (`tracking_number`),
  ADD KEY `tbl_requests_ibfk_1` (`user_id`),
  ADD KEY `tbl_requests_ibfk_5` (`staff_id`);

--
-- Indexes for table `tbl_request_documents`
--
ALTER TABLE `tbl_request_documents`
  ADD PRIMARY KEY (`id`),
  ADD KEY `tbl_request_documents_ibfk_1` (`request_id`),
  ADD KEY `tbl_request_documents_ibfk_2` (`document_id`);

--
-- Indexes for table `tbl_request_payments`
--
ALTER TABLE `tbl_request_payments`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `request_id` (`request_id`),
  ADD KEY `staff_id` (`staff_id`);

--
-- Indexes for table `tbl_roles`
--
ALTER TABLE `tbl_roles`
  ADD PRIMARY KEY (`role_id`);

--
-- Indexes for table `tbl_staff`
--
ALTER TABLE `tbl_staff`
  ADD PRIMARY KEY (`staff_id`),
  ADD UNIQUE KEY `user_id` (`user_id`),
  ADD UNIQUE KEY `employee_number` (`employee_number`);

--
-- Indexes for table `tbl_students`
--
ALTER TABLE `tbl_students`
  ADD PRIMARY KEY (`student_id`),
  ADD UNIQUE KEY `user_id` (`user_id`),
  ADD UNIQUE KEY `student_number` (`student_number`),
  ADD KEY `tbl_students_ibfk_2` (`course_id`);

--
-- Indexes for table `tbl_student_tor_pages`
--
ALTER TABLE `tbl_student_tor_pages`
  ADD PRIMARY KEY (`user_id`),
  ADD KEY `fk_tor_pages_updater` (`updated_by`);

--
-- Indexes for table `tbl_users`
--
ALTER TABLE `tbl_users`
  ADD PRIMARY KEY (`user_id`),
  ADD UNIQUE KEY `email` (`email`),
  ADD KEY `role_id` (`role_id`);

--
-- AUTO_INCREMENT for dumped tables
--

--
-- AUTO_INCREMENT for table `tbl_alumni`
--
ALTER TABLE `tbl_alumni`
  MODIFY `alumni_id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `tbl_archived_students`
--
ALTER TABLE `tbl_archived_students`
  MODIFY `archived_student_id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `tbl_courses`
--
ALTER TABLE `tbl_courses`
  MODIFY `course_id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=6;

--
-- AUTO_INCREMENT for table `tbl_documents`
--
ALTER TABLE `tbl_documents`
  MODIFY `document_id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=16;

--
-- AUTO_INCREMENT for table `tbl_document_types`
--
ALTER TABLE `tbl_document_types`
  MODIFY `type_id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=4;

--
-- AUTO_INCREMENT for table `tbl_login_attempts`
--
ALTER TABLE `tbl_login_attempts`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=8;
-- Indexes for table `tbl_holidays` (PRIMARY and unique_active already defined in CREATE TABLE)
ALTER TABLE `tbl_holidays`
  ADD KEY `idx_holiday_date` (`holiday_date`),
  ADD KEY `idx_is_archived` (`is_archived`);

--
-- AUTO_INCREMENT for table `tbl_password_resets`
--
ALTER TABLE `tbl_password_resets`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=5;

--
-- AUTO_INCREMENT for table `tbl_registration_requests`
--
ALTER TABLE `tbl_registration_requests`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=2;

--
-- AUTO_INCREMENT for table `tbl_requests`
--
ALTER TABLE `tbl_requests`
  MODIFY `request_id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=11;

--
-- AUTO_INCREMENT for table `tbl_request_documents`
--
ALTER TABLE `tbl_request_documents`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=13;

--
-- AUTO_INCREMENT for table `tbl_request_payments`
--
ALTER TABLE `tbl_request_payments`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=3;

--
-- AUTO_INCREMENT for table `tbl_roles`
--
ALTER TABLE `tbl_roles`
  MODIFY `role_id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=6;

--
-- AUTO_INCREMENT for table `tbl_staff`
--
ALTER TABLE `tbl_staff`
  MODIFY `staff_id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=2;

--
-- AUTO_INCREMENT for table `tbl_students`
--
ALTER TABLE `tbl_students`
  MODIFY `student_id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=7;

--
-- AUTO_INCREMENT for table `tbl_users`
--
ALTER TABLE `tbl_users`
  MODIFY `user_id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=14;

--
-- Constraints for dumped tables
--

--
-- Constraints for table `tbl_alumni`
--
ALTER TABLE `tbl_alumni`
  ADD CONSTRAINT `tbl_alumni_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `tbl_users` (`user_id`),
  ADD CONSTRAINT `tbl_alumni_ibfk_2` FOREIGN KEY (`course_id`) REFERENCES `tbl_courses` (`course_id`);

--
-- Constraints for table `tbl_archived_students`
--
ALTER TABLE `tbl_archived_students`
  ADD CONSTRAINT `tbl_archived_students_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `tbl_users` (`user_id`);

--
-- Constraints for table `tbl_department_clearances`
--
ALTER TABLE `tbl_department_clearances`
  ADD CONSTRAINT `tbl_dc_ibfk_2` FOREIGN KEY (`user_id`) REFERENCES `tbl_users` (`user_id`),
  ADD CONSTRAINT `tbl_dc_ibfk_3` FOREIGN KEY (`request_id`) REFERENCES `tbl_requests` (`request_id`);

--
-- Constraints for table `tbl_documents`
--
ALTER TABLE `tbl_documents`
  ADD CONSTRAINT `tbl_documents_ibfk_1` FOREIGN KEY (`type_id`) REFERENCES `tbl_document_types` (`type_id`);

--
-- Constraints for table `tbl_registration_requests`
--
ALTER TABLE `tbl_registration_requests`
  ADD CONSTRAINT `fk_reg_course` FOREIGN KEY (`course_id`) REFERENCES `tbl_courses` (`course_id`);

--
-- Constraints for table `tbl_requests`
--
ALTER TABLE `tbl_requests`
  ADD CONSTRAINT `tbl_requests_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `tbl_users` (`user_id`),
  ADD CONSTRAINT `tbl_requests_ibfk_5` FOREIGN KEY (`staff_id`) REFERENCES `tbl_staff` (`staff_id`);

--
-- Constraints for table `tbl_request_documents`
--
ALTER TABLE `tbl_request_documents`
  ADD CONSTRAINT `tbl_request_documents_ibfk_1` FOREIGN KEY (`request_id`) REFERENCES `tbl_requests` (`request_id`),
  ADD CONSTRAINT `tbl_request_documents_ibfk_2` FOREIGN KEY (`document_id`) REFERENCES `tbl_documents` (`document_id`);

--
-- Constraints for table `tbl_request_payments`
--
ALTER TABLE `tbl_request_payments`
  ADD CONSTRAINT `tbl_request_payments_ibfk_1` FOREIGN KEY (`request_id`) REFERENCES `tbl_requests` (`request_id`),
  ADD CONSTRAINT `tbl_request_payments_ibfk_2` FOREIGN KEY (`staff_id`) REFERENCES `tbl_staff` (`staff_id`);

--
-- Constraints for table `tbl_staff`
--
ALTER TABLE `tbl_staff`
  ADD CONSTRAINT `tbl_staff_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `tbl_users` (`user_id`);

--
-- Constraints for table `tbl_students`
--
ALTER TABLE `tbl_students`
  ADD CONSTRAINT `tbl_students_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `tbl_users` (`user_id`),
  ADD CONSTRAINT `tbl_students_ibfk_2` FOREIGN KEY (`course_id`) REFERENCES `tbl_courses` (`course_id`);

--
-- Constraints for table `tbl_student_tor_pages`
--
ALTER TABLE `tbl_student_tor_pages`
  ADD CONSTRAINT `fk_tor_pages_updater` FOREIGN KEY (`updated_by`) REFERENCES `tbl_users` (`user_id`),
  ADD CONSTRAINT `fk_tor_pages_user` FOREIGN KEY (`user_id`) REFERENCES `tbl_users` (`user_id`);

--
-- Constraints for table `tbl_users`
--
ALTER TABLE `tbl_users`
  ADD CONSTRAINT `tbl_users_ibfk_1` FOREIGN KEY (`role_id`) REFERENCES `tbl_roles` (`role_id`);
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
