from flask import Flask, redirect, jsonify
from flask_restx import Api
from flask_jwt_extended import JWTManager
from flask_cors import CORS
from config import Config
from models import db, bcrypt
from errors import APIError
from jwt.exceptions import DecodeError, InvalidTokenError
from signaling import socketio
import os

app = Flask(__name__)
app.config.from_object(Config)

db.init_app(app)
bcrypt.init_app(app)
jwt = JWTManager(app)
CORS(app)
socketio.init_app(app, cors_allowed_origins="*")

@jwt.invalid_token_loader
def invalid_token_callback(error):
    return jsonify({"message": "Invalid token"}), 401

@jwt.unauthorized_loader
def missing_token_callback(error):
    return jsonify({"message": "Missing authorization token"}), 401

@jwt.expired_token_loader
def expired_token_callback(jwt_header, jwt_data):
    return jsonify({"message": "Token has expired"}), 401

api = Api(
    app,
    title="Video Call API",
    version="1.0",
    description="Backend API for Video Call App",
    doc="/docs",
    prefix="/api"
)

from resources.auth import api as auth_ns
from resources.rooms import api as rooms_ns

api.add_namespace(auth_ns, path="/auth")
api.add_namespace(rooms_ns, path="/rooms")

@api.errorhandler(APIError)
def handle_api_error(error):
    return {"message": error.message}, error.status_code

@api.errorhandler(Exception)
def handle_exception(error):
    import traceback
    traceback.print_exc()
    return {"message": str(error)}, 500

@app.route("/")
def index():
    return redirect("/docs")

@app.route("/home")
def home():
    return {
        "message": "Video Call API",
        "version": "1.0",
        "endpoints": {
            "docs": "/docs",
            "health": "/api/health",
            "auth": "/api/auth",
            "rooms": "/api/rooms"
        }
    }, 200

@app.route("/api/health")
def health():
    return {"status": "healthy"}, 200


import os

if __name__ == "__main__":
    with app.app_context():
        db.create_all()
    port = int(os.environ.get('PORT', 5001))
    socketio.run(app, debug=False, host='0.0.0.0', port=port)
