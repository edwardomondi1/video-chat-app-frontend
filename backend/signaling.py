from flask_socketio import SocketIO, emit, join_room, leave_room
from flask import request
from flask_jwt_extended import decode_token
from models import db, Room
from errors import APIError

socketio = SocketIO()

# Store active rooms and users
rooms = {}
users = {}

@socketio.on('connect')
def handle_connect():
    print(f'User {request.sid} connected')
    users[request.sid] = {'room': None, 'name': None}

@socketio.on('disconnect')
def handle_disconnect():
    print(f'User {request.sid} disconnected')
    user = users.get(request.sid)
    if user and user['room']:
        leave_room_handler(user['room'])
    if request.sid in users:
        del users[request.sid]

@socketio.on('join_room')
def handle_join_room(data):
    room_id = data['roomId']
    user_name = data.get('userName', f'User-{request.sid[:8]}')
    
    join_room(room_id)
    users[request.sid]['room'] = room_id
    users[request.sid]['name'] = user_name
    
    if room_id not in rooms:
        rooms[room_id] = []
    
    rooms[room_id].append({
        'id': request.sid,
        'name': user_name
    })
    
    # Notify others in room
    emit('user_joined', {
        'userId': request.sid,
        'userName': user_name,
        'users': rooms[room_id]
    }, room=room_id, include_self=False)
    
    # Send current users to new user
    emit('room_users', {'users': rooms[room_id]})
    
    print(f'User {user_name} joined room {room_id}')

@socketio.on('leave_room')
def handle_leave_room(data):
    room_id = data['roomId']
    leave_room_handler(room_id)

def leave_room_handler(room_id):
    if room_id and room_id in rooms:
        rooms[room_id] = [user for user in rooms[room_id] if user['id'] != request.sid]
        
        if not rooms[room_id]:
            del rooms[room_id]
        else:
            emit('user_left', {
                'userId': request.sid,
                'users': rooms[room_id]
            }, room=room_id)
    
    leave_room(room_id)
    if request.sid in users:
        users[request.sid]['room'] = None

# WebRTC Signaling
@socketio.on('offer')
def handle_offer(data):
    emit('offer', {
        'offer': data['offer'],
        'from': request.sid
    }, room=data['to'])

@socketio.on('answer')
def handle_answer(data):
    emit('answer', {
        'answer': data['answer'],
        'from': request.sid
    }, room=data['to'])

@socketio.on('ice_candidate')
def handle_ice_candidate(data):
    emit('ice_candidate', {
        'candidate': data['candidate'],
        'from': request.sid
    }, room=data['to'])

# Chat messages
@socketio.on('chat_message')
def handle_chat_message(data):
    user = users.get(request.sid)
    if user and user['room']:
        emit('chat_message', {
            'message': data['message'],
            'sender': user['name'],
            'senderId': request.sid,
            'timestamp': data.get('timestamp')
        }, room=user['room'])