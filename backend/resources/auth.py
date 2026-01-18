from flask_restx import Namespace, Resource, fields
from flask_jwt_extended import create_access_token
from models import db, User
from errors import APIError

api = Namespace("auth", description="Authentication")

signup_model = api.model("Signup", {
    "email": fields.String(required=True),
    "password": fields.String(required=True)
})

login_model = api.model("Login", {
    "email": fields.String(required=True),
    "password": fields.String(required=True)
})

reset_model = api.model("ResetPassword", {
    "email": fields.String(required=True),
    "new_password": fields.String(required=True)
})


@api.route("/signup")
class Signup(Resource):
    @api.expect(signup_model)
    def post(self):
        data = api.payload
        try:
            if User.query.filter_by(email=data["email"]).first():
                raise APIError("Email already exists", 400)

            user = User(email=data["email"])
            user.set_password(data["password"])
            db.session.add(user)
            db.session.commit()
            return {"message": "User created"}, 201
        except ValueError as e:
            raise APIError(str(e), 400)


@api.route("/login")
class Login(Resource):
    @api.expect(login_model)
    def post(self):
        data = api.payload
        user = User.query.filter_by(email=data["email"]).first()

        if not user or not user.check_password(data["password"]):
            raise APIError("Invalid credentials", 401)

        token = create_access_token(identity=str(user.id))
        return {"access_token": token}, 200


@api.route("/reset-password")
class ResetPassword(Resource):
    @api.expect(reset_model)
    def post(self):
        data = api.payload
        try:
            user = User.query.filter_by(email=data["email"]).first()

            if not user:
                raise APIError("User not found", 404)

            user.set_password(data["new_password"])
            db.session.commit()
            return {"message": "Password reset successful"}, 200
        except ValueError as e:
            raise APIError(str(e), 400)
