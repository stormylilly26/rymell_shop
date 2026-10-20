/**
 * Rymel E-commerce Backend - Senior Edition
 * Powered by Google Apps Script
 */

// ==========================================
// CONFIGURATION
// ==========================================
const CONFIG = {
    SHEETS: {
        PRODUCTS: 'Products',
        ORDERS: 'Orders',
        TARIFS: 'tarifs livraison'
    },
    DRIVE: {
        FOLDER_NAME: 'rymel_product_images',
        DEFAULT_IMG: 'https://images.unsplash.com/photo-1556228720-195a672e8a03?q=80&w=800&auto=format&fit=crop'
    },
    APIS: {
        YALIDINE: {
            ID: '09897325726363880972',
            TOKEN: 'HxSkUhrg7Yfd5OL3tEsFPJXaD4eW8BbRcKw2voI0npV6u9ACm1QzlyNiMGjTZq',
            BASE_URL: 'https://api.yalidine.app/v1'
        },
        META_CAPI: {
            PIXEL_ID: '1478534623674360',
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
        // Safety guard against manual 'Run' in editor
        if (!e || !e.parameter) {
            return ContentService.createTextOutput("Rymel API is active. Note: Do not click 'Run' in the Script Editor; access via URL instead.");
        }

        console.log("doGet request parameters:", e.parameter);
        const action = e.parameter.action || e.parameter.type || 'list';
        const id = e.parameter.id;
        const wilaya = e.parameter.wilaya;

        // 1. Process specific ID if present (High Priority)
        if (id) {
            const p = ProductService.getById(id);
            if (p) {
                const imgVal = Utils.getProp(p, ['image', 'صورة', 'img', 'الصورة', 'صور']);
                const galleryVal = Utils.getProp(p, ['gallery', 'معرض', 'اضافية', 'إضافية']);
                const nameVal = Utils.getProp(p, ['name', 'title', 'الاسم', 'اسم']);
                const priceVal = Utils.getProp(p, ['price', 'سعر', 'السعر']);
                const descVal = Utils.getProp(p, ['description', 'desc', 'وصف', 'التفاصيل']);
                const stockVal = Utils.getProp(p, ['stock', 'مخزون']);
                const optionsVal = Utils.getProp(p, ['options_json', 'خيارات', 'options']);
                
                // Standardize keys for single product fetch (like summary does)
                const standardized = {
                    id: p.id || p.ID || "N/A",
                    name: nameVal || "Untitled",
                    price: priceVal || "0",
                    image: imgVal || CONFIG.DRIVE.DEFAULT_IMG,
                    stock: stockVal || 0,
                    description: descVal || "",
                    gallery: galleryVal || "",
                    options: optionsVal || ""
                };
                return Response.json({ status: 'success', data: standardized });
            }
            return Response.json({ status: 'error', message: 'Product not found' }, 404);
        }

        // 2. Process list/search actions
        if (action === 'list' || action === 'products') {
            const products = ProductService.getAll();
            const summary = products.map(p => {
                const imgVal = Utils.getProp(p, ['image', 'صورة', 'img', 'الصورة', 'صور']);
                let img = imgVal || CONFIG.DRIVE.DEFAULT_IMG;
                
                return {
                    id: p.id || p.ID || "N/A",
                    title: Utils.getProp(p, ['name', 'title', 'الاسم', 'اسم']) || "Untitled",
                    price: Utils.getProp(p, ['price', 'سعر', 'السعر']) || "0",
                    image: img,
                    stock: Utils.getProp(p, ['stock', 'مخزون']) || 0,
                    description: Utils.getProp(p, ['description', 'desc', 'وصف', 'التفاصيل']) || "",
                    options: Utils.getProp(p, ['options_json', 'خيارات', 'options']) || ""
                };
            });
            return Response.json({ status: 'success', data: summary });
        }

        if (action === 'tarifs') return Response.json(ProductService.getTarifs());
        if (action === 'centers' && wilaya) return Response.json(YalidineService.getCenters(wilaya));
        if (action === 'communes' && wilaya) return Response.json(YalidineService.getCommunes(wilaya));

        if (action === 'debug_headers') {
            const sheet = Utils.getSheet(CONFIG.SHEETS.PRODUCTS);
            const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
            return Response.json({ status: 'success', headers: headers });
        }

        return Response.json({ status: 'error', message: 'Invalid GET action' }, 400);
    } catch (err) {
        console.error("doGet Error:", err);
        return Response.json({ status: 'error', message: err.toString() }, 500);
    }
}

// ==========================================
// ROUTER: POST
// ==========================================
function doPost(e) {
    const lock = LockService.getScriptLock();
    try {
        if (!lock.tryLock(30000)) { // Increased wait time for large uploads
            return Response.json({ status: 'error', message: 'السيرفر مشغول، يرجى المحاولة في لحظة أخرى (Lock Timeout)' }, 429);
        }

        // Safety guard against manual 'Run' in editor
        if (!e) {
            return ContentService.createTextOutput("Rymel API POST is active. Note: Do not click 'Run' in the Script Editor; access via the Admin Dashboard instead.");
        }

        let data;
        let contents = e.postData ? e.postData.contents : null;
        
        // 1. Try to parse from raw body
        if (contents) {
            try {
                console.log("Parsing raw contents...");
                data = JSON.parse(contents);
            } catch (err) {
                console.warn("Raw parse failed, checking parameters...");
            }
        }

        // 2. Fallback: Parse from 'data' parameter (Resilient mode)
        if (!data && e.parameter && e.parameter.payload) {
             console.log("Parsing from parameter payload...");
             data = JSON.parse(e.parameter.payload);
        }

        if (!data) {
            throw new Error("No valid data received. Details: " + JSON.stringify(e.parameter));
        }

        const action = data.action || data.type;
        console.log("Processing action:", action);

        if (action === 'UPLOAD' || action === 'product') return Response.json(ProductService.create(data));
        if (action === 'ORDER' || action === 'order') return Response.json(OrderService.process(data));
        if (action === 'edit_product') return Response.json(ProductService.update(data));
        if (action === 'delete_product') return Response.json(ProductService.remove(data.id));

        return Response.json({ status: 'error', message: 'Action غير صالح' }, 400);
    } catch (err) {
        console.error("doPost Error:", err);
        return Response.json({ status: 'error', message: err.toString() }, 500);
    } finally {
        lock.releaseLock();
    }
}

// ==========================================
// HELPERS
// ==========================================
const Utils = {
    getSheet: function(name) {
        const ss = SpreadsheetApp.getActiveSpreadsheet();
        let sheet = ss.getSheetByName(name);
        if (sheet) return sheet;
        
        // Fallback: Case-insensitive search
        const sheets = ss.getSheets();
        const found = sheets.find(s => s.getName().toLowerCase() === name.toLowerCase());
        if (found) return found;

        throw new Error(`Sheet "${name}" not found. Please ensure a tab named "${name}" exists in your Google Sheet.`);
    },
    
    getProp: function(obj, aliases) {
        if (!obj) return "";
        // First try exact matches
        for (let alias of aliases) {
            if (obj[alias] !== undefined && obj[alias] !== "") return obj[alias];
        }
        // Then try partial matches (e.g., 'الصورة' includes 'صورة')
        for (let key of Object.keys(obj)) {
            const lowerKey = key.toLowerCase();
            for (let alias of aliases) {
                if (lowerKey.includes(alias.toLowerCase()) && obj[key] !== "") return obj[key];
            }
        }
        return "";
    }
};

// ==========================================
// PRODUCT SERVICE
// ==========================================
const ProductService = {
    getAll: function() {
        try {
            const sheet = Utils.getSheet(CONFIG.SHEETS.PRODUCTS);
            const data = sheet.getDataRange().getValues();
            if (data.length < 1) return [];
            
            const headers = data[0];
            const rows = data.slice(1);
            
            return rows.map(row => {
                const obj = {};
                headers.forEach((h, i) => {
                    let key = h.toString().trim();
                    let val = row[i];
                    // Handle comma-separated lists
                    if (['colors','sizes','gallery'].includes(key.toLowerCase()) && typeof val === 'string') {
                        val = val ? val.split(',').map(s => s.trim()).filter(s => s) : [];
                    }
                    obj[key] = val;
                });
                return obj;
            });
        } catch (e) {
            console.error("ProductService.getAll Error:", e);
            return [];
        }
    },

    getById: function(id) {
        return this.getAll().find(p => (p.id || p.ID || p.id_product || "").toString() == id.toString());
    },

    create: function(data) {
        console.log("Creating new product:", data.name);
        const sheet = Utils.getSheet(CONFIG.SHEETS.PRODUCTS);
        const prodName = data.name || "product";
        
        // 1. Upload Main Image
        let imageUrl = data.image || "";
        if (imageUrl && imageUrl.startsWith("data:image")) {
            try {
                console.log("Starting main image upload to Drive...");
                imageUrl = DriveService.upload(imageUrl, `${prodName}_Main_${Date.now()}`);
                console.log("Main image upload success:", imageUrl);
            } catch (e) {
                console.error("Main Image Upload Error:", e.toString());
            }
        }

        // 2. Upload Gallery Images
        let galleryUrls = "";
        const galleryRaw = data.gallery || "";
        if (galleryRaw) {
            // Split by unique separator OR comma (for backwards compatibility)
            const sep = galleryRaw.includes('|GALLERY_SEP|') ? '|GALLERY_SEP|' : ',';
            const blobs = galleryRaw.split(sep).filter(b => b.startsWith("data:image"));
            if (blobs.length > 0) {
                try {
                    const uploaded = blobs.map((blob, idx) => {
                        return DriveService.upload(blob, `${prodName}_Gallery_${idx + 1}_${Date.now()}`);
                    });
                    galleryUrls = uploaded.join(',');
                } catch (e) {
                    console.error("Gallery Upload Error:", e);
                    galleryUrls = galleryRaw; // Fallback
                }
            } else {
                galleryUrls = galleryRaw; // Already links?
            }
        }

        const hRange = sheet.getRange(1, 1, 1, Math.max(sheet.getLastColumn(), 1));
        const hVals = hRange.getValues()[0];
        const row = new Array(hVals.length).fill("");
        
        const map = {
            id: data.id || Date.now().toString(),
            name: data.name || "Untitled",
            price: data.price || "0",
            stock: data.stock || 0,
            image: imageUrl,
            gallery: galleryUrls,
            description: data.description || data.desc || "",
            colors: data.colors || "",
            sizes: data.sizes || "",
            options_json: data.options_json || ""
        };

        const columnMappings = {
            id: ['id', 'رقم'],
            name: ['name', 'title', 'الاسم', 'اسم'],
            price: ['price', 'سعر', 'السعر'],
            stock: ['stock', 'مخزون', 'المخزون'],
            image: ['image', 'صورة', 'الصورة', 'img'],
            gallery: ['gallery', 'معرض', 'اضافية', 'إضافية'],
            description: ['description', 'desc', 'وصف', 'التفاصيل'],
            colors: ['colors', 'color', 'لون', 'الوان'],
            sizes: ['sizes', 'size', 'مقاس', 'مقاسات'],
            options_json: ['options_json', 'options', 'خيارات']
        };

        // Header-aware mapping with aliases
        hVals.forEach((h, i) => {
            const headerStr = h.toString().toLowerCase();
            const key = Object.keys(columnMappings).find(k => 
                columnMappings[k].some(alias => headerStr.includes(alias))
            );
            if (key) {
                row[i] = map[key];
            } else if (i === 0 && !row[0]) {
                // Fallback: If first column isn't mapped, put ID there
                row[0] = map.id;
            }
        });

        sheet.appendRow(row);
        console.log("Success: Product appended to sheet.");
        return { status: "success", message: "Product created successfully", id: map.id };
    },

    update: function(data) {
        const id = data.id;
        const sheet = Utils.getSheet(CONFIG.SHEETS.PRODUCTS);
        const values = sheet.getDataRange().getValues();
        const headers = values[0];
        
        for (let i = 1; i < values.length; i++) {
            if (values[i][0] == id) {
                const prodName = data.name || "edit";
                let imageUrl = data.image;
                if (imageUrl && imageUrl.startsWith("data:image")) {
                    imageUrl = DriveService.upload(imageUrl, `${prodName}_Main_${Date.now()}`);
                }
                
                let galleryUrls = data.gallery || "";
                if (galleryUrls.includes("data:image")) {
                   const sep = galleryUrls.includes('|GALLERY_SEP|') ? '|GALLERY_SEP|' : ',';
                   const blobs = galleryUrls.split(sep).filter(b => b.startsWith("data:image"));
                   const uploaded = blobs.map((blob, idx) => DriveService.upload(blob, `${prodName}_Gallery_${idx + 1}_${Date.now()}`));
                   galleryUrls = uploaded.join(',');
                }

                const columnMappings = {
                    name: ['name', 'title', 'الاسم', 'اسم'],
                    price: ['price', 'سعر', 'السعر'],
                    stock: ['stock', 'مخزون', 'المخزون'],
                    image: ['image', 'صورة', 'الصورة', 'img'],
                    gallery: ['gallery', 'معرض', 'اضافية', 'إضافية'],
                    description: ['description', 'desc', 'وصف', 'التفاصيل'],
                    colors: ['colors', 'color', 'لون', 'الوان'],
                    sizes: ['sizes', 'size', 'مقاس', 'مقاسات'],
                    options_json: ['options_json', 'options', 'خيارات']
                };

                headers.forEach((h, j) => {
                    const l = h.toString().toLowerCase();
                    
                    const matches = (aliases) => aliases.some(alias => l.includes(alias));

                    if (matches(columnMappings.name)) sheet.getRange(i+1, j+1).setValue(data.name);
                    if (matches(columnMappings.price)) sheet.getRange(i+1, j+1).setValue(data.price);
                    if (matches(columnMappings.stock)) sheet.getRange(i+1, j+1).setValue(data.stock);
                    if (matches(columnMappings.image) && !matches(columnMappings.gallery)) sheet.getRange(i+1, j+1).setValue(imageUrl || values[i][j]);
                    if (matches(columnMappings.gallery)) sheet.getRange(i+1, j+1).setValue(galleryUrls);
                    if (matches(columnMappings.description)) sheet.getRange(i+1, j+1).setValue(data.description || data.desc);
                    if (matches(columnMappings.colors)) sheet.getRange(i+1, j+1).setValue(data.colors);
                    if (matches(columnMappings.sizes)) sheet.getRange(i+1, j+1).setValue(data.sizes);
                    if (matches(columnMappings.options_json)) sheet.getRange(i+1, j+1).setValue(data.options_json);
                });
                return { status: 'success', message: 'Product updated successfully' };
            }
        }
        return { status: 'error', message: 'Product ID not found in sheet' };
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
        
        sheet.appendRow([
            data.timestamp,
            data.fullName,
            data.email,
            data.phone,
            data.wilaya,
            data.commune,
            data.address,
            data.color,
            data.size,
            data.product,
            data.price,
            "Pending",
            "N/A"
        ]);

        if (CONFIG.APIS.YALIDINE.ID) {
            try {
                const resp = YalidineService.createParcel(data);
                if (resp && resp.tracking) sheet.getRange(lastRow, 13).setValue(resp.tracking);
                else if (resp && resp.error) sheet.getRange(lastRow, 13).setValue("Yalidine: " + resp.error);
            } catch (e) {
                console.error("Yalidine integration error:", e);
                sheet.getRange(lastRow, 13).setValue("Integration Error");
            }
        }

        this.updateStock(data.product);
        MetaService.trackPurchase(data);
        this.sendEmails(data);

        return { status: "success", message: "Order processed successfully" };
    },

    updateStock: function(productName) {
        try {
            const sheet = Utils.getSheet(CONFIG.SHEETS.PRODUCTS);
            const data = sheet.getDataRange().getValues();
            const headers = data[0];
            const nIdx = headers.findIndex(h => h.toLowerCase().includes('name'));
            const sIdx = headers.findIndex(h => h.toLowerCase().includes('stock'));
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

    sendEmails: function(data) {
        try {
            const adSub = `🟢 طلب جديد: ${data.fullName}`;
            const adBody = `طلب جديد: ${data.product}\nالسعر: ${data.price}\nالهاتف: ${data.phone}`;
            MailApp.sendEmail(CONFIG.NOTIFICATIONS.ADMIN_EMAIL, adSub, adBody);
            
            if (data.email && data.email !== "N/A" && data.email.includes("@")) {
                const cSub = "تأكيد طلبك من رمال (Rymel) ✨";
                const cBody = `مرحباً ${data.fullName}، شكراً لطلبك منتج ${data.product}. سناتصل بك قريباً لتأكيد المعلومات.`;
                MailApp.sendEmail(data.email, cSub, cBody);
            }
        } catch(e) { console.error("Email Error:", e); }
    }
};

// ==========================================
// DRIVE SERVICE
// ==========================================
const DriveService = {
    upload: function(base64Data, fileName) {
        try {
            console.log("DriveService.upload called for:", fileName);
            if (!base64Data || !base64Data.includes(',')) {
                throw new Error("Invalid base64 data format");
            }
            const split = base64Data.split(',');
            const type = split[0].split(':')[1].split(';')[0];
            console.log("Image type detected:", type);
            
            const blob = Utilities.newBlob(Utilities.base64Decode(split[1]), type, fileName);
            console.log("Blob created successfully, size:", blob.getBytes().length);
            
            let folder;
            console.log("Searching for folder:", CONFIG.DRIVE.FOLDER_NAME);
            const folders = DriveApp.getFoldersByName(CONFIG.DRIVE.FOLDER_NAME);
            if (folders.hasNext()) {
                folder = folders.next();
                console.log("Existing folder found.");
            } else {
                folder = DriveApp.createFolder(CONFIG.DRIVE.FOLDER_NAME);
                console.log("New folder created.");
            }
            
            const file = folder.createFile(blob);
            console.log("File saved to Drive, ID:", file.getId());
            file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
            console.log("File sharing set to public.");
            
            // Return bulletproof thumbnail embedding link format
            // sz=w1000 scales the image to a max width of 1000px, optimizing it for the web while maintaining high quality.
            return "https://drive.google.com/thumbnail?id=" + file.getId() + "&sz=w1000";
        } catch (err) {
            console.error("Inside DriveService.upload Error:", err.toString());
            throw err;
        }
    }
};

/**
 * MANUAL ACTION REQUIRED:
 * Please run this function once in your Script Editor to trigger 
 * the Google Drive permission popup.
 */
function testDriveConnection() {
    try {
        console.log("--- Starting Drive Connection Test ---");
        const folderName = CONFIG.DRIVE.FOLDER_NAME;
        let folder;
        const folders = DriveApp.getFoldersByName(folderName);
        
        if (folders.hasNext()) {
            folder = folders.next();
            console.log("SUCCESS: Folder '" + folderName + "' already exists.");
        } else {
            folder = DriveApp.createFolder(folderName);
            console.log("SUCCESS: Folder '" + folderName + "' has been created.");
        }
        
        folder.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
        console.log("SUCCESS: Permissions verified. Folder URL: " + folder.getUrl());
        console.log("--- Test Complete: Your Drive is CONNECTED ---");
        return "Connection Successful!";
    } catch (e) {
        console.error("ERROR: Drive connection failed. " + e.toString());
        return "Error: " + e.toString();
    }
}

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

            const nameParts = (data.fullName || "Client").split(' ');
            let family = nameParts.length > 1 ? nameParts.pop() : "Client";
            let first = nameParts.join(' ') || "N/A";
            
            const payload = [{
                order_id: data.eventId || ("ord_" + Date.now()),
                firstname: first,
                familyname: family,
                contact_phone: data.phone || "",
                address: data.address || "N/A",
                to_wilaya_name: yWilaya,
                to_commune_name: data.commune || "",
                product_list: `${data.product} (${data.color || 'Default'}, ${data.size || 'Default'})`,
                price: parseFloat((data.price || "0").toString().replace(/[^\d]/g, '')) - 100,
                freeshipping: false,
                is_stopdesk: data.is_stopdesk || 0
            }];

            const opt = {
                method: 'post', contentType: 'application/json',
                headers: { "X-API-ID": CONFIG.APIS.YALIDINE.ID, "X-API-TOKEN": CONFIG.APIS.YALIDINE.TOKEN },
                payload: JSON.stringify(payload), muteHttpExceptions: true
            };

            const resp = UrlFetchApp.fetch(CONFIG.APIS.YALIDINE.BASE_URL + "/parcels/", opt);
            const content = JSON.parse(resp.getContentText());
            for (let key in content) {
                if (content[key] && content[key].tracking) return { tracking: content[key].tracking };
            }
            return { error: "Yalidine API error or invalid response" };
        } catch (err) {
            return { error: err.toString() };
        }
    }
};

// ==========================================
// META SERVICE
// ==========================================
const MetaService = {
    trackPurchase: function(data) {
        try {
            if (!CONFIG.APIS.META_CAPI.PIXEL_ID) return;
            const url = `https://graph.facebook.com/v19.0/${CONFIG.APIS.META_CAPI.PIXEL_ID}/events?access_token=${CONFIG.APIS.META_CAPI.ACCESS_TOKEN}`;
            const hash = (s) => {
                if (!s || s === "N/A") return null;
                return Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, s.trim().toLowerCase())
                    .map(b => (b < 0 ? b + 256 : b).toString(16).padStart(2, '0')).join('');
            };
            const payload = {
                data: [{
                    event_name: 'Purchase',
                    event_time: Math.floor(Date.now() / 1000),
                    action_source: 'website',
                    user_data: { em: [hash(data.email)], ph: [hash(data.phone)] },
                    custom_data: { 
                        currency: 'DZD', 
                        value: parseFloat(data.price.toString().replace(/[^\d]/g, '')) || 0,
                        content_name: data.product 
                    }
                }]
            };
            UrlFetchApp.fetch(url, { method: 'post', contentType: 'application/json', payload: JSON.stringify(payload), muteHttpExceptions: true });
        } catch(e) { console.error("Meta CAPI Error:", e); }
    }
};

const Response = {
    json: function(data, code = 200) {
        return ContentService.createTextOutput(JSON.stringify(data))
            .setMimeType(ContentService.MimeType.JSON);
    }
};

// Daily triggers
function sendPendingReminders() {
    try {
        const sheet = Utils.getSheet(CONFIG.SHEETS.ORDERS);
        const data = sheet.getDataRange().getValues();
        // ... (rest of reminder logic)
    } catch(e) { console.error("CRON Error:", e); }
}
