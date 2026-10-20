document.addEventListener('DOMContentLoaded', () => {
    const GOOGLE_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbwDwtE3FqiWvMTudtcVBANhZcRQkU7_NAb381HLfrQo1BN1JKW2tM5X6XHveUyk-gU/exec";
    let deliveryRates = {};
    let currentProductPrice = 0;
    let currentProductId = "";
    let currentProductName = "";
    let allCenters = [];
    let currentCommunesData = [];

    // --- Meta Conversions API & Cookie Helpers ---
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
            console.warn("Failed to fetch client IP:", e);
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
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
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
            await fetch(GOOGLE_SCRIPT_URL, {
                method: 'POST',
                mode: 'no-cors',
                headers: { 'Content-Type': 'text/plain;charset=utf-8' },
                body: JSON.stringify(payload)
            });
            console.log(`[CAPI] Event ${eventName} sent:`, payload);
        } catch (e) {
            console.error(`[CAPI] Failed to send ${eventName}:`, e);
        }
    }

    let hasTriggeredAddToCart = false;
    let hasTriggeredInitiateCheckout = false;

    function initMetaEngagementListeners(p) {
        hasTriggeredAddToCart = false;
        hasTriggeredInitiateCheckout = false;

        const productId = p.id || p.ID;
        const productName = p.title || p.Name || p.name || "Untitled";
        const productPrice = parseNumericPrice(p.price || p.Price);
        const form = document.getElementById('checkout-form');
        if (!form) return;

        const triggerAddToCart = () => {
            if (hasTriggeredAddToCart) return;
            hasTriggeredAddToCart = true;

            const eventId = generateUUID();
            if (typeof fbq === 'function') {
                fbq('track', 'AddToCart', {
                    content_type: 'product',
                    content_ids: [productId],
                    content_name: productName,
                    value: productPrice,
                    currency: 'DZD'
                }, { eventID: eventId });
            }

            sendCapiEvent('AddToCart', eventId, {
                content_ids: [productId],
                content_type: 'product',
                value: productPrice,
                currency: 'DZD',
                content_name: productName
            });
            console.log(`[Meta Tracking] AddToCart triggered for ID: ${productId}`);
        };

        const optionsContainer = document.getElementById('options-container');
        if (optionsContainer) {
            optionsContainer.addEventListener('change', (e) => {
                if (e.target.classList.contains('dynamic-option-select')) {
                    triggerAddToCart();
                }
            });
            optionsContainer.addEventListener('click', (e) => {
                if (e.target.classList.contains('dynamic-option-select')) {
                    triggerAddToCart();
                }
            });
        }

        const selectionBox = document.querySelector('.selection-box');
        if (selectionBox) {
            selectionBox.addEventListener('click', (e) => {
                if (e.target.closest('.color-circle') || e.target.closest('.size-pill')) {
                    triggerAddToCart();
                }
            });
        }

        const triggerInitiateCheckout = () => {
            if (!hasTriggeredAddToCart) {
                triggerAddToCart();
            }

            if (hasTriggeredInitiateCheckout) return;
            hasTriggeredInitiateCheckout = true;

            const eventId = generateUUID();
            if (typeof fbq === 'function') {
                fbq('track', 'InitiateCheckout', {
                    content_type: 'product',
                    content_ids: [productId],
                    content_name: productName,
                    value: productPrice,
                    currency: 'DZD'
                }, { eventID: eventId });
            }

            sendCapiEvent('InitiateCheckout', eventId, {
                content_ids: [productId],
                content_type: 'product',
                value: productPrice,
                currency: 'DZD',
                content_name: productName
            });
            console.log(`[Meta Tracking] InitiateCheckout triggered for ID: ${productId}`);
        };

        const inputs = form.querySelectorAll('input[type="text"], input[type="tel"], input[type="email"]');
        inputs.forEach(input => {
            input.addEventListener('focus', triggerInitiateCheckout);
            input.addEventListener('input', triggerInitiateCheckout);
        });
    }

    // --- 0. INITIAL SELECTION STATE (Capture defaults from HTML) ---
    function initSelectionStates() {
        const activeColor = document.querySelector('.color-circle.active');
        if (activeColor) window.selectedColor = activeColor.dataset.color || activeColor.title;

        const activeSize = document.querySelector('#checkout-size-options .size-pill.active');
        if (activeSize) window.selectedSize = activeSize.textContent.trim();

        const activeStyle = document.querySelector('#checkout-type-options .size-pill.active');
        if (activeStyle) window.selectedStyle = activeStyle.textContent.trim();
    }

    // --- 0. HELPERS & MAPS ---
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

    /**
     * Robustly get a property from a product object, checking various naming conventions.
     */
    function getProp(obj, keys) {
        if (!obj) return "";
        for (let key of keys) {
            if (obj[key] !== undefined && obj[key] !== null) return obj[key];
            const found = Object.keys(obj).find(k => k.toLowerCase() === key.toLowerCase());
            if (found) return obj[found];
        }
        return "";
    }

    function parseNumericPrice(val) {
        if (!val) return 0;
        const clean = val.toString().replace(/,/g, '').replace(/[^\d.]/g, '');
        return parseFloat(clean) || 0;
    }

    // --- 1. ANIMATIONS & UI LOGIC ---
    const observerOptions = { threshold: 0.1 };
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.style.opacity = '1';
                entry.target.style.transform = 'translateY(0)';
            }
        });
    }, observerOptions);

    const animateElements = document.querySelectorAll('.feature-card, .hero-content, .hero-image');
    animateElements.forEach(el => {
        el.style.opacity = '0';
        el.style.transform = 'translateY(20px)';
        el.style.transition = 'all 0.6s ease-out';
        observer.observe(el);
    });

    // --- 2. TESTIMONIALS CAROUSEL LOGIC ---
    const testiTrack = document.getElementById('testimonials-track');
    const testiPrev = document.getElementById('testi-prev');
    const testiNext = document.getElementById('testi-next');

    if (testiTrack) {
        let isDragging = false;
        let startPos = 0;
        let currentTranslate = 0;
        let prevTranslate = 0;
        let animationID = 0;
        let currentIndex = 0;
        let slideWidth = 0;
        let gap = 0;
        let spv = 3;
        const originalSlides = Array.from(testiTrack.children);
        let allSlides = [];

        const initCarousel = () => {
            testiTrack.querySelectorAll('.clone').forEach(el => el.remove());
            spv = window.innerWidth <= 576 ? 1 : window.innerWidth <= 968 ? 2 : 3;
            originalSlides.slice(-spv).forEach(slide => {
                const clone = slide.cloneNode(true);
                clone.classList.add('clone');
                testiTrack.prepend(clone);
            });
            originalSlides.slice(0, spv).forEach(slide => {
                const clone = slide.cloneNode(true);
                clone.classList.add('clone');
                testiTrack.appendChild(clone);
            });
            allSlides = Array.from(testiTrack.children);
            currentIndex = spv;
            updateDimensions();
            setPositionByIndex();
        };

        const updateDimensions = () => {
            if (originalSlides.length > 0) {
                slideWidth = originalSlides[0].offsetWidth;
                gap = parseFloat(window.getComputedStyle(testiTrack).gap) || 0;
            }
        };

        const setPositionByIndex = (animate = false) => {
            const movePx = currentIndex * (slideWidth + gap);
            currentTranslate = document.documentElement.dir === 'rtl' ? movePx : -movePx;
            prevTranslate = currentTranslate;
            testiTrack.style.transition = animate ? 'transform 0.4s ease-out' : 'none';
            testiTrack.style.transform = `translateX(${currentTranslate}px)`;
        };

        const handleTransitionEnd = () => {
            if (currentIndex <= 0) {
                currentIndex = originalSlides.length;
                setPositionByIndex(false);
            } else if (currentIndex >= allSlides.length - spv) {
                currentIndex = spv;
                setPositionByIndex(false);
            }
        };

        const goNext = () => {
            if (currentIndex >= allSlides.length - spv) return;
            currentIndex++;
            setPositionByIndex(true);
        };

        const goPrev = () => {
            if (currentIndex <= 0) return;
            currentIndex--;
            setPositionByIndex(true);
        };

        if (testiNext) testiNext.addEventListener('click', goNext);
        if (testiPrev) testiPrev.addEventListener('click', goPrev);
        testiTrack.addEventListener('transitionend', handleTransitionEnd);
        window.addEventListener('resize', () => { setTimeout(initCarousel, 100); });

        const touchStart = (event) => {
            isDragging = true;
            startPos = event.type.includes('mouse') ? event.pageX : event.touches[0].clientX;
            animationID = requestAnimationFrame(animation);
            testiTrack.style.cursor = 'grabbing';
            testiTrack.style.transition = 'none';
        };

        const touchMove = (event) => {
            if (isDragging) {
                const currentPosition = event.type.includes('mouse') ? event.pageX : event.touches[0].clientX;
                currentTranslate = prevTranslate + (currentPosition - startPos);
            }
        };

        const touchEnd = () => {
            isDragging = false;
            cancelAnimationFrame(animationID);
            testiTrack.style.cursor = 'grab';
            const movedBy = currentTranslate - prevTranslate;
            const isRTL = document.documentElement.dir === 'rtl';
            const threshold = slideWidth * 0.2;
            if (Math.abs(movedBy) > threshold) {
                if (movedBy > 0) isRTL ? goNext() : goPrev();
                else isRTL ? goPrev() : goNext();
            } else { setPositionByIndex(true); }
        };

        const animation = () => {
            testiTrack.style.transform = `translateX(${currentTranslate}px)`;
            if (isDragging) requestAnimationFrame(animation);
        };

        testiTrack.addEventListener('touchstart', touchStart, { passive: true });
        testiTrack.addEventListener('touchend', touchEnd);
        testiTrack.addEventListener('touchmove', touchMove, { passive: true });
        testiTrack.addEventListener('mousedown', touchStart);
        testiTrack.addEventListener('mouseup', touchEnd);
        testiTrack.addEventListener('mouseleave', () => { if (isDragging) touchEnd() });
        testiTrack.addEventListener('mousemove', touchMove);

        testiTrack.querySelectorAll('img').forEach(img => {
            img.addEventListener('dragstart', e => e.preventDefault());
        });
        setTimeout(initCarousel, 100);
    }

    // --- 3. MODAL LOGIC ---
    const showModal = () => {
        const modal = document.getElementById('thank-you-modal');
        if (modal) {
            modal.classList.add('active');
            document.body.style.overflow = 'hidden';
        }
    };

    const closeModal = () => {
        const modal = document.getElementById('thank-you-modal');
        if (modal) {
            modal.classList.remove('active');
            document.body.style.overflow = '';
        }
    };

    const closeBtn = document.getElementById('close-modal');
    if (closeBtn) closeBtn.addEventListener('click', closeModal);

    // --- 4. FORM SUBMISSION ---
    const forms = document.querySelectorAll('.subscribe-form, .order-form, .checkout-form');

    forms.forEach(form => {
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            const btn = form.querySelector('#checkout-button');
            const originalText = btn.textContent;

            if (!form.classList.contains('checkout-form')) {
                btn.textContent = 'تم الإرسال!';
                btn.style.backgroundColor = '#27ae60';
                form.reset();
                setTimeout(() => {
                    btn.textContent = originalText;
                    btn.style.backgroundColor = '';
                }, 3000);
                return;
            }

            const phoneInput = form.querySelector('#phone');
            const phoneRegex = /^0[5-7][0-9]{8}$/;

            if (!phoneRegex.test(phoneInput.value)) {
                phoneInput.setCustomValidity('يرجى إدخال رقم هاتف صحيح (10 أرقام تبدأ بـ 05، 06 أو 07)');
                phoneInput.reportValidity();
                return;
            } else { phoneInput.setCustomValidity(''); }

            const communeSelect = document.getElementById('commune');
            if (!communeSelect.checkValidity()) {
                communeSelect.reportValidity();
                return;
            }

            const formData = new FormData(form);
            const wilayaSelect = form.querySelector('#wilaya');
            const eventId = 'evt_' + Date.now() + '_' + Math.floor(Math.random() * 100000);

            const selectedWilayaOption = wilayaSelect.options[wilayaSelect.selectedIndex];
            const wilayaText = selectedWilayaOption.text;
            const arabicName = wilayaText.includes('-') ? wilayaText.split('-')[1].trim() : wilayaText.trim();
            const frenchName = wilayaMap[arabicName] || arabicName;

            const deliveryMethod = document.getElementById('delivery-method')?.value || 'domicil';

            const rate = deliveryRates[frenchName] || deliveryRates[arabicName];
            const deliveryFee = rate ? (parseFloat(rate[deliveryMethod]) || 0) : 0;
            const finalTotalPrice = currentProductPrice + deliveryFee;

            let dynamicOptionsStr = "";
            const dynamicSelects = form.querySelectorAll('.dynamic-option-select');
            dynamicSelects.forEach(sel => {
                if(sel.value) {
                    dynamicOptionsStr += `${sel.dataset.optionName}: ${sel.value} | `;
                }
            });

            const orderData = {
                customer: {
                    fullName: formData.get('full-name'),
                    email: formData.get('email'),
                    phone: formData.get('phone'),
                    wilaya: wilayaText,
                    address: formData.get('address'),
                    deliveryMethod: deliveryMethod === 'domicil' ? 'Home' : 'Desk'
                },
                product: {
                    name: document.querySelector('.product-title').textContent,
                    color: dynamicOptionsStr ? 'خيارات ديناميكية' : (window.selectedColor || 'Default'),
                    size: dynamicOptionsStr ? dynamicOptionsStr : (window.selectedSize || 'Default'),
                    type: window.selectedStyle || '',
                    price: `${finalTotalPrice} دج`
                },
                timestamp: new Date().toLocaleString('fr-FR')
            };

            try {
                if (typeof fbq === 'function') {
                    fbq('track', 'Purchase', {
                        currency: 'DZD',
                        value: finalTotalPrice,
                        content_name: orderData.product.name,
                        content_type: 'product',
                        content_ids: [String(currentProductId)]
                    }, { eventID: eventId });
                }

                btn.disabled = true;
                btn.textContent = 'جاري الإرسال...';

                const sheetData = {
                    action: 'ORDER',
                    fullName: orderData.customer.fullName,
                    email: orderData.customer.email,
                    phone: orderData.customer.phone,
                    wilaya: document.getElementById('official-wilaya-name')?.value || orderData.customer.wilaya,
                    commune: document.getElementById('official-commune-name')?.value || orderData.customer.commune,
                    address: orderData.customer.address,
                    center_id: document.getElementById('center-id')?.value || "", // Capture center_id
                    color: orderData.product.color,
                    size: orderData.product.type ? `${orderData.product.size} - ${orderData.product.type}` : orderData.product.size,
                    product: orderData.product.name,
                    price: orderData.product.price,
                    productBasePrice: currentProductPrice,
                    is_stopdesk: deliveryMethod === 'desk' ? 1 : 0,
                    timestamp: orderData.timestamp,
                    eventId: eventId,
                    productId: currentProductId || "",
                    userAgent: navigator.userAgent,
                    clientIp: clientIp,
                    fbc: getOrSetFbc() || "",
                    fbp: getOrSetFbp() || "",
                    externalId: getOrGenerateExternalId(),
                    sourceUrl: window.location.href
                };

                await fetch(GOOGLE_SCRIPT_URL, {
                    method: 'POST',
                    mode: 'no-cors',
                    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
                    body: JSON.stringify(sheetData)
                });

                showModal();
                form.reset();
                updatePriceSummary();
            } catch (error) {
                console.error('Submission failed:', error);
                alert('عذراً، حدث خطأ. يرجى التحقق من اتصالك بالإنترنت.');
            } finally {
                btn.disabled = false;
                btn.textContent = originalText;
            }
        });
    });

    // --- 5. CORE ORDER & DELIVERY LOGIC ---
    function updatePriceSummary() {
        if (currentProductPrice === 0) {
            const elPriceNow = document.querySelector('.price-now');
            if (elPriceNow) currentProductPrice = parseNumericPrice(elPriceNow.textContent);
        }

        const wilayaSelect = document.getElementById('wilaya');
        const methodInput = document.getElementById('delivery-method');
        const method = methodInput ? methodInput.value : 'domicil';

        let fee = 0;
        if (wilayaSelect && wilayaSelect.value) {
            const selectedOption = wilayaSelect.options[wilayaSelect.selectedIndex];
            const text = selectedOption.text;
            const arabicName = text.includes('-') ? text.split('-')[1].trim() : text.trim();
            const frenchName = wilayaMap[arabicName] || arabicName;

            // Debugging
            console.log("Wilaya Lookup:", { arabicName, frenchName, method });
            console.log("All Rates:", deliveryRates);

            const rate = deliveryRates[frenchName] || deliveryRates[arabicName] ||
                deliveryRates[wilayaSelect.value] || // Try numeric ID (e.g. "16")
                deliveryRates[parseInt(wilayaSelect.value).toString()] || // Try without leading zero
                deliveryRates[arabicName.replace("ال", "")] ||
                Object.values(deliveryRates).find(r => r.name === frenchName);

            if (rate) {
                fee = parseFloat(rate[method]) || 0;
                console.log("Found Rate:", rate, "Fee:", fee);
            } else {
                console.warn("No rate found for:", { frenchName, arabicName, id: wilayaSelect.value });
            }
        }

        const total = currentProductPrice + fee;
        const elProduct = document.getElementById('summary-product-price');
        const elFee = document.getElementById('summary-delivery-fee');
        const elTotal = document.getElementById('summary-total-price');

        if (elProduct) elProduct.textContent = `${currentProductPrice} دج`;
        if (elFee) elFee.textContent = `${fee} دج`;
        if (elTotal) elTotal.textContent = `${total} دج`;
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
        allCenters = []; // Reset centers to avoid old wilaya data
        if (stopdeskContainer) stopdeskContainer.style.display = 'none';

        try {
            // 1. Fetch ALL Communes for this Wilaya
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

            // 2. Fetch Centers for this Wilaya to be ready for Stop Desk
            const resCenters = await fetch(`${GOOGLE_SCRIPT_URL}?action=centers&wilaya=${wilayaId}`);
            const dataCenters = await resCenters.json();
            if (dataCenters && dataCenters.data) {
                allCenters = dataCenters.data;
                updateStopDesks(); // Refresh Stop Desk list now that we have data
            }
        } catch (e) {
            console.error("Error updating location data:", e);
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
        const communeGroup = communeSelect.closest('.form-group');

        // Keep Commune field visible for better UX and consistency
        if (communeGroup) {
            communeGroup.style.display = 'block';
            communeSelect.required = true;
        }

        // Sync official names to hidden fields
        const officialWilaya = document.getElementById('official-wilaya-name');
        const officialCommune = document.getElementById('official-commune-name');
        if (communeInfo) {
            if (officialWilaya) officialWilaya.value = communeInfo.wilaya_name;
            if (officialCommune) officialCommune.value = communeInfo.name;
        } else {
            if (officialWilaya) officialWilaya.value = '';
            if (officialCommune) officialCommune.value = '';
        }

        if (warningEl) {
            warningEl.style.display = 'none';
            warningEl.textContent = '';
            warningEl.className = 'commune-warning'; // Reset classes
            
            if (communeInfo) {
                const hasHome = !!communeInfo.is_deliverable;
                const hasAnyDesk = allCenters.length > 0;
                
                if (!hasHome && !hasAnyDesk) {
                    // Total Block: No home delivery and no stopdesks in the entire wilaya
                    warningEl.textContent = "عذراً، هذه المنطقة غير مغطاة بخدمة التوصيل حالياً (لا يوجد توصيل للمنزل أو مكتب).";
                    warningEl.style.display = 'block';
                    warningEl.classList.add('error-blocking');
                    communeSelect.setCustomValidity("المنطقة غير مغطاة بالتوصيل.");
                } else if (method === 'domicil' && !hasHome) {
                    // Method specific warning: Home delivery not supported, but Desk might be
                    warningEl.textContent = "هذه البلدية لا تدعم التوصيل للمنزل. يرجى اختيار التوصيل للمكتب.";
                    warningEl.style.display = 'block';
                    communeSelect.setCustomValidity("هذه البلدية لا تدعم التوصيل للمنزل.");
                } else if (method === 'desk' && !hasAnyDesk) {
                    // Method specific warning: Desk not supported, but Home might be
                    warningEl.textContent = "لا توجد مكاتب Yalidine في هذه الولاية حالياً. يرجى اختيار التوصيل للمنزل.";
                    warningEl.style.display = 'block';
                    communeSelect.setCustomValidity("لا يوجد توصيل للمكتب.");
                } else {
                    communeSelect.setCustomValidity("");
                }
            }
        }

        if (method !== 'desk') {
            stopdeskContainer.style.display = 'none';
            stopdeskSelect.required = false;
            return;
        }

        // Filter centers by the selected commune
        let filtered = allCenters.filter(c => c.commune_name === selectedCommune);

        // Fallback: If no center in this commune, show all centers in the Wilaya
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
            
            // Avoid redundant commune names in the display text
            const showCommune = isFallback && center.name.toLowerCase() !== center.commune_name.toLowerCase();
            opt.textContent = showCommune ? `${center.name} (${center.commune_name})` : center.name;
            
            stopdeskSelect.appendChild(opt);
        });

        if (filtered.length > 0) {
            stopdeskContainer.style.display = 'block';
            stopdeskSelect.required = true;

            // Auto-populate hidden fields with the first available center if none selected
            if (!stopdeskSelect.value && filtered[0]) {
                // We'll let the user select manually or trigger it on change
            }
        } else {
            stopdeskContainer.style.display = 'none';
            stopdeskSelect.required = false;
            if (centerIdInput) centerIdInput.value = '';
            const communeInput = document.getElementById('stopdesk-commune');
            if (communeInput) communeInput.value = '';
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

                // Find matching center to get its official commune_name
                const center = allCenters.find(c => c.center_id == selectedVal);
                const communeInput = document.getElementById('stopdesk-commune');
                const officialCommune = document.getElementById('official-commune-name');
                if (center) {
                    if (communeInput) communeInput.value = center.commune_name;
                    if (officialCommune) officialCommune.value = center.commune_name;
                }
            });
        }

        const addressInput = document.getElementById('address');
        const updateAddressRequired = (method) => {
            if (addressInput) {
                if (method === 'domicil') {
                    addressInput.required = true;
                    addressInput.placeholder = "اسم الحي والشارع (إجباري)";
                } else {
                    addressInput.required = false;
                    addressInput.placeholder = "اسم الحي والشارع (اختياري)";
                }
            }
        };

        const deliveryPills = document.querySelectorAll('.delivery-pill');
        const methodInput = document.getElementById('delivery-method');
        // Initial state
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
                    updateStopDesks(); // <--- Added to trigger real-time validation
                }
            });
        });

        document.body.addEventListener('click', (e) => {
            const circle = e.target.closest('.color-circle');
            if (circle) {
                circle.parentElement.querySelectorAll('.color-circle').forEach(c => c.classList.remove('active'));
                circle.classList.add('active');
                window.selectedColor = circle.dataset.color || circle.title;
                syncGallery();
            }

            const pill = e.target.closest('.size-pill');
            if (pill) {
                pill.parentElement.querySelectorAll('.size-pill').forEach(p => p.classList.remove('active'));
                pill.classList.add('active');
                // Identify if it's Size or Type (Style)
                if (pill.parentElement.id === 'checkout-size-options') {
                    window.selectedSize = pill.textContent.trim();
                } else if (pill.parentElement.id === 'checkout-type-options') {
                    window.selectedStyle = pill.textContent.trim();
                    syncGallery();
                }
            }
        });
    }

    function fetchDeliveryRates() {
        console.log("Fetching delivery rates...");
        fetch(`${GOOGLE_SCRIPT_URL}?action=tarifs`)
            .then(res => res.json())
            .then(res => {
                console.log("Rates response:", res);
                if (res.status === 'success') {
                    deliveryRates = res.data;
                    console.log("Delivery rates loaded successfully:", Object.keys(deliveryRates).length, "items");
                    updatePriceSummary();
                } else {
                    console.error("Failed to load rates:", res.message);
                }
            })
            .catch(err => console.error('Error fetching delivery rates:', err));
    }

    // --- 6. GALLERY & PRODUCT LOGIC ---
    let galleryCurrentIndex = 0;
    function initGallerySwiper() {
        const track = document.getElementById('main-gallery-track');
        const dotsContainer = document.getElementById('main-gallery-dots');
        const prevBtn = document.getElementById('main-gallery-prev');
        const nextBtn = document.getElementById('main-gallery-next');

        if (!track) return;
        galleryCurrentIndex = 0;
        track.style.transform = 'translateX(0%)';
        const slides = track.querySelectorAll('img');
        if (slides.length === 0) return;

        if (dotsContainer) {
            dotsContainer.innerHTML = '';
            slides.forEach((_, i) => {
                const dot = document.createElement('div');
                dot.className = i === 0 ? 'dot active' : 'dot';
                dot.onclick = () => moveGallery(i);
                dotsContainer.appendChild(dot);
            });
        }

        function moveGallery(index) {
            if (index < 0) index = slides.length - 1;
            if (index >= slides.length) index = 0;
            galleryCurrentIndex = index;
            const multiplier = document.documentElement.dir === 'rtl' ? 1 : -1;
            track.style.transform = `translateX(${index * 100 * multiplier}%)`;
            if (dotsContainer) {
                dotsContainer.querySelectorAll('.dot').forEach((d, i) => d.classList.toggle('active', i === index));
            }
        }

        if (prevBtn) prevBtn.onclick = () => moveGallery(galleryCurrentIndex - 1);
        if (nextBtn) nextBtn.onclick = () => moveGallery(galleryCurrentIndex + 1);
        window.moveGalleryToIndex = moveGallery;
    }

    function syncGallery() {
        const track = document.getElementById('main-gallery-track');
        if (!track) return;
        const images = track.querySelectorAll('img');
        let targetIndex = -1;
        images.forEach((img, i) => {
            if (img.dataset.color === window.selectedColor && img.dataset.style === window.selectedStyle) targetIndex = i;
        });
        if (targetIndex === -1) {
            images.forEach((img, i) => {
                if (img.dataset.color === window.selectedColor && img.dataset.style === 'All') targetIndex = i;
            });
        }
        if (targetIndex !== -1 && window.moveGalleryToIndex) window.moveGalleryToIndex(targetIndex);
    }

    async function loadProducts() {
        const urlParams = new URLSearchParams(window.location.search);
        const productId = urlParams.get('id');
        const listContainer = document.getElementById('dynamic-products-list');

        // 1. Handle Specific Product Page (Hydrate main content)
        if (productId) {
            try {
                const resp = await fetch(`${GOOGLE_SCRIPT_URL}?id=${productId}`);
                const json = await resp.json();
                if (json.status === "success" && json.data) {
                    renderProductPage(json.data);
                }
            } catch (e) {
                console.error("Error loading specific product:", e);
            }
        }

        // 2. Handle Homepage / Product List
        if (listContainer) {
            const cachedString = localStorage.getItem('rymel_products_cache');
            if (cachedString) {
                try {
                    const cachedData = JSON.parse(cachedString);
                    renderDynamicProducts(cachedData);
                    // Show LATEST product by default on homepage
                    if (!productId && cachedData.length > 0) renderProductPage(cachedData[cachedData.length - 1]);
                } catch(e) {}
            }

            try {
                const response = await fetch(`${GOOGLE_SCRIPT_URL}?action=list&t=${Date.now()}`);
                const json = await response.json();
                if (json.status === "success" && json.data) {
                    localStorage.setItem('rymel_products_cache', JSON.stringify(json.data));
                    renderDynamicProducts(json.data);
                    // Update main page with the absolute latest from server
                    if (!productId && json.data.length > 0) renderProductPage(json.data[json.data.length - 1]);
                }
            } catch (e) {
                console.error("Error loading product list:", e);
            }
        }
    }

    function renderDynamicProducts(products) {
        const list = document.getElementById('dynamic-products-list');
        if (!list) return;
        
        list.innerHTML = ''; // Clear loader or old items

        // Reverse to show newest at the top of the grid
        products.slice().reverse().forEach(p => {
            const price = p.price || "0";
            const id = p.id || p.ID || "";
            const name = p.title || p.Name || p.name || p.الاسم || "Untitled";
            const imageUrl = p.mainImageId|| p.image ||'images/seo.png';
            //const imageUrl = p.image || p.Image || p.صورة || p.img ;

            const card = document.createElement('a');
            card.href = `product.html?id=${id}`;
            card.className = 'product-card dynamic-card';

            const mediaInput = (imageUrl || "").trim();
            const style = "width:100%; height:100%; object-fit: cover;";          
            const hasVideoExtension = /\.(mp4|webm|ogg|mov|m4v|avi|wmv|flv|mkv)(?:[?#].*)?$/i.test(mediaInput);
            const isTaggedDriveVideo = mediaInput.toLowerCase().startsWith('video:');

            let mediaHTML = "";

            if (isTaggedDriveVideo) {
                const cleanId = mediaInput.substring(6).trim();
                mediaHTML = `<iframe title="${name}" src="https://drive.google.com/file/d/${cleanId}/preview?autoplay=1&loop=1&playlist=${cleanId}" style="${style}" allow="autoplay" frameborder="0"></iframe>`;
            } else if (hasVideoExtension) {
                mediaHTML = `<video src="${mediaInput}" autoplay loop muted playsinline style="${style}"></video>`;
            } else {
                const imgSrc = mediaInput.startsWith('http') ? mediaInput : `https://lh3.googleusercontent.com/d/${mediaInput}`;
                mediaHTML = `<img src="${imgSrc}" alt="Product Media" style="${style}">`;
            }


            card.innerHTML = `
                <div class="card-img">${mediaHTML}</div>
                <div class="card-info">
                    <span class="badge">جديد</span>
                    <h3>${name}</h3>
                    <p class="price">${price} دج</p>
                </div>
            `;
            list.appendChild(card);
        });
        lucide.createIcons();
    }

    // --- POLICY MODAL LOGIC ---
    const policyModal = document.getElementById('policy-modal');
    const openPolicyBtn = document.getElementById('open-policy');
    const closePolicyBtn = document.getElementById('close-policy');

    if (openPolicyBtn && policyModal) {
        openPolicyBtn.addEventListener('click', () => {
            policyModal.style.display = 'flex';
            document.body.style.overflow = 'hidden';
        });
    }

    if (closePolicyBtn && policyModal) {
        closePolicyBtn.addEventListener('click', () => {
            policyModal.style.display = 'none';
            document.body.style.overflow = '';
        });
    }

    if (policyModal) {
        policyModal.addEventListener('click', (e) => {
            if (e.target === policyModal) {
                policyModal.style.display = 'none';
                document.body.style.overflow = '';
            }
        });
    }
    

    // --- DYNAMIC PRODUCT OPTIONS ---
    window.renderProductOptions = function(optionsJSON) {
        const container = document.getElementById('options-container');
        if (!optionsJSON || optionsJSON === "" || !container) return;

        try {
            let optionsArray;
            if (typeof optionsJSON === 'string') {
                optionsArray = JSON.parse(optionsJSON);
            } else if (Array.isArray(optionsJSON)) {
                optionsArray = optionsJSON;
            } else return;

            if (!Array.isArray(optionsArray) || optionsArray.length === 0) return;

            container.innerHTML = '';

            optionsArray.forEach((option, index) => {
                if (!option.name || !Array.isArray(option.values)) return;

                const groupDiv = document.createElement('div');
                groupDiv.className = 'form-group';
                groupDiv.style.marginBottom = '20px'; 

                const label = document.createElement('label');
                label.textContent = option.name;
                label.setAttribute('for', `dynamic-option-${index}`);
                groupDiv.appendChild(label);

                const selectWrapper = document.createElement('div');
                selectWrapper.className = 'custom-select-wrapper';

                const select = document.createElement('select');
                select.id = `dynamic-option-${index}`;
                select.className = 'dynamic-option-select'; 
                select.dataset.optionName = option.name; 

                const defaultOpt = document.createElement('option');
                defaultOpt.value = "";
                defaultOpt.disabled = true;
                defaultOpt.selected = true;
                defaultOpt.textContent = `اختر ${option.name}`;
                select.appendChild(defaultOpt);

                option.values.forEach(val => {
                    const opt = document.createElement('option');
                    opt.value = val;
                    opt.textContent = val;
                    select.appendChild(opt);
                });

                selectWrapper.appendChild(select);
                groupDiv.appendChild(selectWrapper);
                container.appendChild(groupDiv);
            });
        } catch (e) {
            console.error("Error parsing Product Options JSON:", e);
        }
    };

    function renderProductPage(product) {
        if (!product) return;
        const name = getProp(product, ['name', 'Name', 'الاسم', 'title']);
        const priceStr = getProp(product, ['price', 'Price', 'السعر', 'سعر']);
        const desc = getProp(product, ['description', 'Description', 'desc', 'وصف']) || '';
        const img = getProp(product, ['image', 'Image', 'صورة']) || 'images/simple-grey.jpg';

        document.querySelectorAll('.product-title').forEach(el => el.textContent = name);
        document.querySelectorAll('.price-now').forEach(el => el.textContent = priceStr + ' دج');
        
        if (document.getElementById('page-title')) document.getElementById('page-title').textContent = `${name} - رمال`;
        if (document.getElementById('hero-title')) document.getElementById('hero-title').textContent = name;
        if (document.getElementById('hero-desc')) document.getElementById('hero-desc').textContent = desc;
        if (document.getElementById('hero-img')) document.getElementById('hero-img').src = img;

        // Hydrate Gallery
        const track = document.getElementById('main-gallery-track');
        if (track) {
            const galleryImages = [img];
            const galleryRaw = getProp(product, ['gallery', 'Gallery', 'معرض']);
            if (galleryRaw) {
                const extra = Array.isArray(galleryRaw) ? galleryRaw : galleryRaw.split(',').map(s => s.trim());
                extra.forEach(gi => { if (gi) galleryImages.push(gi); });
            }
            
            track.innerHTML = galleryImages.map(gi => `<img src="${gi}" alt="${name}" data-color="All" data-style="All">`).join('');
            initGallerySwiper(); // Re-init swiper for new images
        }

        const dynOpts = getProp(product, ['Options_JSON', 'options_json', 'options', 'خيارات']);
        const oldBox = document.querySelector('.selection-box');
        const dynContainer = document.getElementById('options-container');

        if (dynOpts) {
            renderProductOptions(dynOpts);
            if (oldBox) oldBox.style.display = 'none';
        } else {
            if (oldBox) oldBox.style.display = 'block';
            if (dynContainer) dynContainer.innerHTML = '';
        }

        currentProductPrice = parseNumericPrice(priceStr);
        updatePriceSummary();

        // Trigger Meta Pixel ViewContent event
        const productId = getProp(product, ['id', 'ID']);
        if (productId && typeof fbq === 'function') {
            fbq('track', 'ViewContent', {
                content_type: 'product',
                content_ids: [productId],
                content_name: name,
                value: currentProductPrice,
                currency: 'DZD'
            });
            console.log(`[Meta Pixel] ViewContent tracked for ID: ${productId}`);
        }
    }

    function checkUrlForProduct(products) {
        const id = new URLSearchParams(window.location.search).get('id');
        if (id) {
            const p = products.find(p => getProp(p, ['id', 'ID']) == id);
            if (p) renderProductPage(p);
        }
    }

    // --- INITIALIZE ---
    initSelectionStates(); // Capture pre-selected HTML defaults
    initOrderListeners();
    initGallerySwiper(); // Initialize hardcoded images from HTML
    loadProducts();
    fetchDeliveryRates();
    updatePriceSummary();
});