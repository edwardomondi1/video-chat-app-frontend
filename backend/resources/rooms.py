from flask_restx import Namespace, Resource, fields
from flask_jwt_extended import jwt_required, get_jwt_identity
from models import db, Room
from errors import APIError
import uuid

api = Namespace("rooms", description="Room management")

room_model = api.model("Room", {
    "name": fields.String(required=True, min_length=3, max_length=50)
})

join_model = api.model("JoinRoom", {
    "room_id": fields.String(required=True)
})


@api.route("/")
class RoomList(Resource):
    def get(self):
        rooms = Room.query.filter_by(is_active=True).all()
        return [{"id": r.id, "name": r.name, "room_id": r.room_id} for r in rooms], 200

    @jwt_required()
    @api.expect(room_model)
    def post(self):
        try:
            data = api.payload
            if Room.query.filter_by(name=data["name"]).first():
                raise APIError("Room already exists", 400)

            room_id = str(uuid.uuid4())
            room = Room(name=data["name"], room_id=room_id)
            db.session.add(room)
            db.session.commit()
            return {"id": room.id, "name": room.name, "room_id": room.room_id}, 201
        except APIError:
            raise
        except ValueError as e:
            raise APIError(str(e), 400)
        except Exception as e:
            db.session.rollback()
            raise APIError(f"Error creating room: {str(e)}", 500)


@api.route("/join")
class JoinRoom(Resource):
    @api.expect(join_model)
    def post(self):
        data = api.payload
        room = Room.query.filter_by(room_id=data["room_id"], is_active=True).first()
        if not room:
            raise APIError("Room not found", 404)
        return {"id": room.id, "name": room.name, "room_id": room.room_id}, 200


@api.route("/<int:room_id>")
class RoomDetail(Resource):
    def get(self, room_id):
        room = db.session.get(Room, room_id)
        if not room or not room.is_active:
            raise APIError("Room not found", 404)
        return {"id": room.id, "name": room.name, "room_id": room.room_id}, 200

    @jwt_required()
    def delete(self, room_id):
        room = db.session.get(Room, room_id)
        if not room:
            raise APIError("Room not found", 404)
        
        room.is_active = False
        db.session.commit()
        return {"message": "Room deleted"}, 200
