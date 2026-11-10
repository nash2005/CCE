// API Configuration
const API_BASE_URL = '../api';

// Store loaded requests for modal access
let loadedRequests = [];

// Initialize dashboard
document.addEventListener('DOMContentLoaded', function () {
    loadSidebar();
    loadStudentData();
    loadStudentRequests();
    setupEventListeners();
});

// ─── Topbar only (no navbar/sidebar on dashboard) ───
function loadSidebar() {
    const el = document.getElementById('sidebar-container');
    if (!el) return;
    fetch('sidebar.html')
        .then(r => r.text())
        .then(html => {
            var temp = document.createElement('div');
            temp.innerHTML = html;
            // Only show topbar on dashboard
            var topbar = temp.querySelector('.topbar');
            if (topbar) el.appendChild(topbar);

            // Bind logout
            var logoutBtnTopbar = document.getElementById('logoutBtnTopbar');
            if (logoutBtnTopbar) logoutBtnTopbar.addEventListener('click', function(e) { e.preventDefault(); handleLogout(); });
            var cached = sessionStorage.getItem('studentData');
            if (cached) { try { updateSidebarInfo(JSON.parse(cached)); } catch (e) {} }

            // Setup notification bell toggle
            setupNotifications();
        })
        .catch(err => console.error('Navigation error:', err));
}

// ─── Notifications ───
function setupNotifications() {
    var bell = document.getElementById('notifBell');
    var dropdown = document.getElementById('notifDropdown');
    if (!bell || !dropdown) return;

    bell.addEventListener('click', function(e) {
        e.stopPropagation();
        dropdown.classList.toggle('open');
    });
    document.addEventListener('click', function(e) {
        if (dropdown && !dropdown.contains(e.target) && e.target !== bell && !bell.contains(e.target)) {
            dropdown.classList.remove('open');
        }
    });
}

function timeAgo(dateStr) {
    if (!dateStr) return '';
    var d = new Date(dateStr);
    if (isNaN(d)) return '';
    var now = new Date();
    var diff = Math.floor((now - d) / 1000);
    if (diff < 60) return 'Just now';
    if (diff < 3600) return Math.floor(diff / 60) + 'm ago';
    if (diff < 86400) return Math.floor(diff / 3600) + 'h ago';
    var days = Math.floor(diff / 86400);
    return days === 1 ? '1 day ago' : days + ' days ago';
}

function buildNotifications(requests) {
    var badge = document.getElementById('notifBadge');
    var list = document.getElementById('notifList');
    if (!list) return;

    var notifications = [];
    var deptNames = { dean: "Dean's Office", library: 'Library', finance: 'Finance Office', guidance: 'Guidance Office' };
    var cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 15);

    (requests || []).forEach(function(req) {
        var reqDate = req.request_date ? new Date(req.request_date) : null;
        if (reqDate && reqDate < cutoff) return;

        var cl = req.clearance || {};
        var remarks = req.remarks || {};
        if (typeof remarks === 'string') { try { remarks = JSON.parse(remarks); } catch(e) { remarks = {}; } }
        var rnum = 'REQ-' + String(req.request_id).padStart(6, '0');
        var dateStr = req.date_released || req.request_date || '';

        for (var key in deptNames) {
            var status = (cl[key] || '').toLowerCase();
            if (status === 'pending' && remarks[key]) {
                notifications.push({ icon: 'fas fa-exclamation-triangle', color: '#f59e0b', title: deptNames[key] + ' — Lacking Requirements', message: remarks[key], reqNum: rnum, date: req.request_date });
            }
            if (status === 'rejected' && remarks[key]) {
                notifications.push({ icon: 'fas fa-times-circle', color: '#ef4444', title: deptNames[key] + ' — Rejected', message: remarks[key], reqNum: rnum, date: req.request_date });
            }
        }

        var st = getRawStatus(req);
        var notifSpan = getClaimScheduleSpan(req);
        if (st === 'scheduled for claiming') {
            // Shows as Pending until the first day of the schedule span
            if (isClaimWindowOpen(req)) {
                notifications.push({ icon: 'fas fa-check-circle', color: '#10b981', title: 'Ready to Claim', message: 'Your documents are ready at the Registrar\'s Office' + (notifSpan ? ': ' + notifSpan : '') + '.', reqNum: rnum, date: dateStr });
            } else {
                notifications.push({ icon: 'fas fa-calendar-check', color: '#0ea5e9', title: 'Scheduled for Claiming', message: 'Your documents are scheduled for claiming' + (notifSpan ? ': ' + notifSpan : '') + '. The status becomes Ready to Claim on the first day of the schedule.', reqNum: rnum, date: dateStr });
            }
        } else if (st === 'ready to claim') {
            notifications.push({ icon: 'fas fa-receipt', color: '#10b981', title: 'Submit Reference Number', message: 'Your documents are ready. Please submit your reference number at the Registrar\'s Office.', reqNum: rnum, date: dateStr });
        }
        if (st === 'claimed') {
            notifications.push({ icon: 'fas fa-box-open', color: '#6366f1', title: 'Claimed', message: 'You have claimed your documents. Transaction completed.', reqNum: rnum, date: dateStr });
        }
    });

    if (badge) {
        if (notifications.length > 0) { badge.textContent = notifications.length; badge.style.display = 'inline-block'; }
        else { badge.style.display = 'none'; }
    }

    if (notifications.length === 0) {
        list.innerHTML = '<div class="notif-empty"><i class="fas fa-check-circle me-1"></i>No new notifications</div>';
        return;
    }

    list.innerHTML = notifications.map(function(n) {
        return '<div class="notif-item">' +
            '<div class="notif-item-inner">' +
                '<i class="' + n.icon + ' notif-icon" style="color:' + n.color + ';"></i>' +
                '<div class="notif-body">' +
                    '<div class="notif-title">' + escapeHtml(n.title) + '</div>' +
                    '<div class="notif-msg">' + escapeHtml(n.message) + '</div>' +
                    '<div class="notif-meta"><span>' + escapeHtml(n.reqNum) + '</span><span>' + timeAgo(n.date) + '</span></div>' +
                '</div>' +
            '</div>' +
        '</div>';
    }).join('');
}

function updateSidebarInfo(data) {
    const nameEl = document.getElementById('sidebarStudentName');
    const roleEl = document.getElementById('sidebarStudentRole');
    if (nameEl) {
        nameEl.textContent = data.student?.full_name ||
            `${data.student?.first_name || ''} ${data.student?.last_name || ''}`.trim() ||
            data.user?.email?.split('@')[0] || 'Student';
    }
    if (roleEl) {
        const roles = { 1: 'Admin', 2: 'Student', 3: 'Alumni', 4: 'Staff' };
        roleEl.textContent = roles[data.user?.role_id] || 'Student';
    }
}

// ─── Student Data ───
function loadStudentData() {
    document.getElementById('studentName').innerHTML = '<span class="spinner-border spinner-border-sm"></span> Loading...';
    axios.get(API_BASE_URL + '/get_student_data.php', { timeout: 10000 })
        .then(res => {
            if (res.data.success) {
                const name = res.data.student?.full_name ||
                    (res.data.user?.email ? res.data.user.email.split('@')[0] : 'Student');
                document.getElementById('studentName').textContent = name;
                sessionStorage.setItem('studentData', JSON.stringify(res.data));
                updateSidebarInfo(res.data);
            } else {
                document.getElementById('studentName').textContent = 'Student';
            }
        })
        .catch(() => { document.getElementById('studentName').textContent = 'Student'; });
}

// ─── Load Requests ───
function loadStudentRequests() {
    const loader = document.getElementById('loadingRequests');
    const tbody = document.getElementById('requestsTableBody');
    const ts = document.getElementById('lastUpdated');

    if (loader) loader.style.display = 'block';
    if (tbody) tbody.innerHTML = '';
    if (ts) ts.textContent = 'Last updated: ' + new Date().toLocaleTimeString();

    axios.get(API_BASE_URL + '/get_my_requests.php', { timeout: 10000 })
        .then(res => {
            if (loader) loader.style.display = 'none';
            console.log('Requests API response:', res.data);
            loadedRequests = (res.data.success && res.data.requests) ? res.data.requests : [];
            loadedRequests.sort((a, b) => {
                const order = { 'pending': 1, 'processing': 2, 'ready to claim': 3, 'scheduled for claiming': 4, 'claimed': 5, 'rejected': 6, 'released': 7 };
                const aOrder = order[(a.status || 'pending').toLowerCase()] || 3;
                const bOrder = order[(b.status || 'pending').toLowerCase()] || 3;
                return aOrder - bOrder;
            });
            displayRequests(loadedRequests);
            buildNotifications(loadedRequests);
        })
        .catch(err => {
            if (loader) loader.style.display = 'none';
            console.error('Requests API error:', err.response ? err.response.data : err.message);
            loadedRequests = [];
            displayRequests([]);
        });
}

// ─── Display Table ───
function displayRequests(requests) {
    const tbody = document.getElementById('requestsTableBody');
    if (!tbody) return;

    if (!requests || requests.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" class="no-requests">
            <i class="fas fa-file-alt"></i><p>No requests found</p>
            <small>Your request history will appear here</small></td></tr>`;
        return;
    }

    tbody.innerHTML = requests.map((req, i) => {
        const status = req.status || 'pending';
        const si = getStatusInfo(status, req);
        const d = req.request_date ? new Date(req.request_date) : new Date();
        const fdate = d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
        const ftime = d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
        const rnum = 'REQ-' + String(req.request_id || i + 1).padStart(6, '0');
        const docs = getDocSummary(req.documents);
        const claimSpan = getClaimScheduleSpan(req);
        // Claiming Schedule column: stays "Pending" until the staff sets the
        // claiming schedule (only an actual schedule is shown here)
        const scheduleCell = claimSpan
            ? `<span class="date-requested"><i class="fas fa-calendar-check" style="color:#b85c00;"></i> ${escapeHtml(claimSpan)}</span>`
            : '<span style="color:#94a3b8;"><i class="fas fa-hourglass-half"></i> Pending</span>';

        return `<tr class="clickable-row" onclick="openQueueModal(${parseInt(i)})" title="Click to view progress">
            <td><span class="request-id">${escapeHtml(rnum)}</span></td>
            <td><span class="document-type">${escapeHtml(docs)}</span></td>
            <td><span class="date-requested"><i class="fas fa-calendar-alt"></i> ${escapeHtml(fdate)}</span>
                <small style="display:block;color:#7f8c8d;font-size:0.7rem;margin-top:2px"><i class="fas fa-clock"></i> ${escapeHtml(ftime)}</small></td>
            <td>${scheduleCell}</td>
            <td><span class="status-badge ${si.class}"><i class="${si.icon}"></i> ${escapeHtml(si.label)}</span></td>
        </tr>`;
    }).join('');
}

function getDocSummary(docs) {
    if (!docs) return 'Document Request';
    const p = [];
    if (docs.tor_purpose?.length) p.push('TOR');
    if (docs.certification?.length) p.push(docs.certification.length === 1 ? String(docs.certification[0]) : docs.certification.length + ' Certifications');
    if (docs.diploma?.length) p.push('Diploma');
    if (docs.cav_overseas) p.push('CAV Overseas');
    return p.length ? p.join(', ') : 'Document Request';
}

// ─── 6-Step Progress Tracker ───
const STEPS = [
    { step: 1, label: 'Submitted',       icon: 'fas fa-paper-plane' },
    { step: 2, label: 'Review',          icon: 'fas fa-search' },
    { step: 3, label: 'Dept. Clearance', icon: 'fas fa-clipboard-check' },
    { step: 4, label: 'Submit Reference Number', icon: 'fas fa-receipt' },
    { step: 5, label: 'Scheduled for Claiming',  icon: 'fas fa-calendar-check' },
    { step: 6, label: 'Claimed',         icon: 'fas fa-box-open' }
];

const DEPT_KEYS = [
    { key: 'library',  name: 'Library' },
    { key: 'guidance', name: 'Guidance Office' },
    { key: 'finance',  name: 'Finance Office' },
    { key: 'dean',     name: "Dean's Office" }
];

// Count how many departments approved / rejected
function getDeptCounts(req) {
    const cl = req.clearance || {};
    let approved = 0, rejected = 0, pending = 0;
    const approvedDepts = [], rejectedDepts = [], pendingDepts = [];
    for (const d of DEPT_KEYS) {
        const s = cl[d.key] || 'Pending';
        if (s === 'Approved')      { approved++; approvedDepts.push(d); }
        else if (s === 'Rejected') { rejected++; rejectedDepts.push(d); }
        else                       { pending++; pendingDepts.push(d); }
    }
    return { approved, rejected, pending, approvedDepts, rejectedDepts, pendingDepts };
}

// Get the circle class for the combined department-clearance step (step 3)
function getDeptStepClass(req, stepNum, currentStep) {
    var counts = getDeptCounts(req);
    if (counts.rejected > 0) return 'fail';
    if (counts.approved === 4) return 'done';
    if (stepNum === currentStep) return 'current';
    if (stepNum < currentStep) return 'done';
    return ''; // pending/gray
}

// Get the CSS class for a line segment between step N and step N+1
function getSegmentClass(req, stepFrom, currentStep) {
    var counts = getDeptCounts(req);
    var status = (req.status || 'pending').toLowerCase();
    var isCompleted = status === 'claimed' || status === 'completed';

    if (isCompleted || stepFrom < currentStep) {
        // Past segment — a rejection on the combined clearance step turns it red
        if (stepFrom === 3 && counts.rejected > 0) {
            return 'seg-fail';
        }
        return 'seg-done';
    }
    if (stepFrom === currentStep) {
        return 'seg-current'; // animated dashed line
    }
    return 'seg-pending'; // dashed gray
}

// Calculate current step (1-6)
function getCurrentStep(req) {
    const status = (req.status || 'pending').toLowerCase();
    const rawStatus = getRawStatus(req);
    const counts = getDeptCounts(req);
    const cl = req.clearance || {};
    const hasClearanceRecords = Object.keys(cl).length > 0;
    const isPaid = !!req.is_paid;

    if (status === 'claimed' || status === 'completed') return 6;
    // A claiming schedule is set => step 5 (the request stays "Pending" in the
    // list until the first day of the claiming window)
    if (isScheduledRequest(req)) return 5;
    // Gate: never advance past step 3 (combined Dept. Clearance) until all
    // 4 departments have approved. A finalized request (reference number step)
    // therefore only shows once every department cleared the request.
    if (status === 'ready to claim' || status === 'released' || rawStatus === 'ready to claim') {
        if (counts.approved < 4) return 3;
        // Step 4 (Submit Reference Number) is done once the reference number
        // is recorded; the request then waits for the claiming schedule (step 5).
        return isPaid ? 5 : 4;
    }
    if (status === 'rejected' || counts.rejected > 0) {
        // Rejection is shown on the combined department-clearance step
        return 3;
    }
    if (counts.approved === 4) return 3; // all cleared, waiting for staff finalize

    // If status is Processing or clearance records exist, we're at step 3 (dept clearance)
    if (status === 'processing' || hasClearanceRecords) return 3;

    // Pending with no clearance records = step 2 (awaiting staff review)
    return 2;
}

// Build detail message for a step
function getStepNote(req, stepNum, currentStep) {
    const status = (req.status || 'pending').toLowerCase();
    const counts = getDeptCounts(req);
    const hasRejection = counts.rejected > 0;
    const isPaid = !!req.is_paid;

    // Future step
    if (stepNum > currentStep && status !== 'claimed' && status !== 'completed' && status !== 'ready to claim' && status !== 'released') {
        return '<span style="color:#94a3b8;">Your request has not reached this step yet.</span>';
    }

    if (stepNum === 1) {
        return 'Your request has been submitted and is now in the processing queue.';
    }

    if (stepNum === 2) {
        if (currentStep > 2) {
            var docs = req.documents || {};
            var hasTor = docs.tor_purpose && docs.tor_purpose.length > 0;
            if (hasTor) {
                var totalPrice = parseFloat(req.total_price || 0).toFixed(2);
                var torPages = req.tor_pages || 0;
                return '<span style="color:#065f46;font-weight:600;"><i class="fas fa-check-circle me-1"></i>Request Reviewed Done (Total Pages: ' + torPages + ', Total Price: \u20B1' + totalPrice + ')</span>';
            }
            return '<span style="color:#065f46;font-weight:600;"><i class="fas fa-check-circle me-1"></i>Request Reviewed Done</span>';
        }
        return 'Your request is being reviewed by the Registrar\'s Office. Please wait for the review to be completed.';
    }

    if (stepNum === 3) {
        // Combined clearance step. Show each department with WHO approved it and
        // WHEN, so the student can see the clearance progress in detail.
        const details = req.clearance_details || {};
        let lines = [];
        for (const d of DEPT_KEYS) {
            const info = details[d.key] || {};
            const st = (info.status || 'Pending');
            if (st === 'Approved') {
                const who = info.approver ? String(info.approver) : d.name;
                const when = info.approved_at ? ' on ' + escapeHtml(info.approved_at) : '';
                lines.push(
                    '<div style="margin:2px 0;">' +
                    '<i class="fas fa-check-circle me-1" style="color:#059669;"></i>' +
                    '<strong>' + d.name + '</strong> — approved by ' + escapeHtml(who) + when +
                    '</div>'
                );
            } else if (st === 'Rejected') {
                lines.push(
                    '<div style="margin:2px 0;color:#b91c1c;">' +
                    '<i class="fas fa-times-circle me-1"></i>' +
                    '<strong>' + d.name + '</strong> — rejected' +
                    '</div>'
                );
            } else {
                lines.push(
                    '<div style="margin:2px 0;color:#94a3b8;">' +
                    '<i class="fas fa-hourglass-half me-1"></i>' +
                    '<strong>' + d.name + '</strong> — pending' +
                    '</div>'
                );
            }
        }
        let header = counts.approved === 4
            ? '<span style="color:#065f46;font-weight:600;"><i class="fas fa-check-double me-1"></i>All departments cleared.</span>'
            : '<span style="color:#92400e;font-weight:600;"><i class="fas fa-hourglass-half me-1"></i>Department clearance in progress (' + counts.approved + '/4 approved).</span>';
        return header + '<div style="margin-top:6px;font-size:0.9rem;">' + lines.join('') + '</div>';
    }

    if (stepNum === 4) {
        if (isPaid) {
            var refNo = req.reference_number ? String(req.reference_number) : 'recorded';
            return '<span style="color:#065f46;font-weight:600;"><i class="fas fa-check-circle me-1"></i>Reference number submitted: ' + escapeHtml(refNo) + '. Payment marked as PAID.</span>';
        }
        return 'Your documents are ready. Please submit your reference number at the Registrar\'s Office to continue.';
    }

    if (stepNum === 5) {
        var scheduleInfo = getClaimScheduleInfo(req);
        if (scheduleInfo) {
            var scheduleLines = ['<span style="color:#065f46;font-weight:600;"><i class="fas fa-calendar-check me-1"></i>Scheduled for Claiming: ' + escapeHtml(scheduleInfo.span) + '</span>'];
            if (!isClaimWindowOpen(req)) {
                // The request keeps the "Pending" status until the first day of the span
                var windowStart = formatShortDate(req.claim_schedule_start);
                scheduleLines.push('<span style="color:#92400e;"><i class="fas fa-hourglass-half me-1"></i>Your request is still <strong>Pending</strong> and becomes <strong>Ready to Claim</strong> on ' + escapeHtml(windowStart) + ' (the first day of the schedule).</span>');
            }
            if (scheduleInfo.remarks) {
                scheduleLines.push('<span style="color:#1e40af;"><i class="fas fa-comment-alt me-1"></i>Remarks: "' + escapeHtml(scheduleInfo.remarks) + '"</span>');
            }
            return scheduleLines.join('<br>');
        }
        if (!isPaid) {
            return '<span style="color:#94a3b8;">Your request has not reached this step yet.</span>';
        }
        if (stepNum < currentStep) {
            return '<span style="color:#065f46;font-weight:600;"><i class="fas fa-check-circle me-1"></i>Claiming schedule completed.</span>';
        }
        return 'Your reference number has been submitted. Please wait while the Registrar\'s Office sets your claiming schedule.';
    }

    if (stepNum === 6) {
        if (status !== 'claimed' && status !== 'completed') {
            return '<span style="color:#94a3b8;">Your request has not reached this step yet.</span>';
        }
        return '<span style="color:#065f46;font-weight:600;"><i class="fas fa-check-double me-1"></i>Documents claimed. Transaction complete.</span>';
    }

    return '';
}

// ─── Open Queue Modal ───
let selectedStepIndex = null;

function openQueueModal(index) {
    const req = loadedRequests[index];
    if (!req) return;

    const modal = new bootstrap.Modal(document.getElementById('requestDetailModal'));
    const body = document.getElementById('requestDetailBody');
    const currentStep = getCurrentStep(req);
    const counts = getDeptCounts(req);
    const hasRejection = counts.rejected > 0;
    const status = (req.status || 'pending').toLowerCase();
    const isCompleted = status === 'claimed' || status === 'completed';
    const rnum = 'REQ-' + String(req.request_id || index + 1).padStart(6, '0');
    const si = getStatusInfo(req.status || 'pending', req);
    const dateStr = req.request_date ? new Date(req.request_date).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) : '-';

    // Build circle nodes interleaved with line segments
    var trackParts = [];
    var showStep = selectedStepIndex !== null ? selectedStepIndex : currentStep;

    for (var i = 0; i < STEPS.length; i++) {
        var s = STEPS[i];
        var stepNum = s.step;
        var circleClass = '';

        if (stepNum === 3) {
            circleClass = getDeptStepClass(req, stepNum, currentStep);
        } else if (isCompleted || stepNum < currentStep) {
            circleClass = 'done';
        } else if (stepNum === currentStep) {
            circleClass = 'current';
        }

        var activeClass = stepNum === showStep ? 'active-node' : '';

        // Add circle node
        trackParts.push(
            '<div class="queue-node ' + activeClass + '" onclick="selectStep(' + index + ', ' + stepNum + ')" title="' + s.label + '">' +
                '<div class="queue-circle ' + circleClass + '">' + stepNum + '</div>' +
                '<div class="queue-day-label">' + s.label + '</div>' +
            '</div>'
        );

        // Add line segment after each circle (except the last)
        if (i < STEPS.length - 1) {
            var segClass = getSegmentClass(req, stepNum, currentStep);
            trackParts.push('<div class="queue-segment ' + segClass + '"></div>');
        }
    }

    var nodesHtml = trackParts.join('');

    var detailCard = buildStepDetailCard(req, showStep, currentStep);
    const remarksHtml = buildRemarksHtml(req.remarks);

    var estClaimDate = getEstimatedClaimDate(req.request_date);
    var claimSpan = getClaimScheduleSpan(req);
    var scheduleRemarksHtml = (claimSpan && req.claim_schedule_remarks)
        ? '<div class="remarks-box" style="background:#eff6ff;border:1px solid #bfdbfe;"><h6><i class="fas fa-calendar-check me-1"></i>Claiming Remarks</h6><p>' + escapeHtml(req.claim_schedule_remarks) + '</p></div>'
        : '';

    // Total Amount logic: show "Pending Amount" if step 2 not done and request has TOR
    var docs = req.documents || {};
    var hasTor = docs.tor_purpose && docs.tor_purpose.length > 0;
    var reviewDone = currentStep > 2; // step 2 (Review) is completed
    var totalAmountHtml = '';
    if (hasTor && !reviewDone) {
        totalAmountHtml = '<span style="color:#b85c00; font-style:italic;">Pending Amount</span>';
    } else {
        var totalPrice = parseFloat(req.total_price || 0).toFixed(2);
        totalAmountHtml = '<span style="color:#4e73df; font-weight:700;">\u20B1' + totalPrice + '</span>';
    }

    body.innerHTML =
        '<div class="req-info-bar">' +
            '<div class="info-item"><div class="info-label">Request No.</div><div class="info-val" style="color:#4e73df;font-family:monospace;">' + escapeHtml(rnum) + '</div></div>' +
            '<div class="info-item"><div class="info-label">Date</div><div class="info-val">' + escapeHtml(dateStr) + '</div></div>' +
            '<div class="info-item"><div class="info-label">' + (claimSpan ? 'Claiming Schedule' : 'Est. Date Release') + '</div><div class="info-val" style="color:#b85c00;">' + escapeHtml(claimSpan || estClaimDate) + '</div></div>' +
            '<div class="info-item"><div class="info-label">Student</div><div class="info-val">' + escapeHtml(req.student_name || '-') + '</div></div>' +
            '<div class="info-item"><div class="info-label">Status</div><div class="info-val"><span class="status-badge ' + si.class + '" style="font-size:0.72rem;">' + escapeHtml(si.label) + '</span></div></div>' +
            '<div class="info-item"><div class="info-label">Total Amount</div><div class="info-val">' + totalAmountHtml + '</div></div>' +
        '</div>' +
        '<div style="font-size:0.78rem;color:#856404;background:#fff9e6;border:1px solid #ffe0b3;border-radius:6px;padding:0.5rem 0.75rem;margin-bottom:1rem;">' +
            '<i class="fas fa-calendar-check me-1"></i> There is a 5-day extension to the estimated date release. If it exceeds, please go to the Registrar\'s Office.' +
        '</div>' +

        '<div style="font-size:0.8rem;color:#64748b;margin-bottom:0.5rem;font-weight:600;">' +
            '<i class="fas fa-route me-1" style="color:#4e73df;"></i> Request Progress' +
            '<span style="font-weight:400;color:#94a3b8;"> &mdash; Click a step to see details</span>' +
        '</div>' +

        '<div class="queue-track" id="queueTrack">' +
            nodesHtml +
        '</div>' +

        '<div id="dayDetailContainer">' + detailCard + '</div>' +
        scheduleRemarksHtml +
        remarksHtml;

    selectedStepIndex = null;
    modal.show();
}

// ─── Select a Step circle ───
function selectStep(reqIndex, stepNum) {
    selectedStepIndex = stepNum;
    const req = loadedRequests[reqIndex];
    if (!req) return;

    const currentStep = getCurrentStep(req);

    document.querySelectorAll('#queueTrack .queue-node').forEach(function (node, i) {
        node.classList.toggle('active-node', (i + 1) === stepNum);
    });

    var container = document.getElementById('dayDetailContainer');
    container.innerHTML = buildStepDetailCard(req, stepNum, currentStep);
}

// Keep legacy name so table onclick still works
function selectDay(reqIndex, dayNum) { selectStep(reqIndex, dayNum); }

// ─── Build detail card for a step ───
function buildStepDetailCard(req, stepNum, currentStep) {
    const s = STEPS[stepNum - 1];
    const status = (req.status || 'pending').toLowerCase();
    const counts = getDeptCounts(req);
    const hasRejection = counts.rejected > 0;
    const isCompleted = status === 'claimed' || status === 'completed';

    let cardClass = 'detail-pending';
    let statusBadge = '<span class="queue-detail-status qstatus-pending"><i class="fas fa-hourglass-half me-1"></i>Upcoming</span>';

    if (isCompleted || stepNum < currentStep) {
        // Past step — check if the combined clearance step was rejected
        if (stepNum === 3) {
            var deptClass = getDeptStepClass(req, stepNum, currentStep);
            if (deptClass === 'fail') {
                cardClass = 'detail-fail';
                statusBadge = '<span class="queue-detail-status qstatus-fail"><i class="fas fa-times-circle me-1"></i>Rejected</span>';
            } else {
                cardClass = 'detail-done';
                statusBadge = '<span class="queue-detail-status qstatus-done"><i class="fas fa-check-circle me-1"></i>Approved</span>';
            }
        } else {
            cardClass = 'detail-done';
            statusBadge = '<span class="queue-detail-status qstatus-done"><i class="fas fa-check-circle me-1"></i>Completed</span>';
        }
    } else if (stepNum === currentStep) {
        if (stepNum === 3) {
            var curDeptClass = getDeptStepClass(req, stepNum, currentStep);
            if (curDeptClass === 'fail') {
                cardClass = 'detail-fail';
                statusBadge = '<span class="queue-detail-status qstatus-fail"><i class="fas fa-times-circle me-1"></i>Rejected</span>';
            } else if (curDeptClass === 'done') {
                cardClass = 'detail-done';
                statusBadge = '<span class="queue-detail-status qstatus-done"><i class="fas fa-check-double me-1"></i>All Approved</span>';
            } else {
                cardClass = 'detail-current';
                statusBadge = '<span class="queue-detail-status qstatus-current"><i class="fas fa-spinner fa-spin me-1"></i>In Progress</span>';
            }
        } else if (stepNum === 4) {
            cardClass = 'detail-current';
            statusBadge = '<span class="queue-detail-status qstatus-current"><i class="fas fa-spinner fa-spin me-1"></i>Waiting for Reference No.</span>';
        } else if (stepNum === 5) {
            // The schedule may already be set while the request still shows "Pending"
            if (isScheduledRequest(req)) {
                cardClass = 'detail-done';
                statusBadge = isClaimWindowOpen(req)
                    ? '<span class="queue-detail-status qstatus-done"><i class="fas fa-check-circle me-1"></i>Ready</span>'
                    : '<span class="queue-detail-status qstatus-current"><i class="fas fa-calendar-check me-1"></i>Scheduled</span>';
            } else {
                cardClass = 'detail-current';
                statusBadge = '<span class="queue-detail-status qstatus-current"><i class="fas fa-spinner fa-spin me-1"></i>Awaiting Schedule</span>';
            }
        } else if (status === 'ready to claim' || status === 'released') {
            cardClass = 'detail-done';
            statusBadge = '<span class="queue-detail-status qstatus-done"><i class="fas fa-check-circle me-1"></i>Ready</span>';
        } else {
            cardClass = 'detail-current';
            statusBadge = '<span class="queue-detail-status qstatus-current"><i class="fas fa-spinner fa-spin me-1"></i>In Progress</span>';
        }
    }

    const msg = getStepNote(req, stepNum, currentStep);

    return '<div class="queue-detail-card ' + cardClass + '">' +
        '<div class="queue-detail-title"><i class="' + s.icon + ' me-2" style="color:#4e73df;"></i>Step ' + stepNum + ' — ' + s.label + '</div>' +
        '<p class="queue-detail-msg">' + msg + '</p>' +
        statusBadge +
    '</div>';
}

// ─── Remarks ───
function buildRemarksHtml(remarks) {
    if (!remarks) return '';
    let obj = remarks;
    if (typeof remarks === 'string') {
        try { obj = JSON.parse(remarks); } catch (e) {
            return `<div class="remarks-box"><h6><i class="fas fa-comment-alt me-1"></i>Remarks</h6><p>${escapeHtml(remarks)}</p></div>`;
        }
    }
    if (typeof obj === 'object' && obj !== null) {
        const entries = Object.entries(obj).filter(([, v]) => v);
        if (entries.length === 0) return '';
        return '<div class="remarks-box"><h6><i class="fas fa-comment-alt me-1"></i>Remarks</h6>' +
            entries.map(([k, v]) => `<p><strong>${escapeHtml(k.charAt(0).toUpperCase() + k.slice(1))}:</strong> ${escapeHtml(String(v))}</p>`).join('') +
            '</div>';
    }
    return '';
}

// ─── Estimated Date Release range (10–15 days from request date) ───
function getEstimatedClaimDate(requestDate) {
    var base = requestDate ? new Date(requestDate) : new Date();
    var start = new Date(base);
    start.setDate(start.getDate() + 10);
    var end = new Date(base);
    end.setDate(end.getDate() + 15);

    var months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
    var sMonth = months[start.getMonth()];
    var eMonth = months[end.getMonth()];
    var sDay = start.getDate();
    var eDay = end.getDate();

    if (sMonth === eMonth) return sMonth + " " + sDay + " - " + eDay;
    return sMonth + " " + sDay + " - " + eMonth + " " + eDay;
}

// ─── Status badge helper ───
// --- Claiming schedule helpers ---

// Format a YYYY-MM-DD value as "Sep 20, 2026"
function formatShortDate(value) {
    if (!value) return '';
    var raw = String(value).trim();
    var d = new Date(raw.length <= 10 ? raw + 'T00:00:00' : raw);
    if (isNaN(d)) return raw;
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

// Claiming schedule span, e.g. "Sep 20, 2026 - Sep 24, 2026" (empty when not set)
function getClaimScheduleSpan(req) {
    if (!req || !req.claim_schedule_start || !req.claim_schedule_end) return '';
    var start = formatShortDate(req.claim_schedule_start);
    var end = formatShortDate(req.claim_schedule_end);
    if (!start || !end) return '';
    return start === end ? start : start + ' \u2013 ' + end;
}

function getClaimScheduleInfo(req) {
    var span = getClaimScheduleSpan(req);
    if (!span) return null;
    return { span: span, remarks: req.claim_schedule_remarks || '' };
}

// --- Claiming window status helpers ---
// The status stored in the database (a scheduled request is stored as
// "Scheduled for Claiming" but shows as "Pending" until its window opens)
function getRawStatus(req) {
    return ((req && (req.raw_status || req.status)) || '').toLowerCase();
}

function isScheduledRequest(req) {
    return getRawStatus(req) === 'scheduled for claiming' || !!(req && req.claim_schedule_start);
}

// Where we are relative to the claiming window: '', 'before', 'open' or 'ended'
function getClaimWindowState(req) {
    if (!req) return '';
    if (typeof req.claim_window_state === 'string' && req.claim_window_state !== '') {
        return req.claim_window_state;
    }
    var start = String(req.claim_schedule_start || '').slice(0, 10);
    if (!start) return '';
    var now = new Date();
    var today = now.getFullYear() + '-' +
        String(now.getMonth() + 1).padStart(2, '0') + '-' +
        String(now.getDate()).padStart(2, '0');
    if (today < start) return 'before';
    var end = String(req.claim_schedule_end || '').slice(0, 10);
    if (end && today > end) return 'ended';
    return 'open';
}

// The claiming window has started (the request is "Ready to Claim")
function isClaimWindowOpen(req) {
    return isScheduledRequest(req) && getClaimWindowState(req) !== 'before';
}

function getStatusInfo(status, req) {
    // A finalized request keeps showing "PENDING" until its claiming window
    // opens: either no schedule has been set yet (step 4) or the first day of
    // the schedule span has not arrived. From that day it is READY TO CLAIM.
    if (req) {
        var raw = getRawStatus(req);
        if (raw === 'scheduled for claiming' || raw === 'ready to claim') {
            return isClaimWindowOpen(req)
                ? { class: 'status-approved', icon: 'fas fa-check-circle', label: 'READY TO CLAIM' }
                : { class: 'status-pending', icon: 'fas fa-hourglass-half', label: 'PENDING' };
        }
    }

    const s = (status || 'pending').toLowerCase();
    const map = {
        'pending': { class: 'status-pending', icon: 'fas fa-clock', label: 'PENDING' },
        'processing': { class: 'status-processing', icon: 'fas fa-spinner', label: 'PROCESSING' },
        'approved': { class: 'status-approved', icon: 'fas fa-check-circle', label: 'APPROVED' },
        'completed': { class: 'status-completed', icon: 'fas fa-check-double', label: 'COMPLETED' },
        'ready to claim': { class: 'status-approved', icon: 'fas fa-check-circle', label: 'READY TO CLAIM' },
        'scheduled for claiming': { class: 'status-approved', icon: 'fas fa-calendar-check', label: 'SCHEDULED FOR CLAIMING' },
        'claimed': { class: 'status-released', icon: 'fas fa-box-open', label: 'CLAIMED' },
        'released': { class: 'status-released', icon: 'fas fa-box-open', label: 'RELEASED' },
        'rejected': { class: 'status-rejected', icon: 'fas fa-times-circle', label: 'REJECTED' }
    };
    return map[s] || { class: 'status-pending', icon: 'fas fa-clock', label: s.toUpperCase() };
}

// ─── Event Listeners & Logout ───
function setupEventListeners() {
    const btn = document.getElementById('logoutBtn');
    if (btn) btn.addEventListener('click', e => { e.preventDefault(); handleLogout(); });
}

function handleLogout() {
    Swal.fire({
        title: 'Logout',
        text: 'Are you sure you want to logout?',
        icon: 'question',
        showCancelButton: true,
        confirmButtonColor: '#667eea',
        cancelButtonColor: '#d33',
        confirmButtonText: 'Yes, logout'
    }).then(result => {
        if (result.isConfirmed) {
            window.appLogout(API_BASE_URL + '/logout.php');
        }
    });
}
