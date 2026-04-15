const loginView = document.getElementById("loginView");
const adminView = document.getElementById("adminView");
const loginBtn = document.getElementById("loginBtn");
const passwordInput = document.getElementById("passwordInput");
const loginError = document.getElementById("loginError");
const logoutBtn = document.getElementById("logoutBtn");
const adminTableBody = document.getElementById("adminTableBody");
const adminSearch = document.getElementById("adminSearch");

let adminVenues = [];

async function api(url, options = {}) {
  const res = await fetch(url, options);
  if (!res.ok) {
    let message = "Request failed";
    try {
      const body = await res.json();
      message = body.error || message;
    } catch {}
    throw new Error(message);
  }
  const contentType = res.headers.get("content-type") || "";
  if (contentType.includes("application/json")) return res.json();
  return res;
}

async function checkAuth() {
  const res = await api("/api/admin/check");
  loginView.classList.toggle("hidden", res.authenticated);
  adminView.classList.toggle("hidden", !res.authenticated);
  if (res.authenticated) loadAdminVenues();
}

loginBtn.addEventListener("click", async () => {
  loginError.textContent = "";
  try {
    await api("/api/admin/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password: passwordInput.value })
    });
    passwordInput.value = "";
    checkAuth();
  } catch (error) {
    loginError.textContent = error.message;
  }
});

logoutBtn.addEventListener("click", async () => {
  await api("/api/admin/logout", { method: "POST" });
  checkAuth();
});

async function loadAdminVenues() {
  adminVenues = await api("/api/admin/venues");
  renderAdminTable();
}

function rowHtml(v) {
  return `
    <tr data-id="${v.id}">
      <td><input data-field="name" value="${escapeHtml(v.name)}" /></td>
      <td>
        <div class="form-grid">
          <input data-field="city" value="${escapeHtml(v.city)}" placeholder="City" />
          <input data-field="suburb" value="${escapeHtml(v.suburb)}" placeholder="Suburb" />
          <input data-field="address" value="${escapeHtml(v.address)}" placeholder="Address" />
        </div>
      </td>
      <td><input data-field="type" value="${escapeHtml(v.type)}" /></td>
      <td>
        <select data-field="status">
          <option value="wishlist" ${v.status === "wishlist" ? "selected" : ""}>Wishlist</option>
          <option value="visited" ${v.status === "visited" ? "selected" : ""}>Visited</option>
          <option value="closed" ${v.status === "closed" ? "selected" : ""}>Closed</option>
        </select>
      </td>
      <td>
        <select data-field="favourite">
          <option value="false" ${!v.favourite ? "selected" : ""}>No</option>
          <option value="true" ${v.favourite ? "selected" : ""}>Yes</option>
        </select>
      </td>
      <td><textarea data-field="description" rows="3">${escapeHtml(v.description)}</textarea></td>
      <td><input data-field="mapsUrl" value="${escapeHtml(v.mapsUrl)}" /></td>
      <td><button class="success" onclick="saveRow('${v.id}')">Save</button></td>
    </tr>
  `;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function renderAdminTable() {
  const search = adminSearch.value.trim().toLowerCase();
  const filtered = adminVenues.filter(v =>
    !search ||
    v.name.toLowerCase().includes(search) ||
    v.city.toLowerCase().includes(search) ||
    v.suburb.toLowerCase().includes(search) ||
    v.type.toLowerCase().includes(search)
  );
  adminTableBody.innerHTML = filtered.map(rowHtml).join("");
}

adminSearch.addEventListener("input", renderAdminTable);

window.saveRow = async function(id) {
  const row = document.querySelector(`tr[data-id="${id}"]`);
  const payload = {};
  row.querySelectorAll("[data-field]").forEach(el => {
    const field = el.dataset.field;
    payload[field] = el.value;
  });
  payload.favourite = payload.favourite === "true";

  try {
    await api(`/api/admin/venues/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    await loadAdminVenues();
  } catch (error) {
    alert(error.message);
  }
};

document.getElementById("addVenueBtn").addEventListener("click", async () => {
  const payload = {
    name: document.getElementById("name").value,
    city: document.getElementById("city").value,
    suburb: document.getElementById("suburb").value,
    type: document.getElementById("type").value,
    status: document.getElementById("status").value,
    favourite: document.getElementById("favourite").value === "true",
    description: document.getElementById("description").value,
    address: document.getElementById("address").value,
    mapsUrl: document.getElementById("mapsUrl").value
  };

  try {
    await api("/api/admin/venues", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    ["name", "city", "suburb", "type", "description", "address", "mapsUrl"].forEach(id => {
      document.getElementById(id).value = "";
    });
    document.getElementById("status").value = "wishlist";
    document.getElementById("favourite").value = "false";

    await loadAdminVenues();
  } catch (error) {
    alert(error.message);
  }
});

document.getElementById("uploadBtn").addEventListener("click", async () => {
  const fileInput = document.getElementById("uploadFile");
  const file = fileInput.files[0];
  if (!file) {
    alert("Choose a JSON file first.");
    return;
  }

  const formData = new FormData();
  formData.append("file", file);

  try {
    const result = await api("/api/admin/upload", {
      method: "POST",
      body: formData
    });
    alert(`Uploaded ${result.count} venues.`);
    fileInput.value = "";
    await loadAdminVenues();
  } catch (error) {
    alert(error.message);
  }
});

document.getElementById("exportBtn").addEventListener("click", async () => {
  window.location.href = "/api/admin/export";
});

checkAuth();


document.getElementById("appendBtn").addEventListener("click", async () => {
  const fileInput = document.getElementById("appendFile");
  const file = fileInput.files[0];
  if (!file) {
    alert("Choose a JSON file first.");
    return;
  }

  const formData = new FormData();
  formData.append("file", file);

  try {
    const result = await api("/api/admin/upload-append", {
      method: "POST",
      body: formData
    });
    alert(`Added ${result.addedCount} venues. Skipped ${result.skippedCount}. Total now ${result.totalCount}.`);
    fileInput.value = "";
    await loadAdminVenues();
  } catch (error) {
    alert(error.message);
  }
});
