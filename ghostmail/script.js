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
    const text = document.getElementById("emailInput").value;

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

    console.log("Copied:", text);
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

        const text = await res.text();
        if (!text) return;

        const data = JSON.parse(text);

        const messages = data.list || [];
        // const messages = (data.list || []).filter(mail =>mail.mail_from !== "no-reply@guerrillamail.com");

        // 📊 Counter
        const countEl = document.getElementById("msg-count");
        if (countEl) countEl.innerText = messages.length;

        // 🔔 New mail detection
        if (messages.length > lastCount) {
            console.log("📩 NEW MAIL ARRIVED!");
        }
        lastCount = messages.length;

        // 🧠 Build HTML
        let newHTML = "";

        messages.forEach(mail => {
            newHTML += `
                <div class="p-1rem mail" style="border-bottom: 1px solid #ffffff0d;" onclick="openMail('${mail.mail_id}')">
                    <h4 class="color-blue">${mail.mail_from}</h4>
                    <p>${mail.mail_subject}</p>
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
// OPEN EMAIL
// ==========================
function openMail(emailId) {
    if (window.inboxInterval) {
        clearInterval(window.inboxInterval);
    }

    fetch(`https://api.guerrillamail.com/ajax.php?f=fetch_email&email_id=${emailId}&sid_token=${window.sidToken}`)
        .then(res => res.json())
        .then(data => {

            document.getElementById("inbox").innerHTML = `
                <div class="p-1_5rem flex flex-col">
                    <a class="color-blue font-bold mb-0_5rem" onclick="goBack()" style="position: absolute;"><i class="fa-solid fa-angle-left"></i>Back</a>
                    <h3>${data.mail_subject}</h3>
                    <p class="mb-0_75rem"><b>From:</b> ${data.mail_from}</p>
                    <hr class="mb-0_75rem">
                    <div class="mail-body">
                        ${data.mail_body}
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

    // 👻 Restore cached inbox (NO FLICKER)
    const savedInbox = localStorage.getItem("inboxHTML");
    if (savedInbox) {
        document.getElementById("inbox").innerHTML = savedInbox;
        lastInboxHTML = savedInbox;
    }

    setTimeout(() => {
        getInbox();
        window.inboxInterval = setInterval(getInbox, 6000);
    }, 1500);
};