
// Open local database
const request = indexedDB.open("SchoolcurityDB", 1);

let localDB;

request.onupgradeneeded = function(event) {
    const db = event.target.result;

    db.createObjectStore("visitors", {
        keyPath: "id"
    });
};

request.onsuccess = function(event) {
    localDB = event.target.result;

    // Upload any previously unsynced records
    syncVisitors();
};

// Save a visitor locally
function saveLocally(visitor) {
    return new Promise((resolve, reject) => {
        const transaction = localDB.transaction(
            "visitors", "readwrite"
        );

        transaction.objectStore("visitors").put(visitor);

        transaction.oncomplete = resolve;
        transaction.onerror = () => reject(transaction.error);
    });
}

// Get all locally stored visitors
function getLocalVisitors() {
    return new Promise((resolve, reject) => {
        const transaction = localDB.transaction(
            "visitors", "readonly"
        );

        const request = transaction
            .objectStore("visitors")
            .getAll();

        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

// Submit visitor
async function submitVisitor() {
    const name = document.getElementById("visitorName").value.trim();

    const status = document.querySelector(
        'input[name="status"]:checked'
    );

    const hour = document.getElementById("hour").value;
    const minute = document.getElementById("minute").value;

    if (!name || !status || hour === "" || minute === "") {
        alert("Please fill in all fields!");
        return;
    }

    if (+hour < 0 || +hour > 23 ||
        +minute < 0 || +minute > 59) {
        alert("Invalid time!");
        return;
    }

    const visitor = {
        id: crypto.randomUUID(),
        name: name,
        status: status.value,
        time: `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`,
        created_at: new Date().toISOString(),
        synced: false
    };

    // Always save locally first
    await saveLocally(visitor);

    alert("Visitor record saved locally!");

    // Attempt upload
    if (navigator.onLine) {
        syncVisitors();
    }

    // Clear form
    document.getElementById("visitorName").value = "";
    document.querySelectorAll('input[name="status"]')
        .forEach(input => input.checked = false);
    document.getElementById("hour").value = "";
    document.getElementById("minute").value = "";
}

// Synchronise unsynced records
async function syncVisitors() {
    if (!localDB || !navigator.onLine) return;

    const visitors = await getLocalVisitors();

    for (const visitor of visitors) {
        if (visitor.synced) continue;

        try {
            const response = await fetch("/api/visitors", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify(visitor)
            });

            if (!response.ok) continue;

            // Mark as synced only after server confirms
            visitor.synced = true;
            await saveLocally(visitor);

            console.log("Synced:", visitor.name);

        } catch (error) {
            console.log("Upload failed. Will retry later.");
            break;
        }
    }
}

// Automatically sync when internet returns
window.addEventListener("online", syncVisitors);

// Also retry when the page becomes visible
document.addEventListener("visibilitychange", () => {
    if (!document.hidden) syncVisitors();
});
