# 📁 Google Drive File Upload Setup (5 minutes, browser only)

File uploads (PDFs, docs — anything that isn't an image) go to **your Google
Drive** through a tiny Google Apps Script "bridge". Users never log in to
anything — the script runs as *you* on Google's servers, and your account/token
never appears anywhere in the frontend code.

> Images do NOT use this — they go to ImgBB (see step 4).

## Step 1 — Create the script
1. Open https://script.google.com (log in with the Google account whose Drive
   should store the files)
2. Click **New project**
3. Delete everything in the editor and paste this:

```javascript
// MujConnects Drive upload bridge
// Receives { filename, mimeType, data(base64) } and saves it into one Drive
// folder, then returns a public direct-download URL.
const FOLDER_NAME = 'MujConnects Uploads';

function doPost(e) {
  try {
    const body = JSON.parse(e.postData.contents);
    if (!body.filename || !body.data) throw new Error('Missing filename or data');

    // Find or create the uploads folder
    const folders = DriveApp.getFoldersByName(FOLDER_NAME);
    const folder = folders.hasNext() ? folders.next() : DriveApp.createFolder(FOLDER_NAME);

    const bytes = Utilities.base64Decode(body.data);
    const blob = Utilities.newBlob(bytes, body.mimeType || 'application/octet-stream', body.filename);
    const file = folder.createFile(blob);
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);

    return ContentService
      .createTextOutput(JSON.stringify({
        url: 'https://drive.google.com/uc?export=download&id=' + file.getId(),
        viewUrl: 'https://drive.google.com/file/d/' + file.getId() + '/view'
      }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService
      .createTextOutput(JSON.stringify({ error: String(err) }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}
```

## Step 2 — Deploy it as a Web App
1. Click **Deploy → New deployment**
2. Click the ⚙️ gear next to "Select type" → choose **Web app**
3. Set:
   - *Execute as:* **Me**
   - *Who has access:* **Anyone**  ← required, otherwise browser uploads are rejected
4. Click **Deploy**, approve the permission prompts (it only asks for Drive
   access on *your* account)
5. **Copy the Web app URL** (ends in `/exec`)

## Step 3 — Put the URL in the app
Open `firebase-config.js` and set:

```javascript
window.DRIVE_UPLOAD_URL = 'https://script.google.com/macros/s/XXXXX/exec';
```

## Step 4 — ImgBB key (for images)
1. Go to https://api.imgbb.com → log in → **Get API key** (free)
2. In `firebase-config.js` set:

```javascript
window.IMGBB_API_KEY = 'your_key_here';
```

## Notes & limits
- **Max ~30MB per file** (enforced in the app). Plenty for notes/PDFs.
- Files count against **your Drive's 15GB free quota**. All uploads land in one
  "MujConnects Uploads" folder so they're easy to review/clean.
- **Can uploads be compressed?** Images: yes — the app compresses them before
  upload (profile 30%, group chat 10%, DM 5%, per the product spec). Documents:
  no — PDFs/docx are already-compressed formats, so client-side "compression"
  would either do nothing or corrupt them; they're uploaded byte-perfect.
- If you ever redeploy the script (Deploy → Manage deployments → Edit → new
  version), the URL stays the same.
- To revoke everything at once: script editor → Deploy → Manage deployments →
  Archive. Uploads stop instantly.
