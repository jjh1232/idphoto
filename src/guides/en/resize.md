---
title: How to resize a photo to passport size (without stretching your face)
description: Turn a phone photo into a 2×2 inch US passport photo or a 35×45mm photo. Why you crop instead of resize, and the exact steps.
order: 1
---

Resizing a photo to passport size is really **cropping, not resizing**.
If you type new width and height numbers into Paint or a photo app, the picture gets squeezed to fit,
and your face comes out wider or longer than it is.

## Why stretching goes wrong

Phone photos are usually 3:4 or 9:16. A US passport photo is 1:1 (2×2 inches).
Most other passports — UK, Schengen, Korea, Japan — are 35×45mm, which is 7:9.
Force one shape into another and the difference goes straight into your face.

So the order is fixed:

1. **Crop to the right shape first** — a frame locked to the target ratio, with your face placed inside it.
2. **Then set the size** — scale that crop to the pixel count the print resolution needs.

Doing these as two separate steps is where the ratio slips. A frame that is locked to the ratio from the start avoids it.

## Common sizes

| Use | Width × height | Pixels at 300 dpi |
|---|---|---|
| US passport & visa | 2 × 2 in (50.8mm) | 600 × 600 |
| Passport, 35×45 (UK, Schengen, Korea, Japan…) | 35 × 45 mm | 413 × 531 |
| Résumé photo (Korea, Japan) | 30 × 40 mm | 354 × 472 |

Where those pixel numbers come from is in [passport photo size in pixels](pixels).

## Step by step

1. Open the [ID photo cropper](../en) and drop in your photo, tap to choose one, or paste it with Ctrl+V.
2. Pick the size under **Size**. The frame locks to that ratio.
3. Drag inside the frame to move it, drag a corner to resize it. Passport sizes show guide lines for the top of the head and the chin; US sizes also show the eye line.
4. Leave **Print resolution** at 300 dpi unless you have a reason not to.
5. Press **Download**. You get a JPG at exactly the chosen size.

If your size is not in the list, choose **Enter your own size** and enter width and height in millimetres (2 inches = 50.8mm).

## On a phone

It works in the phone's browser — nothing to install, and the photo is never uploaded; the cropping happens on the phone.

One catch: **iPhone photos are HEIC by default**, and only Safari can open them.
If Chrome refuses the file, use Safari, or set Settings → Camera → Formats to **Most Compatible** and use a photo taken after that.

## Passport photos: crop only

The US State Department rejects photos that have been digitally altered, and since January 2026 it rejects AI-edited photos automatically.
**Cropping and positioning are not alterations; changing brightness or contrast is.**
So when you pick a passport or visa size, the brightness and contrast controls lock. If the photo is too dark or the background is not plain white, the only fix that will be accepted is a retake.
Résumé photos have no such rule and can be adjusted freely.
