# Security

Holy PDF processes documents on the user's device: neither the site nor the desktop app sends a file to a server. A bug that breaks this promise is the most serious issue this project can have.

## Report a vulnerability

Open a private report on GitHub: **Security** tab → **Report a vulnerability**. An email address will come with the site's launch.

Do not open a public issue for a vulnerability. Never attach a real document: a minimal synthetic PDF is enough.

You will get an acknowledgement within a week. There is no bounty program.

## What counts

In order of severity:

1. Anything that makes a document, or part of it, leave the device: a network request carrying file data, a third-party script, a storage that outlives the session without the user's action.
2. In the desktop app: reading or writing a file the user did not choose, or loading a remote page or script inside the app window.
3. Code execution or cross-site scripting from the content of a PDF (text, metadata, bookmarks, form fields, links).
4. A crafted PDF that corrupts the output of another file in the same session.
5. A crafted PDF that crashes the engine worker. The page is expected to recover; a crash of the whole page is a bug, not a vulnerability.

## What is out of scope

- Denial of service by a very large file: the browser's memory is the limit, and the site says so.
- Issues in third-party engines (PDFium, qpdf, OpenCV, Tesseract, libheif) that upstream already tracks. Report them upstream; tell us too if our use makes them worse.
