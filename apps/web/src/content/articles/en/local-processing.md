---
section: blog
lang: en
topics: [browser-processing, privacy]
slug: your-pdfs-stay-on-your-device
title: How Holy PDF works on your PDFs without uploading
description: "PDFium in WebAssembly, a Worker, and no file uploaded: how Holy PDF processes your PDFs in the browser, and how to check it yourself."
h1: How Holy PDF works on your PDFs without uploading them
lead: Your files stay on your device. Here is how, and how to check it yourself.
published: 2026-10-02
updated: 2026-10-06
---

Many online PDF tools work like this: your file goes to their server, it is processed there, then the result comes back. Holy PDF does the opposite: the engine comes to your file.

## The engine comes to your file

When you drop your first file, your browser downloads a PDF engine: PDFium, the open source engine that also displays PDFs in Chrome. It is compiled to WebAssembly, a format the browser runs fast.

The browser reads your file on your device and hands it to this engine. The engine runs in a Worker, a separate thread: the page stays smooth while it works. The result is built in memory, then the browser offers it to you as a download. At no point does your file go over the network.

## What the network still carries

The site uses the network to send you its pages and its engine, never to receive your files. Your browser downloads:

- the pages of the site, their styles and their fonts;
- the PDF engine, a file of about 4.6 MB before compression, when you drop your first file;
- if you accepted audience measurement, the Google Analytics script, which then receives the pages viewed and the name of the tool used, never your file.

Each request tells the server which page you ask for, as on any site. None of them contains your files.

## Check it yourself

1. Open a tool, for example [Merge PDF files](/en/merge-pdf).
2. Open the browser's developer tools (F12 on Windows, Option + Command + I on a Mac), then the Network tab. In Safari, first turn on the features for web developers, in Settings, Advanced tab.
3. Drop a PDF and run the tool.

You will see the engine and files of the site arrive, but no request that sends your document. Lines that start with "blob:" are files made inside your browser, such as the thumbnails and the result: they do not go over the network.

## Why it matters

An ID card, a payslip, a tax notice: these are often the files you need to merge or make lighter. With Holy PDF, they stay with you.
