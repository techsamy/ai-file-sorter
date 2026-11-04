import { CategoryDef } from '../types';

export const PHOTO_CATEGORIES: CategoryDef[] = [
  {
    key: "people",
    label: "Selfies & people",
    color: "#ec4899",
    prompts: [
      "a selfie of a person",
      "a portrait photo of a person",
      "a group photo of friends",
      "a person talking to the camera"
    ]
  },
  {
    key: "outfits",
    label: "Outfits & fashion",
    color: "#d946ef",
    prompts: [
      "a mirror selfie showing an outfit",
      "a person posing to show their clothes",
      "fashion clothing on a hanger",
      "shoes, watches and accessories"
    ]
  },
  {
    key: "food",
    label: "Food & drinks",
    color: "#f59e0b",
    prompts: [
      "a plate of food",
      "a cup of coffee in a cafe",
      "a restaurant meal on a table",
      "desserts and drinks"
    ]
  },
  {
    key: "travel",
    label: "Travel & places",
    color: "#3b82f6",
    prompts: [
      "a famous landmark",
      "a busy city street",
      "a view from an airplane window",
      "a hotel or resort pool"
    ]
  },
  {
    key: "nature",
    label: "Nature",
    color: "#10b981",
    prompts: [
      "a landscape with mountains",
      "a beach and the sea",
      "a green forest",
      "a sunset sky",
      "flowers and plants"
    ]
  },
  {
    key: "spaces",
    label: "Aesthetic spaces",
    color: "#8b5cf6",
    prompts: [
      "a stylish interior room",
      "a cozy aesthetic bedroom",
      "modern architecture",
      "minimal home decor"
    ]
  },
  {
    key: "vehicles",
    label: "Bikes & cars",
    color: "#ef4444",
    prompts: [
      "a motorcycle",
      "a car",
      "a motorbike on the road"
    ]
  },
  {
    key: "sport",
    label: "Sport & fitness",
    color: "#06b6d4",
    prompts: [
      "people playing a sport",
      "a gym workout",
      "running or cycling outdoors",
      "a football or cricket match"
    ]
  },
  {
    key: "hobby",
    label: "Music & hobbies",
    color: "#84cc16",
    prompts: [
      "a musical instrument",
      "a person playing guitar or piano",
      "a camera and photography gear",
      "a video game"
    ]
  },
  {
    key: "work",
    label: "Work & desk",
    color: "#64748b",
    prompts: [
      "a laptop on a desk",
      "an office workspace",
      "a business meeting",
      "a computer setup"
    ]
  },
  {
    key: "designs",
    label: "Designs & posters",
    color: "#c04ae0",
    prompts: [
      "a graphic design poster",
      "a social media post design",
      "an advertisement banner",
      "a flyer with text and graphics"
    ]
  },
  {
    key: "logos",
    label: "Logos & icons",
    color: "#6366f1",
    prompts: [
      "a company logo",
      "an icon on a plain background",
      "a brand logo design"
    ]
  },
  {
    key: "docs",
    label: "Docs & receipts",
    color: "#eab308",
    prompts: [
      "a photo of a printed document",
      "a receipt or invoice",
      "a scanned page of text",
      "an ID card or certificate"
    ]
  },
  {
    key: "screens",
    label: "Screenshots",
    videoLabel: "Screen recordings",
    color: "#0ea5e9",
    prompts: [
      "a screenshot of a website",
      "a screenshot of a mobile phone app",
      "a screenshot of a chat conversation",
      "a screenshot of computer software"
    ]
  },
  {
    key: "memes",
    label: "Memes & quotes",
    color: "#f43f5e",
    prompts: [
      "a meme with text",
      "a quote image with text",
      "a funny cartoon"
    ]
  }
];

export const OTHER_PHOTOS: CategoryDef = {
  key: "unsorted_photos",
  label: "Other photos",
  videoLabel: "Other videos",
  color: "#a1a1aa"
};

export const FILE_CATEGORIES: CategoryDef[] = [
  {
    key: "documents",
    label: "Documents",
    color: "#3b82f6",
    ext: ["pdf", "doc", "docx", "dot", "dotx", "txt", "rtf", "pages", "md", "odt", "wps", "wpd", "tex", "xps", "oxps"]
  },
  {
    key: "ebooks",
    label: "E-books",
    color: "#b45309",
    ext: ["epub", "mobi", "azw", "azw3", "djvu", "fb2"]
  },
  {
    key: "sheets",
    label: "Spreadsheets",
    color: "#10b981",
    ext: ["xls", "xlsx", "xlsm", "xlsb", "csv", "numbers", "ods", "tsv"]
  },
  {
    key: "slides",
    label: "Presentations",
    color: "#f97316",
    ext: ["ppt", "pptx", "pptm", "pps", "ppsx", "key", "odp"]
  },
  {
    key: "design",
    label: "Design files",
    color: "#a855f7",
    ext: ["psd", "ai", "fig", "sketch", "xd", "svg", "eps", "indd", "afdesign", "afphoto"]
  },
  {
    key: "voice",
    label: "Voice notes",
    color: "#f43f5e",
    ext: ["amr", "3ga", "caf"]
  },
  {
    key: "audio",
    label: "Audio & music",
    color: "#ec4899",
    ext: ["mp3", "wav", "m4a", "aac", "flac", "ogg", "oga", "aiff", "aif", "opus", "wma", "mid", "midi", "alac"]
  },
  {
    key: "archives",
    label: "Archives",
    color: "#d97706",
    ext: ["zip", "rar", "7z", "tar", "gz", "tgz", "bz2", "xz", "zst"]
  },
  {
    key: "installers",
    label: "Installers",
    color: "#64748b",
    ext: ["dmg", "pkg", "exe", "msi", "apk", "xapk", "aab", "iso", "deb", "rpm", "appimage"]
  },
  {
    key: "code",
    label: "Code & data",
    color: "#06b6d4",
    ext: ["js", "jsx", "ts", "tsx", "html", "css", "json", "xml", "py", "php", "sql", "yml", "yaml", "sh", "rs", "go", "java", "cpp", "c"]
  },
  {
    key: "fonts",
    label: "Fonts",
    color: "#8b5cf6",
    ext: ["ttf", "otf", "woff", "woff2"]
  },
  {
    key: "other_files",
    label: "Other files",
    color: "#71717a",
    ext: []
  }
];

export const SCREENSHOT_REGEX = /(screen ?shot|screenshot|screen[ _-]?recording|screenrecorder|screen[ _-]?capture|cleanshot|capture d.?écran|bildschirmfoto|captura de pantalla|^scr_|^snip|^scrnli|^shot[_ -])/i;
export const VOICE_REGEX = /(^ptt-|^aud-|whatsapp audio|voice|recording|^rec[_ -]|^call[_ -]|audio note|^record)/i;
export const TEMP_EXTENSIONS = ["crdownload", "part", "download", "partial", "tmp"];
export const PHOTO_EXTENSIONS = ["jpg", "jpeg", "png", "webp", "avif", "gif", "bmp", "tiff", "heic"];
export const VIDEO_EXTENSIONS = ["mp4", "mov", "webm", "mkv", "avi", "wmv", "m4v", "flv"];

