// ==========================
// DECODE + FIX IMAGE URL
// ==========================
function fixImageURL(src) {
    try {
        // If it's Guerrilla proxy
        if (src.includes("res.php") && src.includes("q=")) {
            const url = new URL(src, window.location.origin);
            const encoded = url.searchParams.get("q");

            if (encoded) {
                return decodeURIComponent(encoded);
            }
        }

        // Otherwise return original
        return src;

    } catch (e) {
        console.warn("URL decode failed:", src);
        return src;
    }
}

// ==========================
// GLOBAL STATE
// ==========================
let lastInboxHTML = "";
let lastCount = 0;
let isFetching = false;


// ==========================
// COPY EMAIL
// ==========================
function copyText() {
    const box = document.getElementById("emailInput");
    const text = document.getElementById("emailInput").value;
    const btn = document.getElementById("copyBtn");

    if (navigator.clipboard && window.isSecureContext) {
        navigator.clipboard.writeText(text);
    } else {
        const textarea = document.createElement("textarea");
        textarea.value = text;
        textarea.style.position = "fixed";
        textarea.style.opacity = "0";

        document.body.appendChild(textarea);
        textarea.focus();
        textarea.select();

        document.execCommand("copy");
        document.body.removeChild(textarea);
    }
    
    // ✅ VISUAL FEEDBACK
    box.style.outline = '2px solid #74c0fc';
    setTimeout(() => {
        box.style.outline = '';
    }, 1500);
}


// ==========================
// GET / RESTORE EMAIL
// ==========================
async function getEmail() {
    const savedEmail = localStorage.getItem("email");
    const savedToken = localStorage.getItem("sidToken");
    const startTime = localStorage.getItem("startTime");

    // ⏳ Expiry (10 min)
    if (startTime) {
        const diff = Date.now() - startTime;
        if (diff > 10 * 60 * 1000) {
            localStorage.clear();
        }
    }

    if (savedEmail && savedToken) {
        document.getElementById("emailInput").value = savedEmail;
        window.sidToken = savedToken;
        return;
    }

    try {
        const res = await fetch("https://api.guerrillamail.com/ajax.php?f=get_email_address&site=sharklasers.com");
        const data = await res.json();

        document.getElementById("emailInput").value = data.email_addr;
        window.sidToken = data.sid_token;

        localStorage.setItem("email", data.email_addr);
        localStorage.setItem("sidToken", data.sid_token);
        localStorage.setItem("startTime", Date.now());

    } catch (err) {
        console.error("Email Error:", err);
    }
}


// ==========================
// FETCH INBOX
// ==========================
async function getInbox() {
    const inbox = document.getElementById("inbox");

    if (!window.sidToken || !inbox || isFetching) return;
    isFetching = true;

    try {
        const res = await fetch(
            `https://api.guerrillamail.com/ajax.php?f=get_email_list&offset=0&sid_token=${window.sidToken}`
        );

        if (res.status === 429) {
            console.warn("Too many requests — slowing down");
            return;
        }

        const data = await res.json();
        const messages = data.list || [];

        // 📊 Counter
        const countEl = document.getElementById("msg-count");
        if (countEl) countEl.innerText = messages.length;

        // 🔔 New mail detection (skip first load)
        if (messages.length > lastCount && lastCount !== 0) {
            console.log("📩 NEW MAIL ARRIVED!");
        }
        lastCount = messages.length;

        // 🧠 Build HTML
        let newHTML = "";

        messages.forEach(mail => {
            newHTML += `
                <div class="mb-0_5rem p-1rem mail flex justify-between align-center"
                     style="border-left: 3px solid #74c0fc;"
                     onclick="openMail('${mail.mail_id}')">
                    <div>
                        <h4 class="color-blue">${mail.mail_from}</h4>
                        <p>${mail.mail_subject}</p>
                    </div>
                    <div>
                        <i class="fa-solid fa-angle-right color-blue"></i>
                    </div>
                </div>
            `;
        });

        // ✅ Prevent flicker + cache
        if (newHTML !== lastInboxHTML) {
            inbox.innerHTML = newHTML;
            lastInboxHTML = newHTML;
            localStorage.setItem("inboxHTML", newHTML);
        }

    } catch (err) {
        console.error("Inbox Error:", err);
    }

    isFetching = false;
}


// ==========================
// OPEN EMAIL (SANITIZED 👻)
// ==========================
function openMail(emailId) {
    if (window.inboxInterval) {
        clearInterval(window.inboxInterval);
    }

    fetch(`https://api.guerrillamail.com/ajax.php?f=fetch_email&email_id=${emailId}&sid_token=${window.sidToken}`)
        .then(res => res.json())
        .then(data => {

            const parser = new DOMParser();
            let doc = parser.parseFromString(data.mail_body, "text/html");


            // ==========================
            // ✅ FIX IMG TAGS
            // ==========================
            doc.querySelectorAll("img").forEach(img => {
                let src = img.getAttribute("src") || "";

                // Fix Guerrilla proxy
                if (src.includes("res.php") && src.includes("q=")) {
                    try {
                        const url = new URL(src, window.location.origin);
                        const real = url.searchParams.get("q");

                        if (real) {
                            img.src = decodeURIComponent(real);
                        }
                    } catch {}
                }

                img.style.maxWidth = "100%";
                img.style.height = "auto";
                img.style.display = "inline-block";
                img.onerror = () => {
                    img.style.display = "none";
                };
            });


            // ==========================
            // ✅ FIX INLINE CSS IMAGES
            // ==========================
            doc.querySelectorAll("*").forEach(el => {
                let style = el.getAttribute("style");
                if (!style) return;

                if (style.includes("res.php") && style.includes("q=")) {
                    try {
                        const match = style.match(/q=([^")]+)/);
                        if (match && match[1]) {
                            const real = decodeURIComponent(match[1]);
                            el.style.backgroundImage = `url("${real}")`;
                        }
                    } catch {}
                }
            });


            // ==========================
            // ❌ REMOVE STYLE TAGS (important)
            // ==========================
            doc.querySelectorAll("style").forEach(s => s.remove());


            // ==========================
            // ❌ REMOVE SCRIPTS
            // ==========================
            doc.querySelectorAll("script").forEach(s => s.remove());


            // ==========================
            // 🔗 SAFE LINKS
            // ==========================
            doc.querySelectorAll("a").forEach(a => {
                a.target = "_blank";
                a.rel = "noopener noreferrer";
            });


            // ==========================
            // FINAL HTML
            // ==========================
            const cleanHTML = doc.body.innerHTML;

            document.getElementById("inbox").innerHTML = `
                <div class="p-1_5rem flex flex-col">
                    <ul class="color-blue font-bold mb-0_5rem" onclick="goBack()">
                        <i class="fa-solid fa-angle-left"></i> Back
                    </ul>
                    <h3>${data.mail_subject}</h3>
                    <p class="mb-0_75rem"><b>From:</b> ${data.mail_from}</p>
                    <hr class="mb-0_75rem bg-blue">
                    <div class="mail-body">
                        ${cleanHTML}
                    </div>
                </div>
            `;
        });
}


// ==========================
// BACK TO INBOX
// ==========================
function goBack() {
    lastInboxHTML = "";
    isFetching = false;

    getInbox();

    clearInterval(window.inboxInterval);
    window.inboxInterval = setInterval(getInbox, 6000);
}


// ==========================
// NEW EMAIL
// ==========================
function newEmail() {
    localStorage.clear();
    location.reload();
}


// ==========================
// AUTO RUN
// ==========================
window.onload = async () => {
    await getEmail();

    // 👻 Restore cached inbox
    const savedInbox = localStorage.getItem("inboxHTML");
    if (savedInbox) {
        document.getElementById("inbox").innerHTML = savedInbox;
        lastInboxHTML = savedInbox;
    }

    setTimeout(() => {
        getInbox();
        window.inboxInterval = setInterval(getInbox, 5000);
    }, 1500);
};