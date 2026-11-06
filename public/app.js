
// Open local database
const request = indexedDB.open("SchoolcurityDB", 1);

let localDB;

request.onupgradeneeded = function(event) {
    const db = event.target.result;

    db.createObjectStore("visitors", {
        keyPath: "id"
    });
};

request.onsuccess = async function(event) {
    localDB = event.target.result;

    await syncVisitors();
    await displayVisitors();
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
    await displayVisitors();

    alert("Visitor record saved locally!");

    // Attempt upload
   // Attempt upload and refresh records
if (navigator.onLine) {
    await syncVisitors();
    await displayVisitors();
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
window.addEventListener("online", async () => {
    await syncVisitors();
    await displayVisitors();
});
window.addEventListener("offline", displayVisitors);

// Also retry when the page becomes visible
document.addEventListener("visibilitychange", () => {
    if (!document.hidden) syncVisitors();
});

// Display visitor records
async function displayVisitors() {
    const tableBody = document.getElementById("visitorTableBody");
    const connectionStatus = document.getElementById("connectionStatus");

    if (!localDB) {
        tableBody.textContent = "Local database is still loading...";
        return;
    }

    let visitors = [];

    try {
        if (navigator.onLine) {
            // Try retrieving records from the server
            const response = await fetch("/api/visitors");

            if (!response.ok) {
                throw new Error("Server unavailable");
            }

            visitors = await response.json();

            // Server records have already been synchronised
            visitors = visitors.map(visitor => ({
                ...visitor,
                synced: true
            }));

            // Also include locally stored records waiting for upload
            const localVisitors = await getLocalVisitors();

            const serverIds = new Set(visitors.map(v => v.id));

            for (const visitor of localVisitors) {
                if (!serverIds.has(visitor.id)) {
                    visitors.push(visitor);
                }
            }

            connectionStatus.textContent = "Online – Connected to server";
        } else {
            throw new Error("Offline");
        }
    } catch (error) {
        // If server cannot be reached, show local records
        visitors = await getLocalVisitors();

        connectionStatus.textContent =
            "Offline – Showing locally saved records";
    }

    // Sort newest records first
    visitors.sort((a, b) =>
        new Date(b.created_at) - new Date(a.created_at)
    );

    // Clear previous table contents
    tableBody.replaceChildren();

    if (visitors.length === 0) {
        const row = document.createElement("tr");
        const cell = document.createElement("td");

        cell.colSpan = 4;
        cell.textContent = "No visitor records found.";

        row.appendChild(cell);
        tableBody.appendChild(row);
        return;
    }

    // Display each visitor
    for (const visitor of visitors) {
        const row = document.createElement("tr");

        const values = [
            visitor.name,
            visitor.status,
            visitor.time,
            visitor.synced ? "Synced" : "Pending upload"
        ];

        for (const value of values) {
            const cell = document.createElement("td");
            cell.textContent = value;
            row.appendChild(cell);
        }

        tableBody.appendChild(row);
    }
}
