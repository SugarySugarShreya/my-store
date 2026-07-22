const PHOTOS_FOLDER_NAME = "Soft Launch - Customer Photos";

function getPhotosFolder() {
  const folders = DriveApp.getFoldersByName(PHOTOS_FOLDER_NAME);
  return folders.hasNext() ? folders.next() : DriveApp.createFolder(PHOTOS_FOLDER_NAME);
}

// Saves one base64 "data:image/jpeg;base64,...." photo to Drive and
// returns a viewable link.
function savePhoto(dataUrl, label) {
  const match = dataUrl.match(/^data:(image\/\w+);base64,(.*)$/);
  if (!match) return "";

  const contentType = match[1];
  const bytes = Utilities.base64Decode(match[2]);
  const blob = Utilities.newBlob(bytes, contentType, `${label}-${Date.now()}.jpg`);

  const file = getPhotosFolder().createFile(blob);
  file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);

  return file.getUrl();
}

function doPost(e) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  const data = JSON.parse(e.postData.contents);

  // data.customizations is an array like:
  // [{ item: "Custom Spotify Plaque", qty: 1, notes: "...", photos: ["data:image/jpeg;base64,..."] }]
  const photoLinks = [];
  (data.customizations || []).forEach(c => {
    (c.photos || []).forEach((photo, i) => {
      const url = savePhoto(photo, `${c.item}-${i + 1}`);
      if (url) photoLinks.push(`${c.item}${c.notes ? ` (${c.notes})` : ""}: ${url}`);
    });
  });

  sheet.appendRow([
    data.timestamp || new Date().toISOString(),
    data.orderId || "",
    data.paymentId || "",
    data.name || "",
    data.phone || "",
    data.address || "",
    data.items || "",
    data.total || 0,
    photoLinks.join("\n")
  ]);

  return ContentService
    .createTextOutput(JSON.stringify({ ok: true }))
    .setMimeType(ContentService.MimeType.JSON);
}
```

3. Click **Save** (disk icon), name the project e.g. "Order Logger".

## 3. Deploy it as a Web App

1. Click **Deploy → New deployment**.
2. Click the gear icon next to "Select type" and choose **Web app**.
3. Set:
   - **Execute as:** Me (your Google account)
   - **Who has access:** Anyone
4. Click **Deploy**. Google may ask you to authorize the script —
   approve it (it's your own script, so this is safe).
5. Copy the **Web app URL** it gives you — it looks like
   `https://script.google.com/macros/s/AKfycb.../exec`.

## 4. Add the URL to Vercel

1. In your Vercel project, go to **Settings → Environment Variables**.
2. Add:
   - `GOOGLE_SHEET_WEBHOOK_URL` → the Web app URL you just copied.
3. Redeploy the project (or click **Redeploy**).

## 5. Test it

1. Place a test order on your live site and complete payment
   (use Razorpay test mode if you haven't gone live yet).
2. Check your Google Sheet — a new row should appear within a few
   seconds.

## Notes

- Customers upload photos directly on the product page for Spotify
  Plaques, Canvas prints and Number Plate Keychains — no WhatsApp
  needed. Photos are resized/compressed in the browser before
  upload, then sent as base64 image data inside `data.customizations`
  when the order is logged.
- The example Apps Script above saves each photo into a Drive folder
  called "Soft Launch - Customer Photos" and puts a viewable link in
  the sheet's last column. Feel free to replace this logic if you'd
  rather store photos somewhere else (e.g. a different Drive folder
  per order, or another storage service) — just keep reading
  `data.customizations` the same way.
- Vercel serverless functions cap request bodies at a few MB, so if a
  customer uploads several photos on multiple items in one order,
  keep an eye on total payload size. The default upload limit is 5
  photos per item, resized to ~1200px, which comfortably fits.
- If you ever change the columns in your Sheet, update the
  `sheet.appendRow([...])` line in the Apps Script to match, and the
  keys read in `api/log-order.js` if you rename fields.
- If this isn't set up yet, checkout still works fine — the site
  just silently skips the logging step.
- If you later want a Google Form-style live view for your team
  (e.g. filters, notifications on new rows), you can turn on
  **Tools → Notification rules** inside the Sheet itself — no code
  needed.
