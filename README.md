# Venue Tracker Website

This version is preconfigured with:

- Default admin password: `admin`
- Local cookie secret already set in code
- A Mac launch script included

## Fastest way to run on Mac

1. Extract the zip
2. Open the folder
3. Double click `run-mac.command`

That script will:
- install dependencies with `npm install`
- start the website

Then open:

- Frontend: `http://localhost:3000`
- Admin: `http://localhost:3000/admin`

## Manual run

```bash
npm install
npm start
```

## Change the password later

In `server.js`, find:

```js
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "admin";
```

and change `"admin"` to whatever you want.

## Venue JSON format

Your upload file must be a JSON array like this:

```json
[
  {
    "id": "syd-old-mates-place",
    "name": "Old Mate's Place",
    "city": "Sydney",
    "suburb": "CBD",
    "type": "Bar",
    "status": "visited",
    "favourite": true,
    "description": "Hidden rooftop cocktail bar with a good crowd and city views.",
    "address": "199 Clarence St, Sydney NSW 2000",
    "mapsUrl": "https://www.google.com/maps/search/?api=1&query=Old+Mate%27s+Place+Sydney"
  }
]
```

## Notes

- Uploading a JSON file in admin can either fully replace the current venue list or add extra venues to it.
- The add-extra option skips duplicate venue IDs.
- Export downloads the current list as JSON.
- This is fine for a personal/private deployment.
- For a public production setup, a database and stronger auth would be better.

## Closed venue support

The site now supports three statuses:

- `visited`
- `wishlist`
- `closed`


## Use it as an iPhone app

This build is now PWA-ready.

What that means:
- host it online
- open the site in Safari on your iPhone
- tap Share
- tap **Add to Home Screen**

It will then behave much more like an app.

### Important
It will not work as a proper iPhone app from your laptop alone unless your phone can reach that server.
The easiest path is to deploy it to Render, then add it to your Home Screen on iPhone.

### True native app
If you want a real native iPhone app package, the next step would be wrapping this in Capacitor and building it in Xcode.
