---
title: Passport photo size in pixels — 600×600, 413×531 and how to get them
description: How millimetres and inches turn into pixels, a table for common passport and ID photo sizes at 300 and 600 dpi, and why prints come out four times too big.
order: 2
---

Photo rules are written in inches or millimetres, but a file only has pixels.
The number that connects them is the **resolution in dpi** — dots per inch.

## The formula

```
pixels = inches × dpi
pixels = mm ÷ 25.4 × dpi
```

A US passport photo is 2 inches wide, so at 300 dpi it is 2 × 300 = 600 pixels.
A 35mm-wide photo at 300 dpi is 35 ÷ 25.4 × 300 = 413 pixels.

## Pixel table

| Size | mm | 300 dpi | 600 dpi |
|---|---|---|---|
| US passport & visa (2×2 in) | 50.8 × 50.8 | 600 × 600 | 1200 × 1200 |
| Passport 35×45 (UK, Schengen, Korea, Japan…) | 35 × 45 | 413 × 531 | 827 × 1063 |
| Résumé photo (Korea, Japan) | 30 × 40 | 354 × 472 | 709 × 945 |

## US digital photo: 600×600 to 1200×1200

For online passport renewal and for visa and DV Lottery applications, the State Department asks for a square photo
**at least 600×600 and no more than 1200×1200 pixels**. At 300 dpi a 2×2 photo is exactly 600×600; at 600 dpi it is exactly 1200×1200 — both ends of the allowed range.

Watch out for tools that round 2 inches up to 51mm: at 600 dpi that gives 1205 pixels, just over the limit.
The [ID photo cropper](../en) uses 50.8mm so both settings land inside it.

Visa and DV Lottery photos must also be JPEG and **240 KB or less** — see [passport photo file size](file-size).

## Which dpi to choose

- **Printing at a pharmacy or photo kiosk** — 300 dpi. More is not visible on a 2-inch print.
- **Uploading** — whatever the form asks for; if it says nothing, 300 dpi.
- 600 dpi packs twice as many dots into the same physical size. The print does not get bigger, only the file.

## Printed four times too big?

Besides the pixels, an image file carries a separate note saying what dpi it is meant for.
Many programs leave it blank or write 72, so the print software treats a 600-pixel photo as 72 dpi and prints it 8.3 inches wide.

The cropper writes the resolution you chose (300 or 600) into the file when it saves. Only the label changes — the pixels are untouched, so there is no quality loss.

## When the original is too small

If the part you cropped from the original has fewer pixels than the output needs, it has to be stretched and looks soft.
The cropper warns you when that happens. It usually means the face was small in the frame, or the photo was shrunk when it was sent through a messaging app — use the original file, or take the photo closer.
