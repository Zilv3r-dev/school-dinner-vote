#!/usr/bin/env python3
import json
import os
import sqlite3
from datetime import datetime
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, unquote, urlparse

HOST = os.environ.get("HOST", "127.0.0.1")
PORT = int(os.environ.get("PORT", "8000"))
BASE_DIR = Path(__file__).resolve().parent
DB_PATH = BASE_DIR / "school_meals.db"
ADMIN_PASSWORD = os.environ.get("ADMIN_PASSWORD", "")
METRICS = ["Calories", "Protein", "Carbs", "Fat", "Fiber"]
DEFAULT_MEAT_LABEL = "With Meat"

DEFAULT_POLL_OPTIONS = [
    "Mushroom Soup",
    "Plant-Based Meatballs",
    "Chickpea Curry",
    "Veggie Taco Bowl",
]

DEFAULT_NUTRITION_DATA = {
    "Mushroom Soup": {
        "meat": {"Calories": 340, "Protein": "24g", "Carbs": "19g", "Fat": "16g", "Fiber": "2g"},
        "veggie": {"Calories": 280, "Protein": "12g", "Carbs": "30g", "Fat": "10g", "Fiber": "6g"},
    },
    "Plant-Based Meatballs": {
        "meat": {"Calories": 460, "Protein": "31g", "Carbs": "33g", "Fat": "22g", "Fiber": "3g"},
        "veggie": {"Calories": 420, "Protein": "22g", "Carbs": "38g", "Fat": "18g", "Fiber": "8g"},
    },
    "Chickpea Curry": {
        "meat": {"Calories": 510, "Protein": "28g", "Carbs": "45g", "Fat": "21g", "Fiber": "5g"},
        "veggie": {"Calories": 430, "Protein": "17g", "Carbs": "51g", "Fat": "14g", "Fiber": "11g"},
    },
    "Veggie Taco Bowl": {
        "meat": {"Calories": 540, "Protein": "34g", "Carbs": "41g", "Fat": "24g", "Fiber": "6g"},
        "veggie": {"Calories": 470, "Protein": "19g", "Carbs": "49g", "Fat": "17g", "Fiber": "12g"},
    },
}


def get_conn():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def init_db():
    conn = get_conn()
    cur = conn.cursor()
    cur.execute(
        """
        CREATE TABLE IF NOT EXISTS votes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            student_id TEXT NOT NULL UNIQUE,
            option_name TEXT NOT NULL,
            created_at TEXT NOT NULL
        )
        """
    )
    cur.execute(
        """
        CREATE TABLE IF NOT EXISTS suggestions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            student_id TEXT NOT NULL,
            day_key TEXT NOT NULL,
            suggestion_text TEXT NOT NULL,
            created_at TEXT NOT NULL,
            UNIQUE(student_id, day_key)
        )
        """
    )
    cur.execute(
        """
        CREATE TABLE IF NOT EXISTS poll_config (
            id INTEGER PRIMARY KEY CHECK (id = 1),
            options_json TEXT NOT NULL,
            nutrition_json TEXT NOT NULL,
            meat_label TEXT NOT NULL DEFAULT 'With Meat',
            updated_at TEXT NOT NULL
        )
        """
    )
    cols = {row["name"] for row in cur.execute("PRAGMA table_info(poll_config)").fetchall()}
    if "meat_label" not in cols:
        cur.execute("ALTER TABLE poll_config ADD COLUMN meat_label TEXT NOT NULL DEFAULT 'With Meat'")

    existing = cur.execute("SELECT 1 FROM poll_config WHERE id = 1").fetchone()
    if not existing:
        cur.execute(
            """
            INSERT INTO poll_config (id, options_json, nutrition_json, meat_label, updated_at)
            VALUES (1, ?, ?, ?, ?)
            """,
            (
                json.dumps(DEFAULT_POLL_OPTIONS),
                json.dumps(DEFAULT_NUTRITION_DATA),
                DEFAULT_MEAT_LABEL,
                datetime.now().isoformat(timespec="seconds"),
            ),
        )

    conn.commit()
    conn.close()


def today_key():
    now = datetime.now()
    return f"{now.year:04d}-{now.month:02d}-{now.day:02d}"


def get_poll_config(conn):
    row = conn.execute(
        "SELECT options_json, nutrition_json, meat_label, updated_at FROM poll_config WHERE id = 1"
    ).fetchone()

    if not row:
        return {
            "pollOptions": DEFAULT_POLL_OPTIONS,
            "nutrition": DEFAULT_NUTRITION_DATA,
            "meatLabel": DEFAULT_MEAT_LABEL,
            "updatedAt": None,
        }

    options = json.loads(row["options_json"])
    nutrition = json.loads(row["nutrition_json"])

    # Backward compatibility: older configs may not have per-option meat labels.
    for option in options:
        entry = nutrition.get(option, {})
        if isinstance(entry, dict) and "meatLabel" not in entry:
            entry["meatLabel"] = row["meat_label"] or DEFAULT_MEAT_LABEL
            nutrition[option] = entry
    return {
        "pollOptions": options,
        "nutrition": nutrition,
        "meatLabel": row["meat_label"] or DEFAULT_MEAT_LABEL,
        "updatedAt": row["updated_at"],
    }


def poll_counts(conn, poll_options):
    result = {name: 0 for name in poll_options}
    rows = conn.execute("SELECT option_name, COUNT(*) AS c FROM votes GROUP BY option_name").fetchall()
    for row in rows:
        option_name = row["option_name"]
        if option_name in result:
            result[option_name] = row["c"]
    return result


def recent_suggestions(conn, limit=8):
    rows = conn.execute(
        """
        SELECT day_key, suggestion_text
        FROM suggestions
        ORDER BY id DESC
        LIMIT ?
        """,
        (limit,),
    ).fetchall()
    return [{"date": r["day_key"], "text": r["suggestion_text"]} for r in rows]


def ensure_admin_access(handler):
    if not ADMIN_PASSWORD:
        handler._send_json({"error": "Admin password is not configured on server"}, status=503)
        return False

    provided = handler.headers.get("X-Admin-Key", "")
    if provided != ADMIN_PASSWORD:
        handler._send_json({"error": "Unauthorized admin access"}, status=401)
        return False

    return True


def validate_config(options, nutrition):
    if not isinstance(options, list):
        return "pollOptions must be a list"

    cleaned = []
    seen = set()
    for option in options:
        if not isinstance(option, str):
            return "Each poll option must be text"
        name = option.strip()
        if not name:
            return "Poll option names cannot be empty"
        if len(name) > 80:
            return "Poll option names must be 80 characters or less"
        key = name.lower()
        if key in seen:
            return "Poll options must be unique"
        seen.add(key)
        cleaned.append(name)

    if len(cleaned) < 2:
        return "At least 2 poll options are required"
    if len(cleaned) > 12:
        return "At most 12 poll options are allowed"

    if not isinstance(nutrition, dict):
        return "nutrition must be an object"

    normalized = {}
    for option in cleaned:
        entry = nutrition.get(option)
        if not isinstance(entry, dict):
            return f"Missing nutrition data for: {option}"

        meat = entry.get("meat")
        veggie = entry.get("veggie")
        if not isinstance(meat, dict) or not isinstance(veggie, dict):
            return f"Nutrition for {option} must include meat and veggie sections"

        meat_label = str(entry.get("meatLabel", DEFAULT_MEAT_LABEL)).strip() or DEFAULT_MEAT_LABEL
        if len(meat_label) > 40:
            return f"Meat label for {option} must be 40 characters or less"

        normalized[option] = {"meatLabel": meat_label, "meat": {}, "veggie": {}}
        for metric in METRICS:
            if metric not in meat or metric not in veggie:
                return f"Nutrition for {option} must include {metric} in both columns"
            normalized[option]["meat"][metric] = str(meat[metric]).strip()
            normalized[option]["veggie"][metric] = str(veggie[metric]).strip()

    return {"pollOptions": cleaned, "nutrition": normalized}


class Handler(BaseHTTPRequestHandler):
    def _send_json(self, payload, status=200):
        body = json.dumps(payload).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def _send_bytes(self, data, content_type, status=200):
        self.send_response(status)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def _read_json(self):
        length = int(self.headers.get("Content-Length", "0"))
        raw = self.rfile.read(length) if length > 0 else b"{}"
        try:
            return json.loads(raw.decode("utf-8"))
        except json.JSONDecodeError:
            return None

    def _serve_static(self, path):
        if path == "/":
            path = "/index.html"
        safe = unquote(path.lstrip("/"))
        full = (BASE_DIR / safe).resolve()

        if not str(full).startswith(str(BASE_DIR)) or not full.is_file():
            self._send_json({"error": "Not found"}, status=404)
            return

        suffix = full.suffix.lower()
        content_type = {
            ".html": "text/html; charset=utf-8",
            ".js": "text/javascript; charset=utf-8",
            ".css": "text/css; charset=utf-8",
            ".json": "application/json; charset=utf-8",
        }.get(suffix, "application/octet-stream")

        self._send_bytes(full.read_bytes(), content_type)

    def do_HEAD(self):
        parsed = urlparse(self.path)
        if parsed.path in ("/", "/index.html", "/admin.html"):
            self.send_response(200)
        else:
            self.send_response(404)
        self.end_headers()

    def do_GET(self):
        parsed = urlparse(self.path)
        path = parsed.path

        if path == "/api/bootstrap":
            params = parse_qs(parsed.query)
            device_id = (params.get("device_id", [""])[0] or "").strip()

            conn = get_conn()
            config = get_poll_config(conn)
            poll_options = config["pollOptions"]
            nutrition = config["nutrition"]
            counts = poll_counts(conn, poll_options)
            total_votes = sum(counts.values())

            user_vote = None
            suggestion_allowed = None
            if device_id:
                row = conn.execute(
                    "SELECT option_name FROM votes WHERE student_id = ?",
                    (device_id,),
                ).fetchone()
                user_vote = row["option_name"] if row and row["option_name"] in poll_options else None

                has_today_suggestion = conn.execute(
                    "SELECT 1 FROM suggestions WHERE student_id = ? AND day_key = ? LIMIT 1",
                    (device_id, today_key()),
                ).fetchone()
                suggestion_allowed = has_today_suggestion is None

            payload = {
                "pollOptions": poll_options,
                "pollCounts": counts,
                "totalVotes": total_votes,
                "userVote": user_vote,
                "nutrition": nutrition,
                "today": today_key(),
                "suggestionAllowed": suggestion_allowed,
                "recentSuggestions": recent_suggestions(conn),
            }
            conn.close()
            self._send_json(payload)
            return

        if path == "/api/admin/config":
            if not ensure_admin_access(self):
                return

            conn = get_conn()
            config = get_poll_config(conn)
            conn.close()
            self._send_json(config)
            return

        self._serve_static(path)

    def do_POST(self):
        parsed = urlparse(self.path)

        if parsed.path == "/api/vote":
            body = self._read_json()
            if body is None:
                self._send_json({"error": "Invalid JSON"}, status=400)
                return

            device_id = (body.get("device_id") or "").strip()
            option = (body.get("option") or "").strip()

            if not device_id:
                self._send_json({"error": "device_id is required"}, status=400)
                return

            conn = get_conn()
            poll_options = get_poll_config(conn)["pollOptions"]
            if option not in poll_options:
                conn.close()
                self._send_json({"error": "Invalid option"}, status=400)
                return

            existing = conn.execute(
                "SELECT option_name FROM votes WHERE student_id = ?",
                (device_id,),
            ).fetchone()
            if existing:
                conn.close()
                self._send_json(
                    {
                        "error": "This device already voted",
                        "userVote": existing["option_name"],
                    },
                    status=409,
                )
                return

            conn.execute(
                "INSERT INTO votes (student_id, option_name, created_at) VALUES (?, ?, ?)",
                (device_id, option, datetime.now().isoformat(timespec="seconds")),
            )
            conn.commit()
            conn.close()
            self._send_json({"ok": True})
            return

        if parsed.path == "/api/suggestion":
            body = self._read_json()
            if body is None:
                self._send_json({"error": "Invalid JSON"}, status=400)
                return

            device_id = (body.get("device_id") or "").strip()
            text = (body.get("text") or "").strip()

            if not device_id:
                self._send_json({"error": "device_id is required"}, status=400)
                return
            if not text:
                self._send_json({"error": "Suggestion text is required"}, status=400)
                return
            if len(text) > 140:
                self._send_json({"error": "Suggestion must be 140 chars or less"}, status=400)
                return

            conn = get_conn()
            existing = conn.execute(
                "SELECT 1 FROM suggestions WHERE student_id = ? AND day_key = ? LIMIT 1",
                (device_id, today_key()),
            ).fetchone()
            if existing:
                conn.close()
                self._send_json(
                    {"error": "Only one suggestion per day is allowed"},
                    status=409,
                )
                return

            conn.execute(
                """
                INSERT INTO suggestions (student_id, day_key, suggestion_text, created_at)
                VALUES (?, ?, ?, ?)
                """,
                (device_id, today_key(), text, datetime.now().isoformat(timespec="seconds")),
            )
            conn.commit()
            conn.close()
            self._send_json({"ok": True})
            return

        if parsed.path == "/api/admin/config":
            if not ensure_admin_access(self):
                return

            body = self._read_json()
            if body is None:
                self._send_json({"error": "Invalid JSON"}, status=400)
                return

            options = body.get("pollOptions")
            nutrition = body.get("nutrition")
            reset_votes = bool(body.get("resetVotes", True))

            validated = validate_config(options, nutrition)
            if isinstance(validated, str):
                self._send_json({"error": validated}, status=400)
                return

            conn = get_conn()
            conn.execute(
                """
                UPDATE poll_config
                SET options_json = ?, nutrition_json = ?, meat_label = ?, updated_at = ?
                WHERE id = 1
                """,
                (
                    json.dumps(validated["pollOptions"]),
                    json.dumps(validated["nutrition"]),
                    DEFAULT_MEAT_LABEL,
                    datetime.now().isoformat(timespec="seconds"),
                ),
            )

            if reset_votes:
                conn.execute("DELETE FROM votes")

            conn.commit()
            updated = get_poll_config(conn)
            conn.close()

            message = "Settings saved. Votes were reset for the new poll."
            if not reset_votes:
                message = "Settings saved. Existing votes were kept."

            self._send_json({"ok": True, "message": message, "config": updated})
            return

        self._send_json({"error": "Not found"}, status=404)


def main():
    init_db()
    server = ThreadingHTTPServer((HOST, PORT), Handler)
    print(f"Server running at http://{HOST}:{PORT}")
    server.serve_forever()


if __name__ == "__main__":
    main()
