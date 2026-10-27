# Matrix Studio for the MI Matrix Display (MI-LNL62-999W)

A browser-based Bluetooth controller for the **Merkury Innovations MI Matrix Display,
model MI-LNL62-999W** — a **16×16 RGB LED pixel display**, also known as the
**Merkury Innovations Multicolor Matrix LED Display**.

Draw pixel art, send images and GIF animations, or show a live clock, date, and
local weather directly from your PC using Web Bluetooth.

**[Open Matrix Studio](https://semyri.github.io/matrix-studio/)**

## Supported hardware

| Detail | Device |
| --- | --- |
| Brand | Merkury Innovations |
| Product | MI Matrix Display / Multicolor Matrix LED Display |
| Model / manufacturer part number | **MI-LNL62-999W** |
| Resolution | 16×16, 256 RGB pixels |
| Connection | Bluetooth Low Energy (BLE); USB supplies power |
| Browser device name | `MI Matrix Display` |

The model number is documented by the
[upstream hardware protocol project](https://github.com/offe/mi-led-display).

## Use

1. Keep the display powered by USB.
2. Disconnect other controllers, including the old GitHub demo or the previous Sites controller.
3. Open Matrix Studio in a normal desktop **Edge or Chrome** tab.
4. Choose **Connect display**, select **MI Matrix Display**, and pair.
5. Draw, make text, import an image/GIF, or choose a preset; then **Send to display**.

No site login, server installation, or weather API key is required.

## Create

- 16×16 pixel editor with colors and eraser.
- Eight animation frames with playback and duplication.
- Static text and eight-frame scrolling text.
- PNG, JPG, WebP, and GIF import. GIF decoding depends on browser support.
- Browser-local artwork shelf, with project import/export for backups.
- Device power controls and adjustable gamma/brightness response.
- Temporary sending by default. **Keep after power off** explicitly replaces saved device content.

## Clock, date, and weather

Choose **Clock → Time + date + weather** for three rows:

- Top: HH:MM.
- Middle: MM/DD.
- Bottom: weather icon and temperature in the selected °F/°C unit.

The larger original clock is also available. The compact physical display omits the
temperature unit and AM/PM to save pixels; both are shown in the interface.

Each row has its own digit color. The time colon, date slash, and temperature degree
dot have independent color controls and default to contrasting white. Changes update
the preview immediately and are sent automatically when the live clock is running.
These color choices are saved in your browser along with the other clock settings.
Weather icons use natural multicolor palettes: yellow/orange sun, pale moon, gray
clouds, blue rain, white snow, and yellow lightning. Partly cloudy night conditions
show a moon with clouds. Icon colors stay independent of the temperature digit color.

Enter a city or US ZIP and choose **Update weather**. Settings stay in your browser.
A setup link can use `?zip=76084&unit=F` to configure that browser.

Time/date come from the PC running this page. Weather comes from
[Open-Meteo](https://open-meteo.com/) current model estimates. In live mode it is
refreshed every 15 minutes; conditions older than 45 minutes are replaced with an
unavailable indicator. Choose **Start live clock** to send updates automatically.
The page must stay open on a PC near the display with an active Bluetooth connection.
Closing it or letting the PC sleep stops updates.

## Hosting and development

This is a buildless static website served by GitHub Pages from `main` → `/docs`.
There is no backend, account system, or remote access to the display.
Browser Bluetooth requires HTTPS or localhost; opening the HTML as a local file
is not the supported way to run it.

For local development, serve `docs/` with any static HTTP server.

Run meaningful protocol and layout checks with Node:

```sh
node tests/protocol.test.mjs
node tests/dashboard.test.mjs
```

Edits pushed to `main` publish automatically through GitHub Pages.

## Protocol credit

Bluetooth framing and device commands are adapted from
[LostBeard/SpawnDev.MatrixLEDDisplay](https://github.com/LostBeard/SpawnDev.MatrixLEDDisplay)
(MIT). Its upstream license is preserved in `docs/THIRD_PARTY_LICENSE.txt`.
