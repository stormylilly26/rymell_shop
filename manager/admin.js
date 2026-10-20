// --- Google Sheets Configuration ---
const GOOGLE_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbwDwtE3FqiWvMTudtcVBANhZcRQkU7_NAb381HLfrQo1BN1JKW2tM5X6XHveUyk-gU/exec";
// ------------------------------------

document.addEventListener('DOMContentLoaded', () => {
    // --- UI Elements ---
    const loginOverlay = document.getElementById('login-overlay');
    const loginForm = document.getElementById('login-form');
    const dashboardContent = document.getElementById('dashboard-content');
    const submitBtn = document.getElementById('submit-btn');
    const addProductForm = document.getElementById('add-product-form');
    const productsList = document.getElementById('products-list');
    const toast = document.getElementById('toast');
    const refreshBtn = document.getElementById('refresh-btn');
    const featuresContainer = document.getElementById('features-container');
    const addFeatureBtn = document.getElementById('add-feature-row');
    const successModal = document.getElementById('success-modal');
    const galleryPreview = document.getElementById('gallery-preview');
    const mainImgUploadBtn = document.querySelector('.custom-file-upload');

    let editingProductId = null;
    // --- Media Buffer Engine (JS Runtime Memory Only - Zero DOM Bloat) ---
    let mainImageBase64 = "";
    let galleryImagesBase64 = []; // Store base64 strings or existing Drive IDs
    let quill;


    // --- Advanced Quill Setup with Arabic Hover Tooltips ---
    // --- Optimized Quill Configuration ---
    quill = new Quill('#editor-container', {
        theme: 'snow',
        modules: {
            toolbar: [
                // CHANGED: We replaced 'header' with 'size' so it applies only to selected text
                [{ 'size': ['small', false, 'large', 'huge'] }],
                ['bold', 'italic', 'underline', 'strike'],
                [{ 'list': 'ordered' }, { 'list': 'bullet' }],
                [{ 'align': [] }],
                [{ 'direction': 'rtl' }],
                ['clean']
            ]
        },
        // CHANGED: Make sure 'size' is listed here instead of 'header'
        formats: [
            'size', 'bold', 'italic', 'underline', 'strike',
            'list', 'align', 'direction'
        ]
    });

    quill.root.setAttribute('dir', 'auto');
    // Dictionary mapping Quill classes to clear Arabic hover text
    const toolbarTooltips = {
        '.ql-header': 'حجم الخط / العناوين',
        '.ql-bold': 'نص عريض (مهم)',
        '.ql-italic': 'نص مائل',
        '.ql-underline': 'وضع سطر تحت النص',
        '.ql-strike': 'شطب النص (للسعر القديم)',
        '.ql-list[value="ordered"]': 'قائمة مرقمة (خطوات)',
        '.ql-list[value="bullet"]': 'قائمة منقطة (مميزات)',
        '.ql-align': 'محاذاة وتوجيه النص',
        '.ql-clean': 'مسح التنسيق والتنظيف'
    };

    // Loop through the dictionary and apply HTML title attributes to the buttons
    Object.keys(toolbarTooltips).forEach(selector => {
        const elements = document.querySelectorAll(`.ql-toolbar ${selector}`);
        elements.forEach(el => {
            el.setAttribute('title', toolbarTooltips[selector]);
        });
    });

    // --- 1. Authentication Engine (Token-Based) ---
    const checkAuth = () => {
        // Look for the secure token instead of the 'true' string
        const token = sessionStorage.getItem('rymel_admin_token');
        if (token) {
            loginOverlay.style.display = 'none';
            dashboardContent.style.display = 'flex';
            if (GOOGLE_SCRIPT_URL) submitBtn.disabled = false;
            fetchProducts();
            fetchNiches();
        } else {
            loginOverlay.style.display = 'flex';
            dashboardContent.style.display = 'none';
        }
    };

    const handleUnauthorized = () => {
        // Clear the token if the server rejects it
        sessionStorage.removeItem('rymel_admin_token');
        showToast('انتهت الجلسة أو خطأ في الصلاحيات. يرجى تسجيل الدخول مجدداً.', true);
        dashboardContent.style.display = 'none';
        loginOverlay.style.display = 'flex';
        loginOverlay.style.opacity = '1';
    };

    // --- Login Form Submission ---
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const user = document.getElementById('admin-user').value.trim();
        const pass = document.getElementById('admin-pass').value.trim();
        const error = document.getElementById('login-error');
        const loginBtn = loginForm.querySelector('button');

        loginBtn.disabled = true;
        loginBtn.innerHTML = '<i data-lucide="loader" class="spin"></i> جاري التحقق...';
        lucide.createIcons();
        error.style.display = 'none';

        try {
            const payload = { action: "admin_login", username: user, password: pass };
            const params = new URLSearchParams();
            params.append('payload', JSON.stringify(payload));

            const response = await fetch(GOOGLE_SCRIPT_URL, {
                method: 'POST',
                body: params
            });

            const result = await response.json();

            if (result.status === "success") {
                // Save the secure token sent by Google Apps Script
                sessionStorage.setItem('rymel_admin_token', result.token);

                loginOverlay.style.opacity = '0';
                setTimeout(() => {
                    loginOverlay.style.display = 'none';
                    dashboardContent.style.display = 'flex';
                    if (GOOGLE_SCRIPT_URL) submitBtn.disabled = false;
                    fetchProducts();
                    fetchNiches();
                }, 300);
            } else {
                error.textContent = "اسم المستخدم أو كلمة المرور غير صحيحة";
                error.style.display = 'block';
            }
        } catch (err) {
            error.textContent = "حدث خطأ في الاتصال بالسيرفر";
            error.style.display = 'block';
        } finally {
            loginBtn.disabled = false;
            loginBtn.innerHTML = 'دخول';
            lucide.createIcons();
        }
    });

    // --- Sidebar Navigation ---
    const navItems = document.querySelectorAll('.nav-item[data-section]');
    navItems.forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            const sectionId = item.getAttribute('data-section');

            navItems.forEach(nav => nav.classList.remove('active'));
            item.classList.add('active');

            document.querySelectorAll('.content-grid-full').forEach(sec => sec.style.display = 'none');
            const secEl = document.getElementById(sectionId);
            if (secEl) {
                secEl.style.display = 'grid';
            }

            if (sectionId === 'reviews-section') fetchReviews();
            if (sectionId === 'products-section') fetchProducts();
        });
    });

    checkAuth();



    // --- 2. Dynamic Feature Builder ---
    function createFeatureRow(name = '', values = '') {
        const row = document.createElement('div');
        row.className = 'feature-row';
        row.innerHTML = `
            <input type="text" class="feat-key" placeholder="الخاصية (مثلاً: المقاس)" value="${name}">
            <input type="text" class="feat-val" placeholder="القيم (مفصولة بفاصلة ,)" value="${values}">
            <button type="button" class="btn-remove"><i data-lucide="x"></i></button>
        `;
        featuresContainer.appendChild(row);
        lucide.createIcons();

        row.querySelector('.btn-remove').addEventListener('click', () => {
            row.remove();
            updatePreview();
        });
        row.querySelectorAll('input').forEach(input => input.addEventListener('input', updatePreview));
    }

    addFeatureBtn.addEventListener('click', () => createFeatureRow());

    // --- 3. Async Image Reading Engine ---
    async function readFilesAsBase64(files) {
        const readPromises = files.map(file => {
            return new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = (event) => resolve(event.target.result);
                reader.onerror = (err) => reject(err);
                reader.readAsDataURL(file);
            });
        });
        return Promise.all(readPromises);
    }

    // Main Image Uploader Change Event
    const mainImgInput = document.getElementById('main-image-file');
    mainImgInput.addEventListener('change', async (e) => {
        const files = Array.from(e.target.files);
        if (files.length > 0) {
            try {
                const results = await readFilesAsBase64(files);
                mainImageBase64 = results[0];

                // Show Main Image preview in uploader block
                const previewContainer = mainImgUploadBtn;
                let existingPreview = document.getElementById('main-img-edit-preview');
                if (!existingPreview) {
                    existingPreview = document.createElement('img');
                    existingPreview.id = 'main-img-edit-preview';
                    existingPreview.style.cssText = "width:100px; height:100px; object-fit:cover; border-radius:8px; margin-bottom:10px; border:2px solid var(--admin-accent)";
                    previewContainer.parentNode.insertBefore(existingPreview, previewContainer);
                }
                existingPreview.src = mainImageBase64;
                const previewSpan = previewContainer.querySelector('span');
                if (previewSpan) previewSpan.textContent = "تغيير الصورة الرئيسية";

                updatePreview();
            } catch (err) {
                console.error("Main image load failed:", err);
                showToast("فشل في معالجة الصورة الرئيسية", true);
            }
        }
    });

    // Gallery Multi-Uploader Change Event
    const galleryInput = document.getElementById('gallery-images-file');
    galleryInput.addEventListener('change', async (e) => {
        const files = Array.from(e.target.files);
        if (files.length > 0) {
            try {
                // Stream and process base64 strings in memory
                const results = await readFilesAsBase64(files);
                results.forEach(base64 => {
                    galleryImagesBase64.push(base64);
                    addGalleryItemToPreview(base64);
                });
                updatePreview();
                galleryInput.value = ""; // Clear input file selector
            } catch (err) {
                console.error("Gallery files load failed:", err);
                showToast("فشل في معالجة صور المعرض", true);
            }
        }
    });

    function addGalleryItemToPreview(src) {
        const div = document.createElement('div');
        div.className = 'gallery-item-container';
        div.style.position = 'relative';
        div.style.display = 'inline-block';

        const displaySrc = (src.startsWith('data:image') || src.startsWith('http'))
            ? src
            : `https://lh3.googleusercontent.com/d/${src}`;

        const isVideo = src.startsWith('data:video') || /\.(mp4|webm|ogg)(\?.*)?$/i.test(src);

let mediaTag = isVideo 
    ? `<video src="${displaySrc}" autoplay loop muted playsinline style="width:80px; height:80px; object-fit:cover; border-radius:8px; margin-right:10px; margin-bottom:10px;"></video>`
    : `<img src="${displaySrc}" class="gallery-item" style="width:80px; height:80px; object-fit:cover; border-radius:8px; margin-right:10px; margin-bottom:10px;">`;

div.innerHTML = `
    ${mediaTag}
    <button type="button" class="btn-remove-img" style="position:absolute; top:-5px; right:5px; background:var(--danger); color:white; border:none; border-radius:50%; width:20px; height:20px; cursor:pointer; font-size:12px; display:flex; align-items:center; justify-content:center;">&times;</button>
`;
        galleryPreview.appendChild(div);

        div.querySelector('.btn-remove-img').addEventListener('click', () => {
            const index = galleryImagesBase64.indexOf(src);
            if (index > -1) {
                galleryImagesBase64.splice(index, 1);
            }
            div.remove();
            updatePreview();
        });
    }

    // --- 4. Live Preview Logic ---
    function updatePreview() {
        const pTitle = document.getElementById('preview-title');
        const pDesc = document.getElementById('preview-desc');
        const pImg = document.getElementById('preview-img');
        const pPrice = document.getElementById('preview-price');
        const pStock = document.getElementById('preview-stock');
        const pFeatView = document.getElementById('preview-dynamic-features');

        const name = document.getElementById('product-name').value || 'اسم المنتج';
        const price = document.getElementById('product-price').value || '0';
        const stock = parseInt(document.getElementById('product-stock').value) || 0;
        // 1. Get HTML from Quill instead of .value
        let desc = quill.root.innerHTML;
        if (desc === '<p><br></p>') desc = 'الوصف يظهر هنا...'; // Quill's empty state
        pTitle.textContent = name;
        pPrice.textContent = `${price} دج`;
        pDesc.innerHTML = desc;
        pStock.textContent = `المخزون: ${stock}`;
        pStock.className = stock > 5 ? 'preview-stock-badge in-stock' : 'preview-stock-badge';

        if (mainImageBase64) {
    const src = (mainImageBase64.startsWith('data:') || mainImageBase64.startsWith('http'))
        ? mainImageBase64
        : `https://lh3.googleusercontent.com/d/${mainImageBase64}`;
        
    const isVid = mainImageBase64.startsWith('data:video') || /\.(mp4|webm|ogg)(\?.*)?$/i.test(src);
    
    // You will need to replace the pImg element with a video element dynamically if isVid is true
} else {
            pImg.src = "https://images.unsplash.com/photo-1556228720-195a672e8a03?q=80&w=800&auto=format&fit=crop";
        }

        // Preview Dynamic Features
        pFeatView.innerHTML = '';
        document.querySelectorAll('.feature-row').forEach(row => {
            const key = row.querySelector('.feat-key').value;
            const vals = row.querySelector('.feat-val').value;
            if (key && vals) {
                const div = document.createElement('div');
                div.innerHTML = `<span style="font-size:0.8rem; color:var(--admin-accent)">${key}: </span><small>${vals}</small>`;
                pFeatView.appendChild(div);
            }
        });
    }

    ['product-name', 'product-price', 'product-stock'].forEach(id => {
        document.getElementById(id).addEventListener('input', updatePreview);
    });
    quill.on('text-change', updatePreview);

    // --- 5. Payload Serialization & Submission ---
    addProductForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        if (!mainImageBase64) {
            return showToast('يرجى اختيار الصورة الرئيسية للمنتج', true);
        }

        // Serialize dynamic feature matrix into structured JSON array
        const optionsList = [];
        document.querySelectorAll('.feature-row').forEach(row => {
            const key = row.querySelector('.feat-key').value.trim();
            const vals = row.querySelector('.feat-val').value.split(',').map(v => v.trim()).filter(v => v);
            if (key && vals.length) {
                optionsList.push({ name: key, values: vals });
            }
        });

        // Generate product URL slug from name for uniqueness
        const nameVal = document.getElementById('product-name').value.trim();
        const slug = nameVal.toLowerCase()
            .replace(/[\s_]+/g, '-')
            .replace(/[^\u0621-\u064A\u0660-\u0669a-zA-Z0-9-]/g, '')
            .replace(/-+/g, '-')
            .replace(/(^-|-$)/g, '');
        const finalProductId = editingProductId || slug || Date.now().toString();

        const productData = {
            action: editingProductId ? 'edit_product' : 'UPLOAD',
            id: finalProductId,
            name: nameVal,
            price: document.getElementById('product-price').value,
            description: quill.root.innerHTML,
            image: mainImageBase64,
            gallery: galleryImagesBase64, // Transmitted as structured base64/ID memory array
            stock: document.getElementById('product-stock').value,
            options_json: JSON.stringify(optionsList),
            niche: document.getElementById('product-niche-select') ? document.getElementById('product-niche-select').value : "", // NEW: Captures the dropdown value
            auth: {
                token: sessionStorage.getItem('rymel_admin_token') || ""
            }
        };

        try {
            submitBtn.disabled = true;
            submitBtn.innerHTML = 'جاري رفع ملفات الميديا... <i data-lucide="loader" class="spin"></i>';
            lucide.createIcons();

            // Simple request structure to prevent CORS Preflight issues
            const formData = new URLSearchParams();
            formData.append('payload', JSON.stringify(productData));

            const response = await fetch(GOOGLE_SCRIPT_URL, {
                method: 'POST',
                body: formData
            });

            const json = await response.json();
            if (json.status === "error") {
                if (json.message === "Unauthorized Access") {
                    handleUnauthorized();
                } else {
                    showToast(json.message || 'فشلت العملية', true);
                }
                return;
            }

            // Success feedback UX
            submitBtn.innerHTML = 'تم النشر بنجاح! <i data-lucide="check"></i>';
            showToast('تم حفظ المنتج بنجاح!');

            // Construct link
            let finalLink = `${window.location.origin}/product.html?id=${productData.id}`;
            if (window.location.protocol === 'file:') {
                finalLink = `product.html?id=${productData.id}`;
            }

            document.getElementById('final-link-input').value = finalLink;
            document.getElementById('view-page-btn').href = finalLink;
            successModal.style.display = 'flex';
            lucide.createIcons();

            // Reset dashboard state
            addProductForm.reset();
            // ADD THIS LINE TO CLEAR QUILL:
            quill.setContents([]);
            featuresContainer.innerHTML = '';
            galleryPreview.innerHTML = '';

            const existingPreview = document.getElementById('main-img-edit-preview');
            if (existingPreview) existingPreview.remove();

            const previewSpan = mainImgUploadBtn.querySelector('span');
            if (previewSpan) previewSpan.textContent = "اختر الصورة الرئيسية";

            editingProductId = null;
            mainImageBase64 = "";
            galleryImagesBase64 = [];

            document.getElementById('form-title-h2').innerHTML = '<i data-lucide="plus-circle"></i> إضافة منتج احترافي';
            updatePreview();
            setTimeout(fetchProducts, 1500);

        } catch (error) {
            console.error('Submission error:', error);
            showToast('فشل في الاتصال بالسيرفر لإتمام الرفع', true);
        } finally {
            submitBtn.disabled = false;
            submitBtn.innerHTML = 'حفظ المنتج والرفع <i data-lucide="cloud-upload"></i>';
            lucide.createIcons();
        }
    });

    // Copy to Clipboard
    document.getElementById('copy-link-btn').addEventListener('click', () => {
        const input = document.getElementById('final-link-input');
        input.select();
        document.execCommand('copy');
        showToast('تم نسخ الرابط!');
    });

    // --- 6. Fetching & Rendering ---
    async function fetchProducts() {
        if (!GOOGLE_SCRIPT_URL) return;
        productsList.innerHTML = `<tr><td colspan="6" class="text-center">جاري جلب البيانات... <i data-lucide="loader" class="spin"></i></td></tr>`;
        lucide.createIcons();

        try {
            const response = await fetch(`${GOOGLE_SCRIPT_URL}?action=list&t=${Date.now()}`);
            const json = await response.json();
            if (json.status === "success") {
                renderProducts(json.data);
            }
        } catch (error) {
            console.error('Fetch error:', error);
            productsList.innerHTML = `<tr><td colspan="6" class="text-center" style="color:var(--danger)">
                فشل في جلب البيانات. تأكد من إعدادات النشر على Apps Script.
            </td></tr>`;
        }
    }
    function stripHtml(html) {
    const tmp = document.createElement('div');
    tmp.innerHTML = html || '';
    return tmp.textContent || tmp.innerText || '';
}

    function renderProducts(products) {
    productsList.innerHTML = '';
    products.reverse().forEach(p => {
        const tr = document.createElement('tr');
        const plainDesc = stripHtml(p.description).substring(0, 50);

        tr.innerHTML = `
            <td><img src="${p.image}" class="product-thumb"></td>
            <td>${p.title}</td>
            <td>${p.price} دج</td>
            <td>${p.stock}</td>
            <td style="font-size:0.8rem">${plainDesc}...</td>
            <td>
                <button class="btn-icon edit-btn" data-id="${p.id}"><i data-lucide="edit"></i></button>
                <button class="btn-icon delete-btn" data-id="${p.id}" style="color:var(--danger)"><i data-lucide="trash-2"></i></button>
            </td>
        `;
        productsList.appendChild(tr);

        // Defensive: never let one bad row take down the whole loop again
        const delBtn = tr.querySelector('.delete-btn');
        const editBtn = tr.querySelector('.edit-btn');
        if (delBtn) delBtn.addEventListener('click', () => deleteProduct(p.id, tr));
        if (editBtn) editBtn.addEventListener('click', () => loadEdit(p.id));
    });
    lucide.createIcons();
}

    async function loadEdit(id) {
        showToast('جاري جلب بيانات المنتج...');
        try {
            const resp = await fetch(`${GOOGLE_SCRIPT_URL}?id=${id}`);
            const json = await resp.json();
            if (json.status === 'success') {
                const p = json.data;
                editingProductId = id;

                // Load text fields
                document.getElementById('product-name').value = p.name || "";
                document.getElementById('product-price').value = p.price || "";
                document.getElementById('product-stock').value = p.stock || 0;
                // INJECT HTML INTO QUILL:
                quill.root.innerHTML = p.description || "";
                // Hydrate main image variables in memory
                mainImageBase64 = p.mainImageId || "";
                if (mainImageBase64) {
                    const previewContainer = mainImgUploadBtn;
                    let existingPreview = document.getElementById('main-img-edit-preview');
                    if (!existingPreview) {
                        existingPreview = document.createElement('img');
                        existingPreview.id = 'main-img-edit-preview';
                        existingPreview.style.cssText = "width:100px; height:100px; object-fit:cover; border-radius:8px; margin-bottom:10px; border:2px solid var(--admin-accent)";
                        previewContainer.parentNode.insertBefore(existingPreview, previewContainer);
                    }
                    existingPreview.src = `https://lh3.googleusercontent.com/d/${mainImageBase64}`;
                    const previewSpan = previewContainer.querySelector('span');
                    if (previewSpan) previewSpan.textContent = "تغيير الصورة الرئيسية";
                }

                // Hydrate gallery images in memory
                galleryImagesBase64 = p.galleryIds ? p.galleryIds.split(',').map(x => x.trim()).filter(x => x) : [];

                galleryPreview.innerHTML = '';
                galleryImagesBase64.forEach(id => addGalleryItemToPreview(id));

                // Hydrate features
                featuresContainer.innerHTML = '';
                if (p.options) {
                    try {
                        const opts = typeof p.options === 'string' ? JSON.parse(p.options) : p.options;
                        if (Array.isArray(opts)) {
                            opts.forEach(o => createFeatureRow(o.name, Array.isArray(o.values) ? o.values.join(', ') : o.values));
                        }
                    } catch (e) {
                        console.warn("Could not parse options as JSON:", p.options);
                    }
                }

                document.getElementById('form-title-h2').innerHTML = '<i data-lucide="edit-3"></i> تعديل المنتج';
                window.scrollTo({ top: 0, behavior: 'smooth' });
                updatePreview();
            }
        } catch (e) {
            console.error(e);
            showToast('خطأ في تحميل بيانات التعديل', true);
        }
    }

    async function deleteProduct(id, rowEl) {
        if (!confirm('سيتم حذف المنتج نهائياً من قاعدة البيانات! هل أنت متأكد؟')) return;
        try {
            rowEl.style.opacity = '0.5';

            const payload = {
                action: 'delete_product',
                id: id,
                auth: {
                    token: sessionStorage.getItem('rymel_admin_token') || ""
                }
            };

            const formData = new URLSearchParams();
            formData.append('payload', JSON.stringify(payload));

            const resp = await fetch(GOOGLE_SCRIPT_URL, {
                method: 'POST',
                body: formData
            });
            const json = await resp.json();
            if (json.status === "error") {
                if (json.message === "Unauthorized Access") {
                    handleUnauthorized();
                } else {
                    showToast(json.message, true);
                    rowEl.style.opacity = '1';
                }
                return;
            }

            rowEl.remove();
            showToast('تم حذف المنتج بنجاح');
        } catch (e) {
            console.error(e);
            showToast('خطأ أثناء حذف المنتج', true);
        }
    }

    function showToast(message, isError = false) {
        toast.textContent = message;
        toast.style.backgroundColor = isError ? 'var(--danger)' : 'var(--success)';
        toast.classList.add('show');
        setTimeout(() => toast.classList.remove('show'), 3000);
    }

    refreshBtn.addEventListener('click', () => {
        fetchNiches();
        const activeSec = document.querySelector('.nav-item.active').getAttribute('data-section');
        if (activeSec === 'reviews-section') fetchReviews();
        else fetchProducts();
    });

    // --- 7. REVIEWS ENGINE ---
    const reviewForm = document.getElementById('add-review-form');
    const reviewInput = document.getElementById('review-image-file');
    const reviewsList = document.getElementById('reviews-list');
    let selectedReviewImages = [];

    if (reviewInput) {
        reviewInput.addEventListener('change', async (e) => {
            const files = Array.from(e.target.files);
            if (files.length > 0) {
                try {
                    selectedReviewImages = await readFilesAsBase64(files);
                    const previewGrid = document.getElementById('review-preview-grid');
                    const previewCont = document.getElementById('review-preview-container');

                    if (previewGrid) previewGrid.innerHTML = '';

                    selectedReviewImages.forEach(optimized => {
                        if (previewGrid) {
                            const img = document.createElement('img');
                            img.src = optimized;
                            img.style.cssText = "width:80px; height:80px; object-fit:cover; border-radius:8px; border:1px solid var(--admin-border)";
                            previewGrid.appendChild(img);
                        }
                    });

                    if (previewCont) previewCont.style.display = 'block';
                    showToast(`تمت معالجة ${files.length} صور بنجاح`);
                } catch (err) {
                    console.error("Review file reading failure:", err);
                    showToast("خطأ في قراءة ملفات الآراء", true);
                }
            }
        });
    }

    if (reviewForm) {
        reviewForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const btn = document.getElementById('review-submit-btn');

            if (selectedReviewImages.length === 0) return showToast('يرجى اختيار صور أولاً', true);

            btn.disabled = true;
            btn.innerHTML = `<i data-lucide="loader" class="spin"></i> جاري رفع 1/${selectedReviewImages.length}...`;
            lucide.createIcons();

            try {
                // Upload screenshots sequentially using simple requests
                for (let i = 0; i < selectedReviewImages.length; i++) {
                    btn.innerHTML = `<i data-lucide="loader" class="spin"></i> جاري رفع ${i + 1}/${selectedReviewImages.length}...`;
                    lucide.createIcons();

                    const payload = {
                        action: 'add_review',
                        image: selectedReviewImages[i],
                        auth: {
                            token: sessionStorage.getItem('rymel_admin_token') || ""
                        }
                    };

                    const formData = new URLSearchParams();
                    formData.append('payload', JSON.stringify(payload));

                    const resp = await fetch(GOOGLE_SCRIPT_URL, {
                        method: 'POST',
                        body: formData
                    });

                    const json = await resp.json();
                    if (json.status === "error") {
                        if (json.message === "Unauthorized Access") {
                            handleUnauthorized();
                            return;
                        } else {
                            throw new Error(json.message);
                        }
                    }
                }

                showToast('تم رفع جميع الصور بنجاح');
                reviewForm.reset();
                selectedReviewImages = [];
                document.getElementById('review-preview-container').style.display = 'none';
                setTimeout(fetchReviews, 1000);
            } catch (e) {
                console.error(e);
                showToast('حدث خطأ أثناء رفع الآراء', true);
            } finally {
                btn.disabled = false;
                btn.innerHTML = '<span>حفظ الآراء والرفع</span> <i data-lucide="cloud-upload"></i>';
                lucide.createIcons();
            }
        });
    }

    async function fetchReviews() {
        if (!reviewsList) return;
        reviewsList.innerHTML = '<div class="loader-container"><i data-lucide="loader" class="spin"></i> جاري جلب الآراء...</div>';
        lucide.createIcons();

        try {
            const resp = await fetch(`${GOOGLE_SCRIPT_URL}?action=get_reviews`);
            const json = await resp.json();
            if (json.status === 'success') {
                reviewsList.innerHTML = '';
                if (json.data.length === 0) {
                    reviewsList.innerHTML = '<p style="grid-column: 1/-1; text-align: center; padding: 40px; color: var(--text-muted);">لا توجد آراء مسجلة حالياً</p>';
                    return;
                }

                json.data.forEach(rev => {
                    const card = document.createElement('div');
                    card.className = 'review-admin-card glass-card';
                    card.innerHTML = `
                        <img src="${rev.image || rev.Image}" alt="Review">
                        <button class="btn-delete-review" data-id="${rev.id}">
                            <i data-lucide="trash-2"></i> حذف
                        </button>
                    `;
                    reviewsList.appendChild(card);

                    card.querySelector('.btn-delete-review').onclick = () => deleteReview(rev.id, card);
                });
                lucide.createIcons();
            }
        } catch (e) {
            console.error(e);
            reviewsList.innerHTML = '<p class="error-text">خطأ في جلب البيانات</p>';
        }
    }

    async function deleteReview(id, el) {
        if (!confirm('هل أنت متأكد من حذف هذا الرأي؟')) return;
        try {
            el.style.opacity = '0.5';

            const payload = {
                action: 'delete_review',
                id: id,
                auth: {
                    user: sessionStorage.getItem('rymel_admin_user') || "",
                    pass: sessionStorage.getItem('rymel_admin_pass') || ""
                }
            };

            const formData = new URLSearchParams();
            formData.append('payload', JSON.stringify(payload));

            const resp = await fetch(GOOGLE_SCRIPT_URL, {
                method: 'POST',
                body: formData
            });

            const json = await resp.json();
            if (json.status === "error") {
                if (json.message === "Unauthorized Access") {
                    handleUnauthorized();
                } else {
                    showToast(json.message, true);
                    el.style.opacity = '1';
                }
                return;
            }

            el.remove();
            showToast('تم حذف الرأي');
        } catch (e) {
            console.error(e);
            showToast('خطأ أثناء الحذف', true);
        }
    }

    // --- 8. NICHES ENGINE (Full CRUD) ---
    let editingNicheName = null;
    let allNichesData = [];

    async function fetchNiches() {
        if (!GOOGLE_SCRIPT_URL) return;

        // Dynamically grab the table body to avoid initialization errors
        const listBody = document.getElementById('niches-list');

        if (listBody) {
            listBody.innerHTML = `<tr><td colspan="3" class="text-center">جاري جلب البيانات... <i data-lucide="loader" class="spin"></i></td></tr>`;
            lucide.createIcons();
        }

        try {
            const response = await fetch(`${GOOGLE_SCRIPT_URL}?action=get_niches&t=${Date.now()}`);
            const json = await response.json();
            const select = document.getElementById('product-niche-select');

            if (json.status === "success") {
                allNichesData = json.data;

                // 1. Populate Dropdown in Product Form
                if (select) {
                    select.innerHTML = '<option value="" disabled selected>اختر النيتش...</option>';
                    allNichesData.forEach(niche => {
                        const option = document.createElement('option');
                        option.value = niche.NicheName;
                        option.textContent = niche.NicheName;
                        select.appendChild(option);
                    });
                }

                // 2. Populate Niches Table
                renderNichesTable();
            }
        } catch (error) {
            console.error('Fetch niches error:', error);
            if (listBody) {
                listBody.innerHTML = `<tr><td colspan="3" class="text-center" style="color:var(--danger)">فشل جلب النيتشات</td></tr>`;
            }
        }
    }

    function renderNichesTable() {
        const listBody = document.getElementById('niches-list');
        if (!listBody) return;

        listBody.innerHTML = '';

        allNichesData.forEach(niche => {
            const tr = document.createElement('tr');

            // Raw SVGs guarantee the icons always load without relying on Lucide
            const iconFB = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"></path></svg>`;
            const iconIG = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="2" width="20" height="20" rx="5" ry="5"></rect><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"></path><line x1="17.5" y1="6.5" x2="17.51" y2="6.5"></line></svg>`;
            const iconTT = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 12a4 4 0 1 0 4 4V4a5 5 0 0 0 5 5"></path></svg>`;

            const fb = niche.Facebook || "";
            const ig = niche.Instagram || "";
            const tt = niche.TikTok || "";

            tr.innerHTML = `
                <td><strong>${niche.NicheName || "N/A"}</strong></td>
                <td><code>${niche.PixelID ? String(niche.PixelID).substring(0, 8) + '...' : '---'}</code></td>
                <td class="social-icon-group" style="display: flex; gap: 15px; align-items: center;">
                    <a href="${fb}" target="_blank" style="color: ${fb ? '#1877f2' : '#ccc'}; pointer-events: ${fb ? 'auto' : 'none'};" title="${fb || 'Non configuré'}">${iconFB}</a>
                    <a href="${ig}" target="_blank" style="color: ${ig ? '#e1306c' : '#ccc'}; pointer-events: ${ig ? 'auto' : 'none'};" title="${ig || 'Non configuré'}">${iconIG}</a>
                    <a href="${tt}" target="_blank" style="color: ${tt ? '#ffffffff' : '#ccc'}; pointer-events: ${tt ? 'auto' : 'none'};" title="${tt || 'Non configuré'}">${iconTT}</a>
                </td>
                <td style="text-align: center;">
                    <button type="button" class="btn-icon edit-niche-btn" data-name="${niche.NicheName}"><i data-lucide="edit-2"></i></button>
                    <button type="button" class="btn-icon delete-niche-btn" data-name="${niche.NicheName}" style="color:var(--danger)"><i data-lucide="trash-2"></i></button>
                </td>
            `;
            listBody.appendChild(tr);

            // Re-attach event listeners for edit and delete
            tr.querySelector('.edit-niche-btn').addEventListener('click', () => loadEditNiche(niche));
            tr.querySelector('.delete-niche-btn').addEventListener('click', () => deleteNiche(niche.NicheName, tr));
        });

        // This ensures the Edit and Delete icons still render
        lucide.createIcons();
    }

    function loadEditNiche(niche) {
        editingNicheName = niche.NicheName;
        document.getElementById('niche-name').value = niche.NicheName;
        document.getElementById('niche-pixel').value = niche.PixelID || '';
        document.getElementById('niche-fb').value = niche.Facebook || '';
        document.getElementById('niche-ig').value = niche.Instagram || '';
        document.getElementById('niche-tiktok').value = niche.TikTok || '';

        const btn = document.getElementById('niche-submit-btn');
        if (btn) {
            btn.innerHTML = 'تحديث النيتش <i data-lucide="save"></i>';
            lucide.createIcons();
        }
        window.scrollTo({ top: 0, behavior: 'smooth' });
        showToast('وضع تعديل النيتش');
    }

    async function deleteNiche(nicheName, rowEl) {
        if (!confirm(`هل أنت متأكد من حذف النيتش "${nicheName}"؟`)) return;

        rowEl.style.opacity = '0.5';
        try {
            const payload = {
                action: 'delete_niche',
                nicheName: nicheName,
                auth: { token: sessionStorage.getItem('rymel_admin_token') || "" }
            };

            const formData = new URLSearchParams();
            formData.append('payload', JSON.stringify(payload));

            const resp = await fetch(GOOGLE_SCRIPT_URL, { method: 'POST', body: formData });
            const json = await resp.json();

            if (json.status === "error") {
                if (json.message === "Unauthorized Access") handleUnauthorized();
                else showToast(json.message, true);
                rowEl.style.opacity = '1';
                return;
            }

            showToast('تم حذف النيتش بنجاح');
            fetchNiches(); // Refresh the table and dropdown
        } catch (e) {
            console.error(e);
            showToast('خطأ أثناء الحذف', true);
            rowEl.style.opacity = '1';
        }
    }

    // Form Submission for Add / Edit
    const addNicheForm = document.getElementById('add-niche-form');
    if (addNicheForm) {
        addNicheForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const btn = document.getElementById('niche-submit-btn') || addNicheForm.querySelector('button');
            const originalText = btn.innerHTML;

            btn.innerHTML = '<i data-lucide="loader" class="spin"></i> جاري الحفظ...';
            btn.disabled = true;
            lucide.createIcons();

            const payload = {
                action: editingNicheName ? 'edit_niche' : 'add_niche',
                originalName: editingNicheName,
                auth: { token: sessionStorage.getItem('rymel_admin_token') || "" },
                nicheName: document.getElementById('niche-name').value,
                pixel: document.getElementById('niche-pixel').value,
                fb: document.getElementById('niche-fb').value,
                ig: document.getElementById('niche-ig').value,
                tiktok: document.getElementById('niche-tiktok').value
            };

            try {
                const formData = new URLSearchParams();
                formData.append('payload', JSON.stringify(payload));

                const response = await fetch(GOOGLE_SCRIPT_URL, { method: 'POST', body: formData });
                const result = await response.json();

                if (result.status === 'success') {
                    showToast(editingNicheName ? 'تم تحديث النيتش بنجاح!' : 'تم إضافة النيتش بنجاح!');
                    addNicheForm.reset();
                    editingNicheName = null;
                    if (btn) btn.innerHTML = 'حفظ النيتش <i data-lucide="save"></i>';
                    fetchNiches(); // Refresh table and dropdowns
                } else if (result.message === "Unauthorized Access") {
                    handleUnauthorized();
                } else {
                    showToast('خطأ: ' + result.message, true);
                }
            } catch (error) {
                showToast('حدث خطأ في الاتصال', true);
            } finally {
                if (!editingNicheName && btn) btn.innerHTML = originalText;
                if (btn) btn.disabled = false;
                lucide.createIcons();
            }
        });
    }
});
