// API Configuration
const API_BASE_URL = '../api';

// Initialize profile page
document.addEventListener('DOMContentLoaded', function() {
    console.log('Profile page initializing...');
    loadSidebar();
    loadStudentProfile();
    setupEventListeners();
    setupChangePassword();
});

// Load sidebar component
function loadSidebar() {
    const container = document.getElementById('sidebar-container');
    if (!container) return;
    fetch('sidebar.html')
        .then(response => response.text())
        .then(html => {
            var temp = document.createElement('div');
            temp.innerHTML = html;
            // Show topbar + horizontal navbar, no sidebar
            var topbar = temp.querySelector('.topbar');
            var navbar = temp.querySelector('.student-navbar');
            if (topbar) container.appendChild(topbar);
            if (navbar) container.appendChild(navbar);
            // Adjust content: full width, offset for topbar + navbar
            var content = document.querySelector('.content') || document.querySelector('.main-content');
            if (content) {
                content.style.marginLeft = '0';
                content.style.marginTop = 'calc(var(--cces-topbar-height) + 40px)';
                content.style.padding = '1.5rem';
            }
            // Highlight active nav item
            document.querySelectorAll('.navbar-dropdown-menu a').forEach(function(link) {
                if (link.getAttribute('href') === 'student_profile.html') link.classList.add('active');
            });
            // Bind logout
            var logoutBtnTopbar = document.getElementById('logoutBtnTopbar');
            if (logoutBtnTopbar) {
                logoutBtnTopbar.addEventListener('click', function(e) {
                    e.preventDefault();
                    if (window.appLogout) { window.appLogout('../api/logout.php'); }
                    else { sessionStorage.clear(); window.location.href = '../../index.php'; }
                });
            }
            var cachedData = sessionStorage.getItem('studentData');
            if (cachedData) {
                try { updateSidebarInfo(JSON.parse(cachedData)); } catch (e) {}
            }
        })
        .catch(error => console.error('Error loading navigation:', error));
}

// Update sidebar with student info
function updateSidebarInfo(data) {
    const sidebarName = document.getElementById('sidebarStudentName');
    const sidebarRole = document.getElementById('sidebarStudentRole');
    
    if (sidebarName) {
        const fullName = data.student?.full_name || 
                        `${data.student?.first_name || ''} ${data.student?.last_name || ''}`.trim() || 
                        data.user?.email?.split('@')[0] || 
                        'Student';
        sidebarName.textContent = fullName;
    }
    
    if (sidebarRole) {
        let role = 'Student';
        if (data.user?.role_id === 1) role = 'Admin';
        else if (data.user?.role_id === 2) role = 'Student';
        else if (data.user?.role_id === 3) role = 'Alumni';
        else if (data.user?.role_id === 4) role = 'Staff';
        sidebarRole.textContent = role;
    }
}

// Load student profile using Axios
function loadStudentProfile() {
    // Show loading spinner
    const loadingSpinner = document.getElementById('loadingSpinner');
    const profileContent = document.getElementById('profileContent');
    
    if (loadingSpinner) loadingSpinner.style.display = 'block';
    if (profileContent) profileContent.style.display = 'none';
    
    // Try to get cached data first
    const cachedData = sessionStorage.getItem('studentData');
    
    if (cachedData) {
        try {
            const data = JSON.parse(cachedData);
            console.log('Using cached data');
            displayProfileData(data);
            updateSidebarInfo(data);
            return;
        } catch (e) {
            console.log('Cache error, fetching fresh data');
        }
    }
    
    console.log('Fetching profile from:', API_BASE_URL + '/get_student_data.php');
    
    // Axios GET request
    axios.get(API_BASE_URL + '/get_student_data.php', {
        timeout: 10000,
        headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json'
        }
    })
    .then(function(response) {
        console.log('Profile API Response:', response.data);
        
        if (response.data.success) {
            displayProfileData(response.data);
            updateSidebarInfo(response.data);
            sessionStorage.setItem('studentData', JSON.stringify(response.data));
        } else {
            showError(response.data.message || 'Failed to load profile');
        }
    })
    .catch(function(error) {
        console.error('Profile Axios Error:', error);
        
        let errorMessage = 'Cannot connect to server. ';
        
        if (error.code === 'ECONNABORTED') {
            errorMessage = 'Connection timeout. Please try again.';
        } else if (error.response) {
            errorMessage = 'Server error: ' + error.response.status;
        } else if (error.request) {
            errorMessage = 'Cannot connect to server. Please check your connection.';
        } else {
            errorMessage = 'Error: ' + error.message;
        }
        
        showError(errorMessage);
    });
}

// Display profile data
function displayProfileData(data) {
    // Hide loading spinner
    const loadingSpinner = document.getElementById('loadingSpinner');
    const profileContent = document.getElementById('profileContent');
    
    if (loadingSpinner) loadingSpinner.style.display = 'none';
    if (profileContent) profileContent.style.display = 'block';
    
    const student = data.student || {};
    const user = data.user || {};
    
    // Set full name and student number
    const fullName = student.full_name || 
                    `${student.first_name || ''} ${student.last_name || ''}`.trim() || 
                    (user.email ? user.email.split('@')[0] : 'Student');
    
    // Update display elements
    const displayElements = {
        displayFullName: fullName,
        displayStudentNumber: student.student_number || 'Not Assigned',
        displayFirstName: student.first_name || '-',
        displayLastName: student.last_name || '-',
        displayStudentNum: student.student_number || '-',
        displayCourseName: student.course || '-',
        displayYearLevel: student.year_level || '-',
        displayEmail: user.email || '-',
        displayStatus: user.status || '-'
    };
    
    for (const [id, value] of Object.entries(displayElements)) {
        const element = document.getElementById(id);
        if (element) {
            element.textContent = value;
        }
    }
    
    // Update edit fields with current values
    const editFields = {
        editFirstName: student.first_name || '',
        editLastName: student.last_name || '',
        editStudentNum: student.student_number || '',
        editCourse: student.course || '',
        editYearLevel: String(student.year_level || ''),
        editEmail: user.email || '',
        editStatus: user.status || '',
        editCreatedAt: user.created_at ? new Date(user.created_at).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        }) : '-'
    };
    
    for (const [id, value] of Object.entries(editFields)) {
        const element = document.getElementById(id);
        if (element) {
            if (element.tagName === 'SELECT') {
                // Set select value
                for (let i = 0; i < element.options.length; i++) {
                    if (element.options[i].value === value || 
                        element.options[i].text.includes(value)) {
                        element.selectedIndex = i;
                        break;
                    }
                }
            } else {
                element.value = value;
            }
        }
    }
    
    // Format date for display
    const displayCreatedAt = document.getElementById('displayCreatedAt');
    if (displayCreatedAt && user.created_at) {
        const date = new Date(user.created_at);
        displayCreatedAt.textContent = date.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
    }
}

// Setup event listeners
function setupEventListeners() {
    // Toggle edit mode
    const toggleEditBtn = document.getElementById('toggleEditBtn');
    if (toggleEditBtn) {
        toggleEditBtn.addEventListener('click', toggleEditMode);
    }
    
    // Cancel edit
    const cancelEditBtn = document.getElementById('cancelEditBtn');
    if (cancelEditBtn) {
        cancelEditBtn.addEventListener('click', cancelEditMode);
    }
    
    // Save profile
    const saveProfileBtn = document.getElementById('saveProfileBtn');
    if (saveProfileBtn) {
        saveProfileBtn.addEventListener('click', saveProfileChanges);
    }
}

// Toggle edit mode
function toggleEditMode() {
    const profileCards = document.querySelectorAll('.profile-card');
    const editActions = document.getElementById('editActions');
    const toggleBtn = document.getElementById('toggleEditBtn');
    
    profileCards.forEach(card => {
        card.classList.add('edit-mode');
    });
    
    if (editActions) editActions.style.display = 'block';
    if (toggleBtn) {
        toggleBtn.innerHTML = '<i class="fas fa-times me-2"></i>Cancel Editing';
        toggleBtn.style.background = '#dc3545';
        toggleBtn.style.color = 'white';
        toggleBtn.style.borderColor = '#dc3545';
    }
}

// Cancel edit mode
function cancelEditMode() {
    const profileCards = document.querySelectorAll('.profile-card');
    const editActions = document.getElementById('editActions');
    const toggleBtn = document.getElementById('toggleEditBtn');
    
    profileCards.forEach(card => {
        card.classList.remove('edit-mode');
    });
    
    if (editActions) editActions.style.display = 'none';
    if (toggleBtn) {
        toggleBtn.innerHTML = '<i class="fas fa-edit me-2"></i>Edit Profile';
        toggleBtn.style.background = 'white';
        toggleBtn.style.color = '#667eea';
        toggleBtn.style.borderColor = '#667eea';
    }
    
    // Reload original data
    const cachedData = sessionStorage.getItem('studentData');
    if (cachedData) {
        try {
            const data = JSON.parse(cachedData);
            displayProfileData(data);
        } catch (e) {
            console.error('Error reloading data');
        }
    }
}

// Save profile changes
function saveProfileChanges() {
    // Get updated values
    const updatedData = {
        first_name: document.getElementById('editFirstName')?.value || '',
        last_name: document.getElementById('editLastName')?.value || '',
        course: document.getElementById('editCourse')?.value || '',
        year_level: document.getElementById('editYearLevel')?.value || '',
        email: document.getElementById('editEmail')?.value || ''
    };
    
    // Validate required fields
    if (!updatedData.first_name || !updatedData.last_name) {
        Swal.fire({
            title: 'Validation Error',
            text: 'First name and last name are required',
            icon: 'warning',
            confirmButtonColor: '#667eea'
        });
        return;
    }
    
    // Show the lower-right submission loading toast while the profile is saved
    if (typeof showSubmitLoader === "function") {
        showSubmitLoader("Updating your profile...", "Saving");
    } else {
        Swal.fire({
            toast: true,
            position: "bottom-end",
            title: 'Saving...',
            text: 'Please wait while we update your profile',
            showConfirmButton: false,
            showCancelButton: false,
            allowOutsideClick: false,
            allowEscapeKey: false,
            didOpen: () => {
                Swal.showLoading();
            }
        });
    }
    
    // Send update to server
    axios.post(API_BASE_URL + '/update_profile.php', updatedData)
        .then(function(response) {
            Swal.close();
            
            if (response.data.success) {
                // Update cached data
                const cachedData = sessionStorage.getItem('studentData');
                if (cachedData) {
                    try {
                        const data = JSON.parse(cachedData);
                        data.student.first_name = updatedData.first_name;
                        data.student.last_name = updatedData.last_name;
                        data.student.course = updatedData.course;
                        data.student.year_level = updatedData.year_level;
                        data.student.full_name = `${updatedData.first_name} ${updatedData.last_name}`.trim();
                        if (updatedData.email) {
                            data.user.email = updatedData.email;
                        }
                        sessionStorage.setItem('studentData', JSON.stringify(data));
                        updateSidebarInfo(data);
                    } catch (e) {
                        console.error('Error updating cache');
                    }
                }
                
                // Exit edit mode
                cancelEditMode();
                
                // Show success message
                Swal.fire({
                    title: 'Success!',
                    text: 'Your profile has been updated successfully',
                    icon: 'success',
                    confirmButtonColor: '#667eea',
                    timer: 2000
                });
                
                // Reload profile data
                loadStudentProfile();
                
            } else {
                Swal.fire({
                    title: 'Error',
                    text: response.data.message || 'Failed to update profile',
                    icon: 'error',
                    confirmButtonColor: '#667eea'
                });
            }
        })
        .catch(function(error) {
            Swal.close();
            console.error('Update error:', error);
            
            Swal.fire({
                title: 'Connection Error',
                text: 'Cannot connect to server. Please try again.',
                icon: 'error',
                confirmButtonColor: '#667eea'
            });
        });
}

// Change Password
function setupChangePassword() {
    var changeBtn = document.getElementById('changePasswordBtn');
    if (changeBtn) {
        changeBtn.addEventListener('click', function () {
            var current = document.getElementById('currentPassword').value;
            var newPw = document.getElementById('newPassword').value;
            var confirm = document.getElementById('confirmPassword').value;

            if (!current || !newPw || !confirm) {
                Swal.fire({ title: 'Error', text: 'All password fields are required', icon: 'warning', confirmButtonColor: '#667eea' });
                return;
            }
            if (newPw !== confirm) {
                Swal.fire({ title: 'Error', text: 'New passwords do not match', icon: 'warning', confirmButtonColor: '#667eea' });
                return;
            }
            if (newPw.length < 8) {
                Swal.fire({ title: 'Error', text: 'Password must be at least 8 characters', icon: 'warning', confirmButtonColor: '#667eea' });
                return;
            }
            if (!/[A-Z]/.test(newPw)) {
                Swal.fire({ title: 'Error', text: 'Password must contain at least 1 uppercase letter', icon: 'warning', confirmButtonColor: '#667eea' });
                return;
            }
            if (!/[^a-zA-Z0-9]/.test(newPw)) {
                Swal.fire({ title: 'Error', text: 'Password must contain at least 1 special character', icon: 'warning', confirmButtonColor: '#667eea' });
                return;
            }

            if (typeof showSubmitLoader === "function") {
                showSubmitLoader("Changing password...", "Updating");
            } else {
                Swal.fire({ title: 'Changing password...', allowOutsideClick: false, didOpen: function () { Swal.showLoading(); } });
            }

            axios.post(API_BASE_URL + '/change_password.php', {
                current_password: current,
                new_password: newPw
            })
            .then(function (res) {
                Swal.close();
                if (res.data.success) {
                    Swal.fire({ title: 'Success!', text: 'Your password has been changed', icon: 'success', confirmButtonColor: '#667eea' });
                    document.getElementById('currentPassword').value = '';
                    document.getElementById('newPassword').value = '';
                    document.getElementById('confirmPassword').value = '';
                } else {
                    Swal.fire({ title: 'Error', text: res.data.message, icon: 'error', confirmButtonColor: '#667eea' });
                }
            })
            .catch(function () {
                Swal.close();
                Swal.fire({ title: 'Error', text: 'Cannot connect to server', icon: 'error', confirmButtonColor: '#667eea' });
            });
        });
    }

    // Password visibility toggles
    document.querySelectorAll('.toggle-pw').forEach(function (btn) {
        btn.addEventListener('click', function () {
            var input = document.getElementById(btn.dataset.target);
            var icon = btn.querySelector('i');
            if (input.type === 'password') {
                input.type = 'text';
                icon.classList.replace('fa-eye', 'fa-eye-slash');
            } else {
                input.type = 'password';
                icon.classList.replace('fa-eye-slash', 'fa-eye');
            }
        });
    });
}

// Show error message
function showError(message) {
    const loadingSpinner = document.getElementById('loadingSpinner');
    const profileContent = document.getElementById('profileContent');
    
    if (loadingSpinner) loadingSpinner.style.display = 'none';
    
    if (profileContent) {
        profileContent.style.display = 'block';
        profileContent.innerHTML = `
            <div class="alert alert-danger text-center m-4 p-4">
                <i class="fas fa-exclamation-triangle fa-3x mb-3" style="color: #dc3545;"></i>
                <h5 class="mb-3">Connection Error</h5>
                <p class="mb-4">${escapeHtml(message)}</p>
                <button class="btn btn-primary" onclick="location.reload()">
                    <i class="fas fa-sync-alt me-2"></i>Try Again
                </button>
            </div>
        `;
    }
}