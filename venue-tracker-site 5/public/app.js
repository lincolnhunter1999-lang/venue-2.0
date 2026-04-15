let venues = [];

const els = {
  searchInput: document.getElementById("searchInput"),
  cityFilter: document.getElementById("cityFilter"),
  suburbFilter: document.getElementById("suburbFilter"),
  typeFilter: document.getElementById("typeFilter"),
  statusFilter: document.getElementById("statusFilter"),
  favouriteFilter: document.getElementById("favouriteFilter"),
  grid: document.getElementById("venueGrid"),
  stats: document.getElementById("stats"),
  empty: document.getElementById("emptyState")
};

async function loadVenues() {
  const res = await fetch("/api/venues");
  venues = await res.json();
  buildFilterOptions();
  render();
}

function uniqueSorted(values) {
  return [...new Set(values.filter(Boolean))].sort((a, b) => a.localeCompare(b));
}

function setOptions(select, values, label) {
  const current = select.value;
  select.innerHTML = `<option value="">${label}</option>` + values.map(value => `<option value="${escapeHtml(value)}">${escapeHtml(value)}</option>`).join("");
  if ([...select.options].some(option => option.value === current)) {
    select.value = current;
  }
}

function buildFilterOptions() {
  setOptions(els.cityFilter, uniqueSorted(venues.map(v => v.city)), "All cities");
  setOptions(els.typeFilter, uniqueSorted(venues.map(v => v.type)), "All types");
  updateSuburbOptions();
}

function updateSuburbOptions() {
  const city = els.cityFilter.value;
  const source = city ? venues.filter(v => v.city === city) : venues;
  setOptions(els.suburbFilter, uniqueSorted(source.map(v => v.suburb)), "All suburbs");
}

function getFilteredVenues() {
  const search = els.searchInput.value.trim().toLowerCase();
  const city = els.cityFilter.value;
  const suburb = els.suburbFilter.value;
  const type = els.typeFilter.value;
  const status = els.statusFilter.value;
  const favourite = els.favouriteFilter.value;

  return venues.filter(v => {
    const matchesSearch =
      !search ||
      v.name.toLowerCase().includes(search) ||
      v.description.toLowerCase().includes(search) ||
      v.city.toLowerCase().includes(search) ||
      v.suburb.toLowerCase().includes(search);

    return matchesSearch &&
      (!city || v.city === city) &&
      (!suburb || v.suburb === suburb) &&
      (!type || v.type === type) &&
      (!status || v.status === status) &&
      (!favourite || v.favourite === true);
  });
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function cardHtml(v) {
  const mapsUrl = v.mapsUrl || `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(v.address || `${v.name} ${v.suburb} ${v.city}`)}`;

  return `
    <div class="panel card">
      <div class="card-header">
        <div>
          <h3>${escapeHtml(v.name)}</h3>
          <div class="subtitle">${escapeHtml([v.suburb, v.city].filter(Boolean).join(", "))}</div>
        </div>
        <div class="badges">
          <span class="badge">${escapeHtml(v.type || "Venue")}</span>
          <span class="badge">${v.status === "visited" ? "Visited" : (v.status === "closed" ? "Closed" : "Wishlist")}</span>
          ${v.favourite ? `<span class="badge">★ Favourite</span>` : ""}
        </div>
      </div>
      <p>${escapeHtml(v.description || "No description yet.")}</p>
      <p><strong>Location:</strong> ${escapeHtml(v.address || [v.suburb, v.city].filter(Boolean).join(", "))}</p>
      <div class="actions">
        <a href="${mapsUrl}" target="_blank" rel="noreferrer"><button class="soft">Open in Maps</button></a>
        <button class="soft" onclick="toggleFavourite('${v.id}')">${v.favourite ? "Unfavourite" : "Favourite"}</button>
        <button class="primary" onclick="toggleStatus('${v.id}')">${v.status === "visited" ? "Move to Wishlist" : (v.status === "closed" ? "Reopen as Visited" : "Move to Visited")}</button>
      </div>
    </div>
  `;
}

function render() {
  const filtered = getFilteredVenues();
  els.stats.textContent = `${filtered.length} venue${filtered.length === 1 ? "" : "s"} shown`;
  els.grid.innerHTML = filtered.map(cardHtml).join("");
  els.empty.classList.toggle("hidden", filtered.length > 0);
}

async function toggleFavourite(id) {
  await fetch(`/api/venues/${id}/favourite`, { method: "POST" });
  await loadVenues();
}

async function toggleStatus(id) {
  await fetch(`/api/venues/${id}/status`, { method: "POST" });
  await loadVenues();
}

[
  "searchInput",
  "cityFilter",
  "suburbFilter",
  "typeFilter",
  "statusFilter",
  "favouriteFilter"
].forEach(id => {
  els[id].addEventListener("input", () => {
    if (id === "cityFilter") updateSuburbOptions();
    render();
  });
  els[id].addEventListener("change", () => {
    if (id === "cityFilter") updateSuburbOptions();
    render();
  });
});

loadVenues();
