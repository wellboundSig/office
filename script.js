// ========================================
// Wellbound Email Signature Generator
// ========================================

// Configuration
const CONFIG = {
    scriptUrl: 'https://script.google.com/macros/s/AKfycbwsGu0uuWKp0t4fwuC0zyEuPHzMaMMrJZOte6FTrRIdZL7MVLkS5kGm3mhU_8f1nCD3/exec',
    uploadUrl: 'https://wellbound-signature-upload.support-1e5.workers.dev',
    r2PublicBase: 'https://pub-d7fda00c74254211bfe47adcb51427b0.r2.dev'
};

// Signature Format Configurations
const FORMATS = {
    wellbound: {
        label: 'Wellbound',
        borderColor: '#561640',
        nameFont: "'Verdana',sans-serif",
        nameSize: '12pt',
        nameColor: '#561640',
        titleFont: "'Calibri',sans-serif",
        titleSize: '9pt',
        titleColor: '#98788f',
        contactFont: "'Abadi','Calibri',sans-serif",
        contactSize: '12pt',
        contactColor: '#561640',
        addressFont: "'Verdana',sans-serif",
        addressSize: '8pt',
        addressColor: '#98788f',
        lineColor: '#561640',
        lineWeight: '1.5pt',
        logo: {
            src: 'imgs/logo.png',
            href: 'http://wellboundhc.com/',
            width: 137,
            height: 39,
            style: 'width:1.91in;height:0.54in',
            alt: 'Wellbound Certified Home Health Agency'
        },
        socialIcons: [
            { href: 'https://www.facebook.com/wellbound.homecare', src: 'imgs/facebook icon.png', alt: 'Facebook', size: 22 },
            { href: 'https://www.linkedin.com/company/75448188/admin/feed/posts/', src: 'imgs/linked in icon.png', alt: 'LinkedIn', size: 22 }
        ]
    },
    specialNeeds: {
        label: 'Special Needs',
        borderColor: '#252347',
        nameFont: "'Verdana',sans-serif",
        nameSize: '12pt',
        nameColor: '#252347',
        titleFont: "'Calibri',sans-serif",
        titleSize: '9pt',
        titleColor: '#372f87',
        contactFont: "'Abadi','Calibri',sans-serif",
        contactSize: '12pt',
        contactColor: '#252347',
        addressFont: "'Verdana',sans-serif",
        addressSize: '8pt',
        addressColor: '#252347',
        addressBold: true,
        lineColor: '#252347',
        lineWeight: '1.5pt',
        logo: {
            src: 'imgs/logoSN.png',
            href: 'http://wellboundhc.com/',
            width: 137,
            height: 39,
            style: 'width:1.91in;height:0.54in',
            alt: 'Wellbound For Special Needs'
        },
        iconSpacing: '&nbsp;',
        socialIcons: [
            { href: 'https://www.instagram.com/wellboundspecialneeds/', src: 'imgs/linked in iconSN.png', alt: 'Instagram', size: 22 },
            { href: 'https://www.facebook.com/wellbound.homecare', src: 'imgs/facebook iconSN.png', alt: 'Facebook', size: 22 }
        ]
    }
};

// State
let uploadedImageData = null;
let circularImageData = null;
let hasImage = false;
let employeesCache = [];
let uploadedR2Url = null;  // Stores the R2 URL after upload
let currentImageFile = null;  // Stores the current image file for upload
let isUploading = false;
let extensionsCache = [];  // Stores phone extensions data
let currentModalEmployee = null;  // Stores employee for modal format toggle
let currentSearchEmployee = null;  // Stores employee for search format toggle

// ========================================
// Image Handling
// ========================================

function createCircularImage(imgSrc, callback, borderColor) {
    if (!borderColor) {
        const formatSelect = document.getElementById('signatureFormat');
        const format = formatSelect ? formatSelect.value : 'wellbound';
        borderColor = (FORMATS[format] || FORMATS.wellbound).borderColor;
    }
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = function() {
        const canvas = document.createElement('canvas');
        const size = 96;
        const borderWidth = 3;
        const totalSize = size + (borderWidth * 2);
        
        canvas.width = totalSize;
        canvas.height = totalSize;
        const ctx = canvas.getContext('2d');
        
        ctx.clearRect(0, 0, totalSize, totalSize);
        
        // Draw border circle
        ctx.beginPath();
        ctx.arc(totalSize / 2, totalSize / 2, totalSize / 2, 0, Math.PI * 2);
        ctx.fillStyle = borderColor;
        ctx.fill();
        
        // Clip for image
        ctx.beginPath();
        ctx.arc(totalSize / 2, totalSize / 2, size / 2, 0, Math.PI * 2);
        ctx.closePath();
        ctx.clip();
        
        // Draw image
        const scale = Math.max(size / img.width, size / img.height);
        const x = (totalSize - img.width * scale) / 2;
        const y = (totalSize - img.height * scale) / 2;
        ctx.drawImage(img, x, y, img.width * scale, img.height * scale);
        
        callback(canvas.toDataURL('image/png'));
    };
    img.onerror = function() {
        callback(null);
    };
    img.src = imgSrc;
}

function handleImageUpload(event) {
    const file = event.target.files[0];
    if (file) {
        uploadedR2Url = null;  // Reset any previous URL
        
        const reader = new FileReader();
        reader.onload = function(e) {
            uploadedImageData = e.target.result;
            hasImage = true;
            
            // Compress and prepare the image for upload
            compressImageForUpload(e.target.result, function(compressedBlob) {
                currentImageFile = compressedBlob;
            });
            
            createCircularImage(uploadedImageData, function(circularData) {
                circularImageData = circularData;
                
                const preview = document.getElementById('imagePreview');
                const placeholder = document.getElementById('uploadPlaceholder');
                
                if (preview && placeholder) {
                    preview.src = circularData;
                    preview.style.display = 'block';
                    placeholder.style.display = 'none';
                }
            });
        };
        reader.readAsDataURL(file);
    }
}

// Compress and convert image to JPEG for faster loading
function compressImageForUpload(imgSrc, callback) {
    const img = new Image();
    img.onload = function() {
        const canvas = document.createElement('canvas');
        
        // Max dimensions for profile photo (keeps it reasonable)
        const maxSize = 400;
        let width = img.width;
        let height = img.height;
        
        // Scale down if larger than maxSize
        if (width > height) {
            if (width > maxSize) {
                height = Math.round((height * maxSize) / width);
                width = maxSize;
            }
        } else {
            if (height > maxSize) {
                width = Math.round((width * maxSize) / height);
                height = maxSize;
            }
        }
        
        canvas.width = width;
        canvas.height = height;
        
        const ctx = canvas.getContext('2d');
        
        // Fill with white background (for JPEG transparency)
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, width, height);
        
        // Draw the image
        ctx.drawImage(img, 0, 0, width, height);
        
        // Convert to JPEG with 85% quality (good balance of size/quality)
        canvas.toBlob(function(blob) {
            // Create a new file with .jpg extension
            const compressedFile = new File([blob], 'profile.jpg', { type: 'image/jpeg' });
            console.log(`Image compressed: ${Math.round(blob.size / 1024)}KB`);
            callback(compressedFile);
        }, 'image/jpeg', 0.85);
    };
    img.src = imgSrc;
}

// Upload image to Cloudflare R2
async function uploadImageToR2() {
    if (!currentImageFile) {
        return null;
    }
    
    if (uploadedR2Url) {
        // Already uploaded
        return uploadedR2Url;
    }
    
    isUploading = true;
    
    try {
        const formData = new FormData();
        formData.append('image', currentImageFile);
        
        const response = await fetch(CONFIG.uploadUrl, {
            method: 'POST',
            body: formData
        });
        
        const result = await response.json();
        
        if (result.success && result.url) {
            uploadedR2Url = result.url;
            isUploading = false;
            return result.url;
        } else {
            throw new Error(result.error || 'Upload failed');
        }
    } catch (error) {
        console.error('R2 Upload error:', error);
        isUploading = false;
        throw error;
    }
}

// ========================================
// Signature Generation
// ========================================

function generateSignatureHTML(data = null, format = null) {
    // Determine format
    if (!format) {
        const formatSelect = document.getElementById('signatureFormat');
        format = formatSelect ? formatSelect.value : 'wellbound';
    }
    const fmt = FORMATS[format] || FORMATS.wellbound;

    const name = data?.name || document.getElementById('workerName')?.value || 'Worker Name';
    const title = data?.title || document.getElementById('jobTitle')?.value || 'Job Title';
    const phone = data?.phone || document.getElementById('phoneNumber')?.value || '718.400.WELL (9355)';
    const ext = data?.extension || document.getElementById('extension')?.value || '000';
    const fax = document.getElementById('fax')?.value || '718.766.2109';
    const email = data?.email || document.getElementById('email')?.value || 'email@wellboundhc.com';
    const address = '7424 13th Avenue | Brooklyn, NY 11228';
    const imageUrl = data?.imageUrl || null;
    
    const addressFormatted = address.replace(/(\d+)(st|nd|rd|th)/gi, '$1<sup>$2</sup>');
    
    const imageSize = 102;
    let profileImageHtml;
    
    if (imageUrl) {
        // Use external image URL with format-specific border color
        profileImageHtml = `<img src="${imageUrl}" 
            width="${imageSize}" height="${imageSize}" 
            style="width:${imageSize}px;height:${imageSize}px;border-radius:50%;border:2.25pt solid ${fmt.borderColor};object-fit:cover;display:block;" 
            alt="${name}">`;
    } else if (circularImageData && !data) {
        // Use uploaded circular image (only on create page)
        profileImageHtml = `<img src="${circularImageData}" 
            width="${imageSize}" height="${imageSize}" 
            style="width:${imageSize}px;height:${imageSize}px;display:block;" 
            alt="${name}">`;
    } else {
        // No image placeholder
        profileImageHtml = `<div style="width:96px;height:96px;border-radius:50%;border:2.25pt solid ${fmt.borderColor};background:#f0f0f0;display:flex;align-items:center;justify-content:center;color:${fmt.titleColor};font-size:10pt;">No Photo</div>`;
    }
    
    // Build social icons HTML
    const iconSpacer = fmt.iconSpacing || '&nbsp;&nbsp;&nbsp;';
    let socialIconsHtml = '';
    fmt.socialIcons.forEach((icon, i) => {
        if (i > 0) socialIconsHtml += iconSpacer + '\n            ';
        socialIconsHtml += `<a href="${icon.href}" style="text-decoration:none;">
                <img src="${icon.src}" width="${icon.size}" height="${icon.size}" style="width:${icon.size}pt;height:${icon.size}pt;border:0;" alt="${icon.alt}">
            </a>`;
    });
    
    return `<!--[if gte mso 9]><xml>
<o:OfficeDocumentSettings>
<o:AllowPNG/>
<o:PixelsPerInch>96</o:PixelsPerInch>
</o:OfficeDocumentSettings>
</xml><![endif]-->
<table cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;mso-table-lspace:0pt;mso-table-rspace:0pt;">
    <tr>
        <td style="padding:0 0 10pt 0;">
            ${profileImageHtml}
        </td>
    </tr>
    <tr>
        <td style="padding:0 0 2pt 0;">
            <span style="font-family:${fmt.nameFont};font-size:${fmt.nameSize};font-weight:bold;color:${fmt.nameColor};mso-line-height-rule:exactly;">${name}</span>
        </td>
    </tr>
    <tr>
        <td style="padding:0 0 4pt 0;">
            <span style="font-family:${fmt.titleFont};font-size:${fmt.titleSize};color:${fmt.titleColor};mso-line-height-rule:exactly;">${title}</span>
        </td>
    </tr>
    <tr>
        <td style="padding:2pt 0 6pt 0;border-top:${fmt.lineWeight} solid ${fmt.lineColor};">
        </td>
    </tr>
    <tr>
        <td style="padding:0;">
            <span style="font-family:${fmt.contactFont};font-size:${fmt.contactSize};color:${fmt.contactColor};"><b>Phone</b> | ${phone} Ext. ${ext}</span>
        </td>
    </tr>
    <tr>
        <td style="padding:0;">
            <span style="font-family:${fmt.contactFont};font-size:${fmt.contactSize};color:${fmt.contactColor};"><b>Fax</b> | ${fax}</span>
        </td>
    </tr>
    <tr>
        <td style="padding:0 0 8pt 0;">
            <span style="font-family:${fmt.contactFont};font-size:${fmt.contactSize};color:${fmt.contactColor};"><b>Email</b> | </span><a href="mailto:${email}" style="font-family:${fmt.contactFont};font-size:${fmt.contactSize};color:${fmt.contactColor};text-decoration:underline;">${email}</a>
        </td>
    </tr>
    <tr>
        <td style="padding:0 0 12pt 0;">
            <span style="font-family:${fmt.addressFont};font-size:${fmt.addressSize};color:${fmt.addressColor};${fmt.addressBold ? 'font-weight:bold;' : ''}">${addressFormatted}</span>
        </td>
    </tr>
    <tr>
        <td style="padding:0 0 10pt 0;">
            <a href="${fmt.logo.href}" style="text-decoration:none;">
                <img src="${fmt.logo.src}" width="${fmt.logo.width}" height="${fmt.logo.height}" style="${fmt.logo.style};border:0;display:block;" alt="${fmt.logo.alt}">
            </a>
        </td>
    </tr>
    <tr>
        <td style="padding:0;">
            ${socialIconsHtml}
        </td>
    </tr>
</table>`;
}

function generateSignature() {
    const name = document.getElementById('workerName').value;
    const title = document.getElementById('jobTitle').value;
    const ext = document.getElementById('extension').value;
    const email = document.getElementById('email').value;
    
    if (!name || !title || !ext || !email) {
        showToast('Please fill in all required fields', true);
        return;
    }
    
    const formatSelect = document.getElementById('signatureFormat');
    const format = formatSelect ? formatSelect.value : 'wellbound';
    const signatureHtml = generateSignatureHTML(null, format);
    document.getElementById('signaturePreview').innerHTML = signatureHtml;
}

// ========================================
// Copy Functions
// ========================================

function copySignature() {
    const signaturePreview = document.getElementById('signaturePreview');
    
    if (signaturePreview.querySelector('.preview-placeholder')) {
        showToast('Please generate a signature first', true);
        return;
    }
    
    copyHtmlToClipboard(signaturePreview);
}

function copyModalSignature() {
    const signaturePreview = document.getElementById('modalSignaturePreview');
    copyHtmlToClipboard(signaturePreview);
}

function copySearchSignature() {
    const signaturePreview = document.getElementById('searchSignaturePreview');
    copyHtmlToClipboard(signaturePreview);
}

function copyHtmlToClipboard(element) {
    const range = document.createRange();
    range.selectNodeContents(element);
    
    const selection = window.getSelection();
    selection.removeAllRanges();
    selection.addRange(range);
    
    try {
        const htmlContent = element.innerHTML;
        const textContent = element.innerText;
        
        const clipboardItem = new ClipboardItem({
            'text/html': new Blob([htmlContent], { type: 'text/html' }),
            'text/plain': new Blob([textContent], { type: 'text/plain' })
        });
        
        navigator.clipboard.write([clipboardItem]).then(() => {
            showToast('Signature copied to clipboard!');
        }).catch(() => {
            document.execCommand('copy');
            showToast('Signature copied to clipboard!');
        });
    } catch (err) {
        document.execCommand('copy');
        showToast('Signature copied to clipboard!');
    }
    
    selection.removeAllRanges();
}

// ========================================
// Database Functions
// ========================================

function openAddToDatabase() {
    const name = document.getElementById('workerName').value;
    if (!name) {
        showToast('Please generate a signature first', true);
        return;
    }
    
    document.getElementById('modalOverlay').classList.add('active');
    document.getElementById('modalLoader').classList.remove('active');
    
    // Update modal content based on whether there's an image
    const modalContent = document.getElementById('modalContent');
    const uploadStatus = document.getElementById('uploadStatus');
    
    if (hasImage && currentImageFile) {
        if (uploadStatus) {
            uploadStatus.innerHTML = `<i class="fa-solid fa-image"></i> Image ready: <strong>${currentImageFile.name}</strong>`;
            uploadStatus.style.display = 'block';
        }
    } else {
        if (uploadStatus) {
            uploadStatus.innerHTML = `<i class="fa-solid fa-info-circle"></i> No image uploaded - will be added without photo`;
            uploadStatus.style.display = 'block';
        }
    }
}

function closeModal() {
    document.getElementById('modalOverlay').classList.remove('active');
}

async function addToDatabase() {
    const name = document.getElementById('workerName').value;
    const title = document.getElementById('jobTitle').value;
    const phone = document.getElementById('phoneNumber').value;
    const ext = document.getElementById('extension').value;
    const email = document.getElementById('email').value;
    
    // Show loader
    document.getElementById('modalLoader').classList.add('active');
    const loaderText = document.querySelector('#modalLoader p');
    
    let imageUrl = '';
    
    // If there's an image, upload it to R2 first
    if (hasImage && currentImageFile) {
        try {
            if (loaderText) loaderText.textContent = 'Uploading image to cloud...';
            imageUrl = await uploadImageToR2();
            if (loaderText) loaderText.textContent = 'Adding to database...';
        } catch (error) {
            console.error('Image upload failed:', error);
            showToast('Image upload failed. Adding without image.', true);
            imageUrl = '';
        }
    }
    
    const data = {
        action: 'add',
        name: name,
        title: title,
        phone: phone,
        extension: ext,
        email: email,
        imageUrl: imageUrl
    };
    
    try {
        const response = await fetch(CONFIG.scriptUrl, {
            method: 'POST',
            mode: 'no-cors',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(data)
        });
        
        // Since no-cors doesn't return response, assume success
        showToast('Employee added to database!');
        closeModal();
        
        // Reset image state after successful add
        uploadedR2Url = null;
        currentImageFile = null;
    } catch (error) {
        console.error('Error:', error);
        showToast('Failed to add to database. Check console.', true);
        document.getElementById('modalLoader').classList.remove('active');
    }
}

// ========================================
// List Page Functions
// ========================================

async function loadEmployees() {
    const loader = document.getElementById('listLoader');
    const grid = document.getElementById('employeeGrid');
    const empty = document.getElementById('emptyState');
    
    if (!grid) return;
    
    loader.style.display = 'block';
    grid.innerHTML = '';
    empty.style.display = 'none';
    
    try {
        const response = await fetch(`${CONFIG.scriptUrl}?action=list`);
        const employees = await response.json();
        
        employeesCache = employees;
        
        loader.style.display = 'none';
        
        if (employees.length === 0) {
            empty.style.display = 'block';
            return;
        }
        
        renderEmployeeGrid(employees);
    } catch (error) {
        console.error('Error loading employees:', error);
        loader.style.display = 'none';
        empty.style.display = 'block';
        empty.querySelector('h3').textContent = 'Error loading data';
        empty.querySelector('p').textContent = 'Could not connect to the database. Please check the script URL configuration.';
    }
}

function renderEmployeeGrid(employees) {
    const grid = document.getElementById('employeeGrid');
    const empty = document.getElementById('emptyState');
    
    grid.innerHTML = '';
    
    if (employees.length === 0) {
        empty.style.display = 'block';
        return;
    }
    
    empty.style.display = 'none';
    
    employees.forEach(emp => {
        const card = document.createElement('div');
        card.className = 'employee-card';
        card.onclick = () => openSignatureModal(emp);
        
        const avatarHtml = emp.imageUrl 
            ? `<img src="${emp.imageUrl}" class="employee-avatar" alt="${emp.name}" onerror="this.outerHTML='<div class=\\'employee-avatar-placeholder\\'><i class=\\'fa-solid fa-user\\'></i></div>'">`
            : `<div class="employee-avatar-placeholder"><i class="fa-solid fa-user"></i></div>`;
        
        card.innerHTML = `
            <div class="employee-card-header">
                ${avatarHtml}
                <div>
                    <div class="employee-name">${emp.name}</div>
                    <div class="employee-title">${emp.title}</div>
                </div>
            </div>
            <div class="employee-details">
                <p><i class="fa-solid fa-phone"></i> ${emp.phone} Ext. ${emp.extension}</p>
                <p><i class="fa-solid fa-envelope"></i> ${emp.email}</p>
            </div>
            <div class="employee-card-footer">
                <button class="btn btn-secondary btn-sm" onclick="event.stopPropagation(); openSignatureModal(${JSON.stringify(emp).replace(/"/g, '&quot;')})">
                    <i class="fa-solid fa-signature"></i> View Signature
                </button>
            </div>
        `;
        
        grid.appendChild(card);
    });
}

function filterList() {
    const filter = document.getElementById('filterInput').value.toLowerCase();
    const filtered = employeesCache.filter(emp => 
        emp.name.toLowerCase().includes(filter) || 
        emp.title.toLowerCase().includes(filter)
    );
    renderEmployeeGrid(filtered);
}

function openSignatureModal(employee) {
    currentModalEmployee = employee;
    document.getElementById('signatureModal').classList.add('active');
    document.getElementById('modalEmployeeName').textContent = employee.name;
    
    // Reset format selector to default
    const formatSelect = document.getElementById('modalFormatSelect');
    if (formatSelect) formatSelect.value = 'wellbound';
    
    const signatureHtml = generateSignatureHTML({
        name: employee.name,
        title: employee.title,
        phone: employee.phone,
        extension: employee.extension,
        email: employee.email,
        imageUrl: employee.imageUrl
    }, 'wellbound');
    
    document.getElementById('modalSignaturePreview').innerHTML = signatureHtml;
}

function updateModalSignature() {
    if (!currentModalEmployee) return;
    const format = document.getElementById('modalFormatSelect')?.value || 'wellbound';
    const signatureHtml = generateSignatureHTML({
        name: currentModalEmployee.name,
        title: currentModalEmployee.title,
        phone: currentModalEmployee.phone,
        extension: currentModalEmployee.extension,
        email: currentModalEmployee.email,
        imageUrl: currentModalEmployee.imageUrl
    }, format);
    document.getElementById('modalSignaturePreview').innerHTML = signatureHtml;
}

function updateSearchSignature() {
    if (!currentSearchEmployee) return;
    const format = document.getElementById('searchFormatSelect')?.value || 'wellbound';
    const signatureHtml = generateSignatureHTML({
        name: currentSearchEmployee.name,
        title: currentSearchEmployee.title,
        phone: currentSearchEmployee.phone,
        extension: currentSearchEmployee.extension,
        email: currentSearchEmployee.email,
        imageUrl: currentSearchEmployee.imageUrl
    }, format);
    document.getElementById('searchSignaturePreview').innerHTML = signatureHtml;
}

function closeSignatureModal() {
    document.getElementById('signatureModal').classList.remove('active');
}

// ========================================
// Search Page Functions
// ========================================

async function searchEmployee() {
    const firstName = document.getElementById('firstName').value.trim();
    const lastName = document.getElementById('lastName').value.trim();
    
    if (!firstName && !lastName) {
        showToast('Please enter a first or last name', true);
        return;
    }
    
    const loader = document.getElementById('searchLoader');
    const result = document.getElementById('searchResult');
    const empty = document.getElementById('searchEmpty');
    const btn = document.getElementById('searchBtn');
    
    loader.style.display = 'block';
    result.style.display = 'none';
    empty.style.display = 'none';
    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Searching...';
    
    try {
        const response = await fetch(`${CONFIG.scriptUrl}?action=search&firstName=${encodeURIComponent(firstName)}&lastName=${encodeURIComponent(lastName)}`);
        const data = await response.json();
        
        loader.style.display = 'none';
        btn.disabled = false;
        btn.innerHTML = '<i class="fa-solid fa-magnifying-glass"></i> Search';
        
        if (data.found) {
            const emp = data.employee;
            currentSearchEmployee = emp;
            
            document.getElementById('resultName').textContent = emp.name;
            document.getElementById('resultTitle').textContent = emp.title;
            
            const resultImg = document.getElementById('resultImage');
            if (emp.imageUrl) {
                resultImg.src = emp.imageUrl;
                resultImg.style.display = 'block';
            } else {
                resultImg.style.display = 'none';
            }
            
            // Reset format selector
            const searchFormatSelect = document.getElementById('searchFormatSelect');
            if (searchFormatSelect) searchFormatSelect.value = 'wellbound';
            
            const signatureHtml = generateSignatureHTML({
                name: emp.name,
                title: emp.title,
                phone: emp.phone,
                extension: emp.extension,
                email: emp.email,
                imageUrl: emp.imageUrl
            }, 'wellbound');
            
            document.getElementById('searchSignaturePreview').innerHTML = signatureHtml;
            result.style.display = 'block';
        } else {
            empty.style.display = 'block';
        }
    } catch (error) {
        console.error('Error searching:', error);
        loader.style.display = 'none';
        btn.disabled = false;
        btn.innerHTML = '<i class="fa-solid fa-magnifying-glass"></i> Search';
        showToast('Search failed. Check console for details.', true);
    }
}

// ========================================
// Extensions Directory Functions
// ========================================

function openExtensionsModal() {
    document.getElementById('extensionsModal').classList.add('active');
    document.getElementById('extensionSearchInput').value = '';
    loadExtensions();
}

function closeExtensionsModal() {
    document.getElementById('extensionsModal').classList.remove('active');
}

async function loadExtensions() {
    const loader = document.getElementById('extensionsLoader');
    const grid = document.getElementById('extensionsGrid');
    const empty = document.getElementById('extensionsEmpty');
    
    if (!grid) return;
    
    loader.style.display = 'block';
    grid.innerHTML = '';
    empty.style.display = 'none';
    
    try {
        const response = await fetch(`${CONFIG.scriptUrl}?action=extensions`);
        const extensions = await response.json();
        
        extensionsCache = extensions;
        
        loader.style.display = 'none';
        
        if (extensions.length === 0) {
            empty.style.display = 'block';
            return;
        }
        
        renderExtensionsGrid(extensions);
    } catch (error) {
        console.error('Error loading extensions:', error);
        loader.style.display = 'none';
        empty.style.display = 'block';
        empty.querySelector('p').textContent = 'Could not load extensions. Please try again.';
    }
}

function renderExtensionsGrid(extensions) {
    const grid = document.getElementById('extensionsGrid');
    const empty = document.getElementById('extensionsEmpty');
    
    grid.innerHTML = '';
    
    if (extensions.length === 0) {
        empty.style.display = 'block';
        return;
    }
    
    empty.style.display = 'none';
    
    extensions.forEach(ext => {
        const card = document.createElement('div');
        card.className = 'extension-card';
        
        card.innerHTML = `
            <div class="extension-card-header">
                <div class="extension-icon">
                    <i class="fa-solid fa-phone"></i>
                </div>
                <div class="extension-number">${ext.extension}</div>
            </div>
            <div class="extension-name">${ext.name}</div>
            <div class="extension-outbound">
                <i class="fa-solid fa-building"></i>
                ${ext.outboundName}
            </div>
        `;
        
        grid.appendChild(card);
    });
}

function filterExtensions() {
    const searchTerm = document.getElementById('extensionSearchInput').value.toLowerCase().trim();
    
    if (!searchTerm) {
        renderExtensionsGrid(extensionsCache);
        return;
    }
    
    const filtered = extensionsCache.filter(ext => 
        ext.name.toLowerCase().includes(searchTerm) || 
        ext.extension.includes(searchTerm) ||
        ext.outboundName.toLowerCase().includes(searchTerm)
    );
    
    renderExtensionsGrid(filtered);
}

// ========================================
// Toast Notification
// ========================================

function showToast(message, isError = false) {
    const toast = document.getElementById('toast');
    const toastMessage = document.getElementById('toastMessage');
    
    toastMessage.textContent = message;
    toast.classList.toggle('error', isError);
    toast.querySelector('i').className = isError ? 'fa-solid fa-xmark' : 'fa-solid fa-check';
    
    toast.classList.add('active');
    
    setTimeout(() => {
        toast.classList.remove('active');
    }, 3000);
}

// ========================================
// Initialization
// ========================================

document.addEventListener('DOMContentLoaded', function() {
    // Form validation styling
    const requiredFields = document.querySelectorAll('input[required]');
    requiredFields.forEach(field => {
        field.addEventListener('blur', function() {
            if (!this.value) {
                this.style.borderColor = '#ef4444';
            } else {
                this.style.borderColor = '';
            }
        });
        
        field.addEventListener('input', function() {
            if (this.value) {
                this.style.borderColor = '';
            }
        });
    });
    
    // Close modal on overlay click
    const modalOverlay = document.getElementById('modalOverlay');
    if (modalOverlay) {
        modalOverlay.addEventListener('click', function(e) {
            if (e.target === this) {
                closeModal();
            }
        });
    }
    
    // Close signature modal on overlay click
    const signatureModal = document.getElementById('signatureModal');
    if (signatureModal) {
        signatureModal.addEventListener('click', function(e) {
            if (e.target === this) {
                closeSignatureModal();
            }
        });
    }
    
    // Close extensions modal on overlay click
    const extensionsModal = document.getElementById('extensionsModal');
    if (extensionsModal) {
        extensionsModal.addEventListener('click', function(e) {
            if (e.target === this) {
                closeExtensionsModal();
            }
        });
    }
    
    // Escape key to close modals
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape') {
            closeModal();
            if (typeof closeSignatureModal === 'function') {
                closeSignatureModal();
            }
            if (typeof closeExtensionsModal === 'function') {
                closeExtensionsModal();
            }
        }
    });
    
    // Format dropdown change on create page
    const formatSelect = document.getElementById('signatureFormat');
    if (formatSelect) {
        formatSelect.addEventListener('change', function() {
            const format = this.value;
            const borderColor = (FORMATS[format] || FORMATS.wellbound).borderColor;
            
            // Re-create circular image preview with new border color
            if (uploadedImageData) {
                createCircularImage(uploadedImageData, function(circularData) {
                    circularImageData = circularData;
                    const preview = document.getElementById('imagePreview');
                    if (preview) preview.src = circularData;
                }, borderColor);
            }
            
            // Re-generate signature preview if one exists
            const signaturePreview = document.getElementById('signaturePreview');
            if (signaturePreview && !signaturePreview.querySelector('.preview-placeholder')) {
                generateSignature();
            }
        });
    }
});
