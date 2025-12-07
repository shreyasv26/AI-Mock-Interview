import jwt
from functools import wraps
from flask import request, jsonify, current_app

def token_required(f):
    """
    Decorator to ensure a valid JWT is present and verified.
    It uses the app's current configuration for the secret key.
    """
    @wraps(f)
    def decorated(*args, **kwargs):
        token = None
        # Extract token from 'Bearer <token>' header
        if "Authorization" in request.headers:
            auth_header = request.headers["Authorization"]
            try:
                if auth_header.startswith("Bearer "):
                    token = auth_header.split(" ")[1]
            except IndexError:
                pass # Will be handled by 'if not token'

        if not token:
            return jsonify({"error": "Token is missing!"}), 401

        try:
            # CRITICAL FIX: Use 'current_app.config["SECRET_KEY"]'.
            # This guarantees it uses the same key defined in app.py.
            data = jwt.decode(token, current_app.config["SECRET_KEY"], algorithms=["HS256"])
            user_id = data.get("user_id")

            if not user_id:
                return jsonify({"error": "Token is invalid (payload missing user_id)"}), 401

        except jwt.ExpiredSignatureError:
            return jsonify({"error": "Token has expired! Please log in again."}), 401
        except jwt.InvalidTokenError as e:
            # This will catch signature errors and other JWT issues
            return jsonify({"error": f"Invalid Token: {str(e)}"}), 401

        # Pass the extracted user_id to the decorated route
        return f(user_id=user_id, *args, **kwargs)

    return decorated
