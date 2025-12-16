from flask import Flask, request, jsonify
import os
from ingest.parser import parse_config
from database import initialize_db, save_upload, save_findings
initialize_db()


app = Flask(__name__)
app.config['UPLOAD_FOLDER'] = 'uploads/'

@app.route('/upload', methods=['POST'])
def upload_file():
    if 'file' not in request.files:
        return jsonify({"error":"No file provided"}), 400

    file = request.files['file']
    filepath = os.path.join(app.config['UPLOAD_FOLDER'], file.filename)
    file.save(filepath)

    parsed_data = parse_config(filepath)
    raw_config = parsed_data['raw_config']
    findings = parsed_data['findings']

    upload_id = save_upload(file.filename, raw_config)
    save_findings(upload_id, findings)

    return jsonify({
        "message": "File uploaded successfully.",
        "upload_id": upload_id,
        "parsed_output": parsed_data
    })
if __name__ == '__main__':
    app.run(debug =True)
