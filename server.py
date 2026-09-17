import hashlib
import http.cookies
import http.server
import json
import os
import secrets
import sqlite3
import time
from pathlib import Path

ROOT = Path(__file__).parent
DB_PATH = Path(os.environ.get("KASANGE_DB", ROOT / "kasange.db"))
DEFAULT_ADMIN_NAME = os.environ.get("KASANGE_ADMIN_NAME", "Admin Demo")
DEFAULT_ADMIN_PASSWORD = os.environ.get("KASANGE_ADMIN_PASSWORD", "admin123")
DEFAULT_TEACHER_NAME = os.environ.get("KASANGE_TEACHER_NAME", "Teacher Demo")
DEFAULT_TEACHER_PASSWORD = os.environ.get("KASANGE_TEACHER_PASSWORD", "teacher123")


def hash_password(password, salt=None):
    salt = salt or secrets.token_bytes(16)
    digest = hashlib.pbkdf2_hmac("sha256", password.encode(), salt, 180_000)
    return salt.hex() + "$" + digest.hex()


def verify_password(password, stored):
    try:
        salt, digest = stored.split("$", 1)
        candidate = hashlib.pbkdf2_hmac("sha256", password.encode(), bytes.fromhex(salt), 180_000).hex()
        return secrets.compare_digest(candidate, digest)
    except ValueError:
        return False


def db():
    connection = sqlite3.connect(DB_PATH)
    connection.row_factory = sqlite3.Row
    connection.execute("PRAGMA foreign_keys = ON")
    return connection


def init_db():
    with db() as connection:
        connection.executescript("""
        CREATE TABLE IF NOT EXISTS users (
          id INTEGER PRIMARY KEY AUTOINCREMENT, username TEXT,
          name TEXT NOT NULL, role TEXT NOT NULL CHECK(role IN ('teacher','admin')),
          password_hash TEXT NOT NULL, phone TEXT, email TEXT UNIQUE, id_number TEXT, subject TEXT,
          profile_photo TEXT, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
        CREATE TABLE IF NOT EXISTS sessions (
          token TEXT PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          expires_at INTEGER NOT NULL
        );
        CREATE TABLE IF NOT EXISTS submissions (
          id INTEGER PRIMARY KEY AUTOINCREMENT, teacher_id INTEGER NOT NULL REFERENCES users(id),
          class_name TEXT NOT NULL, subject TEXT NOT NULL, term TEXT NOT NULL, year TEXT NOT NULL,
          stream TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'Pending Admin',
          created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
        CREATE TABLE IF NOT EXISTS submission_rows (
          id INTEGER PRIMARY KEY AUTOINCREMENT, submission_id INTEGER NOT NULL REFERENCES submissions(id) ON DELETE CASCADE,
          name TEXT NOT NULL, admission_no TEXT, marks REAL NOT NULL CHECK(marks >= 0 AND marks <= 100)
        );
        """)
        columns = {row[1] for row in connection.execute("PRAGMA table_info(users)")}
        for column in ["phone", "email", "id_number", "subject", "profile_photo"]:
            if column not in columns:
                connection.execute(f"ALTER TABLE users ADD COLUMN {column} TEXT")
        if not connection.execute("SELECT 1 FROM users WHERE username='admin' AND role='admin'").fetchone():
            connection.execute("INSERT INTO users(username,name,role,password_hash,email) VALUES(?,?,?,?,?)", ("admin", DEFAULT_ADMIN_NAME, "admin", hash_password(DEFAULT_ADMIN_PASSWORD), "admin@kasange.school"))
        if not connection.execute("SELECT 1 FROM users WHERE username='teacher' AND role='teacher'").fetchone():
            connection.execute("INSERT INTO users(username,name,role,password_hash,email) VALUES(?,?,?,?,?)", ("teacher", DEFAULT_TEACHER_NAME, "teacher", hash_password(DEFAULT_TEACHER_PASSWORD), "teacher@kasange.school"))


def public_user(row):
    values = dict(row)
    return {
        "id": values["id"],
        "username": values["username"],
        "name": values["name"],
        "role": values["role"],
        "phone": values.get("phone"),
        "email": values.get("email"),
        "id_number": values.get("id_number"),
        "subject": values.get("subject"),
        "profile_photo": values.get("profile_photo"),
    }


class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def json_body(self):
        length = int(self.headers.get("Content-Length", "0"))
        return json.loads(self.rfile.read(length) or b"{}")

    def respond(self, status, payload):
        data = json.dumps(payload).encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def session_user(self):
        cookies = http.cookies.SimpleCookie(self.headers.get("Cookie", ""))
        token = cookies.get("kasange_session")
        if not token:
            return None
        with db() as connection:
            row = connection.execute(
                "SELECT u.* FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token=? AND s.expires_at>?",
                (token.value, int(time.time())),
            ).fetchone()
        return row

    def do_GET(self):
        if self.path == "/api/auth/me":
            user = self.session_user()
            return self.respond(200 if user else 401, public_user(user) if user else {"error": "Hujaingia."})
        if self.path == "/api/submissions":
            user = self.session_user()
            if not user:
                return self.respond(401, {"error": "Hujaingia."})
            with db() as connection:
                query = """SELECT s.*, u.name AS teacher_name,
                    (SELECT COUNT(*) FROM submission_rows r WHERE r.submission_id=s.id) AS count
                    FROM submissions s JOIN users u ON u.id=s.teacher_id"""
                params = ()
                if user["role"] == "teacher":
                    query += " WHERE s.teacher_id=?"
                    params = (user["id"],)
                query += " ORDER BY s.id DESC"
                items = [dict(row) for row in connection.execute(query, params)]
                for item in items:
                    item["className"] = item.pop("class_name")
                    item["teacherName"] = item.pop("teacher_name")
                    item["createdAt"] = item.pop("created_at")
                    item["rows"] = [dict(row) for row in connection.execute("SELECT name, admission_no AS adm, marks FROM submission_rows WHERE submission_id=?", (item["id"],))]
            return self.respond(200, items)
        return super().do_GET()

    def do_POST(self):
        if self.path == "/api/auth/register":
            body = self.json_body()
            required = ["name", "password"]
            for field in required:
                if not body.get(field):
                    return self.respond(400, {"error": f"Taarifa ya {field} inahitajika."})
            if len(body["password"]) < 6:
                return self.respond(400, {"error": "Password lazima iwe na angalau herufi 6."})
            email = (body.get("email") or "").strip()
            name = body["name"].strip()
            with db() as connection:
                existing = connection.execute("SELECT id FROM users WHERE email=? OR username=? OR name=?", (email or None, (body.get("username") or name).strip(), name)).fetchone()
                if existing:
                    return self.respond(409, {"error": "Akaunti hii tayari ipo. Tumia jina au email tofauti."})
                username = (body.get("username") or name).strip()
                connection.execute(
                    "INSERT INTO users(username,name,role,password_hash,email,phone,id_number,subject,profile_photo) VALUES(?,?,?,?,?,?,?,?,?)",
                    (username, name, "teacher", hash_password(body["password"]), email, body.get("phone") or "", body.get("id_number") or "", body.get("subject") or "", body.get("profile_photo") or ""),
                )
            return self.respond(201, {"ok": True, "message": "Akaunti ya mwalimu imeundwa."})
        if self.path == "/api/auth/login":
            body = self.json_body()
            identifier = (body.get("name") or body.get("username") or body.get("email") or "").strip()
            if not identifier or not body.get("password"):
                return self.respond(400, {"error": "Weka jina/username/email na password."})
            with db() as connection:
                role = body.get("role") or "teacher"
                user = connection.execute(
                    "SELECT * FROM users WHERE role=? AND (name=? OR username=? OR email=?)",
                    (role, identifier, identifier, identifier),
                ).fetchone()
                if not user or not verify_password(body["password"], user["password_hash"]):
                    return self.respond(401, {"error": "Jina/username/email au password si sahihi."})
                token = secrets.token_urlsafe(32)
                connection.execute("INSERT INTO sessions(token,user_id,expires_at) VALUES(?,?,?)", (token, user["id"], int(time.time()) + 60 * 60 * 8))
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.send_header("Set-Cookie", f"kasange_session={token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=28800")
            data = json.dumps(public_user(user)).encode()
            self.send_header("Content-Length", str(len(data)))
            self.end_headers()
            self.wfile.write(data)
            return
        if self.path == "/api/auth/logout":
            cookies = http.cookies.SimpleCookie(self.headers.get("Cookie", ""))
            token = cookies.get("kasange_session")
            if token:
                with db() as connection:
                    connection.execute("DELETE FROM sessions WHERE token=?", (token.value,))
            self.send_response(200)
            self.send_header("Set-Cookie", "kasange_session=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0")
            self.send_header("Content-Length", "2")
            self.end_headers()
            self.wfile.write(b"{}")
            return
        if self.path == "/api/submissions":
            user = self.session_user()
            if not user or user["role"] != "teacher":
                return self.respond(403, {"error": "Teacher login inahitajika."})
            body = self.json_body()
            rows = body.get("rows", [])
            if not all(body.get(key) for key in ("className", "subject", "term", "year")) or not rows:
                return self.respond(400, {"error": "Taarifa za submission hazijakamilika."})
            if any(not row.get("name") or row.get("marks") is None or not 0 <= float(row["marks"]) <= 100 for row in rows):
                return self.respond(400, {"error": "Kila mwanafunzi lazima awe na jina na marks 0-100."})
            with db() as connection:
                cursor = connection.execute("INSERT INTO submissions(teacher_id,class_name,subject,term,year,stream) VALUES(?,?,?,?,?,?)",
                    (user["id"], body["className"], body["subject"], body["term"], body["year"], body.get("stream") or "A"))
                for row in rows:
                    connection.execute("INSERT INTO submission_rows(submission_id,name,admission_no,marks) VALUES(?,?,?,?)",
                        (cursor.lastrowid, row["name"].strip(), row.get("adm", "").strip(), float(row["marks"])))
            return self.respond(201, {"ok": True})
        if self.path.startswith("/api/submissions/") and self.path.endswith("/approve"):
            user = self.session_user()
            if not user or user["role"] != "admin":
                return self.respond(403, {"error": "Admin login inahitajika."})
            submission_id = self.path.split("/")[3]
            with db() as connection:
                connection.execute("UPDATE submissions SET status='Approved' WHERE id=?", (submission_id,))
            return self.respond(200, {"ok": True})
        return self.respond(404, {"error": "Endpoint haipo."})

    def do_DELETE(self):
        if self.path.startswith("/api/submissions/") and self.path.count("/") >= 3:
            user = self.session_user()
            if not user or user["role"] != "admin":
                return self.respond(403, {"error": "Admin login inahitajika."})
            submission_id = self.path.split("/")[-1]
            if not submission_id.isdigit():
                return self.respond(400, {"error": "Submission id si sahihi."})
            with db() as connection:
                connection.execute("DELETE FROM submissions WHERE id=?", (int(submission_id),))
            return self.respond(200, {"ok": True})
        return self.respond(404, {"error": "Endpoint haipo."})

    def do_PUT(self):
        if self.path == "/api/auth/profile":
            user = self.session_user()
            if not user:
                return self.respond(401, {"error": "Hujaingia."})
            body = self.json_body()
            if not body.get("name") or not body.get("email"):
                return self.respond(400, {"error": "Jina na email ni lazima."})
            password_hash = user["password_hash"]
            if body.get("password"):
                if len(body["password"]) < 6:
                    return self.respond(400, {"error": "Password lazima iwe na angalau herufi 6."})
                password_hash = hash_password(body["password"])
            with db() as connection:
                connection.execute(
                    "UPDATE users SET name=?, phone=?, email=?, id_number=?, subject=?, profile_photo=?, password_hash=? WHERE id=?",
                    (
                        body["name"].strip(),
                        (body.get("phone") or "").strip(),
                        body["email"].strip(),
                        (body.get("id_number") or "").strip(),
                        (body.get("subject") or "").strip(),
                        body.get("profile_photo") or user["profile_photo"],
                        password_hash,
                        user["id"],
                    ),
                )
            return self.respond(200, {"ok": True, "message": "Taarifa za mwalimu zimesasishwa."})
        return self.respond(404, {"error": "Endpoint haipo."})


if __name__ == "__main__":
    init_db()
    server = http.server.ThreadingHTTPServer(("127.0.0.1", int(os.environ.get("PORT", "8000"))), Handler)
    print("Kasange running at http://127.0.0.1:8000")
    server.serve_forever()
