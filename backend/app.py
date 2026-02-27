import os
import json
import random
from datetime import datetime, timedelta, timezone

from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
from flask_sqlalchemy import SQLAlchemy
from flask_jwt_extended import (
    JWTManager,
    create_access_token,
    jwt_required,
    get_jwt_identity,
)
import bcrypt
from werkzeug.utils import secure_filename

from sendgrid import SendGridAPIClient
from sendgrid.helpers.mail import Mail

from openai import OpenAI


# App + Config
app = Flask(__name__, static_folder="dist", static_url_path="")
CORS(
    app,
    resources={r"/*": {"origins": ["http://localhost:5173", "http://127.0.0.1:5173"]}},
    allow_headers=["Content-Type", "Authorization"],
    methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
)

# Database
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DB_PATH = os.path.join(BASE_DIR, "cloudscanner.db")
app.config["SQLALCHEMY_DATABASE_URI"] = os.getenv("DATABASE_URL", f"sqlite:///{DB_PATH}")

print("✅ Using DB:", DB_PATH)
app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False

# Secrets (Fixed the hardcoded issue. API's keys are stored in the .env file)
app.config["SECRET_KEY"] = os.getenv("FLASK_SECRET_KEY")
app.config["JWT_SECRET_KEY"] = os.getenv("JWT_SECRET_KEY") 

# JWT settings
app.config["JWT_ACCESS_TOKEN_EXPIRES"] = timedelta(hours=6)

# Upload settings
app.config["UPLOAD_FOLDER"] = os.getenv("UPLOAD_FOLDER", "uploads")
app.config["MAX_CONTENT_LENGTH"] = 10 * 1024 * 1024  # 10 MB max upload

SENDGRID_KEY = os.getenv("SENDGRID_API_KEY", "")
SENDGRID_FROM_EMAIL = os.getenv("SENDGRID_FROM_EMAIL", "realmesandip@gmail.com")


#fixed the Groq API hardcoded issue. API's keys are stored in the .env file
GROQ_API_KEY = os.getenv("GROQ_API_KEY", "")
if not GROQ_API_KEY:
    raise ValueError("GROQ_API_KEY is not set in the environment variables")

jwt_mgr = JWTManager(app)
db = SQLAlchemy(app)

os.makedirs(app.config["UPLOAD_FOLDER"], exist_ok=True)

#consistent JWT error response (avoids 422 vs 401)
@jwt_mgr.unauthorized_loader
def missing_token_callback(reason):
    return jsonify({"error": "Authorization required", "reason": reason}), 401

@jwt_mgr.expired_token_loader
def expired_token_callback(jwt_header, jwt_data):
    return jsonify({"error": "Token has expired"}), 401

@jwt_mgr.invalid_token_loader
def invalid_token_callback(reason):
    return jsonify({"error": "Invalid token", "reason": reason}), 401


_rules_path = os.path.join(BASE_DIR, "rules.json")
try:
    with open(_rules_path, "r", encoding="utf-8") as f:
        RULES = json.load(f)
except Exception as e:
    raise RuntimeError(f" Could not load rules.json: {e}")

PENALTY = {
    "critical": 25,
    "high": 15,
    "medium": 10,
    "low": 5,
}



# Models
class User(db.Model):
    __tablename__ = "users"
    id = db.Column(db.Integer, primary_key=True)
    email = db.Column(db.String(120), unique=True, nullable=False, index=True)
    password_hash = db.Column(db.String(255), nullable=False)
    created_at = db.Column(db.Text)


class Upload(db.Model):
    __tablename__ = "uploads"
    id = db.Column(db.Integer, primary_key=True)
    filename = db.Column(db.Text, nullable=False)
    timestamp = db.Column(db.Text)        
    raw_config = db.Column(db.Text)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)

    findings = db.relationship(
        "Finding",
        backref="parent_upload",
        lazy=True,
        cascade="all, delete-orphan",
    )

class Finding(db.Model):
    __tablename__ = "findings"
    id = db.Column(db.Integer, primary_key=True)
    upload_id = db.Column(db.Integer, db.ForeignKey("uploads.id"), nullable=False)
    category = db.Column(db.Text)
    issue = db.Column(db.Text)
    detail = db.Column(db.Text)
    severity = db.Column(db.Text)
    created_at = db.Column(db.Text)
    nist_reference = db.Column(db.Text)
    remediation = db.Column(db.Text)

with app.app_context():
    db.reflect()



# Auth helpers (salted hashing)
"""fixed: single, consistent auth using bcrypt only."""

def create_user(email: str, password: str) -> bool:
    existing = User.query.filter_by(email=email).first()
    if existing:
        return False

    pw_hash = bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")

    user = User(email=email, password_hash=pw_hash)  
    db.session.add(user)
    db.session.commit()
    return True


def verify_password(stored_hash: str, password: str) -> bool:
    """verify a bcrypt hash"""
    if not stored_hash:
        return False

    try:
        return bcrypt.checkpw(password.encode("utf-8"), stored_hash.encode("utf-8"))
    except Exception:
        return False

def authenticate_user(email: str, password: str):
    user = User.query.filter_by(email=email).first()
    if not user:
        return None

    if not verify_password(user.password_hash, password):
        return None
    return user.id

def scan_content(content: str) -> tuple[list, int]:
    content_norm = "".join(content.split())
    found = []
    score = 100
    for rule in RULES:
        pat = rule.get("pattern")
        if not pat:
            continue
        if "".join(pat.split()) in content_norm:
            found.append(rule)
            score -= PENALTY.get(rule.get("severity", "medium"), 0)

    return found, max(score, 0)

# Password Reset (with expiry)
# { "email": {"code":"123456", "expires_at": datetime} }

reset_codes: dict = {}
RESET_CODE_TTL_MINUTES = 10


@app.route("/forgot-password", methods=["POST"])
def forgot_password():
    data = request.get_json(silent=True) or {}
    email = (data.get("email") or "").strip().lower()

    generic_ok = jsonify({"message": "If an account exists, a code was sent"}), 200

    if not email:
        return generic_ok

    user = User.query.filter_by(email=email).first()
    if not user:
        return generic_ok

    code = f"{random.randint(100000, 999999)}"
    reset_codes[email] = {
        "code": code,
        "expires_at": datetime.now(timezone.utc) + timedelta(minutes=RESET_CODE_TTL_MINUTES),
    }

    # Only attempt sending if configured
    if not SENDGRID_KEY:
        # Still return OK to the client (don’t leak misconfig)
        print("[WARN] SENDGRID_API_KEY not set. Reset code:", code, "for", email)
        return generic_ok

    message = Mail(
        from_email=SENDGRID_FROM_EMAIL,
        to_emails=email,
        subject="Your Password Reset Code",
        html_content=f"""
            <h3>Password Reset Request</h3>
            <p>Your 6-digit verification code is: <strong>{code}</strong></p>
            <p>This code expires in {RESET_CODE_TTL_MINUTES} minutes.</p>
        """,
    )

    try:
        sg = SendGridAPIClient(SENDGRID_KEY).send(message)
    except Exception as e:
        print("SendGrid error:", str(e))

    return generic_ok


@app.route("/reset-password", methods=["POST"])
def reset_password():
    data = request.get_json(silent=True) or {}
    email = (data.get("email") or "").strip().lower()
    code = str(data.get("code") or "").strip()
    new_password = data.get("password") or ""

    if not email or not code or not new_password:
        return jsonify({"error": "Missing fields"}), 400

    if len(new_password) < 8:
        return jsonify({"error": "Password must be at least 8 characters"}), 400

    entry = reset_codes.get(email)
    if not entry:
        return jsonify({"error": "Invalid or expired code"}), 400

    if datetime.now(timezone.utc) > entry["expires_at"]:
        del reset_codes[email]
        return jsonify({"error": "Invalid or expired code"}), 400

    if entry["code"] != code:
        return jsonify({"error": "Invalid or expired code"}), 400

    user = User.query.filter_by(email=email).first()
    if not user:
        del reset_codes[email]
        return jsonify({"error": "Invalid or expired code"}), 400

    user.password_hash = bcrypt.hashpw(
        new_password.encode("utf-8"), bcrypt.gensalt()
    ).decode ("utf-8")
    db.session.commit()

    del reset_codes[email]
    return jsonify({"message": "Password updated successfully"}), 200


# Routes: Signup / Login
@app.route("/signup", methods=["POST"])
def signup():
    data = request.get_json(silent=True) or {}
    email = (data.get("email") or "").strip().lower()
    password = data.get("password") or ""

    if not email or not password:
        return jsonify({"error": "Email and password required"}), 400

    if len(password) < 8:
        return jsonify({"error": "Password must be at least 8 characters"}), 400

    if not create_user(email, password):
        return jsonify({"error": "User already exists"}), 409

    return jsonify({"message": "User created successfully"}), 201


@app.route("/login", methods=["POST"])
def login():
    data = request.get_json(silent=True) or {}
    email = (data.get("email") or "").strip().lower()
    password = data.get("password") or ""

    if not email or not password:
        return jsonify({"error": "Email and password required"}), 400

    user_id = authenticate_user(email, password)
    if not user_id:
        return jsonify({"error": "Invalid credentials"}), 401

    token = create_access_token(identity=str(user_id))
    return jsonify({"access_token": token}), 200



# Upload scanning

@app.route("/upload", methods=["POST"])
@jwt_required()
def upload_file():
    if "file" not in request.files:
        return jsonify({"error": "No file provided"}), 400

    file = request.files["file"]
    if not file.filename:
        return jsonify({"error": "Empty filename"}), 400

    user_id = get_jwt_identity()

    filename = secure_filename(file.filename)
    filepath = os.path.join(app.config["UPLOAD_FOLDER"], filename)
    file.save(filepath)

    try:
        with open(filepath, "r", encoding="utf-8", errors="ignore") as f:
            content = f.read()
    except Exception:
        return jsonify({"error": "Failed to read uploaded file"}), 400

    try:
        with open("rules.json", "r", encoding="utf-8") as f:
            rules = json.load(f)
    except Exception:
        return jsonify({"error": "rules.json missing or invalid"}), 500

    found_findings = []
    score = 100
    penalty = {"CRITICAL": 25, "HIGH": 15, "MEDIUM": 10, "LOW": 5}

    content_norm = "".join(content.split())

    for rule in rules:
        pat = rule.get("pattern")
        if not pat:
            continue
        pat_norm = "".join(pat.split())
        if pat_norm in content_norm:
            found_findings.append(rule)
            score -= penalty.get(rule.get("severity"), 0)

    score = max(score, 0)

    new_upload = Upload(    
        filename=filename,
        user_id=int(user_id),
        timestamp=datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S"),
        raw_config=content
    )
    db.session.add(new_upload)
    db.session.commit()

    for fnd in found_findings:
        db.session.add(
            Finding(
                upload_id=new_upload.id,
                category=fnd.get("category"),
                issue=fnd.get("issue"),
                severity=fnd.get("severity"),
                detail=fnd.get("detail"),
                remediation=fnd.get("remediation"),
                nist_reference=fnd.get("nist_reference"),
            )
        )
    db.session.commit()

    return jsonify(
        {
            "message": "File uploaded successfully.",
            "upload_id": new_upload.id,
            "findings_count": len(found_findings),
            "score": score,
        }
    ), 200

         
@app.route("/upload/batch", methods=["POST"])
@jwt_required()
def upload_batch():
    user_id = get_jwt_identity()
    files = request.files.getlist("files")
    if not files:
        return jsonify({"error": "No files"}), 400

    try:
        with open("rules.json", "r", encoding="utf-8") as f:
            rules = json.load(f)
    except Exception:
        return jsonify({"error": "rules.json missing or invalid"}), 500

    results = []
    penalty = {"CRITICAL": 25, "HIGH": 15, "MEDIUM": 10, "LOW": 5}

    for file in files:
        if not file or not file.filename:
            continue

        filename = secure_filename(file.filename)
        filepath = os.path.join(app.config["UPLOAD_FOLDER"], filename)
        file.save(filepath)

        with open(filepath, "r", encoding="utf-8", errors="ignore") as f:
            content = f.read()

        found, score = [], 100
        content_norm = "".join(content.split())

        for rule in rules:
            pat = rule.get("pattern")
            if not pat:
                continue
            pat_norm = "".join(pat.split())
            if pat_norm in content_norm:
                found.append(rule)
                score -= penalty.get(rule.get("severity"), 0)

        score = max(score, 0)

        new_up = Upload(
            filename=filename,
            user_id=int(user_id),
            timestamp=datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S"),
            raw_config=content
        )   
        db.session.add(new_up)
        db.session.commit()

        for fnd in found:
            db.session.add(
                Finding(
                    upload_id=new_up.id,
                    category=fnd.get("category"),
                    issue=fnd.get("issue"),
                    severity=fnd.get("severity"),
                    detail=fnd.get("detail"),
                    remediation=fnd.get("remediation"),
                )
            )
        db.session.commit()

        results.append(
            {
                "upload_id": new_up.id,
                "filename": filename,
                "score": score,
                "findings_count": len(found),
            }
        )

    return jsonify(
        {
            "results": results,
            "total_files": len(results),
        }
    ), 200


# -----------------------------
# History + Findings
# -----------------------------
@app.route("/history", methods=["GET"])
@jwt_required()
def get_history():
    user_id = int(get_jwt_identity())
    uploads = (
        Upload.query.filter_by(user_id=user_id)
        .order_by(Upload.timestamp.desc())
        .all()
    )
    penalty = {"CRITICAL": 25, "HIGH":15, "MEDIUM": 10, "LOW":5}
    result = []

    for up in uploads:
        findings = Finding.query.filter_by(upload_id=up.id).all()
        score = 100
        for f in findings:
            score -= penalty.get((f.severity or "").upper(), 0)
        score = max(score, 0)
        ts = up.timestamp if isinstance(up.timestamp, str) else (up.timestamp.strftime("%Y-%m-%d %H:%M:%S") if up.timestamp else "")
        result.append({
            "id": up.id,
            "filename": up.filename,
            "timestamp": ts,
            "score": score,
            "findings_count": len(findings),
        })
    return jsonify(result), 200

@app.route("/history/<int:upload_id>", methods=["DELETE"])
@jwt_required
def delete_upload(uplaod_id):
    user_id = int(get_jwt_identity())
    upload= Upload.query.filter_by(id=upload_id, user_id = user_id).first()
    if not upload:
        return jsonify({"error": "Not found or unauthorized"}), 404
    db.session.delete(upload)
    db.session.commit()
    return jsonify({"message": "Deleted Successfully"}), 200

@app.route("/findings/<int:upload_id>", methods=["GET"])
@jwt_required()
def get_findings(upload_id):
    user_id = int(get_jwt_identity())
    upload = Upload.query.filter_by(id=upload_id, user_id=user_id).first()
    if not upload:
        return jsonify({"error": "Not found"}), 404

    findings = Finding.query.filter_by(upload_id=upload_id).all()
    return jsonify(
        [
            {
                "id": f.id,
                "category": f.category,
                "issue": f.issue,
                "severity": f.severity,
                "detail": f.detail,
                "remediation": f.remediation,
                "nist_reference": f.nist_reference,
              
            }
            for f in findings
        ]
    ), 200 

# -----------------------------
# AI Summary
# -----------------------------

groq_client = OpenAI(
    base_url="https://api.groq.com/openai/v1",
    api_key=GROQ_API_KEY,   
)

@app.route('/findings/<int:upload_id>/ai-summary', methods=['POST'])
@jwt_required()
def generate_ai_summary(upload_id):
    user_id = int(get_jwt_identity())
    upload = Upload.query.filter_by(id=upload_id, user_id=user_id).first()
    if not upload:
        return jsonify({"error": "Upload not found"}), 404

    findings = Finding.query.filter_by(upload_id=upload_id).all()
    
    if not findings:
        return jsonify({"summary": "No findings available for AI analysis."}), 200

    # Format findings into a readable list for the AI
    findings_list = "\n".join([
        f"- [{f.severity}] {f.issue}: {f.detail} (NIST: {f.nist_reference})"
        for f in findings
    ])

    prompt = f"""
    You are a Senior Cloud Security Architect.
Analyze these security scan findings and provide a professional executive summary.

FINDINGS:
{findings_list}

STRICT FORMAT — follow exactly, no deviations:

1. **Executive Risk Level**: [Critical / High / Medium / Low]
2. **Summary of Key Threats**: 2-3 sentences describing the main risks found. No URLs or hyperlinks.
3. **Immediate Action Items**:
   * [action 1]
   * [action 2]
   * [action 3]
4. **Long-term Prevention Strategy**: 2-3 sentences on systematic improvements.

RULES:
- Use only **bold** for section titles and `backticks` for technical terms.
- Do NOT include any URLs, hyperlinks, or [text](url) patterns.
- Do NOT add extra commentary outside the 4 sections above.
- Be concise and technical.    """

    try:
        chat_completion = groq_client.chat.completions.create(
            messages=[
                {"role": "system", "content": "You are a helpful assistant that provides concise cloud security advice."},
                {"role": "user", "content": prompt}
            ],
            model="llama-3.3-70b-versatile", # Groq's fast, high-quality model
        )
        
        summary = chat_completion.choices[0].message.content
        return jsonify({"summary": summary}), 200

    except Exception as e:
        print(f"Groq Error: {str(e)}")
        return jsonify({"error": "Failed to connect to AI engine"}), 500
# -----------------------------
# Frontend SPA serving
# -----------------------------
@app.route("/", defaults={"path": ""})
@app.route("/<path:path>")
def serve(path):
    if path and os.path.exists(os.path.join(app.static_folder, path)):
        return send_from_directory(app.static_folder, path)
    return send_from_directory(app.static_folder, "index.html")


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=int(os.environ.get("PORT", 5000)), debug=True)