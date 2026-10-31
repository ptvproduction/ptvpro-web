const CONFIG = window.PTV_ADMIN_CONFIG;
window.TASK_DATES = CONFIG.taskDates;
window.CALENDAR_DETAILS = CONFIG.calendarDetails;
const CAN_MANAGE_TASKS = CONFIG.canManageTasks; // Cek untuk eksekutif/pengawas
const CURRENT_USER_ROLE = CONFIG.currentUserRole;
window.PORTO_KRU_MAP = CONFIG.portoKruMap;
const CURRENT_USER = CONFIG.currentUser;

let isTaskProcessing = false;
let activeKruName = "";
let activeTaskId = "";
let activeTaskDOM = null;
let activeCalSystem = 'masehi'; 

// DYNAMIC ACF CONFIGURATION
const ACF_CONFIG = {
    'acara_ptv': [
        { id: 'acf_acara_start', name: 'ptv_acara_start', label: 'Tanggal Mulai', type: 'date' },
        { id: 'acf_acara_end', name: 'ptv_acara_end', label: 'Tanggal Selesai (Opsional)', type: 'date' },
        { id: 'acf_acara_link_detail', name: 'ptv_acara_link_detail', label: 'Link Detail / Event (Opsional)', type: 'url' },
        { id: 'acf_acara_link_recap', name: 'ptv_acara_link_recap', label: 'Link Rekap (YouTube) (Opsional)', type: 'url' },
        { id: 'acf_acara_series', name: 'ptv_acara_series', label: 'Nama Series (Opsional)', type: 'series_datalist' },
        { id: 'acf_url_poster', name: 'ptv_url_poster', label: 'URL Image', type: 'image_upload' }
    ],
    'aset_ptv': [
        { id: 'acf_aset_desc', name: 'ptv_aset_desc', label: 'Deskripsi', type: 'text' },
        { id: 'acf_aset_url', name: 'ptv_aset_url', label: 'URL File/Folder (Opsional)', type: 'text' },
        { id: 'acf_aset_gambar', name: 'ptv_aset_gambar', label: 'Gambar Layout Besar', type: 'image_upload' },
        { id: 'acf_aset_kategori', name: 'ptv_aset_kategori', label: 'Kategori', type: 'select', options: ['Tokoh', 'Logo', 'File PDF', 'Tempat'] },
        { id: 'acf_aset_subkategori', name: 'ptv_aset_subkategori', label: 'SubKategori', type: 'subcat_datalist' }
    ],
    'galeri_ptv': [
        { id: 'acf_galeri_lokasi', name: 'ptv_galeri_lokasi', label: 'Lokasi Event', type: 'text' },
        { id: 'acf_galeri_foto', name: 'ptv_galeri_foto', label: 'URL Foto (Google Drive / Eksternal)', type: 'image_upload' }
    ],
    'kru_ptv': [
        { id: 'acf_kru_jabatan', name: 'ptv_kru_jabatan', label: 'Posisi / Jabatan', type: 'text' },
        { id: 'acf_kru_divisi', name: 'ptv_kru_divisi', label: 'Divisi', type: 'select', options: ['Layouter/Motion Design', 'Motion Design', 'Video Editor', 'Fotografer', 'Programmer & 3D', 'Technical', 'Content Creator'] },
        { id: 'acf_kru_angkatan', name: 'ptv_kru_angkatan', label: 'Tahun Angkatan', type: 'number' },
        { id: 'acf_kru_nohp', name: 'ptv_kru_nohp', label: 'No WhatsApp', type: 'text' },
        { id: 'acf_kru_status', name: 'ptv_kru_status', label: 'Status Aktif', type: 'select', options: ['Aktif', 'Alumni', 'Non-Aktif'] }
    ],
    'quote_ptv': [
        { id: 'acf_quote_tokoh', name: 'ptv_quote_tokoh', label: 'Nama Tokoh', type: 'text' }
    ],
    'tayangan_ptv': [
        { id: 'acf_tayang_kategori', name: 'ptv_tayang_kategori', label: 'Kategori', type: 'text' },
        { id: 'acf_tayang_url', name: 'ptv_tayang_url', label: 'Link Youtube', type: 'url' },
        { id: 'acf_tayang_gambar', name: 'ptv_tayang_gambar', label: 'Gambar Thumbnail', type: 'image_upload' }
    ],
    'karya_ptv': [
        { id: 'acf_karya_tipe', name: 'ptv_karya_tipe', label: 'Tipe Karya', type: 'select', options: ['Bumper', 'Video', 'Dokumenter', 'Reel', 'Desain Feed', 'E-Book'] },
        { id: 'acf_karya_url', name: 'ptv_karya_url', label: 'Link URL (YouTube/IG/TikTok)', type: 'url' },
        { id: 'acf_karya_gambar', name: 'ptv_karya_gambar', label: 'Gambar Thumbnail / Poster', type: 'image_upload' }
    ]
};

function initAutoResize() {
    document.querySelectorAll('.auto-resize-ta').forEach(ta => {
        ta.addEventListener('input', function() {
            this.style.height = 'auto';
            this.style.height = (this.scrollHeight) + 'px';
        });
    });
}

function triggerAutoResize(taId) {
    setTimeout(() => {
        const ta = document.getElementById(taId);
        if(ta) { ta.style.height = 'auto'; ta.style.height = (ta.scrollHeight) + 'px'; }
    }, 10);
}

function showToast(msg, type = "success") {
    // Notification toast completely disabled
    return;
}

window.dismissDashAnn = function() {
    const banner = document.getElementById('dashAnnBanner');
    if (banner) {
        banner.style.display = 'none';
        const annId = banner.getAttribute('data-id');
        if (annId) {
            localStorage.setItem('ptv_dismissed_ann', annId);
        }
    }
};

window.requestNativeNotif = function() {
    if (!("Notification" in window)) {
        showToast("Browser ini tidak mendukung Push Web Notification.", "error");
        return;
    }
    if (Notification.permission === "granted") {
        showToast("Push Web sudah aktif! Mengirim notifikasi tes...", "success");
        let testPush = new Notification("Progresif TV", { 
            body: "Mantap! Push Web Notification berhasil masuk ke sistem laptopmu.", 
            icon: "/wp-content/uploads/LOGO-NON-RESMI.webp" 
        });
        testPush.onclick = function() { window.focus(); this.close(); };
    } else if (Notification.permission !== "denied") {
        Notification.requestPermission().then(permission => {
            if (permission === "granted") {
                showToast("Izin Push Web diberikan!", "success");
            } else {
                showToast("Izin Push Web ditolak/diblokir browser.", "error");
            }
        });
    } else {
        showToast("Push Web diblokir. Klik icon gembok sebelah URL untuk membuka blokir.", "error");
    }
};

function checkPushNotifications(tasks) {
    if (!("Notification" in window) || Notification.permission !== "granted") return;
    
    let notifiedIds = JSON.parse(localStorage.getItem('ptv_notified_tasks_urgent') || '[]');
    let hasNewNotification = false;

    tasks.forEach(t => {
        // Hanya notify untuk tugas Mendesak (Merah) atau Tugas Pribadi yang belum selesai/menunggu
        if ((t.prioritas === 'tb-red' || t.tipe === 'pribadi') && (t.status === '0' || !t.status)) {
            if (t.tipe === 'pribadi' && t.assignee !== activeKruName) return; // Ignore jika bukan milik kita
            
            if (!notifiedIds.includes(t.id)) {
                let notifType = t.prioritas === 'tb-red' ? '🚨 Tugas Mendesak Baru!' : '🎯 Tugas Pribadi Baru!';
                let push = new Notification(notifType, {
                    body: t.title,
                    icon: "/wp-content/uploads/LOGO-NON-RESMI.webp"
                });
                push.onclick = function() { window.focus(); this.close(); };
                
                notifiedIds.push(t.id);
                hasNewNotification = true;
            }
        }
    });

    if (hasNewNotification) {
        if (notifiedIds.length > 50) notifiedIds = notifiedIds.slice(notifiedIds.length - 50);
        localStorage.setItem('ptv_notified_tasks_urgent', JSON.stringify(notifiedIds));
    }
}

function closeModals() {
    const claimModal = document.getElementById('claimModal');
    if (claimModal) claimModal.classList.remove('active');
    const doneModal = document.getElementById('doneModal');
    if (doneModal) doneModal.classList.remove('active');
    const uncheckModal = document.getElementById('uncheckModal');
    if (uncheckModal) uncheckModal.classList.remove('active');
    const proofModal = document.getElementById('proofModal');
    if (proofModal) proofModal.classList.remove('active');
    const revisiModal = document.getElementById('revisiModal');
    if (revisiModal) revisiModal.classList.remove('active');
    
    // Reset checkbox UI if uncheck was cancelled
    if(activeTaskDOM) {
        const chk = activeTaskDOM.querySelector('.task-chk');
        if (chk && activeTaskDOM.classList.contains('is-done')) {
            chk.checked = true;
        } else if (chk && activeTaskDOM.classList.contains('is-waiting')) {
            chk.checked = true; // Stay checked since it's waiting
        }
    }
}

function closeTaskCalModal() {
    document.getElementById('taskCalModal').classList.remove('active');
}

window.openTaskModal = function() {
    document.getElementById('taskEditorModal').classList.add('active');
}
window.closeTaskModal = function() {
    document.getElementById('taskEditorModal').classList.remove('active');
    resetTaskForm();
}
window.openContentModal = function() {
    document.getElementById('contentEditorModal').classList.add('active');
}
window.closeContentModal = function() {
    document.getElementById('contentEditorModal').classList.remove('active');
    resetContentForm();
}

window.showProofModal = function(id, title, kru, date, type, imgUrl, locText) {
    activeTaskId = id;
    document.getElementById('pmTitle').innerText = title;
    document.getElementById('pmKru').innerHTML = '<i class="fa-solid fa-user-check" style="color:#10b981;"></i> ' + kru;
    document.getElementById('pmDate').innerHTML = '<i class="fa-regular fa-calendar"></i> ' + date;
    document.getElementById('pmType').innerHTML = '<i class="fa-solid fa-tag"></i> ' + type;
    
    const imgEl = document.getElementById('pmImg');
    if(imgUrl) {
        imgEl.src = imgUrl;
        imgEl.style.display = 'block';
    } else {
        imgEl.style.display = 'none';
    }
    imgEl.onerror = () => { imgEl.src = '/wp-content/uploads/LOGO-NON-RESMI.webp'; };

    const locEl = document.getElementById('pmLoc');
    if(locText && locText.trim() !== '') {
        locEl.innerHTML = `<strong><i class="fa-solid fa-folder-open"></i> Lokasi File:</strong> ${locText}`;
        locEl.style.display = 'block';
    } else {
        locEl.style.display = 'none';
    }
    
    const actionWrap = document.getElementById('pmActions');
    // Tampilkan tombol ACC/Revisi jika status Menunggu ACC dan user adalah Eksekutif/Pengawas
    if(type === 'Menunggu ACC' && CAN_MANAGE_TASKS) {
        actionWrap.style.display = 'flex';
    } else {
        actionWrap.style.display = 'none';
    }
    
    document.getElementById('proofModal').classList.add('active');
};

window.accTask = function() {
    if(!activeTaskId || !CURRENT_USER) return;
    
    const btn = event.currentTarget;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Memproses...';
    
    const fd = new FormData();
    fd.append('action', 'ptv_toggle_task');
    fd.append('task_id', activeTaskId);
    fd.append('action_type', 'acc');
    fd.append('acced_by', CURRENT_USER);

    fetch(CONFIG.ajaxUrl, { method: 'POST', body: fd })
    .then(res => res.json())
    .then(data => {
        if(data.success) {
            showToast("Tugas di-ACC!", "success");
            setTimeout(() => window.location.reload(), 1000);
        } else {
            showToast("Gagal ACC", "error");
            btn.innerHTML = '<i class="fa-solid fa-check"></i> ACC (Selesai)';
        }
    });
};

window.openRevisiModal = function() {
    closeModals();
    document.getElementById('revisiNote').value = '';
    document.getElementById('revisiModal').classList.add('active');
};

window.submitRevisi = function() {
    if(!activeTaskId) return;
    const note = document.getElementById('revisiNote').value;
    if(!note) { showToast("Alasan revisi wajib diisi!", "error"); return; }
    
    const btn = document.getElementById('btnSubmitRevisi');
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Mengirim...';
    
    const fd = new FormData();
    fd.append('action', 'ptv_toggle_task');
    fd.append('task_id', activeTaskId);
    fd.append('action_type', 'revisi');
    fd.append('revisi_note', note);

    fetch(CONFIG.ajaxUrl, { method: 'POST', body: fd })
    .then(res => res.json())
    .then(data => {
        if(data.success) {
            showToast("Permintaan Revisi Dikirim!", "success");
            setTimeout(() => window.location.reload(), 1000);
        } else {
            showToast("Gagal mengirim revisi", "error");
            btn.innerHTML = 'Kirim Revisi';
        }
    });
};

window.submitPengumuman = async function(e) {
    e.preventDefault();
    const btn = document.getElementById('btnSubmitAnn');
    const title = document.getElementById('annTitle').value;
    const desc = document.getElementById('annDesc').value;
    const imgUrl = document.getElementById('annImgUrl').value;
    
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Menyiarkan...';
    btn.disabled = true;

    const fd = new FormData();
    fd.append('action', 'ptv_create_post_frontend');
    fd.append('post_type', 'pengumuman_ptv');
    fd.append('title', title);
    fd.append('desc', desc);
    fd.append('attach_id', 0);
    fd.append('force_single', 'yes');
    
    let acfData = {};
    if (imgUrl) { acfData['ptv_ann_image'] = imgUrl; }
    fd.append('acf_data', JSON.stringify(acfData));

    try {
        const res = await fetch(CONFIG.ajaxUrl, { method: 'POST', body: fd });
        const data = await res.json();
        if(data.success) {
            showToast("Pengumuman berhasil disiarkan!", "success");
            setTimeout(() => window.location.reload(), 1000);
        } else {
            showToast("Gagal menyiarkan pengumuman.", "error");
        }
    } catch(err) {
        showToast("Koneksi gagal.", "error");
    } finally {
        btn.innerHTML = '<i class="fa-solid fa-paper-plane"></i> Siarkan Pengumuman';
        btn.disabled = false;
    }
};

window.showTaskDetails = function(dateKey) {
    const modal = document.getElementById('taskCalModal');
    const dateEl = document.getElementById('taskCalDate');
    const listEl = document.getElementById('taskCalList');

    if (!modal || !dateEl || !listEl) return;

    const details = window.CALENDAR_DETAILS[dateKey] || [];

    try {
        const [y, m, d] = dateKey.split('-');
        const dateObj = new Date(y, m-1, d);
        const masehiFormat = new Intl.DateTimeFormat('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(dateObj);
        dateEl.innerText = masehiFormat;
    } catch(e) {
        dateEl.innerText = dateKey;
    }

    listEl.innerHTML = '';
    if (details.length === 0) {
        listEl.innerHTML = '<p style="color:#64748b; font-size:13px; text-align:center;">Tidak ada agenda di tanggal ini.</p>';
    } else {
        details.forEach(item => {
            let statusClass = 'pending';
            let icon = '<i class="fa-regular fa-circle" style="color:#f59e0b;"></i>';
            if (item.status === '1') { statusClass = 'done'; icon = '<i class="fa-solid fa-check-circle" style="color:#10b981;"></i>'; }
            else if (item.status === '2') { statusClass = 'waiting'; icon = '<i class="fa-solid fa-clock" style="color:#d97706;"></i>'; }
            
            let typeColor = 'background: rgba(14, 79, 64, 0.1); color: #0e4f40;'; 
            if (item.type === 'Bulanan') typeColor = 'background: rgba(217, 119, 6, 0.1); color: #d97706;'; 
            if (item.type === 'Agenda Acara') typeColor = 'background: rgba(220, 38, 38, 0.1); color: #dc2626;'; 
            if (item.type === 'Harian') typeColor = 'background: rgba(14, 165, 233, 0.1); color: #0284c7;'; 
            
            listEl.innerHTML += `
                <div class="mtl-item ${statusClass}">
                    <div class="mtl-title" style="display:flex; gap:8px; align-items:flex-start;">
                        <span style="flex-shrink:0; margin-top:2px;">${icon}</span>
                        <span>${item.title}</span>
                    </div>
                    <div class="mtl-meta" style="margin-left:24px; margin-top:5px;">
                        <span class="mtl-badge" style="${typeColor}">${item.type}</span>
                        <span style="font-size:11px; color:#64748b; font-weight:700;"><i class="fa-solid fa-thumbtack"></i> ${item.event_type}</span>
                    </div>
                </div>
            `;
        });
    }

    modal.classList.add('active');
};

function applyTaskLogic() {
    let overdueCount = 0;
    let countSaya = 0, countHarian = 0, countBulanan = 0, countEvent = 0;
    let allProcessedTasks = []; // For notification checking

    document.querySelectorAll('.task-item').forEach(item => {
        const tipe = item.getAttribute('data-tipe');
        const assignee = item.getAttribute('data-assignee');
        const claimer = item.getAttribute('data-claimer');
        const isDone = item.classList.contains('is-done');
        const isWaiting = item.classList.contains('is-waiting');
        
        // Push Notification array collection
        allProcessedTasks.push({
            id: item.getAttribute('data-id'),
            title: item.querySelector('h4').innerText,
            prioritas: item.querySelector('.task-badge').classList[1],
            tipe: tipe,
            assignee: assignee,
            status: isDone ? '1' : (isWaiting ? '2' : '0')
        });

        const chk = item.querySelector('.task-chk');
        const btnClaim = item.querySelector('.btn-claim');
        const lockBox = item.querySelector('.claimed-by-other');
        
        if (tipe === 'umum' && !claimer && !isDone && !isWaiting) {
            if(chk) chk.style.display = 'none';
            if(btnClaim) btnClaim.style.display = 'inline-block';
        } else {
            if(chk) chk.style.display = 'inline-block';
            if(btnClaim) btnClaim.style.display = 'none';
        }
        if(lockBox) lockBox.style.display = 'none'; 
        
        const isTabSaya = item.closest('#task-saya') !== null;
        
        if (isTabSaya) {
            if ((tipe === 'pribadi' && assignee === activeKruName) || (tipe === 'umum' && claimer === activeKruName)) {
                item.style.display = 'flex';
                if (!isDone && !isWaiting) countSaya++; 
            } else {
                item.style.display = 'none';
            }
        } else {
            if (tipe === 'pribadi') {
                item.style.display = 'none'; 
            } else if (claimer) {
                item.style.display = 'none'; 
            } else {
                item.style.display = 'flex'; 
                if (!isDone && !isWaiting) {
                    if (item.closest('#task-harian')) countHarian++;
                    else if (item.closest('#task-bulanan')) countBulanan++;
                    else if (item.closest('#task-event')) countEvent++;
                }
            }
        }
    });

    // Cek Push Notification Real-Time
    checkPushNotifications(allProcessedTasks);

    ['saya', 'harian', 'bulanan', 'event'].forEach(tabId => {
        const container = document.getElementById('task-' + tabId);
        if (container) {
            const hasVisible = Array.from(container.querySelectorAll('.task-item')).some(i => i.style.display !== 'none');
            let emptyState = container.querySelector('.empty-state');
            
            if (!emptyState) {
                emptyState = document.createElement('div');
                emptyState.className = 'empty-state';
                emptyState.style.cssText = 'padding:20px; color:#94a3b8; font-size:13px; text-align:center; background:#f8fafc; border:1px dashed #cbd5e1; border-radius:12px; margin-top:10px; font-weight:600;';
                const wrapper = container.querySelector('.event-items-wrapper') || container;
                wrapper.appendChild(emptyState);
            }
            
            emptyState.innerHTML = tabId === 'saya' 
                ? '<i class="fa-solid fa-mug-hot" style="font-size:24px; color:#cbd5e1; display:block; margin-bottom:8px;"></i> Tidak ada tugas pribadimu saat ini.' 
                : '<i class="fa-solid fa-face-grin-stars" style="font-size:24px; color:#cbd5e1; display:block; margin-bottom:8px;"></i> Semua tugas telah diambil atau tak ada tugas aktif.';
            
            emptyState.style.display = hasVisible ? 'none' : 'block';
        }
    });

    const updateBadge = (tabId, count) => {
        const btn = document.querySelector(`.task-tab[onclick*="switchTask('${tabId}')"]`);
        if (btn) {
            let badge = btn.querySelector('.tab-badge');
            if (count > 0) {
                if (!badge) {
                    badge = document.createElement('span');
                    badge.className = 'tab-badge';
                    btn.appendChild(badge);
                }
                badge.innerText = count;
                badge.style.display = 'inline-block';
            } else if (badge) {
                badge.style.display = 'none';
            }
        }
    };
    updateBadge('saya', countSaya);
    updateBadge('harian', countHarian);
    updateBadge('bulanan', countBulanan);
    updateBadge('event', countEvent);

    let totalActive = countSaya + countHarian + countBulanan + countEvent;
    
    const headBadge = document.getElementById('headerNotifBadge');
    const headBell = document.getElementById('headerNotifBtn');
    if (headBadge && headBell) {
        if (totalActive > 0) {
            headBadge.innerText = totalActive;
            headBadge.style.display = 'flex';
            headBell.style.color = '#fde047'; 
            headBell.querySelector('i').classList.add('fa-shake');
        } else {
            headBadge.style.display = 'none';
            headBell.style.color = '#a7f3d0';
            headBell.querySelector('i').classList.remove('fa-shake');
        }
    }

    if (!window.hasShownWelcomeNotif && activeKruName) {
        if (totalActive > 0) {
            let msgs = [];
            let msgsPlain = [];
            if(countSaya > 0) { msgs.push(`<b>${countSaya}</b> Pribadi`); msgsPlain.push(`${countSaya} Pribadi`); }
            if(countHarian > 0) { msgs.push(`<b>${countHarian}</b> Harian`); msgsPlain.push(`${countHarian} Harian`); }
            if(countBulanan > 0) { msgs.push(`<b>${countBulanan}</b> Bulanan`); msgsPlain.push(`${countBulanan} Bulanan`); }
            if(countEvent > 0) { msgs.push(`<b>${countEvent}</b> Acara`); msgsPlain.push(`${countEvent} Acara`); }
            
            setTimeout(() => {
                showToast(`Semangat! Terdapat ${msgs.join(', ')} menanti.`, 'info');
                
                if ("Notification" in window && Notification.permission === "granted") {
                    let taskPush = new Notification("Command Center PTV", {
                        body: `Semangat ${activeKruName}! Ada ${msgsPlain.join(', ')} yang menantimu hari ini.`,
                        icon: "/wp-content/uploads/LOGO-NON-RESMI.webp"
                    });
                    taskPush.onclick = function() { window.focus(); this.close(); };
                }
            }, 1500);
        } else {
            setTimeout(() => {
                showToast(`Alhamdulillah, tidak ada tugas aktif yang menanti.`, 'success');
            }, 1500);
        }
        window.hasShownWelcomeNotif = true;
    }

    document.querySelectorAll('.alert-item.overdue').forEach(alert => {
        const alertAss = alert.getAttribute('data-alert-assignee');
        if (alertAss === 'Semua Kru PTV' || !alertAss || alertAss === activeKruName) {
            alert.style.display = 'flex';
            overdueCount++;
        } else {
            alert.style.display = 'none';
        }
    });
    
    const abandonedCount = document.querySelectorAll('.alert-item.abandoned').length;
    const overdueBox = document.getElementById('overdueBox');
    if(overdueBox) {
        overdueBox.style.display = (overdueCount > 0 || abandonedCount > 0) ? 'block' : 'none';
    }

    if (typeof renderMyHistory === 'function') renderMyHistory();
}

function renderMyHistory() {
    const historyBox = document.getElementById('myHistoryBox');
    if (!historyBox) return;
    
    // Ganti Judul Rapor jika Role adalah Pengawas
    const historyHeader = historyBox.previousElementSibling;
    if (historyHeader && CURRENT_USER_ROLE === 'pengawas') {
        const titleEl = historyHeader.querySelector('h3');
        if(titleEl) titleEl.innerHTML = '<i class="fa-solid fa-clipboard-check"></i> Riwayat ACC Bulan Ini';
    }

    if (typeof window.KRU_MONTHLY_HISTORY === 'undefined') return;

    // Jika Pengawas, filter khusus ambil yang 'acc_tugas' saja (atau gabung jika dia ambil tugas juga)
    let myHist = window.KRU_MONTHLY_HISTORY[activeKruName] || [];
    
    if (CURRENT_USER_ROLE === 'pengawas') {
        // Pengawas lebih diutamakan melihat raport ACC-nya
        myHist = myHist.filter(item => item.jenis === 'acc_tugas' || item.jenis === 'pribadi' || item.jenis === 'umum' || item.jenis === 'klaim_umum');
    }

    if (myHist.length === 0) {
        historyBox.innerHTML = '<p style="color:#64748b; font-size:13px; margin:0; text-align:center;">Belum ada tugas/ACC yang tercatat bulan ini.</p>';
    } else {
        let h = '<div style="display:flex; flex-direction:column; gap:10px;">';
        myHist.forEach(item => {
            let badgeTambahan = '';
            if(item.jenis === 'klaim_umum') badgeTambahan = '<span style="font-size:9px; background:#e0e7ff; color:#4f46e5; padding:2px 6px; border-radius:4px; margin-left:6px; font-weight:800; vertical-align:middle;">KLAIM INISIATIF</span>';
            if(item.jenis === 'acc_tugas') badgeTambahan = '<span style="font-size:9px; background:#fef3c7; color:#d97706; padding:2px 6px; border-radius:4px; margin-left:6px; font-weight:800; vertical-align:middle;">TUGAS DI-ACC</span>';

            if (item.is_overdue) {
                h += `<div style="display:flex; justify-content:space-between; align-items:center; padding:16px; background:#fef2f2; border:1px solid #fca5a5; border-radius:16px;">
                        <span style="font-size:14px; font-weight:700; color:#991b1b;"><i class="fa-solid fa-triangle-exclamation"></i> Gagal: ${item.title}</span> 
                        <span style="font-size:11px; background:rgba(239,68,68,0.1); color:#ef4444; padding:4px 10px; border-radius:50px; font-weight:800;">Terlewat</span>
                      </div>`;
            } else {
                h += `<div style="display:flex; justify-content:space-between; align-items:center; padding:16px; background:#fff; border:1px solid var(--admin-border); border-radius:16px;">
                        <span style="font-size:14px; font-weight:700; color:#1e293b;">${item.title}${badgeTambahan}</span> 
                        <span style="font-size:11px; background:rgba(16,185,129,0.1); color:#10b981; padding:4px 10px; border-radius:50px; font-weight:800;"><i class="fa-solid fa-check"></i> ${item.date}</span>
                      </div>`;
            }
        });
        h += '</div>';
        historyBox.innerHTML = h;
    }
}

window.closeWelcomeModal = async function() {
    const sel = document.getElementById('welcomeKruSelect');
    if (!sel || !sel.value) {
        showToast("Harap pilih nama Anda terlebih dahulu!", "error");
        return;
    }
    
    if ("Notification" in window && Notification.permission !== "granted" && Notification.permission !== "denied") {
        await Notification.requestPermission();
    }

    localStorage.setItem('ptv_active_kru', sel.value);
    activeKruName = sel.value;
    const hdr = document.getElementById('hdrKruName');
    if (hdr) hdr.innerText = activeKruName;
    
    const wm = document.getElementById('welcomeModal');
    if (wm) wm.classList.remove('active');
    applyTaskLogic();
};

window.doLogout = function() {
    localStorage.removeItem('ptv_active_kru');
    window.location.href = '?logout=true';
};

window.switchTask = function(tabId) {
    document.querySelectorAll('.task-tab').forEach(el => {
        el.classList.remove('active');
        el.style.background = 'transparent'; el.style.color = '#64748b';
    });
    document.querySelectorAll('.task-list-group').forEach(el => el.classList.remove('active'));
    
    const targetBtn = event.currentTarget;
    if (targetBtn) {
        targetBtn.classList.add('active');
        if(tabId === 'saya') { targetBtn.style.background = 'var(--ptv-green)'; targetBtn.style.color = '#fff'; }
        else { targetBtn.style.background = '#fff'; targetBtn.style.color = 'var(--ptv-green)'; }
    }
    
    const tabEl = document.getElementById('task-' + tabId);
    if (tabEl) tabEl.classList.add('active');
};

document.querySelectorAll('.es-tab').forEach(tab => {
    tab.addEventListener('click', function() {
        document.querySelectorAll('.es-tab').forEach(t => t.classList.remove('active'));
        this.classList.add('active');
        
        const filter = this.getAttribute('data-filter');
        document.querySelectorAll('.event-items-wrapper .task-item').forEach(item => {
            if (filter === 'all' || item.getAttribute('data-subcat') === filter) {
                item.style.display = 'flex';
            } else {
                item.style.display = 'none';
            }
        });
    });
});

let editPortoPostId = null;
let bentoItems = [];
let editingBoxIndex = -1;

const normalizeString = (str) => {
    return str.toLowerCase().replace(/[^a-z0-9]/g, '').trim();
};

window.openPortoExec = function() {
    const sel = document.getElementById('execPortoSelect');
    if(!sel.value) { showToast('Pilih nama kru dari dropdown dulu!', 'error'); return; }
    const kruName = sel.options[sel.selectedIndex].text;
    initPortoEditor(sel.value, kruName);
};

window.openPortoKru = function() {
    if(!activeKruName) { showToast('Absen identitas nama Anda terlebih dahulu!', 'error'); return; }
    
    let pid = null;
    const targetName = normalizeString(activeKruName);
    for (const [name, id] of Object.entries(window.PORTO_KRU_MAP)) {
        if (normalizeString(name) === targetName) { pid = id; break; }
    }
    
    if(!pid) { showToast('Data Anda tidak ditemukan. Hubungi Admin Eksekutif.', 'error'); return; }
    initPortoEditor(pid, activeKruName);
};

function initPortoEditor(pid, nama) {
    editPortoPostId = pid;
    document.getElementById('epKruName').innerText = nama;
    showToast('Memuat portofolio dari server...', 'info');

    const fd = new FormData();
    fd.append('action', 'ptv_load_bento');
    fd.append('post_id', pid);

    fetch(CONFIG.ajaxUrl, { method: 'POST', body: fd })
    .then(res => res.json())
    .then(res => {
        if(res.success) {
            const d = res.data;
            document.getElementById('epAktif').checked = (d.aktif == '1');
            document.getElementById('epOverview').value = d.overview || '';
            try { bentoItems = JSON.parse(d.bento_json || '[]'); } catch(e) { bentoItems = []; }
            renderBentoEditorGrid();
            document.getElementById('editorPortoModal').classList.add('active');
            triggerAutoResize('epOverview');
        } else {
            showToast(res.data, 'error');
        }
    }).catch(e => showToast('Koneksi ke server Gagal!', 'error'));
}

window.closePortoEditor = function() { document.getElementById('editorPortoModal').classList.remove('active'); }

function renderBentoEditorGrid() {
    const grid = document.getElementById('epBentoPreview');
    grid.innerHTML = '';
    if(bentoItems.length === 0) {
        grid.innerHTML = '<div class="span-full" style="text-align:center; padding:60px; color:#94a3b8; font-weight:600; background:#f8fafc; border-radius:24px;"><i class="fa-solid fa-ghost" style="font-size:40px; opacity:0.3; margin-bottom:15px; display:block;"></i> Belum ada karya. Klik "Tambah Kotak".</div>';
        return;
    }
    
    bentoItems.forEach((item, idx) => {
        let iconMap = { text: 'fa-align-left', image: 'fa-image', link: 'fa-link', youtube: 'fa-youtube' };
        let icon = item.icon || iconMap[item.type] || 'fa-box';
        let safeTitle = (item.title && item.title.trim() !== '') ? item.title : '';
        let safeContent = (item.content && item.content.trim() !== '') ? item.content : '';
        
        let bgColor = item.color || '#ffffff';
        let textColor = item.textColor || '#1e293b'; 
        if(item.type === 'link' && !item.color) bgColor = 'var(--ptv-green)';
        if(item.type === 'link' && !item.textColor) textColor = '#ffffff';

        let isEmoji = !icon.startsWith('fa-');
        let isBrand = ['fa-instagram', 'fa-youtube', 'fa-tiktok', 'fa-facebook', 'fa-twitter', 'fa-linkedin', 'fa-github', 'fa-whatsapp'].includes(icon);
        let iconClass = isBrand ? 'fa-brands' : 'fa-solid';
        let renderedIcon = isEmoji ? `<span class="b-emoji" style="font-size:24px; line-height:1;">${icon}</span>` : `<i class="${iconClass} ${icon}"></i>`;

        let inlineStyle = `background: ${bgColor}; color: ${textColor}; cursor: grab;`;
        let actionsHtml = `
            <div class="ep-box-actions">
                <button onclick="cycleSize(${idx}); event.stopPropagation();" style="background:#0ea5e9; color:#fff; border:none; border-radius:8px; padding:6px 12px; font-size:11px; font-weight:800; cursor:pointer; box-shadow:0 2px 5px rgba(0,0,0,0.2);"><i class="fa-solid fa-up-right-and-down-left-from-center"></i> Resize</button>
                <button onclick="openBoxEditor(${idx}); event.stopPropagation();" style="background:var(--ptv-gold); color:#111; border:none; border-radius:8px; width:30px; height:30px; cursor:pointer; box-shadow:0 2px 5px rgba(0,0,0,0.2);"><i class="fa-solid fa-pen"></i></button>
                <button onclick="deleteBox(${idx}); event.stopPropagation();" style="background:#ef4444; color:#fff; border:none; border-radius:8px; width:30px; height:30px; cursor:pointer; box-shadow:0 2px 5px rgba(0,0,0,0.2);"><i class="fa-solid fa-trash"></i></button>
            </div>`;

        let innerHtml = '';
        
        if (item.type === 'text') {
            innerHtml = `
                <div class="b-icon-wrap">${renderedIcon}</div>
                <div>
                    <h3>${safeTitle || '<em style="opacity:0.5;">Tanpa Judul</em>'}</h3>
                    <p>${safeContent}</p>
                </div>`;
        } else if (item.type === 'image') {
            innerHtml = `<img src="${item.url}" alt="Preview" onerror="this.src='/wp-content/uploads/LOGO-NON-RESMI.webp'">`;
            inlineStyle = `cursor: grab; padding:0;`;
        } else if (item.type === 'link') {
            innerHtml = `
                <div class="b-icon-wrap">${renderedIcon}</div>
                <div style="margin-top:auto;">
                    <span>${safeTitle || 'Kunjungi Link'}</span>
                </div>`;
        } else if (item.type === 'youtube') {
            innerHtml = `<iframe src="https://www.youtube.com/embed/${item.yt_id}?rel=0" style="pointer-events:none;"></iframe>`;
            inlineStyle = `cursor: grab; padding:0; background:#000;`;
        }

        let html = `
        <div class="b-box type-${item.type} ${item.size} bento-draggable" data-id="${idx}" style="${inlineStyle}">
            ${actionsHtml}
            ${innerHtml}
        </div>`;
        grid.insertAdjacentHTML('beforeend', html);
    });

    new Sortable(grid, {
        animation: 150,
        ghostClass: 'sortable-ghost',
        onEnd: function (evt) {
            const newOrder = [];
            grid.querySelectorAll('.bento-draggable').forEach(el => {
                newOrder.push(bentoItems[el.getAttribute('data-id')]);
            });
            bentoItems = newOrder;
            renderBentoEditorGrid(); 
        }
    });
}

window.cycleSize = function(idx) {
    const sizes = ['span-1', 'span-2', 'span-row-2', 'span-2x2', 'span-full'];
    let currIdx = sizes.indexOf(bentoItems[idx].size);
    let nextIdx = (currIdx + 1) % sizes.length;
    bentoItems[idx].size = sizes[nextIdx];
    renderBentoEditorGrid();
}

window.openBoxEditor = function(index = -1) {
    editingBoxIndex = index;
    if (index === -1) {
        document.getElementById('beType').value = 'text';
        document.getElementById('beSize').value = 'span-1';
        document.getElementById('beTitle').value = '';
        document.getElementById('beContent').value = '';
        document.getElementById('beImage').value = '';
        document.getElementById('beUrl').value = '';
        document.getElementById('beIcon').value = 'fa-link';
        document.getElementById('beColor').value = '#ffffff';
        document.getElementById('beTextColor').value = '#1e293b';
        document.getElementById('beYt').value = '';
    } else {
        let it = bentoItems[index];
        document.getElementById('beType').value = it.type || 'text';
        document.getElementById('beSize').value = it.size || 'span-1';
        document.getElementById('beTitle').value = it.title || '';
        document.getElementById('beContent').value = it.content || '';
        document.getElementById('beImage').value = it.url || ''; 
        document.getElementById('beUrl').value = it.url || '';
        document.getElementById('beIcon').value = it.icon || 'fa-link';
        document.getElementById('beColor').value = it.color || (it.type==='link' ? '#0e4f40' : '#ffffff');
        document.getElementById('beTextColor').value = it.textColor || (it.type==='link' ? '#ffffff' : '#1e293b');
        document.getElementById('beYt').value = it.yt_id || '';
    }
    toggleBoxFields();
    document.getElementById('boxEditorModal').classList.add('active');
    triggerAutoResize('beContent'); 
}

window.closeBoxEditor = function() { document.getElementById('boxEditorModal').classList.remove('active'); }

window.toggleBoxFields = function() {
    const t = document.getElementById('beType').value;
    document.getElementById('fieldTitle').style.display = (t === 'text' || t === 'link') ? 'block' : 'none';
    document.getElementById('fieldContent').style.display = (t === 'text') ? 'block' : 'none';
    document.getElementById('fieldImage').style.display = (t === 'image') ? 'block' : 'none';
    document.getElementById('fieldUrl').style.display = (t === 'link') ? 'block' : 'none';
    document.getElementById('fieldIcon').style.display = (t === 'link' || t === 'text') ? 'block' : 'none'; 
    document.getElementById('fieldColor').style.display = (t === 'link' || t === 'text') ? 'block' : 'none';
    document.getElementById('fieldColorText').style.display = (t === 'link' || t === 'text') ? 'block' : 'none';
    document.getElementById('fieldYt').style.display = (t === 'youtube') ? 'block' : 'none';
}

window.saveBoxData = function() {
    const t = document.getElementById('beType').value;
    let item = {
        type: t,
        size: document.getElementById('beSize').value,
        title: document.getElementById('beTitle').value,
        content: document.getElementById('beContent').value,
        url: (t === 'image') ? document.getElementById('beImage').value : document.getElementById('beUrl').value,
        icon: document.getElementById('beIcon').value,
        color: document.getElementById('beColor').value,
        textColor: document.getElementById('beTextColor').value,
        yt_id: document.getElementById('beYt').value
    };

    if (editingBoxIndex === -1) bentoItems.push(item);
    else bentoItems[editingBoxIndex] = item;
    
    renderBentoEditorGrid();
    closeBoxEditor();
}

window.deleteBox = function(index) {
    if(confirm('Hapus kotak bento ini?')) { bentoItems.splice(index, 1); renderBentoEditorGrid(); }
}

window.savePortoData = function() {
    const btn = document.getElementById('btnSavePorto');
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Menyimpan...';
    
    const fd = new FormData();
    fd.append('action', 'ptv_save_bento');
    fd.append('post_id', editPortoPostId);
    fd.append('aktif', document.getElementById('epAktif').checked ? '1' : '0');
    fd.append('overview', document.getElementById('epOverview').value);
    fd.append('bento_json', JSON.stringify(bentoItems));

    fetch(CONFIG.ajaxUrl, { method: 'POST', body: fd })
    .then(res => res.json())
    .then(res => {
        if (res.success) {
            showToast('Portofolio tersimpan di Server!', 'success');
            setTimeout(closePortoEditor, 1000);
        } else {
            showToast(res.data, 'error');
        }
        btn.innerHTML = '<i class="fa-solid fa-cloud-arrow-up"></i> Simpan Portofolio';
    }).catch(e => {
        showToast('Gagal memanggil server.', 'error');
        btn.innerHTML = '<i class="fa-solid fa-cloud-arrow-up"></i> Simpan Portofolio';
    });
}

window.sharePortoAdmin = function() {
    const kruName = document.getElementById('epKruName').innerText;
    const slug = kruName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
    const shareUrl = CONFIG.shareUrlBase + slug;
    
    const btn = document.getElementById('btnShareAdmin');
    
    navigator.clipboard.writeText(shareUrl).then(() => {
        btn.innerHTML = '<i class="fa-solid fa-check"></i> Link Tersalin!';
        btn.style.background = 'var(--ptv-green)';
        btn.style.color = '#fff';
        showToast("Link berhasil disalin!", "success");
        setTimeout(() => {
            btn.innerHTML = '<i class="fa-solid fa-link"></i> Salin Link Portofolio';
            btn.style.background = 'rgba(14,79,64,0.1)';
            btn.style.color = 'var(--ptv-green)';
        }, 2500);
    }).catch(err => {
        const ta = document.createElement("textarea");
        ta.value = shareUrl;
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
        showToast("Link berhasil disalin!", "success");
    });
}

async function uploadMediaFile(file) {
    const fd = new FormData();
    fd.append('action', 'ptv_upload_media');
    fd.append('file', file);
    const res = await fetch(CONFIG.ajaxUrl, { method: 'POST', body: fd });
    const data = await res.json();
    if(data.success) return data.data; 
    throw new Error(data.data);
}

// =========================================================
// FITUR KONTEN MANAJER DINAMIS (CRUD LIST)
// =========================================================
let sortContent = 'desc';
let globalContentData = [];

window.toggleSortContent = function() {
    sortContent = sortContent === 'desc' ? 'asc' : 'desc';
    const btn = document.getElementById('btnSortContent');
    btn.innerHTML = sortContent === 'desc' ? '<i class="fa-solid fa-arrow-down-short-wide"></i> Terbaru' : '<i class="fa-solid fa-arrow-up-wide-short"></i> Terlama';
    renderContentList();
}

function renderContentList() {
    const listArea = document.getElementById('contentListArea');
    if (globalContentData.length === 0) {
        listArea.innerHTML = '<div style="padding:20px; text-align:center; background:#f1f5f9; border:1px dashed #cbd5e1; border-radius:12px; color:#94a3b8; font-size:13px; font-weight:700;"><i class="fa-solid fa-ghost" style="display:block; font-size:20px; margin-bottom:5px; opacity:0.5;"></i> Belum ada konten.</div>';
        return;
    }

    let dataToRender = [...globalContentData];
    if (sortContent === 'asc') dataToRender.reverse();

    let html = '';
    dataToRender.forEach(item => {
        html += `
        <div style="display:flex; justify-content:space-between; align-items:flex-start; padding:15px; background:#fff; border:1px solid var(--admin-border); border-radius:14px; margin-bottom:10px; transition:0.2s; box-shadow:0 2px 5px rgba(0,0,0,0.02);">
            <div style="flex-grow:1; min-width:0; padding-right:15px;">
                <strong style="display:block; font-size:14px; color:#1e293b; margin-bottom:6px; white-space: normal; line-height: 1.4; word-wrap: break-word;">${item.title}</strong>
                <span style="font-size:11px; color:#64748b; font-weight:700; background:#f1f5f9; padding:4px 8px; border-radius:6px;"><i class="fa-regular fa-calendar"></i> ${item.date}</span>
            </div>
            <div style="display:flex; gap:6px; flex-shrink:0;">
                <button type="button" onclick="editContentItem(${item.id})" style="background:#e0f2fe; color:#0284c7; border:none; padding:8px 10px; border-radius:8px; cursor:pointer; transition:0.2s;" title="Edit Data"><i class="fa-solid fa-pen"></i></button>
                <button type="button" onclick="deleteContentItem(${item.id})" style="background:#fee2e2; color:#ef4444; border:none; padding:8px 10px; border-radius:8px; cursor:pointer; transition:0.2s;" title="Hapus Permanen"><i class="fa-solid fa-trash"></i></button>
            </div>
        </div>`;
    });
    listArea.innerHTML = html;
}

window.toggleContentFields = function() {
    const type = document.getElementById('ccType').value;
    const container = document.getElementById('dynamicAcfContainer');
    container.innerHTML = ''; 

    const lblTitle = document.getElementById('lblCcTitle');
    if (type === 'quote_ptv') lblTitle.innerText = "Isi Kutipan / Quotes";
    else lblTitle.innerText = "Judul Konten";

    const fields = ACF_CONFIG[type] || [];
    fields.forEach(field => {
        let inputHtml = '';
        let requiredAttr = field.label.includes('Opsional') ? '' : 'required';

        if (field.type === 'select') {
            let optionsHtml = field.options.map(opt => `<option value="${opt}">${opt}</option>`).join('');
            inputHtml = `<select id="${field.id}" data-meta="${field.name}" ${requiredAttr} class="form-control">${optionsHtml}</select>`;
        } else if (field.type === 'series_datalist') {
            let optionsHtml = '';
            if (CONFIG.existingSeries && CONFIG.existingSeries.length > 0) {
                CONFIG.existingSeries.forEach(s => optionsHtml += `<option value="${s}">`);
            }
            inputHtml = `
                <input type="text" id="${field.id}" data-meta="${field.name}" placeholder="Pilih atau ketik nama series..." list="list_series_${field.id}" ${requiredAttr} style="width: 100%; padding: 14px; border-radius: 12px; border: 1px solid #cbd5e1; font-family: inherit; font-size: 14px; font-weight: 600; box-sizing: border-box; outline: none; background: #f8fafc;">
                <datalist id="list_series_${field.id}">
                    ${optionsHtml}
                </datalist>
            `;
        } else if (field.type === 'subcat_datalist') {
            let optionsHtml = '';
            if (CONFIG.existingSubkategori && CONFIG.existingSubkategori.length > 0) {
                CONFIG.existingSubkategori.forEach(s => optionsHtml += `<option value="${s}">`);
            }
            inputHtml = `
                <input type="text" id="${field.id}" data-meta="${field.name}" placeholder="Pilih atau ketik subkategori baru..." list="list_subcat_${field.id}" ${requiredAttr} style="width: 100%; padding: 14px; border-radius: 12px; border: 1px solid #cbd5e1; font-family: inherit; font-size: 14px; font-weight: 600; box-sizing: border-box; outline: none; background: #f8fafc;">
                <datalist id="list_subcat_${field.id}">
                    ${optionsHtml}
                </datalist>
            `;
        } else if (field.type === 'image_upload') {
            inputHtml = `
                <div style="display:flex; flex-direction:column; gap:8px;">
                        <div style="position:relative; display:flex; gap:10px;">
                            <input type="text" id="${field.id}" data-meta="${field.name}" placeholder="Pilih Media WP atau paste URL..." class="form-control" style="flex:1;" oninput="checkManualUrl('${field.id}')">
                            <button type="button" onclick="openMediaPicker('${field.id}')" style="background:#0ea5e9; color:#fff; border:none; padding:10px 15px; border-radius:14px; font-weight:800; cursor:pointer; font-size:13px; display:flex; align-items:center; gap:6px;"><i class="fa-regular fa-images"></i> WP Media</button>
                            <span id="badge_${field.id}" style="display:none; position:absolute; right:130px; top:12px; background:#10b981; color:#fff; font-size:11px; padding:4px 8px; border-radius:6px; font-weight:800;"><i class="fa-solid fa-check-circle"></i> Terisi</span>
                    </div>
                    <div style="display:flex; align-items:center; gap:10px;">
                        <input type="file" accept="image/webp" onchange="uploadDynamicImage(event, '${field.id}')" style="flex:1; padding: 10px; border: 1.5 dashed #cbd5e1; border-radius: 12px; background: #fff; cursor:pointer; font-family: inherit; font-size: 13px;" ${requiredAttr}>
                        <span id="loader_${field.id}" style="display:none; font-size:12px; color:#0ea5e9; font-weight:800;"><i class="fa-solid fa-spinner fa-spin"></i> Mengunggah...</span>
                    </div>
                        <p style="margin:0; font-size:11px; color:#64748b;">*Anda bebas upload baru atau memilih gambar dari WP Media Library.</p>
                </div>`;
        } else {
            inputHtml = `<input type="${field.type}" id="${field.id}" data-meta="${field.name}" placeholder="${field.placeholder || ''}" ${requiredAttr} class="form-control">`;
        }

        const wrap = document.createElement('div');
        wrap.className = 'ep-input-group';
        wrap.innerHTML = `<label>${field.label}</label>${inputHtml}`;
        container.appendChild(wrap);
    });
}

window.uploadDynamicImage = async function(e, targetInputId) {
    const file = e.target.files[0];
    if(!file) return;
    
    if(file.type !== "image/webp") {
        showToast("Hanya format .webp yang diizinkan!", "error");
        e.target.value = '';
        return;
    }

    const loader = document.getElementById('loader_' + targetInputId);
    const targetInput = document.getElementById(targetInputId);
    if(loader) loader.style.display = 'inline-block';
    
    try {
        const uploadRes = await uploadMediaFile(file);
        if(targetInput) {
            targetInput.value = uploadRes.url;
            let badge = document.getElementById('badge_' + targetInputId);
            if(badge) badge.style.display = 'inline-block';
            e.target.removeAttribute('required'); 
        }
        showToast("Gambar berhasil diupload!", "success");
    } catch(err) {
        showToast("Gagal mengupload gambar.", "error");
    } finally {
        if(loader) loader.style.display = 'none';
    }
}

window.resetContentForm = function() {
    document.getElementById('ccPostId').value = '';
    document.getElementById('ccTitle').value = '';
    document.getElementById('ccDesc').value = '';
    const btn = document.getElementById('btnSubmitContent');
    btn.innerHTML = '<i class="fa-solid fa-cloud-arrow-up"></i> Terbitkan Konten';
    document.getElementById('btnCancelEditContent').style.display = 'none';
    document.getElementById('btnDuplicateContent').style.display = 'none';
    toggleContentFields(); 
}

window.duplicateContent = function() {
    document.getElementById('ccPostId').value = '';
    const titleEl = document.getElementById('ccTitle');
    titleEl.value = titleEl.value + ' (Copy)';
    
    const btn = document.getElementById('btnSubmitContent');
    btn.innerHTML = '<i class="fa-solid fa-cloud-arrow-up"></i> Terbitkan Konten';
    
    document.getElementById('btnCancelEditContent').style.display = 'none';
    document.getElementById('btnDuplicateContent').style.display = 'none';
    
    showToast("Mode Duplikat! Silakan sesuaikan data dan terbitkan sebagai konten baru.", "info");
}

window.submitNewContent = async function(e) {
    e.preventDefault();
    const postId = document.getElementById('ccPostId').value;
    const type = document.getElementById('ccType').value;
    const title = document.getElementById('ccTitle').value;
    const desc = document.getElementById('ccDesc').value;

    let acfData = {};
    const dynamicInputs = document.querySelectorAll('#dynamicAcfContainer input, #dynamicAcfContainer select');
    dynamicInputs.forEach(input => {
        const metaKey = input.getAttribute('data-meta');
        if (metaKey) acfData[metaKey] = input.value;
    });

    const btn = document.getElementById('btnSubmitContent');
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Menyimpan...';
    btn.disabled = true;

    try {
        const fd = new FormData();
        fd.append('action', 'ptv_create_post_frontend');
        if (postId) fd.append('post_id', postId);
        fd.append('post_type', type);
        fd.append('title', title);
        fd.append('desc', desc);
        fd.append('attach_id', 0); 
        fd.append('acf_data', JSON.stringify(acfData));

        const res = await fetch(CONFIG.ajaxUrl, { method: 'POST', body: fd });
        const data = await res.json();
        
        if(data.success) {
            showToast(postId ? "Konten berhasil diperbarui!" : "Konten berhasil diterbitkan!", 'success');
            resetContentForm();
            fetchContentList(); 
            closeContentModal();
        } else {
            showToast(data.data, 'error');
        }
    } catch(err) {
        showToast('Terjadi kesalahan saat menyimpan.', 'error');
    } finally {
        btn.innerHTML = postId ? '<i class="fa-solid fa-check"></i> Update Konten' : '<i class="fa-solid fa-cloud-arrow-up"></i> Terbitkan Konten';
        btn.disabled = false;
    }
}

window.fetchContentList = async function() {
    const type = document.getElementById('ccType').value;
    const listArea = document.getElementById('contentListArea');
    const sel = document.getElementById('ccType');
    const typeName = sel.options[sel.selectedIndex].text.replace(/^[^\w\s]+/, ''); 
    
    document.getElementById('txtTypeList').innerText = typeName;
    listArea.innerHTML = '<div style="padding:40px 20px; text-align:center; color:#94a3b8; font-size:13px;"><i class="fa-solid fa-circle-notch fa-spin"></i> Memuat data...</div>';
    
    const fd = new FormData();
    fd.append('action', 'ptv_get_content_list');
    fd.append('post_type', type);
    
    try {
        const res = await fetch(CONFIG.ajaxUrl, {method:'POST', body:fd});
        const data = await res.json();
        if(data.success) {
            globalContentData = data.data;
            renderContentList();
        }
    } catch(e) {
        listArea.innerHTML = '<div style="padding:20px; text-align:center; color:#ef4444; font-weight:700;">Gagal memuat data dari server.</div>';
    }
}

window.editContentItem = async function(id) {
    showToast("Mengambil data...", "info");
    const fd = new FormData();
    fd.append('action', 'ptv_get_single_content');
    fd.append('post_id', id);

    try {
        const res = await fetch(CONFIG.ajaxUrl, {method: 'POST', body: fd});
        const d = await res.json();
        if (d.success) {
            const data = d.data;
            document.getElementById('ccPostId').value = data.id;
            document.getElementById('ccTitle').value = data.title;
            document.getElementById('ccDesc').value = data.desc;
            triggerAutoResize('ccDesc');

            if (data.meta) {
                const dynamicInputs = document.querySelectorAll('#dynamicAcfContainer input, #dynamicAcfContainer select');
                dynamicInputs.forEach(input => {
                    const metaKey = input.getAttribute('data-meta');
                    if (data.meta[metaKey]) {
                        input.value = data.meta[metaKey][0];
                        if (input.id.includes('url_poster') || input.id.includes('gambar') || input.id.includes('foto')) {
                            if(input.value) {
                                let badge = document.getElementById('badge_' + input.id);
                                if (badge) badge.style.display = 'inline-block';
                                let fileInputWrap = input.parentElement.nextElementSibling;
                                if (fileInputWrap) {
                                    let fileInp = fileInputWrap.querySelector('input[type="file"]');
                                    if (fileInp) fileInp.removeAttribute('required');
                                }
                            }
                        }
                    }
                });
            }

            const btn = document.getElementById('btnSubmitContent');
            btn.innerHTML = '<i class="fa-solid fa-check"></i> Update Konten';
            document.getElementById('btnCancelEditContent').style.display = 'inline-block';
            document.getElementById('btnDuplicateContent').style.display = 'inline-block';
            
            openContentModal();
        } else {
            showToast("Gagal mengambil data.", "error");
        }
    } catch(e) {
        showToast("Koneksi Error", "error");
    }
}
    
window.deleteContentItem = async function(id) {
    if(!confirm('Yakin ingin menghapus konten ini selamanya?')) return;
    
    const fd = new FormData();
    fd.append('action', 'ptv_delete_content');
    fd.append('post_id', id);
    
    try {
        const res = await fetch(CONFIG.ajaxUrl, {method:'POST', body:fd});
        const data = await res.json();
        if(data.success) {
            showToast('Konten terhapus!', 'success');
            fetchContentList();
        } else {
            showToast('Gagal hapus', 'error');
        }
    } catch(e) { showToast('Koneksi Error', 'error'); }
}

function hijriToGregorian(hYear, hMonth, hDay) {
    hYear = parseInt(hYear); hMonth = parseInt(hMonth); hDay = parseInt(hDay);
    const jd = Math.floor((11 * hYear + 3) / 30) + 354 * hYear + 30 * hMonth - Math.floor((hMonth - 1) / 2) + hDay + 1948440 - 385;
    let l = jd + 68569;
    let n = Math.floor((4 * l) / 146097);
    l = l - Math.floor((146097 * n + 3) / 4);
    let i = Math.floor((4000 * (l + 1)) / 1461001);
    l = l - Math.floor((1461 * i) / 4) + 31;
    let j = Math.floor((80 * l) / 2447);
    let gDay = l - Math.floor((2447 * j) / 80);
    let l_prime = Math.floor(j / 11);
    let gMonth = j + 2 - 12 * l_prime;
    let gYear = 100 * (n - 49) + i + l_prime;
    return `${gYear}-${String(gMonth).padStart(2, '0')}-${String(gDay).padStart(2, '0')}`;
}

window.switchCalendarSystem = function(sys) {
    activeCalSystem = sys;
    document.getElementById('btnCalMasehi').classList.remove('active');
    document.getElementById('btnCalHijri').classList.remove('active');
    
    if (sys === 'masehi') {
        document.getElementById('btnCalMasehi').classList.add('active');
        document.getElementById('masehiInputs').style.display = 'block';
        document.getElementById('hijriInputs').style.display = 'none';
    } else {
        document.getElementById('btnCalHijri').classList.add('active');
        document.getElementById('masehiInputs').style.display = 'none';
        document.getElementById('hijriInputs').style.display = 'block';
        previewHijri('Mulai');
        previewHijri('Deadline');
    }
}

window.toggleAssigneeField = function() {
    const tipe = document.getElementById('ctTipe').value;
    document.getElementById('wrapAssignee').style.display = (tipe === 'Tugas Pribadi') ? 'block' : 'none';
    document.getElementById('wrapKategori').style.display = (tipe === 'Tugas Umum Tim') ? 'block' : 'none';
}

window.previewHijri = function(type) {
    const d = document.getElementById('ct' + type + 'HD').value;
    const m = document.getElementById('ct' + type + 'HM').value;
    const y = document.getElementById('ct' + type + 'HY').value;
    
    const previewEl = document.getElementById('prev' + type + 'Hijri');
    if(!d || !m || !y) {
        previewEl.style.display = 'none';
        return;
    }
    
    const masehiDate = hijriToGregorian(y, m, d);
    
    const tglObj = new Date(masehiDate);
    const options = { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' };
    const previewTxt = tglObj.toLocaleDateString('id-ID', options);

    previewEl.style.display = 'block';
    previewEl.querySelector('span').innerText = previewTxt;
}

window.resetTaskForm = function() {
    document.getElementById('ctTaskId').value = '';
    document.getElementById('ctTitle').value = '';
    document.getElementById('ctDesc').value = '';
    document.getElementById('ctMulaiMasehi').value = '';
    document.getElementById('ctDeadlineMasehi').value = '';
    const btn = document.getElementById('btnSubmitTask');
    btn.innerHTML = '<i class="fa-solid fa-paper-plane"></i> Publikasikan Tugas';
    const cancelBtn = document.getElementById('btnCancelEditTask');
    if(cancelBtn) cancelBtn.style.display = 'none';
}

window.submitNewTask = function(e) {
    e.preventDefault();
    
    const taskId = document.getElementById('ctTaskId') ? document.getElementById('ctTaskId').value : '';
    const title = document.getElementById('ctTitle').value;
    const desc = document.getElementById('ctDesc').value;
    const tipe = document.getElementById('ctTipe').value;
    const prioritas = document.getElementById('ctPrioritas').value;
    const assignee = document.getElementById('ctAssignee').value;
    const frekuensi = document.getElementById('ctFrekuensi').value;
    const kategori = document.getElementById('ctKategori').value;

    if (tipe === 'Tugas Pribadi' && assignee === '') {
        showToast('Silakan pilih kru (assignee) untuk tugas pribadi!', 'error');
        return;
    }

    let mulai, deadline;

    if (activeCalSystem === 'masehi') {
        mulai = document.getElementById('ctMulaiMasehi').value;
        deadline = document.getElementById('ctDeadlineMasehi').value;
    } else {
        const mHD = document.getElementById('ctMulaiHD').value;
        const mHM = document.getElementById('ctMulaiHM').value;
        const mHY = document.getElementById('ctMulaiHY').value;
        mulai = (mHD && mHM && mHY) ? hijriToGregorian(mHY, mHM, mHD) : '';

        const dHD = document.getElementById('ctDeadlineHD').value;
        const dHM = document.getElementById('ctDeadlineHM').value;
        const dHY = document.getElementById('ctDeadlineHY').value;
        deadline = (dHD && dHM && dHY) ? hijriToGregorian(dHY, dHM, dHD) : '';
    }

    const btn = document.getElementById('btnSubmitTask');
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Memproses...';
    btn.disabled = true;

    const fd = new FormData();
    fd.append('action', 'ptv_create_new_task');
    if (taskId) fd.append('task_id', taskId);
    fd.append('title', title);
    fd.append('desc', desc);
    fd.append('tipe', tipe);
    fd.append('prioritas', prioritas);
    fd.append('assignee', assignee);
    fd.append('frekuensi', frekuensi);
    fd.append('kategori', kategori);
    fd.append('mulai', mulai);
    fd.append('deadline', deadline);

    fetch(CONFIG.ajaxUrl, { method: 'POST', body: fd })
    .then(res => res.json())
    .then(res => {
        if (res.success) {
            showToast(taskId ? "Tugas berhasil diupdate!" : "Tugas diterbitkan!", 'success');
            if (CAN_MANAGE_TASKS && window.fetchAdminTasks) {
                resetTaskForm();
                fetchAdminTasks();
                closeTaskModal();
            } else {
                setTimeout(() => { window.location.reload(); }, 1200);
            }
        } else {
            showToast(res.data, 'error');
            btn.innerHTML = taskId ? '<i class="fa-solid fa-check"></i> Update Tugas' : '<i class="fa-solid fa-paper-plane"></i> Publikasikan Tugas';
            btn.disabled = false;
        }
    }).catch(err => {
        showToast('Koneksi ke server gagal!', 'error');
        btn.innerHTML = taskId ? '<i class="fa-solid fa-check"></i> Update Tugas' : '<i class="fa-solid fa-paper-plane"></i> Publikasikan Tugas';
        btn.disabled = false;
    });
}

// =========================================================
// JS SORTING UNTUK VALIDASI BUKTI
// =========================================================
let sortValidation = 'desc';
window.toggleSortValidation = function() {
    sortValidation = sortValidation === 'desc' ? 'asc' : 'desc';
    const btn = document.getElementById('btnSortValidation');
    btn.innerHTML = sortValidation === 'desc' ? '<i class="fa-solid fa-arrow-down-short-wide"></i> Terbaru' : '<i class="fa-solid fa-arrow-up-wide-short"></i> Terlama';
    
    const container = document.getElementById('validasiListArea');
    if(!container) return;
    const items = Array.from(container.children);
    if (items.length > 1) {
        items.reverse();
        container.innerHTML = '';
        items.forEach(item => container.appendChild(item));
    }
}

// =========================================================
// EXECUTIVE TASK LIST MANAGEMENT (CRUD LIST)
// =========================================================
let sortAdminTasks = 'desc';
let globalAdminTasksData = [];

window.toggleSortAdminTasks = function() {
    sortAdminTasks = sortAdminTasks === 'desc' ? 'asc' : 'desc';
    const btn = document.getElementById('btnSortAdminTasks');
    btn.innerHTML = sortAdminTasks === 'desc' ? '<i class="fa-solid fa-arrow-down-short-wide"></i> Terbaru' : '<i class="fa-solid fa-arrow-up-wide-short"></i> Terlama';
    renderAdminTasks();
}

function renderAdminTasks() {
    const listArea = document.getElementById('adminTaskListArea');
    if (globalAdminTasksData.length === 0) {
        listArea.innerHTML = '<div style="padding:20px; text-align:center; background:#f1f5f9; border:1px dashed #cbd5e1; border-radius:12px; color:#94a3b8; font-size:13px; font-weight:700;"><i class="fa-solid fa-ghost" style="display:block; font-size:20px; margin-bottom:5px; opacity:0.5;"></i> Belum ada tugas aktif.</div>';
        return;
    }

    let dataToRender = [...globalAdminTasksData];
    if (sortAdminTasks === 'asc') dataToRender.reverse();

    let html = '';
    dataToRender.forEach(item => {
        let statusIco = '<i class="fa-regular fa-circle" style="color:#f59e0b;"></i> Aktif';
        if (item.status === '1') statusIco = '<i class="fa-solid fa-check-circle" style="color:#10b981;"></i> Selesai';
        if (item.status === '2') statusIco = '<i class="fa-solid fa-clock" style="color:#d97706;"></i> Menunggu ACC';

        html += `
        <div style="display:flex; justify-content:space-between; align-items:flex-start; padding:15px; background:#fff; border:1px solid var(--admin-border); border-radius:14px; margin-bottom:10px; transition:0.2s; box-shadow:0 2px 5px rgba(0,0,0,0.02);">
            <div style="flex-grow:1; min-width:0; padding-right:15px;">
                <strong style="display:block; font-size:14px; color:#1e293b; margin-bottom:6px; white-space: normal; line-height: 1.4; word-wrap: break-word;">${item.title}</strong>
                <div style="display:flex; gap:6px; flex-wrap:wrap; font-size:11px; color:#64748b; font-weight:700;">
                    <span style="background:#f1f5f9; padding:4px 8px; border-radius:6px;">${statusIco}</span>
                    <span style="background:#f1f5f9; padding:4px 8px; border-radius:6px;"><i class="fa-solid fa-user"></i> ${item.tipe === 'Tugas Pribadi' ? item.assignee : 'Umum'}</span>
                </div>
            </div>
            <div style="display:flex; gap:6px; flex-shrink:0;">
                <button type="button" onclick="editTask(${item.id})" style="background:#e0f2fe; color:#0284c7; border:none; padding:8px 10px; border-radius:8px; cursor:pointer; transition:0.2s;" title="Edit Tugas"><i class="fa-solid fa-pen"></i></button>
                <button type="button" onclick="deleteTask(${item.id})" style="background:#fee2e2; color:#ef4444; border:none; padding:8px 10px; border-radius:8px; cursor:pointer; transition:0.2s;" title="Hapus Tugas"><i class="fa-solid fa-trash"></i></button>
            </div>
        </div>`;
    });
    listArea.innerHTML = html;
}

window.fetchAdminTasks = async function() {
    const listArea = document.getElementById('adminTaskListArea');
    if(!listArea) return;
    listArea.innerHTML = '<div style="padding:40px 20px; text-align:center; color:#94a3b8; font-size:13px;"><i class="fa-solid fa-circle-notch fa-spin"></i> Memuat data tugas...</div>';
    
    const fd = new FormData();
    fd.append('action', 'ptv_get_admin_tasks');
    
    try {
        const res = await fetch(CONFIG.ajaxUrl, {method:'POST', body:fd});
        const data = await res.json();
        if(data.success) {
            globalAdminTasksData = data.data;
            renderAdminTasks();
        }
    } catch(e) {
        listArea.innerHTML = '<div style="padding:20px; text-align:center; color:#ef4444; font-weight:700;">Gagal memuat daftar tugas.</div>';
    }
}

window.editTask = async function(id) {
    showToast("Mengambil data tugas...", "info");
    const fd = new FormData();
    fd.append('action', 'ptv_get_single_task');
    fd.append('task_id', id);

    try {
        const res = await fetch(CONFIG.ajaxUrl, {method: 'POST', body: fd});
        const d = await res.json();
        if (d.success) {
            const data = d.data;
            document.getElementById('ctTaskId').value = data.id;
            document.getElementById('ctTitle').value = data.title;
            document.getElementById('ctDesc').value = data.desc;
            triggerAutoResize('ctDesc');
            
            document.getElementById('ctTipe').value = data.tipe || 'Tugas Umum Tim';
            toggleAssigneeField();
            if (data.assignee) document.getElementById('ctAssignee').value = data.assignee;
            if (data.prioritas) document.getElementById('ctPrioritas').value = data.prioritas;
            if (data.frekuensi) document.getElementById('ctFrekuensi').value = data.frekuensi;
            
            switchCalendarSystem('masehi');
            if (data.mulai) document.getElementById('ctMulaiMasehi').value = data.mulai;
            if (data.deadline) document.getElementById('ctDeadlineMasehi').value = data.deadline;

            const btn = document.getElementById('btnSubmitTask');
            btn.innerHTML = '<i class="fa-solid fa-check"></i> Update Tugas';
            const cancelBtn = document.getElementById('btnCancelEditTask');
            if(cancelBtn) cancelBtn.style.display = 'inline-block';
            
            openTaskModal();
        } else {
            showToast("Gagal mengambil tugas.", "error");
        }
    } catch(e) {
        showToast("Koneksi Error", "error");
    }
}

window.deleteTask = async function(id) {
    if(!confirm('Yakin ingin menghapus tugas ini? Riwayat juga mungkin akan hilang.')) return;
    
    const fd = new FormData();
    fd.append('action', 'ptv_delete_task');
    fd.append('task_id', id);
    
    try {
        const res = await fetch(CONFIG.ajaxUrl, {method:'POST', body:fd});
        const data = await res.json();
        if(data.success) {
            showToast('Tugas dihapus!', 'success');
            fetchAdminTasks();
            setTimeout(() => window.location.reload(), 1500); 
        } else {
            showToast('Gagal hapus', 'error');
        }
    } catch(e) { showToast('Koneksi Error', 'error'); }
}

function updateClock() {
    const now = new Date();
    const cw = document.getElementById('clockWidget');
    if (cw) {
        let timeStr = now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
        cw.innerText = timeStr.replace(/\./g, ':'); 
    }
    
    const mw = document.getElementById('masehiWidgetText');
    if (mw) {
        try {
            const masehiFormat = new Intl.DateTimeFormat('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(now);
            mw.innerText = masehiFormat;
        } catch(e) {
            mw.innerText = now.toDateString();
        }
    }

    const hw = document.getElementById('hijriWidgetText');
    if (hw) {
        try {
            const hijriFormatter = new Intl.DateTimeFormat('id-ID-u-ca-islamic', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(now);
            hw.innerHTML = '<i class="fa-solid fa-moon"></i> ' + hijriFormatter;
        } catch(e) {
            hw.style.display = 'none';
        }
    }
}

setInterval(updateClock, 1000);
updateClock();

function renderCalendar() {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();
    const today = now.getDate();

    const grid = document.getElementById('calendarGrid');
    if(!grid) return;
    grid.innerHTML = '';
    
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    
    const monthNames = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
    document.getElementById('calMasehiMonth').innerText = monthNames[month] + ' ' + year;

    try {
        const hFormatter = new Intl.DateTimeFormat('id-ID-u-ca-islamic', { month: 'long', year: 'numeric' }).format(now);
        document.getElementById('calHijriMonth').innerHTML = '<i class="fa-solid fa-moon"></i> ' + hFormatter;
    } catch(e) {}

    const dayNames = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];
    dayNames.forEach(d => {
        const el = document.createElement('div');
        el.className = 'calendar-day-name';
        el.innerText = d;
        grid.appendChild(el);
    });

    for (let i = 0; i < firstDay; i++) {
        const el = document.createElement('div');
        el.className = 'calendar-date is-empty';
        grid.appendChild(el);
    }

    for (let d = 1; d <= daysInMonth; d++) {
        const el = document.createElement('div');
        el.className = 'calendar-date';
        
        const currDateStr = `${year}-${String(month+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
        const currDayOfWeek = new Date(year, month, d).getDay();
        
        if (currDayOfWeek === 0) el.classList.add('is-sunday');
        if (d === today) el.classList.add('is-today');

        let isTaskDay = false;

        if (window.TASK_DATES && window.TASK_DATES[currDateStr]) {
            isTaskDay = true;
            el.classList.add('is-task-day');
            el.addEventListener('click', () => {
                if (typeof window.showTaskDetails === 'function') window.showTaskDetails(currDateStr);
            });
        } else if (window.CALENDAR_DETAILS && window.CALENDAR_DETAILS[currDateStr]) {
             el.classList.add('is-task-day');
             el.addEventListener('click', () => {
                if (typeof window.showTaskDetails === 'function') window.showTaskDetails(currDateStr);
            });
        }

        let hijriNumStr = '';
        try {
            const dateObj = new Date(year, month, d);
            hijriNumStr = new Intl.DateTimeFormat('id-ID-u-ca-islamic', { day: 'numeric' }).format(dateObj);
        } catch(e) {}

        el.innerHTML = `
            ${d}
            <div class="date-hijri-num">${hijriNumStr}</div>
        `;
        grid.appendChild(el);
    }
}

document.addEventListener("DOMContentLoaded", () => {
    applyTaskLogic();
    renderCalendar();
    toggleContentFields(); 
    fetchContentList();
    if(CAN_MANAGE_TASKS && typeof fetchAdminTasks === 'function') fetchAdminTasks();

    const historySelect = document.getElementById('adminHistorySelect');
    if (historySelect && typeof window.switchAdminHistory === 'function') {
        window.switchAdminHistory(historySelect.value);
    }

    const annBanner = document.getElementById('dashAnnBanner');
    if (annBanner) {
        const annId = annBanner.getAttribute('data-id');
        const dismissedId = localStorage.getItem('ptv_dismissed_ann');
        if (annId !== dismissedId) {
            annBanner.style.display = 'flex';
        }
    }

    const ak = localStorage.getItem('ptv_active_kru');
    if (ak) {
        activeKruName = ak;
        const hdr = document.getElementById('hdrKruName');
        if(hdr) hdr.innerText = activeKruName;
        applyTaskLogic();
    } else {
        const wm = document.getElementById('welcomeModal');
        if (wm) wm.classList.add('active');
    }

    document.querySelectorAll('.btn-claim').forEach(btn => {
        btn.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            if(isTaskProcessing) return;
            
            const item = this.closest('.task-item');
            activeTaskId = item.getAttribute('data-id');
            document.getElementById('claimModal').classList.add('active');
        });
    });

    const btnConfirmClaim = document.getElementById('btnConfirmClaim');
    if (btnConfirmClaim) {
        btnConfirmClaim.addEventListener('click', function() {
            if(!activeTaskId || !activeKruName) return;
            isTaskProcessing = true;
            this.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Memproses...';

            const fd = new FormData();
            fd.append('action', 'ptv_claim_task');
            fd.append('task_id', activeTaskId);
            fd.append('kru_name', activeKruName);
            fd.append('claim_action', 'claim');

            fetch(CONFIG.ajaxUrl, { method: 'POST', body: fd })
            .then(() => { setTimeout(() => { isTaskProcessing = false; window.location.reload(); }, 500); })
            .catch(err => { console.error(err); isTaskProcessing = false; });
        });
    }

    document.querySelectorAll('.task-chk').forEach(chk => {
        chk.addEventListener('change', function(e) {
            if (isTaskProcessing) { e.preventDefault(); this.checked = !this.checked; return; }
            
            activeTaskDOM = this.closest('.task-item');
            activeTaskId = activeTaskDOM.getAttribute('data-id');
            const willBeDone = this.checked;
            
            if (willBeDone) {
                this.checked = false; 
                const tTitle = activeTaskDOM.querySelector('.task-detail h4').innerText;
                document.getElementById('doneText').innerText = `Tugas "${tTitle}" akan disubmit untuk ACC oleh Pengawas.`;
                document.getElementById('taskProofFile').value = ''; 
                document.getElementById('taskFileLoc').value = ''; 
                document.getElementById('doneModal').classList.add('active');
            } else {
                // Jangan langsung uncheck jika status menunggu ACC atau Done
                if(activeTaskDOM.classList.contains('is-waiting') || activeTaskDOM.classList.contains('is-done')) {
                    this.checked = true;
                    document.getElementById('uncheckModal').classList.add('active');
                }
            }
        });
    });

    const btnConfirmUncheck = document.getElementById('btnConfirmUncheck');
    if (btnConfirmUncheck) {
        btnConfirmUncheck.addEventListener('click', function() {
            if(!activeTaskId) return;
            
            isTaskProcessing = true;
            this.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Membatalkan...';
            this.disabled = true;

            if (activeTaskDOM) {
                activeTaskDOM.classList.remove('is-done');
                activeTaskDOM.classList.remove('is-waiting');
            }

            const fd = new FormData();
            fd.append('action', 'ptv_toggle_task');
            fd.append('task_id', activeTaskId);
            fd.append('action_type', 'uncheck'); // Uncheck reset status 0

            fetch(CONFIG.ajaxUrl, { method: 'POST', body: fd })
            .then(() => { setTimeout(() => { isTaskProcessing = false; window.location.reload(); }, 500); })
            .catch(err => { console.error(err); isTaskProcessing = false; });
        });
    }

    const btnConfirmDone = document.getElementById('btnConfirmDone');
    if (btnConfirmDone) {
        btnConfirmDone.addEventListener('click', async function() {
            if (!activeTaskId || !activeKruName) return;
            
            const fileInput = document.getElementById('taskProofFile');
            const fileLoc = document.getElementById('taskFileLoc').value; // Ambil nilai text input
            if(!fileInput.files || fileInput.files.length === 0) {
                showToast("Wajib upload foto bukti selesai!", "error");
                return;
            }

            isTaskProcessing = true;
            this.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Mengirim Bukti...';
            this.disabled = true;
            
            try {
                const uploadRes = await uploadMediaFile(fileInput.files[0]);
                
                const fd = new FormData();
                fd.append('action', 'ptv_toggle_task');
                fd.append('task_id', activeTaskId);
                fd.append('action_type', 'submit_proof'); // Aksi baru untuk status 2 (Menunggu)
                fd.append('completed_by', activeKruName); 
                fd.append('proof_url', uploadRes.url);
                fd.append('file_loc', fileLoc);

                const res = await fetch(CONFIG.ajaxUrl, { method: 'POST', body: fd });
                const data = await res.json();
                if(data.success) {
                    showToast("Bukti Dikirim. Menunggu ACC!", "success");
                    setTimeout(() => window.location.reload(), 1000);
                } else {
                    throw new Error(data.data);
                }
            } catch (err) {
                console.error(err);
                showToast("Gagal: " + err.message, "error");
                this.innerHTML = 'Ya, Kirim & Tunggu ACC';
                this.disabled = false;
                isTaskProcessing = false;
            }
        });
    }

    async function fetchYT() {
        try {
            const res = await fetch(CONFIG.ytApiUrl);
            if (!res.ok) throw new Error("HTTP error");
            const d = await res.json();
            if(d && d.subs) {
                const eSubs = document.getElementById('valYtSubs');
                if (eSubs) eSubs.innerText = d.subs.toLocaleString('id-ID');
                const eViews = document.getElementById('valYtViews');
                if (eViews) eViews.innerText = d.views_juta;
                const eVideos = document.getElementById('valYtVideos');
                if (eVideos) eVideos.innerText = d.videos.toLocaleString('id-ID');
                const eAvg = document.getElementById('valYtAvg');
                if (eAvg) eAvg.innerText = d.avg_views.toLocaleString('id-ID');
            }
        } catch(e) { console.warn("API PTV Offline atau gagal.", e); }
    }
    fetchYT();
});

window.switchAdminHistory = function(type) {
    if(type === 'izin') {
        document.getElementById('tableHistoryIzin').style.display = 'block';
        document.getElementById('tableHistoryAset').style.display = 'none';
        if(document.getElementById('linkArsipLengkap')) document.getElementById('linkArsipLengkap').href = '/wp-admin/edit.php?post_type=riwayat_izin';
    } else {
        document.getElementById('tableHistoryIzin').style.display = 'none';
        document.getElementById('tableHistoryAset').style.display = 'block';
        if(document.getElementById('linkArsipLengkap')) document.getElementById('linkArsipLengkap').href = '/wp-admin/edit.php?post_type=req_aset_ptv';
    }
};

window.addEventListener('pageshow', function(event) {
    const historySelect = document.getElementById('adminHistorySelect');
    if (historySelect && typeof window.switchAdminHistory === 'function') {
        window.switchAdminHistory(historySelect.value);
    }
});