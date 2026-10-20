/**
 * Rymal E-commerce Backend - Production Edition
 * Powered by Google Apps Script
 */

// ==========================================
// MASTER AUTHENTICATION CREDENTIALS
// ==========================================
const MASTER_USER = "rymel_admin";
const MASTER_PASS = "rymel";
const MASTER_TOKEN = "rymel_secure_token_89xyz_2026";
// ==========================================
// CONFIGURATION
// ==========================================
const DRIVE_FOLDER_ID = "1PRiSYHLMwEsUsq0ihJCcPJEgEmxBlzGw"; // Replace with your Google Drive Folder ID

const CONFIG = {
    SHEETS: {
        PRODUCTS: 'Products',
        ORDERS: 'Orders',
        TARIFS: 'tarifs livraison',
        REVIEWS: 'Reviews',
        NICHES: 'Niches',
        RATINGS: 'Ratings'
    },
    DRIVE: {
        DEFAULT_IMG: 'https://images.unsplash.com/photo-1556228720-195a672e8a03?q=80&w=800&auto=format&fit=crop'
    },
    APIS: {
        YALIDINE: {
            ID: '09897325726363880972',
            TOKEN: 'HxSkUhrg7Yfd5OL3tEsFPJXaD4eW8BbRcKw2voI0npV6u9ACm1QzlyNiMGjTZq',
            BASE_URL: 'https://api.yalidine.app/v1'
        },
        META_CAPI: {
            PIXEL_ID: '756841240594846',
            ACCESS_TOKEN: 'EAARsAvc8xHwBQzHNf3FskzfNXkKi8BPp9tZCQjUfenmPlCfrbBnrbjKwE8ZBJ7RK7x2w7SNmnd2bDWUwabiPsx5g9mZCjZCWQSOMd2A3aUjZAz4eCh8WkBm1333TZA93e0AdU1lWZB8zGnZAxrxqKBNrcxw7uZCF16veGuEEqmYmAx1P7J2nTP2BCiVlHG41NCAZDZD'
        }
    },
    NOTIFICATIONS: {
        ADMIN_EMAIL: 'rymelldz@gmail.com'
    }
};

// ==========================================
// ROUTER: GET
// ==========================================
function doGet(e) {
    try {
        if (!e || !e.parameter) {
            return ContentService.createTextOutput("Rymel API is active. Access via client web application.");
        }

        const action = e.parameter.action || e.parameter.type || 'list';
        const id = e.parameter.id;
        const wilaya = e.parameter.wilaya;

        // Fetch single product by URL slug ID
        if (id) {
            const p = ProductService.getById(id);
            if (p) {
                const ratingData = RatingService.getSummary(id).data;
                const standardized = {
                    id: p.ProductID || "",
                    name: p.Title || "",
                    price: p.Price || "0",
                    mainImageId: p.MainImageID || "",
                    galleryIds: p.GalleryIDs || "",
                    stock: p.Stock || 0,
                    description: p.Description || "",
                    options: p.FeaturesJSON || "",
                    niche: p.Niche || "",
                    ratingAverage: ratingData.average,
                    ratingCount: ratingData.count
                };
                return Response.json({ status: 'success', data: standardized });
            }
            return Response.json({ status: 'error', message: 'Product not found' }, 404);
        }

        // Fetch product list
        if (action === 'list' || action === 'products') {
            const products = ProductService.getAll();
            const ratingsMap = RatingService.getMap();
            const summary = products.map(p => {
                const mainImgId = p.MainImageID || "";
                const imgUrl = mainImgId ? "https://lh3.googleusercontent.com/d/" + mainImgId : CONFIG.DRIVE.DEFAULT_IMG;
                const r = ratingsMap[String(p.ProductID || "")]; 
                return {
                    id: p.ProductID || "N/A",
                    title: p.Title || "Untitled",
                    price: p.Price || "0",
                    image: imgUrl,
                    mainImageId: mainImgId,
                    stock: p.Stock || 0,
                    description: p.Description || "",
                    gallery: p.GalleryIDs || "",
                    options: p.FeaturesJSON || "",
                    niche: p.Niche || "",
                    ratingAverage: r ? Number((r.sum / r.count).toFixed(1)) : 0,
                    ratingCount: r ? r.count : 0 
                };
            });
            return Response.json({ status: 'success', data: summary });
        }

        if (action === 'tarifs') return Response.json(ProductService.getTarifs());
        if (action === 'centers' && wilaya) return Response.json(YalidineService.getCenters(wilaya));
        if (action === 'communes' && wilaya) return Response.json(YalidineService.getCommunes(wilaya));
        if (action === 'get_reviews') return Response.json(ReviewService.getAll());
        if (action === 'get_niches') return Response.json(NicheService.getAll());

        return Response.json({ status: 'error', message: 'Invalid GET action' }, 400);
    } catch (err) {
        console.error("doGet Error:", err);
        return Response.json({ status: 'error', message: err.toString() }, 500);
    }
}

// ==========================================
// ROUTER: POST (SECURE GATEWAY)
// ==========================================
function doPost(e) {
    const lock = LockService.getScriptLock();
    try {
        // Concurrency Protection
        if (!lock.tryLock(10000)) {
            return Response.json({ status: 'error', message: 'Server is busy. Please try again (Lock Timeout).' }, 429);
        }

        if (!e) {
            return ContentService.createTextOutput("Rymal API POST is active. Access via administration control panel.");
        }

        let data;
        let contents = e.postData ? e.postData.contents : null;
        
        // Parse incoming body
        if (contents) {
            try {
                data = JSON.parse(contents);
            } catch (err) {
                // Silence JSON parsing warning
            }
        }

        // Resilient Fallback parsing
        if (!data && e.parameter && e.parameter.payload) {
             data = JSON.parse(e.parameter.payload);
        }

        if (!data) {
            throw new Error("No valid data payload received.");
        }

        const action = data.action || data.type;

        // --- 1. NEW: Handle Login Requests ---
        if (action === 'admin_login') {
            if (data.username === MASTER_USER && data.password === MASTER_PASS) {
                return Response.json({ status: "success", token: MASTER_TOKEN });
            } else {
                return Response.json({ status: "error", message: "بيانات غير صحيحة" }, 401);
            }
        }

        // --- 2. UPDATED: Server-Side Authentication Guard ---
        const ADMIN_ACTIONS = ['UPLOAD', 'edit_product', 'delete_product', 'add_review', 'delete_review', 'add_niche', 'edit_niche', 'delete_niche'];
        
        if (ADMIN_ACTIONS.indexOf(action) > -1) {
            // Check if they provided the correct password OR the correct token
            const isValidUser = data.auth && data.auth.user === MASTER_USER && data.auth.pass === MASTER_PASS;
            const isValidToken = data.auth && data.auth.token === MASTER_TOKEN;
            
            if (!isValidUser && !isValidToken) {
                return Response.json({ status: "error", message: "Unauthorized Access" }, 401);
            }
        }

        // Action Router
        if (action === 'UPLOAD' || action === 'product') return Response.json(ProductService.create(data));
        if (action === 'ORDER' || action === 'order') return Response.json(OrderService.process(data));
        if (action === 'edit_product') return Response.json(ProductService.update(data));
        if (action === 'delete_product') return Response.json(ProductService.remove(data.id));
        if (action === 'add_review') return Response.json(ReviewService.add(data));
        if (action === 'delete_review') return Response.json(ReviewService.remove(data.id));
        if (action === 'add_niche') return Response.json(NicheService.add(data));
        if (action === 'edit_niche') return Response.json(NicheService.edit(data));
        if (action === 'delete_niche') return Response.json(NicheService.delete(data));
        if (action === 'submit_rating') return Response.json(RatingService.submit(data));
        if (action === 'track_event') {
            const eventName = data.event_name;
            const eventId = data.event_id;
            const sourceUrl = data.event_source_url || data.source_url;
            const userData = data.user_data || {};
            const customData = data.custom_data || {};
            return Response.json(MetaService.sendEvent(eventName, eventId, sourceUrl, userData, customData));
        }

        return Response.json({ status: 'error', message: 'Invalid action payload' }, 400);
    } catch (err) {
        console.error("doPost Error:", err);
        return Response.json({ status: 'error', message: err.toString() }, 500);
    } finally {
        lock.releaseLock();
    }
}

// ==========================================
// Cloudinary settings
// ==========================================
const CLOUDINARY = {
    CLOUD_NAME: "qo4wvpvu",       // from your dashboard
    UPLOAD_PRESET: "rymel_products"      // the unsigned preset you created
};

function uploadToCloudinary(blob, mimeType) {
    const resourceType = mimeType.startsWith('video/') ? 'video' : 'image';
    const url = `https://api.cloudinary.com/v1_1/${CLOUDINARY.CLOUD_NAME}/${resourceType}/upload`;

    const options = {
        method: 'post',
        payload: {
            file: blob,
            upload_preset: CLOUDINARY.UPLOAD_PRESET
        },
        muteHttpExceptions: true
    };

    const response = UrlFetchApp.fetch(url, options);
    const result = JSON.parse(response.getContentText());

    if (result.secure_url) return result.secure_url;
    throw new Error("Cloudinary upload failed: " + response.getContentText());
}




// ==========================================
// HELPERS
// ==========================================
const Utils = {
    getSheet: function(name) {
        const ss = SpreadsheetApp.getActiveSpreadsheet();
        let sheet = ss.getSheetByName(name);
        if (sheet) return sheet;
        
        // Case-insensitive fallback lookup
        const sheets = ss.getSheets();
        const found = sheets.find(s => s.getName().toLowerCase() === name.toLowerCase());
        if (found) return found;

        
       // Auto-initialize missing spreadsheet layout
        console.log("Creating missing sheet tab:", name);
        sheet = ss.insertSheet(name);
        if (name === CONFIG.SHEETS.REVIEWS) {
            sheet.appendRow(['id', 'image', 'date']);
        } else if (name === CONFIG.SHEETS.PRODUCTS) {
            sheet.appendRow(['ProductID', 'Title', 'Price', 'Stock', 'Description', 'MainImageID', 'GalleryIDs', 'FeaturesJSON', 'Niche']);
        } else if (name === CONFIG.SHEETS.NICHES) {
            sheet.appendRow(['NicheName', 'PixelID', 'Facebook', 'Instagram', 'TikTok']);
        } else if (name === CONFIG.SHEETS.RATINGS) {         
            sheet.appendRow(['Timestamp', 'ProductID', 'Rating', 'ExternalID']);
}
        return sheet;
    }
};

function extractFileId(url) {
    if (!url) return "";
    if (url.toString().toLowerCase().startsWith("video:")) return url; // already tagged, leave as-is
    if (url.indexOf("lh3.googleusercontent.com/d/") > -1) {
        return url.split("lh3.googleusercontent.com/d/")[1].split("/")[0].split("?")[0];
    }
    if (url.indexOf("id=") > -1) {
        return url.split("id=")[1].split("&")[0];
    }
    return url;
}

// ==========================================
// PRODUCT SERVICE
// ==========================================
const ProductService = {
    getAll: function() {
        try {
            const sheet = Utils.getSheet(CONFIG.SHEETS.PRODUCTS);
            const data = sheet.getDataRange().getValues();
            if (data.length < 2) return [];
            
            const headers = data[0];
            const rows = data.slice(1);
            
            return rows.map(row => {
                const obj = {};
                headers.forEach((h, i) => {
                    let key = h.toString().trim();
                    obj[key] = row[i];
                });
                return obj;
            });
        } catch (e) {
            console.error("ProductService.getAll Error:", e);
            return [];
        }
    },

    getById: function(id) {
        return this.getAll().find(p => (p.ProductID || p.id || "").toString() == id.toString());
    },

    create: function(data) {
        console.log("Creating product:", data.name);
        const sheet = Utils.getSheet(CONFIG.SHEETS.PRODUCTS);
        
        // Ensure sheet headers are established
        if (sheet.getLastRow() === 0) {
            sheet.appendRow(['ProductID', 'Title', 'Price', 'Stock', 'Description', 'MainImageID', 'GalleryIDs', 'FeaturesJSON']);
        }

        // Upload Main Image
        // Upload Main Media
        let mainImageId = "";
        if (data.image && data.image.startsWith("data:")) { // <-- Changed
            mainImageId = DriveService.upload(data.image, `${data.name}_Main_${Date.now()}`);
        } else {
            mainImageId = extractFileId(data.image);
        }

        // Upload Gallery Media
        let galleryIds = [];
        if (data.gallery && Array.isArray(data.gallery)) {
            data.gallery.forEach((item, index) => {
                if (item.startsWith("data:")) { // <-- Changed
                    const id = DriveService.upload(item, `${data.name}_Gallery_${index + 1}_${Date.now()}`);
                    galleryIds.push(id);
                } else {
                    galleryIds.push(extractFileId(item));
                }
            });
        }
        const galleryIdsStr = galleryIds.filter(id => id).join(',');

        const row = [
            data.id,          // ProductID (unique URL slug)
            data.name,        // Title
            data.price,       // Price
            data.stock,       // Stock
            data.description, // Description
            mainImageId,      // MainImageID
            galleryIdsStr,    // GalleryIDs
            data.options_json,// FeaturesJSON
            data.niche || ""  // NEW: Niche
        ];

        sheet.appendRow(row);
        return { status: "success", message: "Product created successfully", id: data.id };
    },

    update: function(data) {
        const id = data.id;
        const sheet = Utils.getSheet(CONFIG.SHEETS.PRODUCTS);
        const values = sheet.getDataRange().getValues();
        
        for (let i = 1; i < values.length; i++) {
            if (values[i][0] == id) {
                // Upload Main Media if updated
                let mainImageId = values[i][5];
                if (data.image && data.image.startsWith("data:")) { // <-- Changed
                    mainImageId = DriveService.upload(data.image, `${data.name}_Main_${Date.now()}`);
                } else if (data.image) {
                    mainImageId = extractFileId(data.image);
                }
                
                // Upload Gallery Media if updated
                let galleryIds = [];
                if (data.gallery && Array.isArray(data.gallery)) {
                    data.gallery.forEach((item, index) => {
                        if (item.startsWith("data:")) { // <-- Changed
                            const id = DriveService.upload(item, `${data.name}_Gallery_${index + 1}_${Date.now()}`);
                            galleryIds.push(id);
                        } else {
                            galleryIds.push(extractFileId(item));
                        }
                    });
                }
                
                const galleryIdsStr = galleryIds.filter(id => id).join(',');

                // Update ledger row values directly
                sheet.getRange(i + 1, 1).setValue(data.id);           // ProductID
                sheet.getRange(i + 1, 2).setValue(data.name);         // Title
                sheet.getRange(i + 1, 3).setValue(data.price);        // Price
                sheet.getRange(i + 1, 4).setValue(data.stock);        // Stock
                sheet.getRange(i + 1, 5).setValue(data.description);  // Description
                sheet.getRange(i + 1, 6).setValue(mainImageId);       // MainImageID
                sheet.getRange(i + 1, 7).setValue(galleryIdsStr);     // GalleryIDs
                sheet.getRange(i + 1, 8).setValue(data.options_json); // FeaturesJSON
                sheet.getRange(i + 1, 9).setValue(data.niche || "");  // NEW: Update Niche in Column I

                return { status: 'success', message: 'Product updated successfully' };
            }
        }
        return { status: 'error', message: 'Product ID not found' };
    },

    remove: function(id) {
        const sheet = Utils.getSheet(CONFIG.SHEETS.PRODUCTS);
        const data = sheet.getDataRange().getValues();
        for (let i = data.length - 1; i > 0; i--) {
            if (data[i][0] == id) {
                sheet.deleteRow(i + 1);
                return { status: 'success', message: 'Product deleted successfully' };
            }
        }
        return { status: 'error', message: 'Product ID not found' };
    },

    getTarifs: function() {
        try {
            const sheet = Utils.getSheet(CONFIG.SHEETS.TARIFS);
            const data = sheet.getDataRange().getValues();
            const tarifs = {};
            data.slice(1).forEach(row => {
                if (row[0]) tarifs[row[0].toString().trim()] = { domicil: parseFloat(row[1]) || 0, desk: parseFloat(row[2]) || 0 };
            });
            return { status: 'success', data: tarifs };
        } catch (e) {
            return { status: 'error', message: e.toString() };
        }
    }
};

// ==========================================
// ORDER SERVICE
// ==========================================
const OrderService = {
    process: function(data) {
    console.log("Processing order for:", data.fullName);
    const sheet = Utils.getSheet(CONFIG.SHEETS.ORDERS);
    const lastRow = sheet.getLastRow() + 1;

    // Parse the options JSON into a readable string for the sheet
    let optionsStr = "Default";
    try {
        if (data.options) {
            const parsed = typeof data.options === 'string' ? JSON.parse(data.options) : data.options;
            optionsStr = Object.entries(parsed)
                .map(([label, value]) => `${label} ${value}`)
                .join(' | ');
        }
    } catch (e) {
        console.error("Failed to parse order options:", e);
        optionsStr = data.options || "Default";
    }

    sheet.appendRow([
        data.timestamp,
        data.fullName,
        data.email,
        data.phone,
        data.wilaya,
        data.commune,
        data.address,
        optionsStr,      // ← column H now holds real parsed options
        "",              // ← column I: no longer used, kept as blank to preserve column count/order
        data.product,
        data.price,
        "Pending",
        "N/A",
        data.eventId
    ]);

    let tracking = "N/A";
    if (CONFIG.APIS.YALIDINE.ID) {
        try {
            const resp = YalidineService.createParcel(data);
            if (resp && resp.tracking) {
                tracking = resp.tracking;
                sheet.getRange(lastRow, 13).setValue(tracking);
            } else if (resp && resp.error) {
                sheet.getRange(lastRow, 13).setValue("Yalidine: " + resp.error);
            }
        } catch (e) {
            console.error("Yalidine integration error:", e);
            sheet.getRange(lastRow, 13).setValue("Integration Error");
        }
    }

    this.updateStock(data.product);
    MetaService.trackPurchase(data);
    this.sendEmails(data, tracking);

    return { status: "success", message: "Order processed successfully" };
},

    updateStock: function(productName) {
        try {
            const sheet = Utils.getSheet(CONFIG.SHEETS.PRODUCTS);
            const data = sheet.getDataRange().getValues();
            const headers = data[0];
            const nIdx = headers.findIndex(h => h.toString().toLowerCase().includes('title') || h.toString().toLowerCase().includes('name'));
            const sIdx = headers.findIndex(h => h.toString().toLowerCase().includes('stock'));
            if (nIdx > -1 && sIdx > -1) {
                for (let i = 1; i < data.length; i++) {
                    if (data[i][nIdx] == productName) {
                        const c = parseInt(data[i][sIdx], 10);
                        if (c > 0) sheet.getRange(i+1, sIdx+1).setValue(c - 1);
                        break;
                    }
                }
            }
        } catch(e) { console.error("Stock Update Error:", e); }
    },

    sendEmails: function(data, tracking = "N/A") {
        try {
            let optStr = "";
            if (data.size) {
                optStr = data.size.split('|').map(s => "   - " + s.trim()).filter(s => s).join('\n');
            }

            const adSub = `🟢 طلب جديد: ${data.fullName} (${data.product})`;
            const adBody = `
                === 🟢 طلب جديد وارد ===
                
                👤 العميل: ${data.fullName}
                📞 الهاتف: ${data.phone}
                📧 الإيميل: ${data.email || 'غير متوفر'}
                
                📦 المنتج: ${data.product}
                ⚙️ خيارات التخصيص:
                ${OptionsStr}
                
                💰 السعر الإجمالي: ${data.price} دج
                
                📍 الولاية: ${data.wilaya}
                🏘️ البلدية: ${data.commune}
                🏠 العنوان: ${data.address}
                🚚 طريقة التوصيل: ${data.is_stopdesk ? 'مكتب Yalidine (Stop Desk)' : 'إلى المنزل'}
                
                🆔 رقم التتبع (Yalidine): ${tracking}
                🕒 التاريخ: ${data.timestamp}
                
                -----------------------------------
                تحقق من Google Sheets لمزيد من التفاصيل.
            `;
            MailApp.sendEmail(CONFIG.NOTIFICATIONS.ADMIN_EMAIL, adSub, adBody);
            
            if (data.email && data.email !== "N/A" && data.email.includes("@")) {
                const cSub = "شكراً لاختيارك رمال (Rymel) ✨ - تم استلام طلبك بنجاح";
                const htmlBody = `
                    <div style="direction: rtl; font-family: 'Arial', sans-serif; padding: 20px; color: #333; line-height: 1.6;">
                        <h2 style="color: #000;">مرحباً ${data.fullName} 👋</h2>
                        <p style="font-size: 1.1rem;">شكراً جزيلاً لثقتك في <strong>رمال (Rymel)</strong>. لقد تلقينا طلبك بنجاح ونحن الآن بصدد تجهيزه لك ! 😊</p>
                        
                        <div style="background: #f9f9f9; padding: 15px; border-radius: 10px; margin: 20px 0; border: 1px solid #eee;">
                            <h3 style="margin-top: 0; color: #d4af37;">📦 تفاصيل طلبك:</h3>
                            <p><strong>المنتج:</strong> ${data.product}</p>
                            <p><strong>المبلغ الإجمالي:</strong> ${data.price} دج</p>
                        </div>

                        <p>✅ <strong>ماذا سيحدث الآن؟</strong><br>
                        سيقوم فريقنا بالاتصال بك قريباً لتأكيد العنوان وموعد التسليم.</p>

                        <p style="margin-top: 30px;">إذا كان لديك أي سؤال، يمكنك الرد على هذا الإيميل مباشرة.</p>
                        
                        <hr style="border: 0; border-top: 1px solid #eee; margin: 20px 0;">
                        <p style="font-size: 0.9rem; color: #888;">فريق رمال - Rymel<br>الجودة شعارنا✨</p>
                    </div>
                `;
                
                MailApp.sendEmail({
                    to: data.email,
                    subject: cSub,
                    htmlBody: htmlBody
                });
            }
        } catch(e) { console.error("Email Error:", e); }
    }
};

// ==========================================
// DRIVE SERVICE (BINARY BUFFER pipeline)
// ==========================================
const DriveService = {
    upload: function(base64Data, fileName) {
        try {
            if (!base64Data || !base64Data.includes(',')) {
                throw new Error("Invalid base64 data format");
            }
            const split = base64Data.split(',');
            const type = split[0].split(':')[1].split(';')[0];
            const decoded = Utilities.base64Decode(split[1]);
            const blob = Utilities.newBlob(decoded, type, fileName);

            // Route videos to Cloudinary — real streaming, no Drive quirks
            if (type.startsWith('video/')) {
                return uploadToCloudinary(blob, type); // returns a full https://res.cloudinary.com/....mp4 URL
            }

            // Images stay on Drive as before
            const folder = DriveApp.getFolderById(DRIVE_FOLDER_ID);
            const file = folder.createFile(blob);
            file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
            return file.getId();
        } catch (err) {
            console.error("Inside DriveService.upload Error:", err.toString());
            throw err;
        }
    }
};

// ==========================================
// YALIDINE SERVICE
// ==========================================
const YalidineService = {
    wilayaMap: {
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
    },

    getCenters: function(wilaya) {
        const p = isNaN(wilaya) ? "wilaya_name" : "wilaya_id";
        return this.fetch(`${CONFIG.APIS.YALIDINE.BASE_URL}/centers?${p}=${encodeURIComponent(wilaya)}`);
    },
    getCommunes: function(wilaya) {
        const p = isNaN(wilaya) ? "wilaya_name" : "wilaya_id";
        return this.fetch(`${CONFIG.APIS.YALIDINE.BASE_URL}/communes?${p}=${encodeURIComponent(wilaya)}`);
    },
    fetch: function(url) {
        const opt = { 
            headers: { "X-API-ID": CONFIG.APIS.YALIDINE.ID, "X-API-TOKEN": CONFIG.APIS.YALIDINE.TOKEN },
            muteHttpExceptions: true 
        };
        const resp = UrlFetchApp.fetch(url, opt);
        return JSON.parse(resp.getContentText());
    },

    createParcel: function(data) {
        try {
            const rawW = data.wilaya || "";
            let cleanW = rawW.includes('-') ? rawW.split('-')[1].trim() : rawW;
            const yWilaya = this.wilayaMap[cleanW] || cleanW;

            const nameParts = (data.fullName || "Client").trim().split(' ');
            let family = nameParts.length > 1 ? nameParts.pop() : "Client";
            let first = nameParts.join(' ') || "N/A";
            
            const payload = [{
                order_id: data.eventId || ("ord_" + Date.now()),
                firstname: first,
                familyname: family,
                contact_phone: data.phone || "",
                address: data.is_stopdesk ? `Stop Desk: ${data.commune}` : (data.address || "N/A"),
                to_wilaya_name: yWilaya,
                to_commune_name: data.commune || "",
                product_list: `${data.product} (${data.options || 'Default'})`,
                price: parseFloat((data.productBasePrice || "0").toString().replace(/[^\d]/g, '')),
                freeshipping: false,
                is_stopdesk: !!data.is_stopdesk,
has_exchange: false,
// Force it to be an integer. If the integer fails (NaN), fallback to null.
stopdesk_id: !!data.is_stopdesk ? (parseInt(data.center_id, 10) || null) : null
            }];

            const opt = {
                method: 'post', contentType: 'application/json',
                headers: { "X-API-ID": CONFIG.APIS.YALIDINE.ID, "X-API-TOKEN": CONFIG.APIS.YALIDINE.TOKEN },
                payload: JSON.stringify(payload), muteHttpExceptions: true
            };

            const resp = UrlFetchApp.fetch(CONFIG.APIS.YALIDINE.BASE_URL + "/parcels/", opt);
            const content = JSON.parse(resp.getContentText());
            
            for (let key in content) {
                const item = content[key];
                if (item && typeof item === 'object') {
                    if (item.success) return { tracking: item.tracking };
                    if (item.error || item.message) return { error: item.error || item.message };
                }
            }
            
            return { error: "Yalidine API Error: " + resp.getContentText() };
        } catch (err) {
            console.error("Yalidine createParcel Error:", err);
            return { error: err.toString() };
        }
    }
};

// ==========================================
// META SERVICE
// ==========================================
const MetaService = {
    sendEvent: function(eventName, eventId, sourceUrl, userData, customData) {
        try {
            const pixelId = CONFIG.APIS.META_CAPI.PIXEL_ID;
            if (!pixelId) return { status: 'error', message: 'Pixel ID not configured' };
            
            const url = `https://graph.facebook.com/v19.0/${pixelId}/events?access_token=${CONFIG.APIS.META_CAPI.ACCESS_TOKEN}`;
            
            const hash = (s) => {
                if (!s || s === "N/A" || s === "") return null;
                const digest = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, s.trim().toLowerCase());
                return digest.map(b => (b < 0 ? b + 256 : b).toString(16).padStart(2, '0')).join('');
            };
            
            const formattedUserData = {};
            if (userData) {
                if (userData.client_ip_address) formattedUserData.client_ip_address = userData.client_ip_address;
                if (userData.client_user_agent) formattedUserData.client_user_agent = userData.client_user_agent;
                if (userData.fbc) formattedUserData.fbc = userData.fbc;
                if (userData.fbp) formattedUserData.fbp = userData.fbp;
                if (userData.external_id) formattedUserData.external_id = userData.external_id;
                
                const emVal = userData.email || userData.em;
                if (emVal) {
                    const hashed = hash(String(emVal));
                    if (hashed) formattedUserData.em = [hashed];
                }
                const phVal = userData.phone || userData.ph;
                if (phVal) {
                    const hashed = hash(String(phVal));
                    if (hashed) formattedUserData.ph = [hashed];
                }
            }
            
            const formattedCustomData = {};
            if (customData) {
                if (customData.content_ids) {
                    formattedCustomData.content_ids = Array.isArray(customData.content_ids)
                        ? customData.content_ids.map(id => String(id))
                        : [String(customData.content_ids)];
                }
                if (customData.content_type) formattedCustomData.content_type = customData.content_type;
                if (customData.value !== undefined) formattedCustomData.value = parseFloat(customData.value) || 0;
                if (customData.currency) formattedCustomData.currency = customData.currency;
                if (customData.content_name) formattedCustomData.content_name = customData.content_name;
            }
            
            const eventData = {
                event_name: eventName,
                event_time: Math.floor(Date.now() / 1000),
                event_id: eventId || ('evt_' + Date.now() + '_' + Math.floor(Math.random() * 100000)),
                event_source_url: sourceUrl || "",
                action_source: "website",
                user_data: formattedUserData,
                custom_data: formattedCustomData
            };
            
            const payload = {
                data: [eventData]
            };
            
            const options = {
                method: 'post',
                contentType: 'application/json',
                payload: JSON.stringify(payload),
                muteHttpExceptions: true
            };
            
            const response = UrlFetchApp.fetch(url, options);
            const code = response.getResponseCode();
            const content = response.getContentText();
            
            return { status: code === 200 ? 'success' : 'error', code: code, response: content };
        } catch(e) {
            console.error("Meta CAPI Error:", e);
            return { status: 'error', message: e.toString() };
        }
    },

    trackPurchase: function(data) {
        const userData = {
            email: data.email,
            phone: data.phone,
            client_ip_address: data.clientIp || data.client_ip_address,
            client_user_agent: data.userAgent || data.client_user_agent,
            fbc: data.fbc,
            fbp: data.fbp,
            external_id: data.externalId || data.external_id
        };
        
        const value = parseFloat((data.price || "0").toString().replace(/[^\d.]/g, '')) || 0;
        
        const customData = {
            content_ids: data.productId ? [String(data.productId)] : [],
            content_type: 'product',
            value: value,
            currency: 'DZD',
            content_name: data.product
        };
        
        return this.sendEvent('Purchase', data.eventId, data.sourceUrl, userData, customData);
    }
};

const Response = {
    json: function(data, code = 200) {
        return ContentService.createTextOutput(JSON.stringify(data))
            .setMimeType(ContentService.MimeType.JSON);
    }
};

// ==========================================
// REVIEW SERVICE
// ==========================================
const ReviewService = {
    getAll: function() {
        try {
            const sheet = Utils.getSheet(CONFIG.SHEETS.REVIEWS);
            const data = sheet.getDataRange().getValues();
            if (data.length < 2) return { status: 'success', data: [] };
            
            const headers = data[0];
            const rows = data.slice(1);
            const reviews = rows.map(row => {
                const obj = {};
                headers.forEach((h, i) => obj[h.toString().trim()] = row[i]);
                return obj;
            });
            return { status: 'success', data: reviews };
        } catch (e) {
            return { status: 'error', message: e.toString() };
        }
    },

    add: function(data) {
        try {
            const sheet = Utils.getSheet(CONFIG.SHEETS.REVIEWS);
            let imageUrl = data.image || "";
            if (imageUrl.startsWith("data:image")) {
                const fileId = DriveService.upload(imageUrl, `Review_${Date.now()}`);
                imageUrl = "https://lh3.googleusercontent.com/d/" + fileId;
            }
            
            const id = Date.now().toString();
            sheet.appendRow([id, imageUrl, new Date().toLocaleString()]);
            return { status: 'success', id: id, url: imageUrl };
        } catch (e) {
            return { status: 'error', message: e.toString() };
        }
    },

    remove: function(id) {
        try {
            const sheet = Utils.getSheet(CONFIG.SHEETS.REVIEWS);
            const data = sheet.getDataRange().getValues();
            for (let i = 1; i < data.length; i++) {
                if (data[i][0].toString() === id.toString()) {
                    sheet.deleteRow(i + 1);
                    return { status: 'success' };
                }
            }
            return { status: 'error', message: 'Review not found' };
        } catch (e) {
            return { status: 'error', message: e.toString() };
        }
    }
};

// ==========================================
// RATING SERVICE
// ==========================================
const RatingService = {
    getMap: function() {
        const sheet = Utils.getSheet(CONFIG.SHEETS.RATINGS);
        const data = sheet.getDataRange().getValues();
        const map = {};
        for (let i = 1; i < data.length; i++) {
            const pid = String(data[i][1] || "");
            const rating = Number(data[i][2]);
            if (!pid || !rating) continue;
            if (!map[pid]) map[pid] = { sum: 0, count: 0 };
            map[pid].sum += rating;
            map[pid].count += 1;
        }
        return map;
    },

    getSummary: function(productId) {
        const map = this.getMap();
        const entry = map[String(productId)];
        return {
            status: 'success',
            data: {
                average: entry ? Number((entry.sum / entry.count).toFixed(1)) : 0,
                count: entry ? entry.count : 0
            }
        };
    },

    submit: function(data) {
        const productId = String(data.productId || "");
        const rating = Number(data.rating);
        const externalId = String(data.externalId || "");

        if (!productId || !rating || rating < 1 || rating > 5) {
            return { status: 'error', message: 'invalid_rating' };
        }

        const sheet = Utils.getSheet(CONFIG.SHEETS.RATINGS);

        if (externalId) {
            const values = sheet.getDataRange().getValues();
            for (let i = 1; i < values.length; i++) {
                if (String(values[i][1]) === productId && String(values[i][3]) === externalId) {
                    return { status: 'error', message: 'already_rated' };
                }
            }
        }

        sheet.appendRow([new Date(), productId, rating, externalId]);
        return { status: 'success' };
    }
};

// ==========================================
// NICHE SERVICE
// ==========================================
const NicheService = {
    getAll: function() {
        try {
            const sheet = Utils.getSheet(CONFIG.SHEETS.NICHES);
            const data = sheet.getDataRange().getValues();
            if (data.length < 2) return { status: 'success', data: [] };
            
            const headers = data[0].map(h => h.toString().trim());
            const rows = data.slice(1);
            
            const niches = rows.map(row => {
                const obj = {};
                headers.forEach((h, i) => {
                    // Mappage strict basé sur vos colonnes : NicheName, PixelID, Facebook, Instagram, TikTok
                    obj[h] = row[i];
                });
                return obj;
            });
            return { status: 'success', data: niches };
        } catch (e) {
            return { status: 'error', message: e.toString() };
        }
    },

    add: function(data) {
        try {
            const sheet = Utils.getSheet(CONFIG.SHEETS.NICHES);
            if (sheet.getLastRow() === 0) {
                sheet.appendRow(['NicheName', 'PixelID', 'Facebook', 'Instagram', 'TikTok']);
            }
            sheet.appendRow([data.nicheName, data.pixel || "", data.fb || "", data.ig || "", data.tiktok || ""]);
            return { status: 'success', message: 'تم إضافة النيتش بنجاح' };
        } catch (e) {
            return { status: 'error', message: e.toString() };
        }
    },

    edit: function(data) {
        try {
            const sheet = Utils.getSheet(CONFIG.SHEETS.NICHES);
            const rows = sheet.getDataRange().getValues();
            
            // Start from 1 to skip headers
            for (let i = 1; i < rows.length; i++) {
                if (rows[i][0] === data.originalName) {
                    sheet.getRange(i + 1, 1, 1, 5).setValues([[
                        data.nicheName, data.pixel || "", data.fb || "", data.ig || "", data.tiktok || ""
                    ]]);
                    return { status: 'success', message: 'تم تعديل النيتش بنجاح' };
                }
            }
            return { status: 'error', message: 'لم يتم العثور على النيتش' };
        } catch (e) {
            return { status: 'error', message: e.toString() };
        }
    },

    delete: function(data) {
        try {
            const sheet = Utils.getSheet(CONFIG.SHEETS.NICHES);
            const rows = sheet.getDataRange().getValues();
            
            for (let i = 1; i < rows.length; i++) {
                if (rows[i][0] === data.nicheName) {
                    sheet.deleteRow(i + 1);
                    return { status: 'success', message: 'تم حذف النيتش بنجاح' };
                }
            }
            return { status: 'error', message: 'لم يتم العثور على النيتش' };
        } catch (e) {
            return { status: 'error', message: e.toString() };
        }
    }
};