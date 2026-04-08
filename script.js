// --- Auth Logic ---
const loginScreen = document.getElementById('login-screen');
const loginPassword = document.getElementById('login-password');
const loginBtn = document.getElementById('login-btn');
const loginError = document.getElementById('login-error');

async function handleAuthAction(action, payload) {
    try {
        const res = await fetch('/.netlify/functions/auth', {
            method: 'POST',
            body: JSON.stringify({ action, payload })
        });
        return await res.json();
    } catch(e) { return { error: "Network error" }; }
}

loginBtn.addEventListener('click', async () => {
    loginBtn.textContent = 'Verifying...';
    loginError.style.display = 'none';
    const res = await handleAuthAction('login', { pass: loginPassword.value });
    loginBtn.textContent = 'Unlock';
    if (res.success) {
        loginScreen.style.display = 'none';
    } else {
        loginError.style.display = 'block';
        loginError.textContent = res.error || "Incorrect Password";
    }
});

loginPassword.addEventListener('keyup', (e) => {
    if (e.key === 'Enter') loginBtn.click();
});

// --- Auth Config Modals ---
const authModal = document.getElementById('auth-modal');
const authTitle = document.getElementById('auth-modal-title');
const authDesc = document.getElementById('auth-modal-desc');
const authInput1 = document.getElementById('auth-input-1');
const authInput2 = document.getElementById('auth-input-2');
const authSubmit = document.getElementById('auth-submit-btn');
const authError = document.getElementById('auth-modal-error');
let currentAuthMode = '';

document.getElementById('forgot-pass-link').addEventListener('click', (e) => {
    e.preventDefault();
    currentAuthMode = 'reset';
    authTitle.textContent = "Reset Password";
    authDesc.textContent = "Enter your Master Recovery Key";
    authInput1.placeholder = "Recovery Key";
    authInput2.placeholder = "New Password";
    authInput1.value = ''; authInput2.value = ''; authError.style.display = 'none';
    authModal.classList.remove('hidden');
});

document.getElementById('btn-change-password').addEventListener('click', () => {
    currentAuthMode = 'change';
    authTitle.textContent = "Change Password";
    authDesc.textContent = "Updates global access PIN";
    authInput1.placeholder = "Old Password";
    authInput2.placeholder = "New Password";
    authInput1.value = ''; authInput2.value = ''; authError.style.display = 'none';
    authModal.classList.remove('hidden');
});

document.getElementById('auth-close-btn').addEventListener('click', () => authModal.classList.add('hidden'));

authSubmit.addEventListener('click', async () => {
    authSubmit.textContent = 'Processing...';
    authError.style.display = 'none';
    
    let res;
    if (currentAuthMode === 'reset') {
        res = await handleAuthAction('resetPassword', { recoveryKey: authInput1.value, newPass: authInput2.value });
    } else {
        res = await handleAuthAction('changePassword', { oldPass: authInput1.value, newPass: authInput2.value });
    }
    
    authSubmit.textContent = 'Submit';
    if (res.success) {
        alert("Password updated successfully!");
        authModal.classList.add('hidden');
    } else {
        authError.textContent = res.error || "Invalid details";
        authError.style.display = 'block';
    }
});

// --- DOM Elements ---
const navLinks = document.querySelectorAll('#nav-links li');
const showcaseArea = document.getElementById('showcase-area');
const pdfMakerArea = document.getElementById('pdf-maker-area');
const currentShowcaseTitle = document.getElementById('current-showcase-title');
const fileGrid = document.getElementById('file-grid');
const uploadZone = document.getElementById('upload-zone');
const fileInput = document.getElementById('file-input');
const browseBtn = document.getElementById('browse-btn');
const folderInput = document.getElementById('folder-input');
const browseFolderBtn = document.getElementById('browse-folder-btn');

// Audio Player Elements
const globalAudioPlayer = document.getElementById('global-audio-player');
const audioElement = document.getElementById('audio-element');
const audioTitle = document.getElementById('audio-title');

// Modal Elements
const viewerModal = document.getElementById('viewer-modal');
const viewerBody = document.getElementById('viewer-body');
const closeModal = document.getElementById('close-modal');

// Custom Showcases
const customNavLinks = document.getElementById('custom-nav-links');
const addShowcaseBtn = document.getElementById('add-showcase-btn');

// --- State ---
let currentCategory = 'all';
let currentFolderId = null;
let cloudFiles = [];

// Initial Load
document.addEventListener('DOMContentLoaded', () => {
    loadFiles();
});

// --- Database Operations ---
// --- Cloud API Wrappers ---
async function fetchAction(action, payload = {}) {
    try {
        await fetch('/.netlify/functions/action', {
            method: 'POST',
            body: JSON.stringify({ action, payload })
        });
        loadFiles();
    } catch(e) {
        console.error("Action error", e);
    }
}

// Global Progress Tracking
let activeUploads = [];

function drawActiveUploads() {
    const fileGrid = document.getElementById('file-grid');
    activeUploads.forEach(u => {
        let card = document.getElementById(`upload-${u.id}`);
        if (!card) {
            card = document.createElement('div');
            card.id = `upload-${u.id}`;
            card.className = `file-card ghost ${u.status === 'error' ? 'ghost-error' : ''}`;
            fileGrid.appendChild(card);
        } else {
            card.className = `file-card ghost ${u.status === 'error' ? 'ghost-error' : ''}`;
        }
        
        let contentHtml = `
            <div class="file-icon" style="opacity: 0.5;">
                ${u.status === 'error' ? '⚠️' : '⏳'}
            </div>
            <div class="file-info">
                <h3 style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis; width: 100px;">${u.name}</h3>
                <p style="color: ${u.status === 'error' ? '#ff3333' : 'var(--accent-cyan)'}; font-size: 11px;">
                    ${u.status === 'error' ? u.errorMsg.substring(0, 30) : 'Uploading...'}
                </p>
            </div>
        `;
        
        if (u.status === 'error') {
            contentHtml += `<div class="file-actions"><button class="btn-delete" style="color: var(--accent-red);" onclick="removeActiveUpload('${u.id}')">✕</button></div>`;
        } else {
            contentHtml += `
                <div style="width: 100%; height: 2px; background: #333; position: absolute; bottom: 0; left: 0;">
                    <div style="width: 100%; height: 100%; background: var(--accent-cyan); animation: pulse-shimmer 1.5s infinite;"></div>
                </div>
            `;
        }
        card.innerHTML = contentHtml;
    });
}

window.removeActiveUpload = function(id) {
    activeUploads = activeUploads.filter(u => u.id !== id);
    const card = document.getElementById(`upload-${id}`);
    if (card) card.remove();
}

function saveFileToDB(fileData) {
    return new Promise((resolve) => {
        const id = Date.now().toString() + Math.random().toString(36).substring(7);
        const uploadObj = { id, name: fileData.name, status: 'uploading', errorMsg: '' };
        
        // Push and draw immediately
        activeUploads.push(uploadObj);
        drawActiveUploads();

        const reader = new FileReader();
        reader.onload = async (e) => {
            const dataURL = e.target.result;
            const metadata = {
                name: fileData.name,
                type: fileData.type,
                category: fileData.category,
                customShowcase: fileData.customShowcase || 'null',
                parentFolder: fileData.parentFolder || 'null',
                isDeleted: fileData.isDeleted ? 'true' : 'false'
            };
            
            try {
                const res = await fetch('/.netlify/functions/upload', {
                    method: 'POST',
                    body: JSON.stringify({ id, dataURL, metadata })
                });
                
                if (!res.ok) {
                    const errObj = await res.json();
                    throw new Error(errObj.error || "Server Limit Reached (6MB)");
                }
                
                // Done! Remove ghost and reload proper cloud state
                activeUploads = activeUploads.filter(u => u.id !== id);
                loadFiles();
                
            } catch(err) {
                // Mark ghost as error
                uploadObj.status = 'error';
                uploadObj.errorMsg = err.message || "Upload Failed";
                drawActiveUploads();
            }
            resolve();
        };
        reader.readAsDataURL(fileData.fileBlob);
    });
}

function moveToRecycleBin(id, file) { fetchAction('moveToRecycleBin', { id, metadata: file }); }
function restoreFile(id, file) { fetchAction('restoreFile', { id, metadata: file }); }
function permanentlyDeleteFile(id) { fetchAction('permanentlyDeleteFile', { id }); }
function emptyRecycleBin() { fetchAction('emptyRecycleBin'); }
function restoreAllRecycleBin() { 
    fetchAction('restoreAllRecycleBin'); 
    currentCategory = 'all'; 
    document.querySelector('#nav-links [data-showcase="all"]').click();
}

async function loadFiles() {
    try {
        const res = await fetch('/.netlify/functions/list');
        const data = await res.json();
        const files = data.files || [];
        
        // Render showcases
        const scList = data.customShowcases || [];
        renderCustomShowcasesUI(scList);
        
        renderFiles(files);
        updateAudioPlaylist(files);
    } catch(err) {
        console.log("Could not load from cloud natively (normal if testing offline without node).", err);
    }
}

// --- File Handling & Categories ---
function getFileCategory(file) {
    if (file.type.startsWith('audio/')) return 'audio';
    if (file.type.startsWith('video/')) return 'video';
    if (file.type.startsWith('image/')) return 'images';
    return 'documents';
}

function getMimeFromExtension(filename) {
    const ext = filename.split('.').pop().toLowerCase();
    if (['jpg','jpeg','png','gif','webp'].includes(ext)) return 'image/' + ext;
    if (['mp3','wav','ogg'].includes(ext)) return 'audio/' + ext;
    if (['mp4','webm','mkv'].includes(ext)) return 'video/' + ext;
    if (ext === 'pdf') return 'application/pdf';
    return 'text/plain';
}

async function handleZipFile(file) {
    const parentName = file.name.replace('.zip', ''); 
    const zip = new window.JSZip();
    try {
        const contents = await zip.loadAsync(file);
        const entries = Object.entries(contents.files).filter(([f, z]) => !z.dir && !f.includes('__MACOSX') && !f.includes('.DS_Store'));

        for (let [filename, zipEntry] of entries) {
            const blob = await zipEntry.async('blob');
            const extractedFile = new File([blob], filename.split('/').pop(), { type: getMimeFromExtension(filename) });
            
            const fileData = {
                name: extractedFile.name,
                type: extractedFile.type,
                category: getFileCategory(extractedFile),
                fileBlob: extractedFile,
                customShowcase: null,
                isDeleted: false,
                parentFolder: parentName
            };
            await saveFileToDB(fileData);
        }
    } catch (e) {
        console.error("Error extracting zip:", e);
        alert("Failed to extract ZIP file.");
    }
}

async function handleFiles(files) {
    const fileArray = Array.from(files);

    for (let file of fileArray) {
        if (file.name.endsWith('.zip') || file.type === 'application/zip') {
            await handleZipFile(file);
            continue;
        }

        let parentName = null;
        if (file.webkitRelativePath) {
            parentName = file.webkitRelativePath.split('/')[0];
        }

        const fileData = {
            name: file.name,
            type: file.type,
            category: getFileCategory(file),
            fileBlob: file, // Store actual file object
            customShowcase: null,
            isDeleted: false,
            parentFolder: parentName
        };
        await saveFileToDB(fileData);
    }
}

// Drag & Drop
uploadZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    uploadZone.classList.add('dragover');
});

uploadZone.addEventListener('dragleave', () => {
    uploadZone.classList.remove('dragover');
});

uploadZone.addEventListener('drop', (e) => {
    e.preventDefault();
    uploadZone.classList.remove('dragover');
    if (e.dataTransfer.files.length) {
        handleFiles(e.dataTransfer.files);
    }
});

// Click Browse
browseBtn.addEventListener('click', () => fileInput.click());
fileInput.addEventListener('change', (e) => {
    if (e.target.files.length) {
        handleFiles(e.target.files);
    }
});

browseFolderBtn.addEventListener('click', () => folderInput.click());
folderInput.addEventListener('change', (e) => {
    if (e.target.files.length) {
        handleFiles(e.target.files);
    }
});

// --- UI Rendering ---
function renderFiles(files) {
    fileGrid.innerHTML = '';
    
    const oldBulk = document.getElementById('bulk-actions');
    if(oldBulk) oldBulk.remove();
    
    let filteredFiles = [];
    const allFolders = new Set(files.filter(f => f.parentFolder && !f.isDeleted).map(f => f.parentFolder));
    
    if (currentCategory === 'recycle-bin') {
        filteredFiles = files.filter(f => f.isDeleted);
    } else if (currentCategory === 'folders' && !currentFolderId) {
        if (allFolders.size === 0) {
            fileGrid.innerHTML = '<p style="color: grey;">No folders found.</p>';
            return;
        }
        allFolders.forEach(folderName => {
            const card = document.createElement('div');
            card.className = 'file-card';
            card.innerHTML = `
                <div class="category-tag" style="border-color: grey;">Folder</div>
                <div class="file-icon" style="font-size: 50px;">📁</div>
                <div class="file-name" title="${folderName}">${folderName}</div>
                <div class="file-actions"><button class="btn-open-folder" data-name="${folderName}">Enter Folder</button></div>
            `;
            card.querySelector('.btn-open-folder').addEventListener('click', () => {
                currentFolderId = folderName;
                document.getElementById('breadcrumb-back-btn').classList.remove('hidden');
                document.getElementById('current-showcase-title').textContent = folderName;
                renderFiles(files);
            });
            fileGrid.appendChild(card);
        });
        return;
    } else if (currentFolderId) {
        filteredFiles = files.filter(f => !f.isDeleted && f.parentFolder === currentFolderId);
    } else {
        // Strict Isolation: If it has a parentFolder, it ONLY shows up in that folder or Recycle Bin
        let globalFiles = files.filter(f => !f.isDeleted && !f.parentFolder);
        if (currentCategory === 'all') {
            filteredFiles = globalFiles;
        } else {
            filteredFiles = globalFiles.filter(f => f.category === currentCategory || f.customShowcase === currentCategory);
        }
    }

    if (filteredFiles.length === 0) {
        fileGrid.innerHTML = '<p style="color: grey;">No files found in this showcase.</p>';
        return;
    }

    if (currentCategory === 'recycle-bin') {
        const bulkDiv = document.createElement('div');
        bulkDiv.id = 'bulk-actions';
        bulkDiv.style.marginTop = '10px';
        bulkDiv.style.marginBottom = '20px';
        bulkDiv.innerHTML = `
            <button id="btn-restore-all" class="btn-restore">Restore All</button>
            <button id="btn-empty-bin" style="background:var(--accent-red);color:#000;margin-left:10px;">Empty Bin</button>
        `;
        document.querySelector('.showcase-header').appendChild(bulkDiv);
        
        bulkDiv.querySelector('#btn-restore-all').addEventListener('click', () => {
            if(confirm("Restore all items?")) restoreAllRecycleBin();
        });
        bulkDiv.querySelector('#btn-empty-bin').addEventListener('click', () => {
            if(confirm("Permanently erase everything in the bin?")) emptyRecycleBin();
        });
    }

    filteredFiles.forEach(file => {
        const card = document.createElement('div');
        card.className = 'file-card';
        
        let iconContent = '📄';
        if (file.category === 'audio') iconContent = '🎵';
        if (file.category === 'video') iconContent = '🎬';
        if (file.category === 'images') {
            // For images, we can show a mini preview
            const objectUrl = URL.createObjectURL(file.fileBlob);
            iconContent = `<img src="${objectUrl}" style="max-height:100%; max-width:100%; object-fit:cover; border-radius:4px;">`;
        }

        let actionsHtml = '';
        if (currentCategory === 'recycle-bin') {
            actionsHtml = `
                <button class="btn-restore" data-id="${file.id}">Restore</button>
                <button class="btn-delete" data-id="${file.id}">Erase</button>
            `;
        } else {
            actionsHtml = `
                <button class="btn-open">Open</button>
                <button class="btn-delete" data-id="${file.id}">Delete</button>
            `;
        }

        card.innerHTML = `
            <div class="category-tag" style="border-color: ${getCategoryColor(file.category)}">${file.category}</div>
            <div class="file-icon" ${file.category === 'images' ? 'style="padding:0;"' : ''}>
                ${iconContent}
            </div>
            <div class="file-name" title="${file.name}">${file.name}</div>
            <div class="file-actions">
                ${actionsHtml}
            </div>
        `;

        // Actions
        if (currentCategory === 'recycle-bin') {
            card.querySelector('.btn-restore').addEventListener('click', (e) => {
                e.stopPropagation(); restoreFile(file.id, file);
            });
            card.querySelector('.btn-delete').addEventListener('click', (e) => {
                e.stopPropagation(); if (confirm("Erase forever?")) permanentlyDeleteFile(file.id);
            });
        } else {
            card.querySelector('.btn-open').addEventListener('click', () => openFile(file));
            card.querySelector('.btn-delete').addEventListener('click', (e) => {
                e.stopPropagation(); if (confirm("Move to Recycle Bin?")) moveToRecycleBin(file.id, file);
            });
        }

        fileGrid.appendChild(card);
    });
    
    drawActiveUploads();
}

function getCategoryColor(cat) {
    if(cat === 'audio') return 'var(--accent-purple)';
    if(cat === 'video') return 'var(--accent-red)';
    if(cat === 'images') return 'var(--accent-cyan)';
    return 'var(--text-muted)';
}

function dataURLtoBlob(dataurl) {
    let arr = dataurl.split(','), mime = arr[0].match(/:(.*?);/)[1],
        bstr = atob(arr[1]), n = bstr.length, u8arr = new Uint8Array(n);
    while(n--){
        u8arr[n] = bstr.charCodeAt(n);
    }
    return new Blob([u8arr], {type:mime});
}

// --- File Viewers ---
async function openFile(file) {
    const originalTitle = document.getElementById('current-showcase-title').textContent;
    document.getElementById('current-showcase-title').textContent = "Downloading from Cloud...";
    
    let objectUrl = null;
    try {
        const res = await fetch(`/.netlify/functions/download?id=${file.id}`);
        const data = await res.json();
        
        file.fileBlob = dataURLtoBlob(data.dataURL);
        objectUrl = URL.createObjectURL(file.fileBlob);
    } catch(e) {
        alert("Failed to download file from cloud.");
        document.getElementById('current-showcase-title').textContent = originalTitle;
        return;
    }
    document.getElementById('current-showcase-title').textContent = originalTitle;

    if (file.category === 'audio') {
        playAudio(file, objectUrl);
    } else if (file.category === 'video') {
        viewerBody.innerHTML = `<video controls autoplay src="${objectUrl}"></video>`;
        viewerModal.classList.remove('hidden');
    } else if (file.category === 'images') {
        viewerBody.innerHTML = `<img src="${objectUrl}">`;
        viewerModal.classList.remove('hidden');
    } else {
        // Documents
        if (file.type === 'application/pdf') {
            viewerBody.innerHTML = `<iframe src="${objectUrl}" width="100%" height="100%"></iframe>`;
            viewerModal.classList.remove('hidden');
        } else if (file.type.startsWith('text/') || file.name.endsWith('.js') || file.name.endsWith('.css') || file.name.endsWith('.html')) {
            const reader = new FileReader();
            reader.onload = (e) => {
                let extraHtmlButton = '';
                if (file.name.endsWith('.html')) {
                    extraHtmlButton = `<button id="preview-html-btn" style="background-color: var(--accent-cyan); color: black;">Live Preview</button>`;
                }

                viewerBody.innerHTML = `
                    <div class="document-editor-container">
                        <div class="document-editor-toolbar">
                            <button id="save-doc-btn" class="btn-restore">Save to Cloud</button>
                            ${extraHtmlButton}
                            <button id="export-pdf-btn" style="background-color: var(--accent-orange); color: black;">Export Document as PDF</button>
                        </div>
                        <textarea id="doc-editor" class="document-editor-textarea">${e.target.result}</textarea>
                    </div>
                `;
                viewerModal.classList.remove('hidden');

                if (file.name.endsWith('.html')) {
                    document.getElementById('preview-html-btn').addEventListener('click', () => {
                        const currentText = document.getElementById('doc-editor').value;
                        const tempBlob = new Blob([currentText], { type: 'text/html' });
                        const tempUrl = URL.createObjectURL(tempBlob);
                        const newWindow = window.open(tempUrl, '_blank');
                        if(!newWindow) alert("Please allow popups for live preview!");
                    });
                }

                document.getElementById('save-doc-btn').addEventListener('click', () => {
                    const newText = document.getElementById('doc-editor').value;
                    const dataURL = "data:" + (file.type || 'text/plain') + ";base64," + btoa(unescape(encodeURIComponent(newText)));
                    
                    document.getElementById('save-doc-btn').textContent = 'Saving...';
                    fetch('/.netlify/functions/upload', {
                        method: 'POST',
                        body: JSON.stringify({ 
                            id: file.id, 
                            dataURL: dataURL, 
                            metadata: file 
                        })
                    }).then(() => {
                         alert("Saved cloud edits successfully!");
                         document.getElementById('save-doc-btn').textContent = 'Save to Cloud';
                         loadFiles();
                    });
                });

                document.getElementById('export-pdf-btn').addEventListener('click', () => {
                    const content = document.getElementById('doc-editor').value;
                    if (!content) return alert("Document is empty!");
                    
                    const { jsPDF } = window.jspdf;
                    const doc = new jsPDF();
                    
                    doc.setFont("helvetica", "bold");
                    doc.setFontSize(16);
                    doc.text(file.name, 20, 20);
                    
                    doc.setFont("helvetica", "normal");
                    doc.setFontSize(12);
                    
                    const splitText = doc.splitTextToSize(content, 170);
                    doc.text(splitText, 20, 30);
                    
                    doc.save(`${file.name.replace(/\.[^/.]+$/, "")}.pdf`);
                });
            };
            reader.readAsText(file.fileBlob);
        } else {
            // For unsupported like pptx, docx without serverside conversion, force download
            const a = document.createElement('a');
            a.href = objectUrl;
            a.download = file.name;
            a.click();
        }
    }
}

closeModal.addEventListener('click', () => {
    viewerModal.classList.add('hidden');
    viewerBody.innerHTML = ''; // Clear contents (stops videos)
});

// --- Audio Player Logic ---
function updateAudioPlaylist(files) {
    audioPlaylist = files.filter(f => f.category === 'audio' && !f.isDeleted);
}

function playAudio(file, url = null) {
    if (!url) url = URL.createObjectURL(file.fileBlob);
    
    globalAudioPlayer.classList.remove('hidden');
    audioElement.src = url;
    audioTitle.textContent = file.name;
    audioElement.play();
    
    currentAudioIndex = audioPlaylist.findIndex(f => f.id === file.id);
}

audioElement.addEventListener('ended', () => {
    // Play next
    if (audioPlaylist.length > 0) {
        currentAudioIndex = (currentAudioIndex + 1) % audioPlaylist.length;
        playAudio(audioPlaylist[currentAudioIndex]);
    }
});

// Navigation Breadcrumbs
document.getElementById('breadcrumb-back-btn').addEventListener('click', () => {
    currentFolderId = null;
    document.getElementById('breadcrumb-back-btn').classList.add('hidden');
    document.getElementById('current-showcase-title').textContent = document.querySelector('#nav-links .active, #custom-nav-links .active').textContent;
    loadFiles();
});

// --- Navigation ---
navLinks.forEach(link => {
    link.addEventListener('click', (e) => {
        navLinks.forEach(l => l.classList.remove('active'));
        if(customNavLinks) Array.from(customNavLinks.children).forEach(l => l.classList.remove('active'));
        e.target.classList.add('active');

        const showcase = e.target.getAttribute('data-showcase');
        
        showcaseArea.classList.remove('hidden');
        uploadZone.parentElement.classList.remove('hidden');
        
        currentCategory = showcase;
        currentFolderId = null;
        document.getElementById('breadcrumb-back-btn').classList.add('hidden');
        currentShowcaseTitle.textContent = e.target.textContent;
        loadFiles();
        
        if(window.innerWidth <= 768) {
            document.querySelector('.sidebar').classList.remove('open');
        }
    });
});

// --- Custom Showcases ---

// --- Custom Showcases ---
function renderCustomShowcasesUI(showcases) {
    customNavLinks.innerHTML = '';
    showcases.forEach(sc => {
        const li = document.createElement('li');
        li.innerHTML = `<span>${sc.name}</span> <button class="delete-showcase-btn" title="Delete Showcase">x</button>`;
        li.className = 'custom-showcase-link';
        li.style.color = "var(--accent-cyan)";
        
        li.addEventListener('click', (e) => {
            // Check if they clicked the x button
            if(e.target.classList.contains('delete-showcase-btn')) {
                if(confirm("Delete this showcase? (Files inside will return to 'All Files')")) {
                    fetchAction('deleteShowcase', { name: sc.name });
                }
                return; // Prevent triggering the showcase load
            }

            navLinks.forEach(l => l.classList.remove('active'));
            Array.from(customNavLinks.children).forEach(l => l.classList.remove('active'));
            e.currentTarget.classList.add('active');
            
            showcaseArea.classList.remove('hidden');
            uploadZone.parentElement.classList.remove('hidden');
            
            currentCategory = sc.name;
            currentFolderId = null;
            document.getElementById('breadcrumb-back-btn').classList.add('hidden');
            currentShowcaseTitle.textContent = sc.name;
            loadFiles();
            
            if(window.innerWidth <= 768) {
                document.querySelector('.sidebar').classList.remove('open');
            }
        });
        
        customNavLinks.appendChild(li);
    });
}

addShowcaseBtn.addEventListener('click', () => {
    const name = prompt("Enter a name for the new showcase:");
    if (name && name.trim() !== '') {
        fetchAction('createShowcase', { name: name.trim() });
    }
});

// Mobile menu toggle
const menuToggleBtn = document.getElementById('menu-toggle');
if (menuToggleBtn) {
    menuToggleBtn.addEventListener('click', () => {
        document.querySelector('.sidebar').classList.toggle('open');
    });
}
