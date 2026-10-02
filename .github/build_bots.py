"""
Builds bots/data.json from the folders inside bots/files/.

One folder per character. The folder name is the character's id
(lowercase-with-hyphens, e.g. character-name) and is also what shows up
in share links (?bot=character-name).

  bots/files/ayaka-ishikawa/
      anything.png    REQUIRED  the card image (exactly one .png in the folder)
      anything.json   REQUIRED  the card data  (exactly one .json besides meta.json)
      meta.json       optional  portal-only info: series, altName, altLabel, previewText...
      scripts/        optional  every file in here becomes a downloadable script
      extra/          optional  every image in here becomes an extra image

Run locally from the repo root to test:   python .github/build_bots.py
Never edit bots/data.json by hand; it is rewritten every time this runs.
"""
import json
import re
import subprocess
import sys
from collections import Counter
from datetime import date
from pathlib import Path
from urllib.parse import quote

BOTS_DIR = Path("bots")
FILES_DIR = BOTS_DIR / "files"
IMAGE_TYPES = {".png", ".jpg", ".jpeg", ".webp", ".gif"}

errors = []    # problems that stop the build (so a broken index is never published)
warnings = []  # things worth knowing, but not fatal


# ---------- helpers ----------

def web_path(path):
    """File on disk -> URL path relative to /bots/ (spaces etc. get encoded)."""
    return quote(path.relative_to(BOTS_DIR).as_posix())


def natural_key(path):
    """Sort key so that i2 comes before i10."""
    return [int(t) if t.isdigit() else t.lower() for t in re.split(r"(\d+)", path.name)]


def load_json(path):
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, UnicodeDecodeError) as e:
        errors.append(f"{path}: not valid JSON ({e})")
        return None


def date_first_committed(path):
    """Date the file first appeared in git history (follows renames and moves)."""
    try:
        out = subprocess.run(
            ["git", "log", "--follow", "--format=%as", "--", str(path)],
            capture_output=True, text=True).stdout.split()
    except OSError:  # git not installed
        return ""
    return out[-1] if out else ""


def strip_html(notes):
    return re.sub(r"<[^>]*>", "", notes or "")


def fallback_preview(notes):
    """Safety net when meta.json has no previewText: start of creator_notes, tags stripped."""
    text = " ".join(strip_html(notes).split())
    return text[:160] + ("…" if len(text) > 160 else "")


# ---------- one character ----------

def build_bot(folder):
    files = [p for p in folder.iterdir() if p.is_file()]
    pngs = [p for p in files if p.suffix.lower() == ".png"]
    cards = [p for p in files if p.suffix.lower() == ".json" and p.name != "meta.json"]

    if len(pngs) != 1 or len(cards) != 1:
        errors.append(
            f"{folder}: needs exactly one .png and one .json in the folder "
            f"(found {len(pngs)} png, {len(cards)} json; meta.json doesn't count)")
        return None
    png, card = pngs[0], cards[0]

    raw = load_json(card)
    meta_file = folder / "meta.json"
    meta = load_json(meta_file) if meta_file.exists() else {}
    if raw is None or meta is None:
        return None
    data = raw.get("data", raw)  # V2/V3 cards nest everything under "data"

    scripts = [{"name": p.name, "path": web_path(p)}
               for p in sorted((folder / "scripts").glob("*"), key=natural_key)
               if p.is_file()]
    extras = [web_path(p)
              for p in sorted((folder / "extras").glob("*"), key=natural_key)
              if p.is_file() and p.suffix.lower() in IMAGE_TYPES]

    added = meta.get("dateAdded") or date_first_committed(card) or date.today().isoformat()

    preview = meta.get("previewText")
    if not preview:
        warnings.append(f"{folder.name}: no previewText in meta.json, using start of creator_notes")
        preview = fallback_preview(data.get("creator_notes"))
    if isinstance(preview, list):
        preview = " ".join(preview)

    # fullDescription is raw HTM, taken from creator_notes, otherwise taken from meta.json.
    full_description = meta.get("fullDescription")
    if full_description is None:
        full_description = data.get("creator_notes") or ""
    if isinstance(full_description, list):   # old array-of-paragraphs format, still supported
        full_description = "".join(f"<p>{p}</p>" for p in full_description)

    return {
        "id": folder.name,
        "name": data.get("name", folder.name),
        "altName": meta.get("altName", ""),
        "altGroup": meta.get("altGroup", ""),
        "altLabel": meta.get("altLabel", ""),
        "series": meta.get("series", ""),
        "tags": data.get("tags", []),
        "previewText": preview,
        "fullDescription": full_description,
        "image": web_path(png),
        "card": web_path(card),
        "scripts": scripts,
        "extraImages": extras,
        "dateAdded": added,
        "dateCreated": meta.get("dateCreated") or added,
        "legacy": meta.get("legacy", False),
        "isAlt": meta.get("isAlt", False),
    }


# ---------- everything ----------

def main():
    if not FILES_DIR.is_dir():
        sys.exit(f"{FILES_DIR}/ not found. Run this from the repo root.")

    bots = []
    for folder in sorted(p for p in FILES_DIR.iterdir() if p.is_dir()):
        bot = build_bot(folder)
        if bot:
            bots.append(bot)

    # "alts" is worked out, not typed: 2+ characters sharing an altGroup
    groups = Counter(b["altGroup"] for b in bots if b["altGroup"])
    for b in bots:
        b["alts"] = bool(b["altGroup"]) and groups[b["altGroup"]] > 1

    for w in warnings:
        print(f"warning: {w}")
    if errors:
        for e in errors:
            print(f"ERROR: {e}")
        sys.exit(1)  # data.json is left untouched, so the live site keeps working

    (BOTS_DIR / "data.json").write_text(
        json.dumps({"bots": bots}, indent=2, ensure_ascii=False), encoding="utf-8")
    print(f"Built bots/data.json with {len(bots)} character(s).")


if __name__ == "__main__":
    main()