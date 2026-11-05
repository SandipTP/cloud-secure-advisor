import os
import sys
import json
import uuid
import secrets
import hashlib
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

# Load .env if present
try:
    from dotenv import load_dotenv
    load_dotenv()
    # Also load from backend/.env if running from workspace root
    load_dotenv(os.path.join(os.path.dirname(os.path.abspath(__file__)), ".env"))
except ImportError:
    pass

# Import structured scanner and compliance engine
from ingest.parser import parse_config, PENALTY
from compliance import evaluate_compliance


# App + Config
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
app = Flask(__name__, static_folder="dist", static_url_path="")
CORS(
    app,
    resources={r"/*": {"origins": ["http://localhost:5173", "http://127.0.0.1:5173"]}},
    allow_headers=["Content-Type", "Authorization"],
    methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
)

# Database
raw_db_url = os.getenv("DATABASE_URL")
if raw_db_url:
    # If a relative SQLite path like sqlite:///cloudscanner.db is supplied,
    # resolve it to BASE_DIR so it always points to the exact same file
    # regardless of which working directory Flask is started from.
    if raw_db_url.startswith("sqlite:///") and not os.path.isabs(raw_db_url[10:]):
        rel_name = raw_db_url[10:]
        app.config["SQLALCHEMY_DATABASE_URI"] = f"sqlite:///{os.path.join(BASE_DIR, rel_name)}"
    else:
        app.config["SQLALCHEMY_DATABASE_URI"] = raw_db_url
else:
    DB_PATH = os.path.join(BASE_DIR, "cloudscanner.db")
    app.config["SQLALCHEMY_DATABASE_URI"] = f"sqlite:///{DB_PATH}"

app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False
print("✅ Using DB:", app.config["SQLALCHEMY_DATABASE_URI"])

# Secrets & JWT Configuration
jwt_secret = os.getenv("JWT_SECRET_KEY")
flask_secret = os.getenv("FLASK_SECRET_KEY")

debug_mode = os.getenv("FLASK_DEBUG", "false").lower() in ("true", "1")
is_dev_or_test = (
    debug_mode
    or os.getenv("FLASK_ENV", "").lower() in ("development", "dev", "test", "testing")
    or "pytest" in sys.modules
    or "unittest" in sys.modules
    or any("test" in arg.lower() for arg in sys.argv)
    or app.config.get("TESTING", False)
)

if not jwt_secret:
    if not is_dev_or_test:
        raise RuntimeError(
            "FATAL SECURITY CONFIGURATION: JWT_SECRET_KEY environment variable is not set. "
            "CloudSecure Advisor refuses to start in production mode without a configured secret key. "
            "Set JWT_SECRET_KEY in your environment or enable FLASK_DEBUG=true for local development."
        )
    print("[WARN] JWT_SECRET_KEY not set in environment. Generating an ephemeral random secret for development/testing.")
    jwt_secret = flask_secret or secrets.token_hex(32)

if not flask_secret:
    if not is_dev_or_test:
        raise RuntimeError(
            "FATAL SECURITY CONFIGURATION: FLASK_SECRET_KEY environment variable is not set. "
            "CloudSecure Advisor refuses to start in production mode without a configured secret key."
        )
    flask_secret = jwt_secret

app.config["SECRET_KEY"] = flask_secret
app.config["JWT_SECRET_KEY"] = jwt_secret
app.config["JWT_ACCESS_TOKEN_EXPIRES"] = timedelta(hours=6)

# Upload settings
ALLOWED_EXTENSIONS = {".json", ".yaml", ".yml"}
MAX_BATCH_FILES = 20  # Cap maximum files per batch request to prevent denial-of-service / resource exhaustion
raw_upload_folder = os.getenv("UPLOAD_FOLDER", "uploads")
app.config["UPLOAD_FOLDER"] = (
    raw_upload_folder
    if os.path.isabs(raw_upload_folder)
    else os.path.join(BASE_DIR, raw_upload_folder)
)
app.config["MAX_CONTENT_LENGTH"] = 10 * 1024 * 1024  # 10 MB max upload
os.makedirs(app.config["UPLOAD_FOLDER"], exist_ok=True)

# SendGrid & Groq
SENDGRID_KEY = os.getenv("SENDGRID_API_KEY", "")
SENDGRID_FROM_EMAIL = os.getenv("SENDGRID_FROM_EMAIL", "realmesandip@gmail.com")
GROQ_API_KEY = os.getenv("GROQ_API_KEY", "")

jwt_mgr = JWTManager(app)
db = SQLAlchemy(app)


# Consistent JWT error responses
@jwt_mgr.unauthorized_loader
def missing_token_callback(reason):
    return jsonify({"error": "Authorization required", "reason": reason}), 401

@jwt_mgr.expired_token_loader
def expired_token_callback(jwt_header, jwt_data):
    return jsonify({"error": "Token has expired"}), 401

@jwt_mgr.invalid_token_loader
def invalid_token_callback(reason):
    return jsonify({"error": "Invalid token", "reason": reason}), 401


# ============================================================
# Database Models
# ============================================================
class User(db.Model):
    __tablename__ = "users"
    id = db.Column(db.Integer, primary_key=True)
    email = db.Column(db.String(120), unique=True, nullable=False, index=True)
    password_hash = db.Column(db.String(255), nullable=False)
    created_at = db.Column(db.Text, default=lambda: datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S"))

    uploads = db.relationship(
        "Upload",
        backref="user",
        lazy=True,
        cascade="all, delete-orphan",
    )
    reset_tokens = db.relationship(
        "PasswordResetToken",
        backref="user",
        lazy=True,
        cascade="all, delete-orphan",
    )


class Upload(db.Model):
    __tablename__ = "uploads"
    id = db.Column(db.Integer, primary_key=True)
    filename = db.Column(db.Text, nullable=False)
    timestamp = db.Column(db.Text, default=lambda: datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S"))
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
    created_at = db.Column(db.Text, default=lambda: datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S"))
    nist_reference = db.Column(db.Text)
    remediation = db.Column(db.Text)


class PasswordResetToken(db.Model):
    __tablename__ = "password_reset_tokens"
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
    code_hash = db.Column(db.String(255), nullable=False)
    expires_at = db.Column(db.DateTime, nullable=False)
    attempts = db.Column(db.Integer, default=0, nullable=False)
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)


# Initialize tables on startup and ensure self-healing before requests
with app.app_context():
    db.create_all()

_db_initialized = False

@app.before_request
def ensure_database_ready():
    global _db_initialized
    if not _db_initialized:
        try:
            db.create_all()
            _db_initialized = True
        except Exception as e:
            print("[WARN] Error ensuring database tables exist:", e)


# ============================================================
# Auth Helpers
# ============================================================
def create_user(email: str, password: str) -> bool:
    existing = User.query.filter_by(email=email).first()
    if existing:
        return False

    pw_hash = bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")
    user = User(
        email=email,
        password_hash=pw_hash,
        created_at=datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S")
    )
    db.session.add(user)
    db.session.commit()
    return True


def verify_password(stored_hash: str, password: str) -> bool:
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


# ============================================================
# Password Reset (Cryptographic secrets, DB stored, rate-limited)
# ============================================================
RESET_CODE_TTL_MINUTES = 10
MAX_RESET_ATTEMPTS = 5


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

    # Rate limiting: check recent requests (at most 1 per 60 seconds)
    recent_token = (
        PasswordResetToken.query.filter_by(user_id=user.id)
        .order_by(PasswordResetToken.created_at.desc())
        .first()
    )
    now_utc = datetime.now(timezone.utc)
    if recent_token and (now_utc - recent_token.created_at.replace(tzinfo=timezone.utc)).total_seconds() < 60:
        return jsonify({"error": "Please wait at least 60 seconds before requesting another code."}), 429

    # Generate cryptographically secure 6-digit code
    code = f"{secrets.randbelow(1000000):06d}"
    code_hash = hashlib.sha256(code.encode("utf-8")).hexdigest()
    expires_at = now_utc + timedelta(minutes=RESET_CODE_TTL_MINUTES)

    # Invalidate previous tokens
    PasswordResetToken.query.filter_by(user_id=user.id).delete()

    reset_entry = PasswordResetToken(
        user_id=user.id,
        code_hash=code_hash,
        expires_at=expires_at,
        attempts=0,
        created_at=now_utc,
    )
    db.session.add(reset_entry)
    db.session.commit()

    if not SENDGRID_KEY:
        print(f"[SECURITY/DEV] Password reset code for {email}: {code}")
        return generic_ok

    message = Mail(
        from_email=SENDGRID_FROM_EMAIL,
        to_emails=email,
        subject="Your Password Reset Code - CloudSecure Advisor",
        html_content=f"""
            <h3>Password Reset Request</h3>
            <p>Your 6-digit verification code is: <strong>{code}</strong></p>
            <p>This code expires in {RESET_CODE_TTL_MINUTES} minutes.</p>
        """,
    )

    try:
        SendGridAPIClient(SENDGRID_KEY).send(message)
    except Exception as e:
        print("SendGrid delivery error:", str(e))

    return generic_ok


@app.route("/reset-password", methods=["POST"])
def reset_password():
    data = request.get_json(silent=True) or {}
    email = (data.get("email") or "").strip().lower()
    code = str(data.get("code") or "").strip()
    new_password = data.get("password") or ""

    if not email or not code or not new_password:
        return jsonify({"error": "Missing required fields"}), 400

    if len(new_password) < 8:
        return jsonify({"error": "Password must be at least 8 characters"}), 400

    user = User.query.filter_by(email=email).first()
    if not user:
        return jsonify({"error": "Invalid or expired code"}), 400

    token = (
        PasswordResetToken.query.filter_by(user_id=user.id)
        .order_by(PasswordResetToken.created_at.desc())
        .first()
    )
    if not token:
        return jsonify({"error": "Invalid or expired code"}), 400

    now_utc = datetime.now(timezone.utc)
    token_expiry = token.expires_at.replace(tzinfo=timezone.utc) if token.expires_at.tzinfo is None else token.expires_at

    if now_utc > token_expiry:
        db.session.delete(token)
        db.session.commit()
        return jsonify({"error": "Reset code has expired. Please request a new one."}), 400

    token.attempts += 1
    if token.attempts > MAX_RESET_ATTEMPTS:
        db.session.delete(token)
        db.session.commit()
        return jsonify({"error": "Too many failed attempts. Please request a new reset code."}), 429

    input_hash = hashlib.sha256(code.encode("utf-8")).hexdigest()
    if not secrets.compare_digest(token.code_hash, input_hash):
        db.session.commit()
        return jsonify({"error": "Invalid verification code"}), 400

    # Code is valid; update password
    user.password_hash = bcrypt.hashpw(new_password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")
    db.session.delete(token)
    db.session.commit()

    return jsonify({"message": "Password updated successfully"}), 200


# ============================================================
# Auth Routes
# ============================================================
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


# ============================================================
# Account & Profile Management
# ============================================================
@app.route("/account", methods=["GET"])
@jwt_required()
def get_account_profile():
    user_id = int(get_jwt_identity())
    user = db.session.get(User, user_id)
    if not user:
        return jsonify({"error": "User account not found"}), 404

    scans_count = Upload.query.filter_by(user_id=user.id).count()
    upload_ids = [u.id for u in user.uploads]
    findings_count = (
        Finding.query.filter(Finding.upload_id.in_(upload_ids)).count()
        if upload_ids
        else 0
    )

    return jsonify({
        "id": user.id,
        "email": user.email,
        "created_at": user.created_at,
        "total_scans": scans_count,
        "total_findings": findings_count,
    }), 200


@app.route("/account", methods=["PUT"])
@jwt_required()
def update_account_profile():
    user_id = int(get_jwt_identity())
    user = db.session.get(User, user_id)
    if not user:
        return jsonify({"error": "User account not found"}), 404

    data = request.get_json(silent=True) or {}
    new_email = (data.get("email") or "").strip().lower()
    current_password = data.get("current_password") or ""
    new_password = data.get("new_password") or ""

    updated_fields = []

    # Update email
    if new_email and new_email != user.email.lower():
        if "@" not in new_email or "." not in new_email:
            return jsonify({"error": "Please provide a valid email address"}), 400

        # Require current password to change email
        if not current_password or not verify_password(user.password_hash, current_password):
            return jsonify({"error": "Current password is required to change your email address"}), 401

        existing = User.query.filter(User.email == new_email, User.id != user.id).first()
        if existing:
            return jsonify({"error": "An account with this email address already exists"}), 409

        user.email = new_email
        updated_fields.append("email")

    # Update password
    if new_password:
        if not current_password or not verify_password(user.password_hash, current_password):
            return jsonify({"error": "Current password is required to set a new password"}), 401

        if len(new_password) < 8:
            return jsonify({"error": "New password must be at least 8 characters long"}), 400

        if verify_password(user.password_hash, new_password):
            return jsonify({"error": "New password must be different from your current password"}), 400

        user.password_hash = bcrypt.hashpw(new_password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")
        updated_fields.append("password")

    if not updated_fields:
        return jsonify({"message": "No changes requested", "email": user.email}), 200

    db.session.commit()
    return jsonify({
        "message": f"Account {', '.join(updated_fields)} successfully updated.",
        "email": user.email,
        "updated_fields": updated_fields,
    }), 200


@app.route("/account", methods=["DELETE"])
@jwt_required()
def delete_account():
    user_id = int(get_jwt_identity())
    user = db.session.get(User, user_id)
    if not user:
        return jsonify({"error": "User account not found"}), 404

    data = request.get_json(silent=True) or {}
    password = data.get("password") or ""

    if not password or not verify_password(user.password_hash, password):
        return jsonify({"error": "Current password confirmation is required to delete your account"}), 401

    db.session.delete(user)
    db.session.commit()
    return jsonify({"message": "Account and all associated scan data permanently deleted."}), 200


# ============================================================
# Scanning Engine Helper (Shared by Single & Batch Routes)
# ============================================================
def process_uploaded_file(file_storage, user_id: int):
    """
    Validates, securely stores, parses, and analyzes an uploaded cloud config file
    using the structured AST scanner (with pattern fallback) and records findings.
    """
    if not file_storage or not file_storage.filename:
        return {"error": "Empty filename"}

    # File type validation
    ext = os.path.splitext(file_storage.filename)[1].lower()
    if ext not in ALLOWED_EXTENSIONS:
        return {
            "error": f"Unsupported file type '{ext}'. Supported formats: .json, .yaml, .yml"
        }

    orig_filename = secure_filename(file_storage.filename) or f"config{ext}"
    unique_prefix = uuid.uuid4().hex[:12]
    disk_filename = f"{unique_prefix}_{orig_filename}"
    filepath = os.path.join(app.config["UPLOAD_FOLDER"], disk_filename)

    file_storage.save(filepath)

    try:
        with open(filepath, "r", encoding="utf-8", errors="ignore") as f:
            content = f.read()
    except Exception as e:
        return {"error": f"Failed to read file: {e}"}

    # Execute structured AST rules + fallback
    scan_res = parse_config(filepath, raw_content=content)
    if scan_res.get("error"):
        return {"error": scan_res["error"]}

    findings_data = scan_res.get("findings", [])
    score = scan_res.get("score", 100)

    # Persist upload record
    now_str = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S")
    new_upload = Upload(
        filename=orig_filename,
        user_id=int(user_id),
        timestamp=now_str,
        raw_config=content,
    )
    db.session.add(new_upload)
    db.session.commit()

    # Persist findings with NIST references and remediation
    for fnd in findings_data:
        db.session.add(
            Finding(
                upload_id=new_upload.id,
                category=fnd.get("category"),
                issue=fnd.get("issue"),
                severity=fnd.get("severity"),
                detail=fnd.get("detail"),
                remediation=fnd.get("remediation"),
                nist_reference=fnd.get("nist_reference"),
                created_at=now_str,
            )
        )
    db.session.commit()

    return {
        "upload_id": new_upload.id,
        "filename": orig_filename,
        "score": score,
        "findings_count": len(findings_data),
    }


# ============================================================
# Upload Routes (Merged scan logic, YAML & JSON support)
# ============================================================
@app.route("/upload", methods=["POST"])
@jwt_required()
def upload_file():
    user_id = int(get_jwt_identity())

    # Support either single file "file" or multiple "files"
    if "file" in request.files:
        res = process_uploaded_file(request.files["file"], user_id)
        if "error" in res:
            return jsonify({"error": res["error"]}), 400
        return jsonify({
            "message": "File uploaded successfully.",
            "upload_id": res["upload_id"],
            "filename": res["filename"],
            "score": res["score"],
            "findings_count": res["findings_count"],
        }), 200

    files = request.files.getlist("files")
    if not files:
        return jsonify({"error": "No file provided"}), 400

    if len(files) > MAX_BATCH_FILES:
        return jsonify({"error": f"Upload limit exceeded: maximum {MAX_BATCH_FILES} files allowed per batch request."}), 400

    results = []
    for f in files:
        if f and f.filename:
            r = process_uploaded_file(f, user_id)
            if "error" not in r:
                results.append(r)

    return jsonify({
        "results": results,
        "total_files": len(results),
    }), 200


@app.route("/upload/batch", methods=["POST"])
@jwt_required()
def upload_batch():
    user_id = int(get_jwt_identity())
    files = request.files.getlist("files")

    if not files and "file" in request.files:
        files = [request.files["file"]]

    if not files:
        return jsonify({"error": "No files provided"}), 400

    if len(files) > MAX_BATCH_FILES:
        return jsonify({"error": f"Batch upload limit exceeded: maximum {MAX_BATCH_FILES} files allowed per request."}), 400

    results = []
    for f in files:
        if not f or not f.filename:
            continue
        res = process_uploaded_file(f, user_id)
        if "error" in res:
            return jsonify({"error": res["error"]}), 400
        results.append(res)

    return jsonify({
        "results": results,
        "total_files": len(results),
    }), 200


# ============================================================
# History & Findings Endpoints
# ============================================================
@app.route("/history", methods=["GET"])
@jwt_required()
def get_history():
    user_id = int(get_jwt_identity())
    uploads = (
        Upload.query.filter_by(user_id=user_id)
        .order_by(Upload.timestamp.desc())
        .all()
    )
    result = []

    for up in uploads:
        findings = Finding.query.filter_by(upload_id=up.id).all()
        score = 100
        for f in findings:
            score -= PENALTY.get((f.severity or "").upper(), 5)
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
@jwt_required()
def delete_upload(upload_id):
    user_id = int(get_jwt_identity())
    upload = Upload.query.filter_by(id=upload_id, user_id=user_id).first()
    if not upload:
        return jsonify({"error": "Not found or unauthorized"}), 404

    db.session.delete(upload)
    db.session.commit()
    return jsonify({"message": "Deleted successfully"}), 200


@app.route("/findings/<int:upload_id>", methods=["GET"])
@jwt_required()
def get_findings(upload_id):
    user_id = int(get_jwt_identity())
    upload = Upload.query.filter_by(id=upload_id, user_id=user_id).first()
    if not upload:
        return jsonify({"error": "Not found or unauthorized"}), 404

    findings = Finding.query.filter_by(upload_id=upload_id).all()
    return jsonify([
        {
            "id": f.id,
            "category": f.category,
            "issue": f.issue,
            "severity": f.severity,
            "detail": f.detail,
            "remediation": f.remediation,
            "nist_reference": f.nist_reference,
            "created_at": f.created_at,
        }
        for f in findings
    ]), 200


@app.route("/findings", methods=["GET"])
@jwt_required()
def get_all_user_findings():
    """
    Returns all findings across all uploads for the authenticated user.
    Allows the frontend Dashboard to populate immediately on initial load.
    """
    user_id = int(get_jwt_identity())
    uploads = Upload.query.filter_by(user_id=user_id).all()
    upload_ids = [u.id for u in uploads]

    if not upload_ids:
        return jsonify([]), 200

    findings = Finding.query.filter(Finding.upload_id.in_(upload_ids)).all()
    return jsonify([
        {
            "id": f.id,
            "upload_id": f.upload_id,
            "category": f.category,
            "issue": f.issue,
            "severity": f.severity,
            "detail": f.detail,
            "remediation": f.remediation,
            "nist_reference": f.nist_reference,
            "created_at": f.created_at,
        }
        for f in findings
    ]), 200


@app.route("/compliance", methods=["GET"])
@jwt_required()
def get_compliance():
    """
    Evaluates compliance against NIST SP 800-53, CIS AWS Foundations Benchmark,
    and SOC 2 Type II across all scans or for a specific upload_id.
    """
    user_id = int(get_jwt_identity())
    upload_id = request.args.get("upload_id")

    if upload_id:
        try:
            up_id_int = int(upload_id)
        except ValueError:
            return jsonify({"error": "Invalid upload_id parameter"}), 400

        upload = Upload.query.filter_by(id=up_id_int, user_id=user_id).first()
        if not upload:
            return jsonify({"error": "Upload not found or unauthorized"}), 404
        uploads = [upload]
        findings = Finding.query.filter_by(upload_id=upload.id).all()
    else:
        uploads = Upload.query.filter_by(user_id=user_id).all()
        upload_ids = [u.id for u in uploads]
        if not upload_ids:
            return jsonify(evaluate_compliance([], has_scans=False)), 200
        findings = Finding.query.filter(Finding.upload_id.in_(upload_ids)).all()

    upload_map = {u.id: u.filename for u in uploads}
    finding_dicts = [
        {
            "id": f.id,
            "upload_id": f.upload_id,
            "filename": upload_map.get(f.upload_id, ""),
            "category": f.category,
            "issue": f.issue,
            "severity": f.severity,
            "detail": f.detail,
            "remediation": f.remediation,
            "nist_reference": f.nist_reference,
            "created_at": f.created_at,
        }
        for f in findings
    ]

    result = evaluate_compliance(finding_dicts, has_scans=len(uploads) > 0)
    return jsonify(result), 200


# ============================================================
# AI Summary
# ============================================================
@app.route("/findings/<int:upload_id>/ai-summary", methods=["POST"])
@jwt_required()
def generate_ai_summary(upload_id):
    user_id = int(get_jwt_identity())
    upload = Upload.query.filter_by(id=upload_id, user_id=user_id).first()
    if not upload:
        return jsonify({"error": "Upload not found"}), 404

    findings = Finding.query.filter_by(upload_id=upload_id).all()
    if not findings:
        return jsonify({"summary": "No findings available for AI analysis."}), 200

    if not GROQ_API_KEY:
        return jsonify({"error": "GROQ_API_KEY is not configured on the server."}), 503

    findings_list = "\n".join([
        f"- [{f.severity}] {f.issue}: {f.detail} (NIST: {f.nist_reference})"
        for f in findings
    ])

    prompt = f"""You are a Senior Cloud Security Architect.
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
- Be concise and technical."""

    try:
        groq_client = OpenAI(
            base_url="https://api.groq.com/openai/v1",
            api_key=GROQ_API_KEY,
        )
        chat_completion = groq_client.chat.completions.create(
            messages=[
                {"role": "system", "content": "You are a helpful assistant that provides concise cloud security advice."},
                {"role": "user", "content": prompt}
            ],
            model="llama-3.3-70b-versatile",
        )
        summary = chat_completion.choices[0].message.content
        return jsonify({"summary": summary}), 200

    except Exception as e:
        print(f"Groq Error: {str(e)}")
        return jsonify({"error": "Failed to connect to AI engine"}), 500


# ============================================================
# Frontend SPA serving
# ============================================================
@app.route("/", defaults={"path": ""})
@app.route("/<path:path>")
def serve(path):
    if path and os.path.exists(os.path.join(app.static_folder, path)):
        return send_from_directory(app.static_folder, path)
    if os.path.exists(os.path.join(app.static_folder, "index.html")):
        return send_from_directory(app.static_folder, "index.html")
    return jsonify({"message": "CloudSecure Advisor API running. Static frontend not yet built."}), 200


if __name__ == "__main__":
    debug_mode = os.getenv("FLASK_DEBUG", "false").lower() in ("true", "1")
    host = os.getenv("FLASK_HOST", "127.0.0.1")
    port = int(os.getenv("PORT", 5000))
    print(f"🚀 Starting CloudSecure Advisor on http://{host}:{port} (debug={debug_mode})")
    app.run(host=host, port=port, debug=debug_mode)
