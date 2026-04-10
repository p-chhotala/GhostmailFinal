async function getEmail() {
    console.log("Fetching email...");

    try {
        const res = await fetch("https://api.guerrillamail.com/ajax.php?f=get_email_address");
        console.log("Response:", res);

        const data = await res.json();
        console.log("Data:", data);

        const email = data.email_addr;

        document.getElementById("emailInput").value = email;

        window.sidToken = data.sid_token;

        console.log("Email set:", email);

    } catch (err) {
        console.error("Error:", err);
    }
}


async function getInbox() {
    console.log("Fetching inbox...");
    
    if (!window.sidToken) {
        console.log("No SID token yet");
        return;
    }
    
    try {
        const res = await fetch(`https://api.guerrillamail.com/ajax.php?f=get_email_list&sid_token=${window.sidToken}`);
        const data = await res.json();
        
        console.log("INBOX DATA:", data);
        console.log("MESSAGES:", data.list);
        
    } catch (err) {
        console.error("Inbox Error:", err);
    }
}

getEmail();

setTimeout(() => {
    getInbox();
}, 2000);