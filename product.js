/**
         * RYMAL STOREFRONT ENGINE
         * High-velocity vanilla hydration & interactions
         */
        const GOOGLE_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbwDwtE3FqiWvMTudtcVBANhZcRQkU7_NAb381HLfrQo1BN1JKW2tM5X6XHveUyk-gU/exec";
        const DEFAULT_IMG = "https://images.unsplash.com/photo-1556228720-195a672e8a03?q=80&w=800&auto=format&fit=crop";

        // --- Meta Conversions API & Identifier Engines ---
        let clientIp = "";
        async function fetchClientIp() {
            try {
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 2000);
                const resp = await fetch('https://api.ipify.org?format=json', { signal: controller.signal });
                clearTimeout(timeoutId);
                const json = await resp.json();
                clientIp = json.ip || "";
            } catch (e) {
                console.warn("Could not determine client IP address:", e);
            }
        }

        fetchClientIp();

        function getCookie(name) {
            const value = `; ${document.cookie}`;
            const parts = value.split(`; ${name}=`);
            if (parts.length === 2) return parts.pop().split(';').shift();
            return null;
        }

        function setCookie(name, value, days) {
            let expires = "";
            if (days) {
                const date = new Date();
                date.setTime(date.getTime() + (days * 24 * 60 * 60 * 1000));
                expires = "; expires=" + date.toUTCString();
            }
            document.cookie = name + "=" + (value || "") + expires + "; path=/; SameSite=Lax";
        }

        function getOrGenerateExternalId() {
            let extId = localStorage.getItem('rymel_external_id');
            if (!extId) {
                extId = 'ext_' + Math.floor(Math.random() * 1e16).toString(36) + '_' + Math.floor(Math.random() * 1e16).toString(36);
                localStorage.setItem('rymel_external_id', extId);
            }
            return extId;
        }

        function getOrSetFbp() {
            let fbp = getCookie('_fbp');
            if (!fbp) {
                const creationTime = Date.now();
                const randomNum = Math.floor(Math.random() * 1000000000);
                fbp = `fb.1.${creationTime}.${randomNum}`;
                setCookie('_fbp', fbp, 90);
            }
            return fbp;
        }

        function getOrSetFbc() {
            let fbc = getCookie('_fbc');
            if (!fbc) {
                const urlParams = new URLSearchParams(window.location.search);
                const fbclid = urlParams.get('fbclid');
                if (fbclid) {
                    const creationTime = Date.now();
                    fbc = `fb.1.${creationTime}.${fbclid}`;
                    setCookie('_fbc', fbc, 90);
                }
            }
            return fbc;
        }

        function generateUUID() {
            if (window.crypto && window.crypto.randomUUID) {
                return window.crypto.randomUUID();
            }
            return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
                const r = Math.random() * 16 | 0;
                const v = c === 'x' ? r : (r & 0x3 | 0x8);
                return v.toString(16);
            });
        }

        async function sendCapiEvent(eventName, eventId, customData) {
            const fbp = getOrSetFbp();
            const fbc = getOrSetFbc();
            const externalId = getOrGenerateExternalId();

            const payload = {
                action: 'track_event',
                event_name: eventName,
                event_id: eventId,
                event_source_url: window.location.href,
                user_data: {
                    client_ip_address: clientIp,
                    client_user_agent: navigator.userAgent,
                    fbc: fbc || "",
                    fbp: fbp || "",
                    external_id: externalId
                },
                custom_data: customData
            };

            try {
                const params = new URLSearchParams();
                params.append('payload', JSON.stringify(payload));

                await fetch(GOOGLE_SCRIPT_URL, {
                    method: 'POST',
                    body: params
                });
                console.log(`[CAPI] Event ${eventName} sent`);
            } catch (e) {
                console.error(`[CAPI] Fail on ${eventName}:`, e);
            }
        }

        // --- Yalidine & Calculations State ---
        let deliveryRates = {};
        let currentProductPrice = 0;
        let allCenters = [];
        let currentCommunesData = [];

        const wilayaMap = {
            "أدرار": "Adrar", "الشلف": "Chlef", "الأغواط": "Laghouat", "أم البواقي": "Oum El Bouaghi",
            "باتنة": "Batna", "بجاية": "Bejaia", "بسكرة": "Biskra", "بشار": "Bechar",
            "البليدة": "Blida", "البويرة": "Bouira", "تمنراست": "Tamanrasset", "تبسة": "Tebessa",
            "تلمسان": "Tlemcen", "تيارت": "Tiaret", "تيزي وزو": "Tizi Ouzou", "الجزائر": "Alger",
            "الجلفة": "Djelfa", "جيجل": "Jijel", "سطيف": "Setif", "سعيدة": "Saida",
            "سكيكدة": "Skikda", "سيدي بلعباس": "Sidi Bel Abbes", "عنابة": "Annaba", "قالمة": "Guelma",
            "قسنطينة": "Constantine", "المدية": "Medea", "مستغانم": "Mostaganem", "المسيلة": "M'Sila",
            "معسكر": "Mascara", "ورقلة": "Ouargla", "وهران": "Oran", "البيض": "El Bayadh",
            "إليزي": "Illizi", "برج بوعريريج": "Bordj Bou Arreridj", "بومرداس": "Boumerdes", "الطارف": "El Tarf",
            "تندوف": "Tindouf", "تسمسيلت": "Tissemsilt", "الوادي": "El Oued", "خنشلة": "Khenchela",
            "سوق أهراس": "Souk Ahras", "تيبازة": "Tipaza", "ميلة": "Mila", "عين الدفلى": "Ain Defla",
            "النعامة": "Naama", "عين تموشنت": "Ain Temouchent", "غرداية": "Ghardaia", "غليزان": "Relizane",
            "تيميمون": "Timimoun", "برج باجي مختار": "Bordj Badji Mokhtar", "أولاد جلال": "Ouled Djellal", "بني عباس": "Beni Abbes",
            "عين صالح": "In Salah", "عين قزام": "In Guezzam", "تقرت": "Touggourt", "جانت": "Djanet",
            "المغير": "El M'Ghair", "المنيعة": "El Meniaa"
        };

        function populateWilayas() {
            const wilayaSelect = document.getElementById('wilaya');
            if (!wilayaSelect) return;
            wilayaSelect.innerHTML = '<option value="" disabled selected>اختر الولاية</option>';
            Object.keys(wilayaMap).forEach((arabicName, index) => {
                const id = index + 1;
                const paddedId = id < 10 ? '0' + id : id;
                const opt = document.createElement('option');
                opt.value = id.toString();
                opt.textContent = `${paddedId} - ${arabicName}`;
                wilayaSelect.appendChild(opt);
            });
        }

        document.addEventListener('DOMContentLoaded', async () => {
            populateWilayas();

            const urlParams = new URLSearchParams(window.location.search);
            const productId = urlParams.get('id');

            if (!productId) {
                document.body.innerHTML = `
                <header class="header"><div class="container"><a href="index.html" class="logo"><img src="images/seo2.png" alt="Rymel"></a></div></header>
                <div style="text-align:center; padding:100px 20px; font-family:'Tajawal', sans-serif;">
                    <h1 style="color:var(--primary-brown); margin-bottom:20px;">⚠️ عذراً، لم يتم تحديد المنتج</h1>
                    <p style="color:var(--text-muted); font-size:1.2rem; margin-bottom:30px;">هذه الصفحة مخصصة لعرض تفاصيل منتج معين وتحتاج إلى رقم تعريف (ID) في الرابط.</p>
                    <a href="index.html" class="btn-order" style="display:inline-flex; width:auto; padding:15px 40px; text-decoration:none;">العودة إلى المتجر لاختيار منتج</a>
                </div>
            `;
                return;
            }

            // Hydration initialization
            initProduct(productId);
            initRecommendations();
            loadReviews();
        });

        // --- Dynamic Niche & Pixel Engine ---
        async function initializeNicheAndPixel(productNiche) {
            if (!productNiche) {
                console.warn("[Niche Bridge] Product has no niche assigned.");
                return;
            }

            try {
                // Fetch niche configuration
                const response = await fetch(`${GOOGLE_SCRIPT_URL}?action=get_niches`);
                const json = await response.json();

                if (json.status === 'success' && json.data) {
                    const nicheData = json.data.find(n => n.NicheName === productNiche);

                    if (nicheData) {
                        // 1. Initialize Meta Pixel dynamically
                        if (nicheData.PixelID) {
                            const pixelId = String(nicheData.PixelID).trim();
                            // Ensure fbq is initialized before using
                            if (typeof fbq !== 'undefined') {
                                fbq('init', pixelId);
                                fbq('track', 'PageView');
                                console.log(`%c[Pixel Engine] Activated: ${nicheData.NicheName} (${pixelId})`, "background: #22c55e; color: white;");
                            }
                        }

                        // 2. Update Social Links
                        const fbLink = document.getElementById('niche-facebook-link');
                        const igLink = document.getElementById('niche-instagram-link');
                        const ttLink = document.getElementById('niche-tiktok-link');

                        if (nicheData.Facebook && fbLink) { fbLink.href = nicheData.Facebook; fbLink.style.display = 'inline-flex'; }
                        if (nicheData.Instagram && igLink) { igLink.href = nicheData.Instagram; igLink.style.display = 'inline-flex'; }
                        if (nicheData.TikTok && ttLink) { ttLink.href = nicheData.TikTok; ttLink.style.display = 'inline-flex'; }
                    }
                }
            } catch (error) {
                console.error("[Niche Bridge] Failed to fetch niche data:", error);
            }
        }

        async function initProduct(id) {
            try {
                const response = await fetch(`${GOOGLE_SCRIPT_URL}?id=${id}`);
                const result = await response.json();

                if (result.status === "success" && result.data) {
                    console.log("Fetched Product Data:", result.data);
                    hydrateUI(result.data);
                    injectOpenGraphData(result.data);
                    const nicheToPass = result.data.Niche || result.data.niche;
                    await initializeNicheAndPixel(nicheToPass);
                    trackViewContent(result.data);
                } else {
                    document.body.innerHTML = `
                    <header class="header"><div class="container"><a href="index.html" class="logo"><img src="images/seo2.png" alt="Rymel"></a></div></header>
                    <div style="text-align:center; padding:100px 20px; font-family:'Tajawal', sans-serif;">
                        <h1 style="color:var(--primary-brown); margin-bottom:20px;">🔍 عذراً، المنتج غير موجود</h1>
                        <p style="color:var(--text-muted); font-size:1.2rem; margin-bottom:30px;">لم نتمكن من العثور على المنتج المطلوب. قد يكون تم حذفه أو أن الرابط غير صحيح.</p>
                        <a href="index.html" class="btn-order" style="display:inline-flex; width:auto; padding:15px 40px; text-decoration:none;">العودة لمنتجات رمال</a>
                    </div>
                `;
                }
            } catch (error) {
                console.error("Storefront hydration failed:", error);
            }
        }

        function injectOpenGraphData(p) {
            const title = p.name || 'Untitled';
            const desc = p.description || '';
            const image = p.mainImageId ? `http://googleusercontent.com/profile/picture/${p.mainImageId}` : DEFAULT_IMG;
            const setMeta = (property, content) => {
                let meta = document.querySelector(`meta[property="${property}"]`);
                if (!meta) {
                    meta = document.createElement('meta');
                    meta.setAttribute('property', property);
                    document.head.appendChild(meta);
                }
                meta.setAttribute('content', content);
            };

            setMeta('og:title', `${title} | رمال`);
            setMeta('og:description', desc.substring(0, 200));
            setMeta('og:image', image);
            setMeta('og:url', window.location.href);
            setMeta('og:type', 'product');
        }
        

        // --- Media Format Helper ---
function isVideo(url) {
    // Checks if the string contains any common video extension
    return /\.(mp4|webm|ogg|mov|m4v|avi|wmv|flv|mkv|3gp|mpeg|mpg)(\?.*)?$/i.test(url);
}

function renderRatingSummary(p) {
    const display = document.getElementById('stars-display');
    const countEl = document.getElementById('rating-count');
    if (!display || !countEl) return;

    const avg = Number(p.ratingAverage) || 0;
    const count = Number(p.ratingCount) || 0;
    const rounded = Math.round(avg);

    display.innerHTML = [1, 2, 3, 4, 5].map(i => `
        <i data-lucide="star" class="star-icon ${i <= rounded ? 'filled' : ''}"></i>
    `).join('');

    countEl.textContent = count > 0
        ? `${avg.toFixed(1)} (${count} تقييم)`
        : 'لا توجد تقييمات بعد';

    if (typeof lucide !== 'undefined') lucide.createIcons();
}

function initRatingWidget(product) {
    const starsInput = document.getElementById('stars-input');
    const thanksMsg = document.getElementById('rating-thanks');
    const label = document.getElementById('stars-input-label');
    if (!starsInput || !thanksMsg) return;

    const ratedKey = `rymel_rated_${product.id}`;
    if (localStorage.getItem(ratedKey)) {
        starsInput.style.display = 'none';
        if (label) label.style.display = 'none';
        thanksMsg.style.display = 'block';
        return;
    }

    let selectedRating = 0;
    let submitting = false;

    const paintStars = (value, className) => {
        starsInput.querySelectorAll('[data-value]').forEach(el => {
            el.classList.toggle(className, Number(el.dataset.value) <= value);
        });
    };

    // Delegated hover — works no matter how many times lucide swaps the icons
    starsInput.addEventListener('mousemove', (e) => {
        const target = e.target.closest('[data-value]');
        if (!target) return;
        const val = Number(target.dataset.value);
        paintStars(val, 'hovered');
        if (label) label.textContent = `${val} من 5`;
    });

    starsInput.addEventListener('mouseleave', () => {
        paintStars(0, 'hovered');
        if (label) label.textContent = selectedRating ? `${selectedRating} من 5` : 'اختاري من 1 إلى 5 نجوم';
    });

    // Delegated click — attached to the container, never destroyed
    starsInput.addEventListener('click', async (e) => {
        if (submitting) return;
        const target = e.target.closest('[data-value]');
        if (!target) return;

        selectedRating = Number(target.dataset.value);
        paintStars(selectedRating, 'selected');
        if (label) label.textContent = `${selectedRating} من 5`;
        submitting = true;

        const payload = {
            action: 'submit_rating',
            productId: product.id,
            rating: selectedRating,
            externalId: getOrGenerateExternalId()
        };

        try {
            const params = new URLSearchParams();
            params.append('payload', JSON.stringify(payload));
            const res = await fetch(GOOGLE_SCRIPT_URL, { method: 'POST', body: params });
            const json = await res.json();

            if (json.status === 'success' || json.message === 'already_rated') {
                localStorage.setItem(ratedKey, '1');
                starsInput.style.display = 'none';
                if (label) label.style.display = 'none';
                thanksMsg.style.display = 'block';

                if (json.status === 'success') {
                    const newCount = (Number(product.ratingCount) || 0) + 1;
                    const newAvg = ((Number(product.ratingAverage) || 0) * (newCount - 1) + selectedRating) / newCount;
                    renderRatingSummary({ ratingAverage: newAvg, ratingCount: newCount });
                }
            }
        } catch (err) {
            console.error('Rating submit failed:', err);
        } finally {
            submitting = false;
        }
    });
}

        function hydrateUI(p) {
            // 1. Details Binding
            const name = p.name || 'Untitled';
            const price = p.price || '0';
            const desc = p.description || '';
            const mainImageId = p.mainImageId || '';

            document.getElementById('dyn-title').textContent = name;
            document.getElementById('page-title').textContent = `${name} | رمال`;
            document.getElementById('dyn-price').textContent = `${price} دج`;
            document.getElementById('dyn-desc').innerHTML = desc;
            renderRatingSummary(p);
            initRatingWidget(p);

          // 2. High-performance CDN gallery reconstruction
            const viewport = document.getElementById('main-viewport');
            const galleryViewport = document.getElementById('gallery-viewport');
            const thumbList = document.getElementById('thumb-list');

            // Universal media parser
            function getMediaHTML(mediaString, isMain) {
                const style = isMain 
                    ? "width:100%; height:100%; object-fit: cover;" 
                    : "width:100%; height:100%; object-fit:cover; pointer-events:none; border-radius: inherit;";
                
                const input = mediaString.trim();
                
                // 1. Detect direct URLs with video extensions
                const hasVideoExtension = /\.(mp4|webm|ogg|mov|m4v|avi|wmv|flv|mkv)(?:[?#].*)?$/i.test(input);
                
                // 2. Detect explicit Google Drive video flags
                const isTaggedDriveVideo = input.toLowerCase().startsWith('video:');
                
                if (hasVideoExtension || isTaggedDriveVideo) {
                if (isTaggedDriveVideo) {
                const cleanId = input.substring(6).trim();
                    // Use Drive's preview embed — reliable streaming, unlike uc?export=download
                    return `
                        <iframe src="https://drive.google.com/file/d/${cleanId}/preview?autoplay=1&loop=1&playlist=${cleanId}" 
                    style="${style}" 
                    allow="autoplay" 
                    frameborder="0"></iframe>
                    `;
                } else {
                    // Direct-hosted video files (real .mp4/.webm URLs) still use <video> — this works fine
                    return `
                        <video src="${input}" autoplay loop muted playsinline style="${style}"></video>
                        ${!isMain ? `<div class="video-indicator" style="position:absolute; top:50%; left:50%; transform:translate(-50%, -50%); background:rgba(0,0,0,0.4); border-radius:50%; display:flex; align-items:center; justify-content:center; width:36px; height:36px; color:#fff;"><i data-lucide="play-circle"></i></div>` : ''}
                    `;
                }
                } else {
                    const imgSrc = input.startsWith('http') ? input : `https://lh3.googleusercontent.com/d/${input}`;
                    return `<img src="${imgSrc}" alt="Product Media" style="${style}">`;
                }
            }

            // Compile payload into a single array
            let allMedia = [];
            let mainMediaId ;

            if (p.mainImageId) mainMediaId = p.mainImageId;

            //if (p.mainImageId) allMedia.push(p.mainImageId);
            if (p.galleryIds) {
                p.galleryIds.split(',').forEach(id => {
                    if (id.trim()) allMedia.push(id.trim());
                });
            }

            // Render main viewports
            if (viewport) viewport.innerHTML = getMediaHTML(mainMediaId, true);

            if (allMedia.length > 0) {
                if (galleryViewport) galleryViewport.innerHTML = getMediaHTML(allMedia[0], true);
            }

            // Render interactive thumbnails
            if (thumbList) {
                thumbList.innerHTML = '';
                allMedia.forEach((mediaString, idx) => {
                    const thumb = document.createElement('div');
                    thumb.className = `thumb-item ${idx === 0 ? 'active' : ''}`;
                    thumb.style.position = 'relative'; 
                    
                    thumb.innerHTML = getMediaHTML(mediaString, false);

                    thumb.onclick = () => {
                        if (galleryViewport) galleryViewport.innerHTML = getMediaHTML(mediaString, true);
                        
                        document.querySelectorAll('.thumb-item').forEach(t => t.classList.remove('active'));
                        thumb.classList.add('active');
                    };
                    
                    thumbList.appendChild(thumb);
                });
            }

            if (typeof lucide !== 'undefined') lucide.createIcons();

            /// 3. Dynamic Options Table Injection
            const featuresContainer = document.getElementById('dynamic-features');
            featuresContainer.innerHTML = '';
            if (p.options) {
                try {
                    const options = typeof p.options === 'string' ? JSON.parse(p.options) : p.options;
                    if (Array.isArray(options)) {
                        options.forEach((opt, idx) => {
                            const group = document.createElement('div');
                            group.className = 'form-group';
                            
                            // Generate a single row table for the options
                            group.innerHTML = `
                                <label>${opt.name}</label>
                                <!-- Hidden input keeps compatibility with your existing form submit logic -->
                                <input type="hidden" name="option-${idx}" class="feature-select" data-label="${opt.name}">
                                
                                <div class="options-row-table">
                                    ${opt.values.map(v => `<div class="option-cell" data-value="${v}">${v}</div>`).join('')}
                                </div>
                            `;
                            
                            // Add click interactions to behave like a selector
                            const cells = group.querySelectorAll('.option-cell');
                            const hiddenInput = group.querySelector('.feature-select');
                            
                            cells.forEach(cell => {
                                cell.addEventListener('click', () => {
                                    // Remove 'active' class from all cells in this specific row
                                    cells.forEach(c => c.classList.remove('active'));
                                    
                                    // Add 'active' class to the clicked cell
                                    cell.classList.add('active');
                                    
                                    // Update the hidden input value for the form submission
                                    hiddenInput.value = cell.getAttribute('data-value');
                                });
                            });

                            featuresContainer.appendChild(group);
                        });
                    }
                } catch (e) {
                    console.warn("Invalid FeaturesJSON syntax", e);
                }
            }

            // 4. Form Listeners Binding
            document.getElementById('submit-btn').disabled = false;
            initFormHandler(p);
        }

        document.addEventListener('DOMContentLoaded', function() {
    const showCheckoutBtn = document.getElementById('show-checkout-btn');
    const checkoutBox = document.querySelector('.checkout-box'); //[cite: 1]
    
    // Hide the form by default on page load
    if(checkoutBox && showCheckoutBtn) {
        checkoutBox.classList.add('hidden-form');
        
        showCheckoutBtn.addEventListener('click', function() {
            // Hide the button itself
            showCheckoutBtn.style.display = 'none';
            
            // Show the checkout box with animation
            checkoutBox.classList.remove('hidden-form');
            checkoutBox.classList.add('fade-in');
            
            // Smoothly scroll down to the form
            setTimeout(() => {
                checkoutBox.scrollIntoView({ 
                    behavior: 'smooth', 
                    block: 'start' 
                });
            }, 100);
            
            // Re-render lucide icons if needed
            if (typeof lucide !== 'undefined') {
                lucide.createIcons();
            }
        });
    }
});

        // --- Recommendations Carousel Builder ---
        async function initRecommendations() {
            const grid = document.getElementById('rec-grid');
            const prevBtn = document.getElementById('rec-prev');
            const nextBtn = document.getElementById('rec-next');

            if (!grid) return;

            try {
                const response = await fetch(`${GOOGLE_SCRIPT_URL}?action=list`);
                const result = await response.json();

                if (result.status === "success" && result.data) {
                    const currentId = new URLSearchParams(window.location.search).get('id');
                    const others = result.data.filter(p => (p.id || "").toString() !== (currentId || "").toString());

                    if (others.length === 0) {
                        grid.parentElement.parentElement.style.display = 'none';
                        return;
                    }

                    // Hardcode the style since it was undefined in this scope
                    const style = "width:100%; height:100%; object-fit: cover;";

                    // Evaluate the media type INSIDE the map for each product individually
                    grid.innerHTML = others.map(p => {
                        // Safely extract the media string for the current product. 
                        // Adjust 'p.mainImageId' to match the actual key in your JSON data if needed.
                        const mediaInput = (p.mainImageId || p.image || "").trim();
                        
                        const hasVideoExtension = /\.(mp4|webm|ogg|mov|m4v|avi|wmv|flv|mkv)(?:[?#].*)?$/i.test(mediaInput);
                        const isTaggedDriveVideo = mediaInput.toLowerCase().startsWith('video:');
                        
                        let mediaHTML = "";

                        if (isTaggedDriveVideo) {
                            const cleanId = mediaInput.substring(6).trim();
                            mediaHTML = `<iframe title="${p.title}" src="https://drive.google.com/file/d/${cleanId}/preview?autoplay=1&loop=1&playlist=${cleanId}" style="${style}" allow="autoplay" frameborder="0"></iframe>`;
                        } else if (hasVideoExtension) {
                            mediaHTML = `<video src="${mediaInput}" autoplay loop muted playsinline style="${style}"></video>`;
                        } else {
                            const imgSrc = mediaInput.startsWith('http') ? mediaInput : `https://lh3.googleusercontent.com/d/${mediaInput}`;
                            mediaHTML = `<img src="${imgSrc}" alt="Product Media" style="${style}">`;
                        }

                        return `
                            <a href="product.html?id=${p.id}" class="rec-card">
                                <div class="rec-img">${mediaHTML}</div>
                                <div class="rec-info">
                                    <h3>${p.title || p.name}</h3>
                                    <div class="price">${p.price} دج</div>
                                </div>
                            </a>
                        `;
                    }).join('');

                    let scrollPos = 0;
                    const scrollAmount = () => {
                        const card = grid.querySelector('.rec-card');
                        return card ? card.offsetWidth + 20 : 300;
                    };

                    const updateButtons = () => {
                        if (prevBtn) prevBtn.disabled = scrollPos <= 0;
                        if (nextBtn) nextBtn.disabled = scrollPos >= (grid.scrollWidth - grid.clientWidth - 10);
                    };

                    if (nextBtn) {
                        nextBtn.onclick = () => {
                            const step = scrollAmount();
                            const maxScroll = grid.scrollWidth - grid.clientWidth;
                            scrollPos = Math.min(scrollPos + step, maxScroll);
                            grid.style.transform = `translateX(${scrollPos}px)`;
                            updateButtons();
                        };
                    }

                    if (prevBtn) {
                        prevBtn.onclick = () => {
                            const step = scrollAmount();
                            scrollPos = Math.max(scrollPos - step, 0);
                            grid.style.transform = `translateX(${scrollPos}px)`;
                            updateButtons();
                        };
                    }

                    updateButtons();
                    if (window.lucide) lucide.createIcons();
                } 
            
            } catch (e) {
                console.error("Failed to compile recommendations list:", e);
            }
        }

        // --- Yalidine Shipping Cost & Booking Handler ---
        function initFormHandler(product) {
            const form = document.getElementById('order-form');
            if (!form) return;

            currentProductPrice = parseFloat((product.price || "0").toString().replace(/[^\d.]/g, '')) || 0;

            fetchDeliveryRates();
            initOrderListeners();

            // Unique InitiateCheckout event trigger (once per session)
            let hasTriggeredInitiateCheckout = false;
            const triggerInitiateCheckout = () => {
                if (hasTriggeredInitiateCheckout) return;
                hasTriggeredInitiateCheckout = true;

                const eventId = generateUUID();

                if (typeof fbq === 'function') {
                    fbq('track', 'InitiateCheckout', {
                        content_type: 'product',
                        content_ids: [String(product.id || "")],
                        content_name: product.name || "",
                        value: currentProductPrice,
                        currency: 'DZD'
                    }, { eventID: eventId });
                }

                sendCapiEvent('InitiateCheckout', eventId, {
                    content_ids: [String(product.id || "")],
                    content_type: 'product',
                    value: currentProductPrice,
                    currency: 'DZD',
                    content_name: product.name || ""
                });
            };

            const inputs = form.querySelectorAll('input[type="text"], input[type="tel"], input[type="email"]');
            inputs.forEach(input => {
                input.addEventListener('focus', triggerInitiateCheckout);
                input.addEventListener('input', triggerInitiateCheckout);
            });

            form.onsubmit = async (e) => {
                e.preventDefault();
                const btn = document.getElementById('submit-btn');
                const originalText = btn.innerHTML;

                // Basic regex formatting validation
                const phoneInput = document.getElementById('phone');
                const phoneRegex = /^0[5-7][0-9]{8}$/;
                if (!phoneRegex.test(phoneInput.value)) {
                    phoneInput.setCustomValidity('يرجى إدخال رقم هاتف صحيح (10 أرقام تبدأ بـ 05، 06 أو 07)');
                    phoneInput.reportValidity();
                    return;
                } else {
                    phoneInput.setCustomValidity('');
                }

                btn.disabled = true;
                btn.innerHTML = '<i data-lucide="loader" class="spin"></i> جاري إرسال الطلبية...';
                lucide.createIcons();

                const formData = new FormData(form);
                let selectedOptions = {}; 
                let missingOption = false;
                document.querySelectorAll('.feature-select').forEach(sel => {
                    if (!sel.value) missingOption = true;
                    selectedOptions[sel.dataset.label] = sel.value || null;
                });

                if (missingOption) {
                    alert('يرجى اختيار جميع الخيارات المتوفرة قبل تأكيد الطلب');
                    btn.disabled = false;
                    btn.innerHTML = originalText;
                    lucide.createIcons();
                    return;
                }

                const selectedOptionsJSON = JSON.stringify(selectedOptions);

                const wilayaSelect = document.getElementById('wilaya');
                const selectedWilayaOption = wilayaSelect.options[wilayaSelect.selectedIndex];
                const wilayaText = selectedWilayaOption ? selectedWilayaOption.text : '';
                const arabicName = wilayaText.includes('-') ? wilayaText.split('-')[1].trim() : wilayaText.trim();
                const frenchName = wilayaMap[arabicName] || arabicName;

                const deliveryMethod = document.getElementById('delivery-method')?.value || 'domicil';
                const rate = deliveryRates[frenchName] || deliveryRates[arabicName];
                const deliveryFee = rate ? (parseFloat(rate[deliveryMethod]) || 0) : 0;
                const finalTotalPrice = currentProductPrice + deliveryFee;

                // Generate cryptographically secure/random event transaction token
                // Clean the price variable so it's strictly a mathematical number
                const cleanProductPrice = parseFloat(String(currentProductPrice).replace(/[^\d.]/g, '')) || 0;
                const finalNumericPrice = cleanProductPrice + (deliveryFee || 0);

                const eventId = generateUUID();

                // Track Pixel Purchase with event ID deduplication parameter
                if (typeof fbq === 'function') {
                    fbq('track', 'Purchase', {
                        currency: 'DZD',
                        value: finalNumericPrice, // Clear numeric value fix
                        content_name: product.name || "",
                        content_type: 'product',
                        content_ids: [String(product.id || "")]
                    }, { eventID: eventId });
                }

                // Track CAPI Purchase with matching event ID
                sendCapiEvent('Purchase', eventId, {
                    content_ids: [String(product.id || "")],
                    content_type: 'product',
                    value: finalNumericPrice, // Clear numeric value fix
                    currency: 'DZD',
                    content_name: product.name || ""
                });

                // 1. Safely extract the final Center ID
                const finalCenterId = deliveryMethod === 'desk'
                    ? (document.getElementById('stopdesk')?.value || document.getElementById('center-id')?.value || "")
                    : "";

                // 2. Override the commune if this is a fallback Stop Desk selection
                let finalCommune = formData.get('commune');
                if (deliveryMethod === 'desk' && finalCenterId) {
                    // Search the allCenters array you already loaded in memory
                    const matchedCenter = allCenters.find(c => String(c.center_id) === String(finalCenterId));
                    if (matchedCenter && matchedCenter.commune_name) {
                        finalCommune = matchedCenter.commune_name; // Force the correct Yalidine commune!
                    }
                }

                // 3. Build the final payload
                const orderData = {
                    action: 'ORDER',
                    fullName: formData.get('full-name'),
                    email: formData.get('email') || '',
                    phone: formData.get('phone'),
                    wilaya: wilayaText,
                    commune: finalCommune, // Uses the matched Yalidine commune
                    address: formData.get('address') || "N/A",
                    center_id: finalCenterId, // Uses the extracted Center ID
                    options: selectedOptionsJSON,
                    product: product.name || "",
                    price: `${finalTotalPrice} دج`,
                    productBasePrice: currentProductPrice,
                    is_stopdesk: deliveryMethod === 'desk' ? 1 : 0,
                    timestamp: new Date().toLocaleString('fr-FR'),

                    // Tracking & Deduplication variables
                    eventId: eventId,
                    productId: product.id || "",
                    userAgent: navigator.userAgent,
                    clientIp: clientIp,
                    fbc: getOrSetFbc() || "",
                    fbp: getOrSetFbp() || "",
                    externalId: getOrGenerateExternalId(),
                    sourceUrl: window.location.href
                };
                console.log(orderData);
                console.log("hhhhhhhhhhhhhhhh");
                console.log(selectedOptionsJSON);
                console.log("yyyyyyyyyyyyyyyyy");
                console.log(selectedOptions);
                try {
                    const params = new URLSearchParams();
                    params.append('payload', JSON.stringify(orderData));

                    await fetch(GOOGLE_SCRIPT_URL, {
                        method: 'POST',
                        body: params
                    });

                    const modal = document.getElementById('success-modal');
                    if (modal) {
                        modal.style.display = 'flex';
                    } else {
                        alert("تم تأكيد طلبيتك بنجاح!");
                    }
                    form.reset();
                    updatePriceSummary();
                } catch (err) {
                    console.error("Order processing error:", err);
                    alert("حدث خطأ في عملية الإرسال. يرجى المحاولة لاحقاً.");
                } finally {
                    btn.disabled = false;
                    btn.innerHTML = originalText;
                    lucide.createIcons();
                }
            };
        }

        function fetchDeliveryRates() {
            fetch(`${GOOGLE_SCRIPT_URL}?action=tarifs`)
                .then(res => res.json())
                .then(res => {
                    if (res.status === 'success') {
                        deliveryRates = res.data;
                        updatePriceSummary();
                    }
                })
                .catch(err => console.error('Error fetching Yalidine tarifs:', err));
        }

        function updatePriceSummary() {
            const wilayaSelect = document.getElementById('wilaya');
            const methodInput = document.getElementById('delivery-method');
            const method = methodInput ? methodInput.value : 'domicil';

            let fee = 0;
            if (wilayaSelect && wilayaSelect.value) {
                const selectedOption = wilayaSelect.options[wilayaSelect.selectedIndex];
                const text = selectedOption.text;
                const arabicName = text.includes('-') ? text.split('-')[1].trim() : text.trim();
                const frenchName = wilayaMap[arabicName] || arabicName;

                const rate = deliveryRates[frenchName] || deliveryRates[arabicName] ||
                    deliveryRates[wilayaSelect.value] ||
                    deliveryRates[parseInt(wilayaSelect.value).toString()] ||
                    deliveryRates[arabicName.replace("ال", "")];

                if (rate) {
                    fee = parseFloat(rate[method]) || 0;
                }
            }

           // const total = currentProductPrice + fee;
           // const elProduct = document.getElementById('summary-product-price');
            const elFee = document.getElementById('summary-delivery-fee');
           // const elTotal = document.getElementById('summary-total-price');

            //if (elProduct) elProduct.textContent = `${currentProductPrice} دج`;
            if (elFee) elFee.textContent = `${fee} دج`;
           // if (elTotal) elTotal.textContent = `${total} دج`;
        }

        async function updateCommunes() {
            const wilayaSelect = document.getElementById('wilaya');
            const communeSelect = document.getElementById('commune');
            const stopdeskContainer = document.getElementById('stopdesk-container');

            if (!wilayaSelect || !communeSelect) return;
            const wilayaId = wilayaSelect.value;
            if (!wilayaId) return;

            communeSelect.innerHTML = '<option value="" disabled selected>جاري التحميل...</option>';
            communeSelect.disabled = true;
            allCenters = [];
            if (stopdeskContainer) stopdeskContainer.style.display = 'none';

            try {
                const resCommunes = await fetch(`${GOOGLE_SCRIPT_URL}?action=communes&wilaya=${wilayaId}`);
                const dataCommunes = await resCommunes.json();

                if (dataCommunes && dataCommunes.data) {
                    currentCommunesData = dataCommunes.data;
                    communeSelect.innerHTML = '<option value="" disabled selected>اختر البلدية</option>';
                    currentCommunesData.forEach(c => {
                        const opt = document.createElement('option');
                        opt.value = c.name;
                        opt.textContent = c.name;
                        communeSelect.appendChild(opt);
                    });
                    communeSelect.disabled = false;
                } else {
                    communeSelect.innerHTML = '<option value="" disabled selected>خطأ في تحميل البلديات</option>';
                }

                const resCenters = await fetch(`${GOOGLE_SCRIPT_URL}?action=centers&wilaya=${wilayaId}`);
                const dataCenters = await resCenters.json();
                if (dataCenters && dataCenters.data) {
                    allCenters = dataCenters.data;
                    updateStopDesks();
                }
            } catch (e) {
                console.error("Error updating location communes list:", e);
                communeSelect.innerHTML = '<option value="" disabled selected>خطأ في الاتصال</option>';
            }
        }

        function updateStopDesks() {
            const communeSelect = document.getElementById('commune');
            const stopdeskSelect = document.getElementById('stopdesk');
            const stopdeskContainer = document.getElementById('stopdesk-container');
            const methodInput = document.getElementById('delivery-method');
            const centerIdInput = document.getElementById('center-id');

            if (!communeSelect || !stopdeskSelect || !stopdeskContainer) return;

            const method = methodInput ? methodInput.value : 'domicil';
            const selectedCommune = communeSelect.value;
            const communeInfo = currentCommunesData.find(c => c.name === selectedCommune);
            const warningEl = document.getElementById('commune-warning');

            if (method !== 'desk') {
                stopdeskContainer.style.display = 'none';
                stopdeskSelect.required = false;
                return;
            }

            let filtered = allCenters.filter(c => c.commune_name === selectedCommune);
            let isFallback = false;
            if (filtered.length === 0 && allCenters.length > 0) {
                filtered = allCenters;
                isFallback = true;
            }

            stopdeskSelect.innerHTML = (isFallback && !selectedCommune)
                ? '<option value="" disabled selected>اختر مكتب Yalidine في ولايتك</option>'
                : (isFallback ? '<option value="" disabled selected>لا يوجد مكتب في هذه البلدية، اختر مكتباً آخر:</option>' : '<option value="" disabled selected>اختر مكتب Yalidine</option>');

            filtered.forEach(center => {
                const opt = document.createElement('option');
                opt.value = center.center_id;
                const showCommune = isFallback && center.name.toLowerCase() !== center.commune_name.toLowerCase();
                opt.textContent = showCommune ? `${center.name} (${center.commune_name})` : center.name;
                stopdeskSelect.appendChild(opt);
            });

            if (filtered.length > 0) {
                stopdeskContainer.style.display = 'block';
                stopdeskSelect.required = true;
            } else {
                stopdeskContainer.style.display = 'none';
                stopdeskSelect.required = false;
                if (centerIdInput) centerIdInput.value = '';
            }
        }

        function initOrderListeners() {
            const wilayaSelect = document.getElementById('wilaya');
            const communeSelect = document.getElementById('commune');
            const stopdeskSelect = document.getElementById('stopdesk');
            const centerIdInput = document.getElementById('center-id');

            if (wilayaSelect) {
                wilayaSelect.addEventListener('change', () => {
                    updatePriceSummary();
                    updateCommunes();
                });
            }
            if (communeSelect) {
                communeSelect.addEventListener('change', updateStopDesks);
            }
            if (stopdeskSelect) {
                stopdeskSelect.addEventListener('change', () => {
                    const selectedVal = stopdeskSelect.value;
                    if (centerIdInput) centerIdInput.value = selectedVal;
                });
            }

            const addressGroup = document.getElementById('address-div'); // wrapper, for show/hide
            const addressInput = document.getElementById('address');       // the real input, for required

            const updateAddressRequired = (method) => {
                if (addressGroup && addressInput) {
                    if (method === 'domicil') {
                        addressInput.required = true;
                        addressGroup.style.display = "block";
                    } else {
                        addressInput.required = false;
                        addressGroup.style.display = "none";
                        addressInput.value = ""; // optional: clear stale value so it's not submitted with desk orders
                    }
                }
            };

            const deliveryPills = document.querySelectorAll('.delivery-pill');
            const methodInput = document.getElementById('delivery-method');
            if (methodInput) updateAddressRequired(methodInput.value);

            deliveryPills.forEach(pill => {
                pill.addEventListener('click', () => {
                    deliveryPills.forEach(p => p.classList.remove('active'));
                    pill.classList.add('active');
                    if (methodInput) {
                        const method = pill.dataset.method;
                        methodInput.value = method;
                        updateAddressRequired(method);
                        updatePriceSummary();
                        updateStopDesks();
                    }
                });
            });
        }

        // --- Meta Ads Pixel Tracking ---
        function trackViewContent(p) {
            const eventId = generateUUID();
            const productName = p.name || 'Untitled';
            const productId = p.id || '';
            const productPrice = parseFloat((p.price || "0").toString().replace(/[^\d.]/g, '')) || 0;

            // Browser Pixel event
            if (typeof fbq === 'function') {
                fbq('track', 'ViewContent', {
                    content_name: productName,
                    content_ids: [productId],
                    content_type: 'product',
                    value: productPrice,
                    currency: 'DZD'
                }, { eventID: eventId });
            }

            // Mirror to CAPI server
            sendCapiEvent('ViewContent', eventId, {
                content_ids: [productId],
                content_type: 'product',
                value: productPrice,
                currency: 'DZD',
                content_name: productName
            });
        }

        // --- Reviews Display Carousel ---
        async function loadReviews() {
            const track = document.getElementById('reviews-carousel-track');
            if (!track) return;

            try {
                const resp = await fetch(`${GOOGLE_SCRIPT_URL}?action=get_reviews`);
                const json = await resp.json();

                if (json.status === 'success' && json.data.length > 0) {
                    const reviews = [...json.data, ...json.data, ...json.data]; // Tripled list for looping transition padding

                    track.innerHTML = reviews.map(rev => `
                    <div class="testimonial-item">
                        <img src="${rev.image || rev.Image}" alt="رأي زبونة" class="review-img">
                    </div>
                `).join('');

                    initLightboxHandlers();

                    // Smooth Infinite Scrolling
                    let scrollAmount = 0;
                    const step = 1;
                    const animate = () => {
                        scrollAmount += step;
                        if (scrollAmount >= track.scrollWidth / 3) {
                            scrollAmount = 0;
                        }
                        track.style.transform = `translateX(${scrollAmount}px)`;
                        requestAnimationFrame(animate);
                    };
                    setTimeout(animate, 1000);
                } else {
                    const sec = document.querySelector('.testimonials-section');
                    if (sec) sec.style.display = 'none';
                }
            } catch (e) {
                console.error("Reviews load error:", e);
            }
        }

        function initLightboxHandlers() {
            const lightbox = document.getElementById('review-lightbox');
            const lightboxImg = document.getElementById('lightbox-img');

            document.querySelectorAll('.testimonial-item').forEach(item => {
                item.onclick = () => {
                    const img = item.querySelector('img');
                    if (img && lightbox) {
                        lightboxImg.src = img.src;
                        lightbox.style.display = 'flex';
                    }
                };
            });
        }

        // --- Global Controls Setup ---
        document.addEventListener('DOMContentLoaded', () => {
            // Lightbox closing
            const lightbox = document.getElementById('review-lightbox');
            const closeBtn = document.querySelector('.close-lightbox');
            if (lightbox) {
                lightbox.onclick = (e) => {
                    if (e.target !== document.getElementById('lightbox-img')) {
                        lightbox.style.display = 'none';
                    }
                };
                if (closeBtn) {
                    closeBtn.onclick = () => lightbox.style.display = 'none';
                }
            }

            // Policy Modal
            const policyModal = document.getElementById('policy-modal');
            const openBtn = document.getElementById('open-policy');
            const closeBtnPolicy = document.getElementById('close-policy');

            if (openBtn && policyModal) {
                openBtn.onclick = () => policyModal.style.display = 'flex';
            }
            if (closeBtnPolicy && policyModal) {
                closeBtnPolicy.onclick = () => policyModal.style.display = 'none';
            }
            if (policyModal) {
                policyModal.onclick = (e) => {
                    if (e.target === policyModal) {
                        policyModal.style.display = 'none';
                    }
                };
            }
        });