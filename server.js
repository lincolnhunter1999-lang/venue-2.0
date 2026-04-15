import express from "express";
import fs from "fs/promises";
import path from "path";
import crypto from "crypto";
import multer from "multer";
import cookieParser from "cookie-parser";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "admin";
const COOKIE_NAME = "venue_admin";
const COOKIE_SECRET = process.env.COOKIE_SECRET || "venue-tracker-local-secret";
const DATA_FILE = path.join(__dirname, "data", "venues.json");

const upload = multer({ dest: path.join(__dirname, "uploads") });

app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, "public")));

function signValue(value) {
  return crypto.createHmac("sha256", COOKIE_SECRET).update(value).digest("hex");
}

function makeAdminToken() {
  const payload = "admin:" + Date.now();
  const signature = signValue(payload);
  return `${payload}.${signature}`;
}

function isValidAdminToken(token) {
  if (!token || !token.includes(".")) return false;
  const parts = token.split(".");
  const signature = parts.pop();
  const payload = parts.join(".");
  return signValue(payload) === signature && payload.startsWith("admin:");
}

function requireAdmin(req, res, next) {
  const token = req.cookies[COOKIE_NAME];
  if (!isValidAdminToken(token)) {
    return res.status(401).json({ error: "Unauthorised" });
  }
  next();
}

async function readVenues() {
  try {
    const raw = await fs.readFile(DATA_FILE, "utf8");
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed;
  } catch {
    return [];
  }
}

async function writeVenues(venues) {
  await fs.writeFile(DATA_FILE, JSON.stringify(venues, null, 2), "utf8");
}

function normaliseVenue(input, index = 0) {
  const city = String(input.city || "").trim();
  const suburb = String(input.suburb || "").trim();
  const name = String(input.name || "").trim();

  return {
    id: String(input.id || `${city}-${suburb}-${name}-${index}`).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""),
    name,
    city,
    suburb,
    type: String(input.type || "").trim(),
    status: ["visited", "wishlist", "closed"].includes(String(input.status || "").trim()) ? String(input.status).trim() : "wishlist",
    favourite: Boolean(input.favourite),
    description: String(input.description || "").trim(),
    address: String(input.address || "").trim(),
    mapsUrl: String(input.mapsUrl || "").trim()
  };
}

app.post("/api/admin/login", (req, res) => {
  const { password } = req.body;
  if (password !== ADMIN_PASSWORD) {
    return res.status(401).json({ error: "Invalid password" });
  }

  const token = makeAdminToken();
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: false,
    maxAge: 1000 * 60 * 60 * 8
  });

  res.json({ ok: true });
});

app.post("/api/admin/logout", (req, res) => {
  res.clearCookie(COOKIE_NAME);
  res.json({ ok: true });
});

app.get("/api/admin/check", (req, res) => {
  res.json({ authenticated: isValidAdminToken(req.cookies[COOKIE_NAME]) });
});

app.get("/api/venues", async (_req, res) => {
  const venues = await readVenues();
  res.json(venues);
});

app.post("/api/venues/:id/favourite", async (req, res) => {
  const venues = await readVenues();
  const venue = venues.find(v => v.id === req.params.id);
  if (!venue) return res.status(404).json({ error: "Venue not found" });

  venue.favourite = !venue.favourite;
  await writeVenues(venues);
  res.json(venue);
});

app.post("/api/venues/:id/status", async (req, res) => {
  const venues = await readVenues();
  const venue = venues.find(v => v.id === req.params.id);
  if (!venue) return res.status(404).json({ error: "Venue not found" });

  if (venue.status === "visited") {
    venue.status = "wishlist";
  } else {
    venue.status = "visited";
  }
  await writeVenues(venues);
  res.json(venue);
});

app.get("/api/admin/venues", requireAdmin, async (_req, res) => {
  const venues = await readVenues();
  res.json(venues);
});

app.put("/api/admin/venues/:id", requireAdmin, async (req, res) => {
  const venues = await readVenues();
  const index = venues.findIndex(v => v.id === req.params.id);
  if (index === -1) return res.status(404).json({ error: "Venue not found" });

  const merged = { ...venues[index], ...req.body };
  venues[index] = normaliseVenue(merged, index);
  await writeVenues(venues);
  res.json(venues[index]);
});

app.post("/api/admin/venues", requireAdmin, async (req, res) => {
  const venues = await readVenues();
  const venue = normaliseVenue(req.body, venues.length);
  venues.push(venue);
  await writeVenues(venues);
  res.json(venue);
});

app.post("/api/admin/upload", requireAdmin, upload.single("file"), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: "No file uploaded" });
  }

  try {
    const raw = await fs.readFile(req.file.path, "utf8");
    const parsed = JSON.parse(raw);

    if (!Array.isArray(parsed)) {
      return res.status(400).json({ error: "Uploaded file must be a JSON array" });
    }

    const venues = parsed.map((v, index) => normaliseVenue(v, index));
    await writeVenues(venues);
    await fs.unlink(req.file.path);
    res.json({ ok: true, count: venues.length });
  } catch (error) {
    try { await fs.unlink(req.file.path); } catch {}
    res.status(400).json({ error: "Invalid JSON file" });
  }
});


app.post("/api/admin/upload-append", requireAdmin, upload.single("file"), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: "No file uploaded" });
  }

  try {
    const raw = await fs.readFile(req.file.path, "utf8");
    const parsed = JSON.parse(raw);

    if (!Array.isArray(parsed)) {
      return res.status(400).json({ error: "Uploaded file must be a JSON array" });
    }

    const existingVenues = await readVenues();
    const existingIds = new Set(existingVenues.map(v => v.id));
    let addedCount = 0;
    let skippedCount = 0;

    parsed.forEach((v, index) => {
      const venue = normaliseVenue(v, existingVenues.length + index);
      if (!venue.id || existingIds.has(venue.id)) {
        skippedCount += 1;
        return;
      }
      existingVenues.push(venue);
      existingIds.add(venue.id);
      addedCount += 1;
    });

    await writeVenues(existingVenues);
    await fs.unlink(req.file.path);
    res.json({ ok: true, addedCount, skippedCount, totalCount: existingVenues.length });
  } catch (error) {
    try { await fs.unlink(req.file.path); } catch {}
    res.status(400).json({ error: "Invalid JSON file" });
  }
});

app.get("/api/admin/export", requireAdmin, async (_req, res) => {
  const venues = await readVenues();
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Content-Disposition", "attachment; filename=venues-export.json");
  res.send(JSON.stringify(venues, null, 2));
});

app.get("/admin", (_req, res) => {
  res.sendFile(path.join(__dirname, "public", "admin.html"));
});

app.listen(PORT, () => {
  console.log(`Venue tracker running on http://localhost:${PORT}`);
});
