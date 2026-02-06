import jwt
import os 
from flask import request, jsonify, current_app, g
from functools import wraps
from datetime import datetime, timezone

def token_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        auth_header = request.headers.get("Authorization")

        if not auth_header or not auth_header.startswith("Bearer "):
            return jsonify({"error": "Missing or invalid token"}), 401

        token = auth_header.split(" ")[1]

        try:
            payload = jwt.decode(token, current_app.config["SECRET_KEY"], algorithms=["HS256"])

            g.user_id = payload["user_id"]

        except jwt.ExpiredSignatureError:
            return jsonify({"error": "Token expired"}), 401
        except jwt.InvalidTokenError:
            return jsonify({"error": "Invalid token"}), 401

        return f(*args, **kwargs)
    
    return decorated
