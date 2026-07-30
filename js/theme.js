/* ============================================================
   TGC Rongai Campus Tracker — Theming
   Color presets are just different values for the same CSS custom
   properties already used throughout styles.css, applied at runtime
   via documentElement.style.setProperty(). Logo/branding works the
   same way: a data URL (or the bundled default) swapped into the
   topbar <img> and the favicon links.
   ============================================================ */

const DEFAULT_LOGO_PATH = "assets/logo-default.png";

const THEME_PRESETS = {
  blue_purple: {
    label: "Blue & Purple (default)",
    swatch: ["#4F5FD1", "#9B59E0", "#EEF1FC"],
    vars: {
      "--sky": "#EEF1FC", "--sky-mid": "#DDE3F8", "--sky-card": "#FFFFFF",
      "--blue": "#4F5FD1", "--blue-deep": "#3A3FA0", "--navy": "#201B4D",
      "--yellow": "#9B59E0", "--yellow-soft": "#ECE0FB", "--gold": "#7C3AED",
      "--red-flag": "#E0245E", "--red-soft": "#FBE1EA", "--green-ok": "#16A37A",
      "--line": "#CDD2F2",
    },
  },
  sky_yellow: {
    label: "Sky & Yellow (classic)",
    swatch: ["#1F7AC7", "#FFC93C", "#EAF6FF"],
    vars: {
      "--sky": "#EAF6FF", "--sky-mid": "#D3ECFB", "--sky-card": "#FFFFFF",
      "--blue": "#1F7AC7", "--blue-deep": "#145A96", "--navy": "#0F3352",
      "--yellow": "#FFC93C", "--yellow-soft": "#FFF3D2", "--gold": "#E8960C",
      "--red-flag": "#E2544B", "--red-soft": "#FBE1DF", "--green-ok": "#2E9E5B",
      "--line": "#C9E2F3",
    },
  },
  royal_violet: {
    label: "Royal Violet",
    swatch: ["#7C4DDB", "#4C6FE0", "#F3EEFC"],
    vars: {
      "--sky": "#F3EEFC", "--sky-mid": "#E6D9F7", "--sky-card": "#FFFFFF",
      "--blue": "#7C4DDB", "--blue-deep": "#5B32B0", "--navy": "#241640",
      "--yellow": "#4C6FE0", "--yellow-soft": "#E1E8FB", "--gold": "#3550B8",
      "--red-flag": "#D6336C", "--red-soft": "#FBE1EC", "--green-ok": "#1E9E74",
      "--line": "#DAC7F2",
    },
  },
  slate_mono: {
    label: "Slate Monochrome",
    swatch: ["#2B2F3A", "#5865E8", "#F4F5F7"],
    vars: {
      "--sky": "#F4F5F7", "--sky-mid": "#E4E6EA", "--sky-card": "#FFFFFF",
      "--blue": "#2B2F3A", "--blue-deep": "#14161C", "--navy": "#0B0C10",
      "--yellow": "#5865E8", "--yellow-soft": "#E9EAFB", "--gold": "#3F49B0",
      "--red-flag": "#C22B4E", "--red-soft": "#F7DFE4", "--green-ok": "#29866B",
      "--line": "#D6D8DD",
    },
  },
};

function applyColorPreset(key) {
  const preset = THEME_PRESETS[key] || THEME_PRESETS.blue_purple;
  const root = document.documentElement;
  Object.entries(preset.vars).forEach(([varName, value]) => root.style.setProperty(varName, value));
}

// Uploaded logos can be any aspect ratio / have lots of surrounding
// whitespace, which looks poor shrunk straight down to favicon size.
// This draws it centered, contained, and padded onto a small white square
// canvas instead, so the favicon stays legible regardless of the source image.
function generateSquareFavicon(dataUrl, size, callback) {
  const img = new Image();
  img.onload = () => {
    try {
      const canvas = document.createElement("canvas");
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext("2d");
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, size, size);
      const scale = Math.min(size / img.width, size / img.height) * 0.86; // slight padding
      const w = img.width * scale, h = img.height * scale;
      ctx.drawImage(img, (size - w) / 2, (size - h) / 2, w, h);
      callback(canvas.toDataURL("image/png"));
    } catch (e) {
      callback(dataUrl); // fallback: use the original image as-is
    }
  };
  img.onerror = () => callback(dataUrl);
  img.src = dataUrl;
}

// Swap the topbar logo + favicon links to a custom uploaded logo, or back
// to the bundled default if none is set.
function applyBranding(settings) {
  const customLogo = settings && settings.logoDataUrl;
  const img = document.getElementById("brandLogoImg");
  if (img) img.src = customLogo || DEFAULT_LOGO_PATH;

  const iconEl = document.getElementById("faviconIcon");
  const appleEl = document.getElementById("faviconApple");
  if (customLogo) {
    generateSquareFavicon(customLogo, 128, (faviconUrl) => {
      if (iconEl) iconEl.href = faviconUrl;
      if (appleEl) appleEl.href = faviconUrl;
    });
  } else {
    if (iconEl) iconEl.href = "assets/favicon-32.png";
    if (appleEl) appleEl.href = "assets/apple-touch-icon.png";
  }
}
