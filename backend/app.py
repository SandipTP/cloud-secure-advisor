from flask import Flask, request, jsonify
import os
from werkzeug.utils import secure_filename

from ingest.parser import parse_config
from database import initialize_db, save_upload, save_findings


app = Flask(__name__, static_folder='dist', static_url_path="")
app.config['UPLOAD_FOLDER'] = 'uploads'

@app.route("/upload", methods=["POST"])
def upload_file():
    if "file" not in request.files:
        return jsonify({"error": "No file provided"}), 400

    file = request.files["file"]
    if not file or file.filename.strip() == "":
        return jsonify({"error": "Empty filename"}), 400

    # ensure uploads folder exists
    os.makedirs(app.config["UPLOAD_FOLDER"], exist_ok=True)

    # safer filename
    filename = secure_filename(file.filename)
    filepath = os.path.join(app.config["UPLOAD_FOLDER"], filename)
    file.save(filepath)

    parsed_data = parse_config(filepath)
    raw_config = parsed_data.get("raw_config")
    findings = parsed_data.get("findings", [])

    upload_id = save_upload(filename, raw_config)
    save_findings(upload_id, findings)

    return jsonify({
        "message": "File uploaded successfully.",
        "upload_id": upload_id,
        "parsed_output": parsed_data
    }), 200


# -----------------------------
# IMPORTANT:
# Keep your other API routes (like /history, /findings) ABOVE the catch-all routes below.
# -----------------------------

@app.route("/")
def index():
    # serves React
    return send_from_directory(app.static_folder, "index.html")


@app.route("/<path:path>")
def react_router(path):
    # serves React assets if they exist, otherwise fallback to index.html
    full_path = os.path.join(app.static_folder, path)
    if os.path.exists(full_path):
        return send_from_directory(app.static_folder, path)
    return send_from_directory(app.static_folder, "index.html")


if __name__ == "__main__":
    # default to 5000 for local dev (matches your Vite proxy)
    initialize_db()
    port = int(os.environ.get("PORT", 5000))
    app.run(host="0.0.0.0", port=port)