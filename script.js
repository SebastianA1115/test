window.addEventListener('DOMContentLoaded', () => {
    let currentRoomId = null;
    let schedules = [];
    let localUserIdentity = localStorage.getItem('fs_user_identity') || '';

    // Screen View References
    const authScreen = document.getElementById('auth-screen');
    const mainDashboard = document.getElementById('main-dashboard');
    const displayRoomName = document.getElementById('display-room-name');
    const shareLinkInput = document.getElementById('share-link-input');
    const identityBanner = document.getElementById('identity-banner');
    const identityDisplay = document.getElementById('identity-display');

    // Input Control References
    const form = document.getElementById('schedule-form');
    const nameInput = document.getElementById('name');
    const editIdInput = document.getElementById('edit-id');
    const statusSelect = document.getElementById('status');
    const timeInputsDiv = document.getElementById('time-inputs');
    const scheduleList = document.getElementById('schedule-list');
    const findHangoutBtn = document.getElementById('find-hangout');
    const hangoutResults = document.getElementById('hangout-results');

    // 1. URL ROUTE PARSER
    const urlParams = new URLSearchParams(window.location.search);
    const roomIdParam = urlParams.get('room');
    if (roomIdParam) {
        document.getElementById('join-room-id').value = roomIdParam;
    }

    // 2. CREATE FUNCTIONAL LOCAL SERVER
    document.getElementById('btn-create-room').addEventListener('click', function() {
        const name = document.getElementById('new-room-name').value.trim();
        const passcode = document.getElementById('new-room-pass').value.trim();

        if (!name || !passcode) {
            alert("Please enter both a Server Name and a Passcode.");
            return;
        }

        const roomId = 'local_' + Math.random().toString(36).substring(2, 9);
        const roomData = {
            metadata: { name: name, passcode: passcode },
            schedules: {}
        };

        localStorage.setItem(roomId, JSON.stringify(roomData));
        enterRoom(roomId, name);
    });

    // 3. JOIN EXISTING ROOM
    document.getElementById('btn-join-room').addEventListener('click', function() {
        const roomId = document.getElementById('join-room-id').value.trim();
        const inputPasscode = document.getElementById('join-room-pass').value.trim();

        if (!roomId || !inputPasscode) {
            alert("Please provide both the Server ID and Passcode.");
            return;
        }

        const savedRoomRaw = localStorage.getItem(roomId);
        if (savedRoomRaw) {
            const roomData = JSON.parse(savedRoomRaw);
            if (roomData.metadata.passcode === inputPasscode) {
                enterRoom(roomId, roomData.metadata.name);
            } else {
                alert("Incorrect passcode! Access Denied.");
            }
        } else {
            alert("Local Server ID not found.");
        }
    });

    // 4. TEST SERVER SEED ENGINE
    document.getElementById('btn-test-room').addEventListener('click', function() {
        const testRoomId = 'local_test';
        const testRoomName = 'Demo Friendship Crew';
        const testPasscode = '1234';

        localUserIdentity = 'Alice';
        localStorage.setItem('fs_user_identity', 'Alice');

        const todayStr = new Date().toISOString().split('T')[0];
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        const tomorrowStr = tomorrow.toISOString().split('T')[0];

        const mockRoomData = {
            metadata: { name: testRoomName, passcode: testPasscode },
            schedules: {
                'sch_1': { name: 'Alice', date: todayStr, status: 'Working', details: 'Retail Shift', clockIn: '09:00', clockOut: '17:00', repeatDays: [1, 3, 5] },
                'sch_2': { name: 'Bob', date: todayStr, status: 'Free', details: 'Day Off', clockIn: '', clockOut: '', repeatDays: [] },
                'sch_3': { name: 'Charlie', date: tomorrowStr, status: 'Event', details: 'Youth Group Event', clockIn: '', clockOut: '', repeatDays: [0] },
                'sch_4': { name: 'Bob', date: tomorrowStr, status: 'Free', details: 'Free to hang', clockIn: '', clockOut: '', repeatDays: [] }
            }
        };

        localStorage.setItem(testRoomId, JSON.stringify(mockRoomData));
        enterRoom(testRoomId, testRoomName);
    });

    function enterRoom(roomId, roomName) {
        currentRoomId = roomId;
        authScreen.classList.add('hidden');
        mainDashboard.classList.remove('hidden');
        displayRoomName.innerText = roomName;
        
        const baseCleanUrl = window.location.href.split('?')[0];
        shareLinkInput.value = `${baseCleanUrl}?room=${roomId}`;

        manageIdentityUI();
        loadLocalSchedules();
    }

    function manageIdentityUI() {
        if (localUserIdentity) {
            identityDisplay.innerText = localUserIdentity;
            identityBanner.classList.remove('hidden');
            nameInput.value = localUserIdentity;
            nameInput.setAttribute('disabled', 'true');
        } else {
            identityBanner.classList.add('hidden');
            nameInput.value = '';
            nameInput.removeAttribute('disabled');
        }
    }

    document.getElementById('btn-change-identity').addEventListener('click', function() {
        localStorage.removeItem('fs_user_identity');
        localUserIdentity = '';
        manageIdentityUI();
        renderSchedules();
    });

    function loadLocalSchedules() {
        if (!currentRoomId) return;
        const roomData = JSON.parse(localStorage.getItem(currentRoomId));
        schedules = [];
        if (roomData && roomData.schedules) {
            Object.keys(roomData.schedules).forEach(key => {
                schedules.push({ id: key, ...roomData.schedules[key] });
            });
        }
        renderSchedules();
    }

    statusSelect.addEventListener('change', function() {
        if (this.value === 'Working' || this.value === 'Half-Day') {
            timeInputsDiv.classList.remove('hidden');
        } else {
            timeInputsDiv.classList.add('hidden');
        }
    });

    function getSelectedDays() {
        return Array.from(document.querySelectorAll('input[name="repeat-days"]:checked')).map(cb => parseInt(cb.value));
    }

    form.addEventListener('submit', function(e) {
        e.preventDefault();
        if (!currentRoomId) return;

        if (!localUserIdentity) {
            const typedName = nameInput.value.trim();
            if (!typedName) return;
            localUserIdentity = typedName;
            localStorage.setItem('fs_user_identity', typedName);
            manageIdentityUI();
        }

        const id = editIdInput.value || 'sch_' + Date.now().toString();
        const name = localUserIdentity;
        const date = document.getElementById('date').value;
        const status = statusSelect.value;
        const details = document.getElementById('event-details').value;
        const clockIn = document.getElementById('clock-in').value;
        const clockOut = document.getElementById('clock-out').value;
        const repeatDays = getSelectedDays();

        const entryData = { name, date, status, details, clockIn, clockOut, repeatDays };

        const roomData = JSON.parse(localStorage.getItem(currentRoomId));
        if (!roomData.schedules) roomData.schedules = {};
        
        roomData.schedules[id] = entryData;
        localStorage.setItem(currentRoomId, JSON.stringify(roomData));

        resetForm();
        loadLocalSchedules();
    });

    function renderSchedules() {
        scheduleList.innerHTML = '';
        schedules.sort((a, b) => new Date(a.date) - new Date(b.date));

        schedules.forEach(entry => {
            const div = document.createElement('div');
            const isOwner = (entry.name.toLowerCase() === localUserIdentity.toLowerCase());
            
            div.className = `entry ${entry.status} ${!isOwner && localUserIdentity ? 'read-only' : ''}`;
            
            let timeText = (entry.clockIn && entry.clockOut) ? ` (${entry.clockIn} - ${entry.clockOut})` : '';
            let detailText = entry.details ? ` - ${entry.details}` : '';
            const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
            let repeatDaysArr = entry.repeatDays || [];
            let repeatText = repeatDaysArr.length > 0 ? ` 🔄 [Repeats: ${repeatDaysArr.map(d => dayNames[d]).join(', ')}]` : '';
            
            let actionButtons = '';
            if (isOwner || !localUserIdentity) {
                actionButtons = `
                    <div class="entry-actions">
                        <button class="btn-small btn-edit" data-id="${entry.id}">Edit</button>
                        <button class="btn-small btn-delete" data-id="${entry.id}">Delete</button>
                    </div>`;
            } else {
                actionButtons = `<div style="font-size: 11px; color:#777; margin-top:5px;">🔒 Read-Only (Owned by ${entry.name})</div>`;
            }
            
            div.innerHTML = `
                <div><strong>${entry.name}</strong>: ${entry.date} - ${entry.status}${timeText}${detailText}${repeatText}</div>
                ${actionButtons}
                    `;
            scheduleList.appendChild(div);
        });

        document.querySelectorAll('.btn-edit').forEach(btn => {
            btn.addEventListener('click', () => editEntry(btn.getAttribute('data-id')));
        });
        document.querySelectorAll('.btn-delete').forEach(btn => {
            btn.addEventListener('click', () => deleteEntry(btn.getAttribute('data-id')));
        });
    }

    function editEntry(id) {
        const entry = schedules.find(item => item.id === id);
        if (!entry) return;

        if (localUserIdentity && entry.name.toLowerCase() !== localUserIdentity.toLowerCase()) {
            alert("Action Denied! You cannot manipulate other people's schedule entries.");
            return;
        }

        document.getElementById('form-title').innerText = "Edit Entry";
        document.getElementById('submit-btn').innerText = "Save Changes";
        document.getElementById('cancel-edit-btn').classList.remove('hidden');
        
        editIdInput.value = entry.id;
        nameInput.value = entry.name;
        document.getElementById('date').value = entry.date;
        statusSelect.value = entry.status;
        document.getElementById('event-details').value = entry.details;
        document.getElementById('clock-in').value = entry.clockIn || '';
        document.getElementById('clock-out').value = entry.clockOut || '';
        
        statusSelect.dispatchEvent(new Event('change'));
        
        let repeatDaysArr = entry.repeatDays || [];
        document.querySelectorAll('input[name="repeat-days"]').forEach(cb => {
            cb.checked = repeatDaysArr.includes(parseInt(cb.value));
        });
    }

    function deleteEntry(id) {
        const entry = schedules.find(item => item.id === id);
        if (!entry) return;

        if (localUserIdentity && entry.name.toLowerCase() !== localUserIdentity.toLowerCase()) {
            alert("Action Denied! You cannot delete other people's schedule entries.");
            return;
        }

        const roomData = JSON.parse(localStorage.getItem(currentRoomId));
        if (roomData && roomData.schedules) {
            delete roomData.schedules[id];
            localStorage.setItem(currentRoomId, JSON.stringify(roomData));
            loadLocalSchedules();
        }
    }

    document.getElementById('cancel-edit-btn').addEventListener('click', resetForm);

    function resetForm() {
        form.reset();
        editIdInput.value = '';
        document.getElementById('form-title').innerText = "Add Your Availability";
        document.getElementById('submit-btn').innerText = "Add to Calendar";
        document.getElementById('cancel-edit-btn').classList.add('hidden');
        timeInputsDiv.classList.add('hidden');
        manageIdentityUI();
    }

    function expandSchedules() {
        let expanded = [];
        schedules.forEach(entry => {
            expanded.push(entry);
            let repeatDaysArr = entry.repeatDays || [];
            if (repeatDaysArr.length > 0) {
                let currentPointer = new Date(entry.date + 'T00:00:00');
                for (let i = 1; i <= 28; i++) {
                    currentPointer.setDate(currentPointer.getDate() + 1);
                    if (repeatDaysArr.includes(currentPointer.getDay())) {
                        expanded.push({ ...entry, date: currentPointer.toISOString().split('T')[0] });
                    }
                }
            }
        });
        return expanded;
    }

    findHangoutBtn.addEventListener('click', function() {
        const allEvents = expandSchedules();
        if (allEvents.length === 0) {
            hangoutResults.innerHTML = "No schedules recorded yet!";
            return;
        }
        const dateMap = {};
        allEvents.forEach(entry => {
            if (!dateMap[entry.date]) dateMap[entry.date] = [];
            dateMap[entry.date].push(entry);
        });
        
        let bestDays = [];
        for (const [date, entries] of Object.entries(dateMap)) {
            let fullDayConflict = entries.some(e => e.status === 'Working' && (!e.clockIn || !e.clockOut));
            const uniquePeople = new Set(entries.map(e => e.name)).size;
            
            if (!fullDayConflict && uniquePeople > 1) {
                let shiftsText = entries.filter(e => e.clockIn && e.clockOut).map(e => `${e.name} works ${e.clockIn}-${e.clockOut}`).join(', ');
                let suffix = shiftsText ? ` <span style="font-size:12px; color:#555;"><br>&nbsp;&nbsp;↳ (${shiftsText})</span>` : '';
                bestDays.push(`• <strong>${date}</strong>${suffix}`);
            }
        }
        if (bestDays.length > 0) {
            bestDays.sort();
            hangoutResults.innerHTML = `🎉 <strong>Great days to hang out:</strong><br><br>${bestDays.slice(0, 7).join('<br>')}`;
        } else {
            hangoutResults.innerHTML = `😢 No matches found. Try editing entries to open up matching dates!`;
        }
    });
});