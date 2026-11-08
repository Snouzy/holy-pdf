---
section: guides
lang: en
topics: [administrative-documents, ocr, privacy, scan]
slug: how-to-make-a-pdf-searchable
title: How to Make a Scanned PDF Searchable
description: "Make a scanned PDF searchable with OCR in your browser. Follow the steps, check the new text layer, and learn the limits before sharing the file."
h1: How to make a scanned PDF searchable
lead: Run OCR on the scanned pages, download the new copy, then search it to check the recognized text.
author: Mathias
image: /articles/searchable-pdf/searchable-pdf-hero.webp
published: 2026-11-02
---

<figure class="article-visual article-visual--hero">
  <img src="/articles/searchable-pdf/searchable-pdf-hero.webp" alt="Illustration of OCR examining text on a scanned page" width="1600" height="900" loading="eager" decoding="async" />
  <figcaption>OCR adds computer-readable text without replacing the visible scan.</figcaption>
</figure>

To make a scanned PDF searchable, open [PDF OCR](/en/ocr-pdf), select **Choose a PDF file**, and then select **Read the text**. Holy PDF reads pages that contain little or no existing text and adds an invisible text layer. Download the new copy and test it by searching for a distinctive word from the document.

## Why a scanned PDF may not be searchable

A scan can look like a page full of words while containing only a picture. A PDF reader can display that picture, but it has no letters to find or copy.

Optical character recognition, or OCR, analyzes the page image and creates machine-readable text. The [US National Archives describes OCR](https://www.archives.gov/files/citizen-archivist/images/09-05-2019-ocr.pdf) as converting images with text into text a computer can read and search.

A searchable PDF keeps the scan as the visible page and adds a machine-readable text layer. You can use Find, select a passage, or copy words into another document. OCR does not guarantee that every word is correct, so check important names, dates, and numbers against the page image.

## Run OCR before checking the downloaded PDF

1. If a page is sideways, fix it first with [Rotate a PDF](/en/rotate-pdf). Download the rotated copy.
2. Open [PDF OCR](/en/ocr-pdf) and select **Choose a PDF file**.
3. Select **Read the text**. The status reads **Reading the pages…** while OCR runs.
4. When the result is ready, select **Download the PDF**.
5. Open the downloaded copy in your usual PDF reader and search for a word that appears on a scanned page.

<figure class="article-visual">
  <picture>
    <source media="(max-width: 40rem)" srcset="/articles/searchable-pdf/holy-pdf-ocr-ui-en-mobile.webp" width="390" height="900" />
    <img src="/articles/searchable-pdf/holy-pdf-ocr-ui-en.webp" alt="The English Holy PDF OCR tool with a scanned sample PDF ready for text recognition" width="1400" height="900" loading="lazy" decoding="async" />
  </picture>
  <figcaption>The current OCR tool reads one PDF at a time in English and French.</figcaption>
</figure>

The file is processed in your browser and is not uploaded to Holy PDF. [Your PDFs stay on your device](/en/blog/your-pdfs-stay-on-your-device) explains the local processing model.

## Check that the new PDF is searchable

Do not assume that a completed OCR run means every word was recognized correctly. Check the downloaded file itself:

- press Ctrl+F on Windows or Command+F on a Mac;
- search for a distinctive word on more than one page;
- select and copy a sentence, then compare it with the scan;
- check names, reference numbers, dates, and accented letters carefully;
- confirm that every page still looks like the original.

Search can find a correctly recognized word even though the invisible text is not perfectly aligned with every letter. If the copied text contains mistakes, the OCR text layer contains those mistakes too. Keep the original scan and use the searchable copy for finding and copying text.

## What Holy PDF changes

Holy PDF leaves the visible page content in place. It renders each page selected for OCR, recognizes lines of text, and writes those lines back as invisible text over the scan. Engine tests verify that the added layer remains invisible and is positioned correctly at all four PDF page rotations.

The tool checks how much text each page already contains. It runs OCR only on pages with fewer than 50 existing characters. This avoids duplicating a normal digital text layer while still allowing a scanned page with a page number, stamp, or short fax header to be read.

If every page already has at least 50 characters, the tool reports **Every page already has its text: there is nothing to read.** It does not rewrite or correct that existing text.

## Get better OCR results

Start with a clear, upright scan. Small type, blur, shadows, low contrast, skewed pages, and marks over letters can all reduce recognition accuracy.

OCR can handle a page whose PDF rotation is set correctly. A scan that remains sideways within the page image is different: the current recognition engine does not reliably detect that orientation. Rotate the PDF before OCR and make sure the words read from left to right on screen.

The English tool recognizes both English and French in the same pass. It does not offer a language selector. Documents in other languages may lose accents or produce incorrect words.

## Limits to know

- **English and French only.** The English page recognizes these two languages. Other languages are not supported here.
- **Pages with 50 or more existing characters are skipped.** A page may therefore keep an incomplete or incorrect text layer instead of being read again.
- **No editing of existing text.** OCR adds searchable text to scanned pages; it does not turn the PDF into an editable word-processing document or repair text already in the file.
- **No cancel button during recognition.** Once reading starts, let it finish or close the page.
- **Sideways content may be recognized poorly.** Correct the orientation before running OCR.
- **Recognition is not transcription.** The invisible layer may contain errors even when the page still looks right.
- **Some characters are simplified.** A character that the PDF's standard font cannot represent may lose its accent or disappear.
- **Annotations are part of the rendered image.** Their visible words may be recognized with the page text.

If the tool cannot recognize any text on the pages it checks, it reports **No text could be read in the pages.** Try a clearer, straighter scan rather than repeatedly processing the same image.

## Searchable does not mean editable

OCR makes words available to search and selection. It does not replace the scanned page with freshly typeset text, and it does not let you revise the original sentences in place.

If you need to add a note or type an answer over a scan, use [Edit a PDF](/en/edit-pdf). If you need a Word document rather than a searchable PDF, use [PDF to Word](/en/pdf-to-word) and check the converted text and layout carefully.

## Frequently asked questions

### How do I make a PDF document searchable?

Run OCR on the scanned PDF, download the resulting copy, and test it with your PDF reader's Find command. In Holy PDF, choose the file, select **Read the text**, and then select **Download the PDF**.

### Can I make a scanned PDF searchable for free?

Yes. [Holy PDF's OCR tool](/en/ocr-pdf) is free and does not require an account. The recognition runs in your browser, on your device.

### Does OCR change how the PDF looks?

Holy PDF keeps the scanned page visible and adds invisible text over it. The purpose is to preserve the page's appearance while enabling searching and copying. Check the downloaded copy before relying on it.

### Why is my PDF still not searchable after OCR?

The scan may be too unclear to read, the page may be sideways inside its image, or the words may be in an unsupported language. A page with 50 or more existing characters is skipped, even if that text layer is incomplete.

### Can OCR fix text that is already wrong?

Not in this workflow. Holy PDF skips pages with 50 or more existing characters and does not edit their text layer. OCR here is for scanned pages that have little or no text.

## Make your scanned PDF searchable now

Open [PDF OCR](/en/ocr-pdf), choose the scan, and select **Read the text**. Download the new copy, search it, and keep the original alongside it.

## Official sources

- [Holy PDF Web OCR specification](https://github.com/Snouzy/holy-pdf/blob/main/wiki/specs/2026-10-02-web-ocr-design.md)
- [Adobe Acrobat Help — Recognize text in scanned documents](https://helpx.adobe.com/acrobat/desktop/create-documents/scan-documents-to-pdfs/recognize-text.html)
- [US National Archives — Optical Character Recognition](https://www.archives.gov/files/citizen-archivist/images/09-05-2019-ocr.pdf)
