import json
import uuid
from channels.generic.websocket import AsyncWebsocketConsumer
from channels.db import database_sync_to_async
from .models import Room

# In-memory room state: { room_code: { name, participants, votes, ticket, status, vote_round } }
# participants: { channel_name: { id, name, is_organizer, has_voted } }
# votes: { channel_name: { id, name, value } }
rooms_state = {}

VALID_VOTES = {'1', '2', '3', '5', '8', '13', '21', '34', '?', '☕'}


class PokerConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        self.room_code = self.scope['url_route']['kwargs']['room_code']
        self.room_group_name = f'room_{self.room_code}'
        self.participant_name = None
        self.is_organizer = False

        try:
            room = await self.get_room()
        except Room.DoesNotExist:
            await self.close(code=4004)
            return

        # setdefault is atomic in CPython — eliminates the TOCTOU race on concurrent connects
        rooms_state.setdefault(self.room_code, {
            'name': room.name,
            'participants': {},
            'votes': {},
            'ticket': '',
            'status': 'waiting',
            'vote_round': 0,
        })

        await self.channel_layer.group_add(self.room_group_name, self.channel_name)
        await self.accept()

    async def disconnect(self, close_code):
        # Discard from group first so the departing client doesn't receive its own leave broadcast
        await self.channel_layer.group_discard(self.room_group_name, self.channel_name)

        state = rooms_state.get(self.room_code)
        if state:
            state['participants'].pop(self.channel_name, None)
            state['votes'].pop(self.channel_name, None)

            if not state['participants']:
                rooms_state.pop(self.room_code, None)
            else:
                await self.broadcast_state()

    async def receive(self, text_data):
        try:
            data = json.loads(text_data)
        except json.JSONDecodeError:
            return

        handlers = {
            'join': self.handle_join,
            'vote': self.handle_vote,
            'reveal': self.handle_reveal,
            'set_ticket': self.handle_set_ticket,
            'kick': self.handle_kick,
        }
        handler = handlers.get(data.get('type'))
        if handler:
            await handler(data)

    async def handle_join(self, data):
        # Ignore duplicate joins on the same connection
        if self.participant_name is not None:
            return

        name = (data.get('name') or 'Anonymous').strip()[:50]
        organizer_token = data.get('organizer_token', '')
        # Accept client-provided ID so the client always knows its own stable identity
        provided_id = (data.get('participant_id') or '').strip()[:36]
        participant_id = provided_id if provided_id else str(uuid.uuid4())

        room = await self.get_room()
        self.is_organizer = organizer_token == str(room.organizer_token)
        self.participant_name = name

        state = rooms_state.get(self.room_code)
        if not state:
            await self.close(code=4004)
            return

        state['participants'][self.channel_name] = {
            'id': participant_id,
            'name': name,
            'is_organizer': self.is_organizer,
            'has_voted': False,
        }
        await self.broadcast_state()

    async def handle_vote(self, data):
        state = rooms_state.get(self.room_code)
        if not state or not self.participant_name or state['status'] != 'voting':
            return
        if self.channel_name not in state['participants']:
            return

        value = str(data.get('value', '')).strip()
        if value not in VALID_VOTES:
            return

        participant_id = state['participants'][self.channel_name]['id']
        state['votes'][self.channel_name] = {'id': participant_id, 'name': self.participant_name, 'value': value}
        state['participants'][self.channel_name]['has_voted'] = True
        await self.broadcast_state()

    async def handle_reveal(self, data):
        if not self.is_organizer:
            return
        state = rooms_state.get(self.room_code)
        if state and state['status'] == 'voting':
            state['status'] = 'revealed'
            await self.broadcast_state()

    async def handle_set_ticket(self, data):
        if not self.is_organizer:
            return
        state = rooms_state.get(self.room_code)
        if not state:
            return

        ticket = (data.get('ticket') or '').strip()[:200]
        state['ticket'] = ticket
        state['status'] = 'voting'
        state['vote_round'] = state['vote_round'] + 1
        state['votes'] = {}
        for participant in state['participants'].values():
            participant['has_voted'] = False

        await self.broadcast_state()

    async def handle_kick(self, data):
        if not self.is_organizer:
            return
        target_id = (data.get('participant_id') or '').strip()
        state = rooms_state.get(self.room_code)
        if not state:
            return

        target_channel = next(
            (ch for ch, p in state['participants'].items()
             if p['id'] == target_id and ch != self.channel_name),
            None,
        )
        if target_channel:
            await self.channel_layer.send(target_channel, {'type': 'kick_participant'})

    async def kick_participant(self, event):
        await self.send(text_data=json.dumps({'type': 'kicked'}))
        await self.close()

    async def broadcast_state(self):
        state = rooms_state.get(self.room_code)
        if not state:
            return

        participants = [
            {
                'id': p['id'],
                'name': p['name'],
                'is_organizer': p['is_organizer'],
                'has_voted': p['has_voted'],
            }
            for p in state['participants'].values()
        ]

        votes = None
        average = None
        if state['status'] == 'revealed':
            votes = [{'id': v['id'], 'name': v['name'], 'value': v['value']} for v in state['votes'].values()]
            numeric = []
            for v in state['votes'].values():
                try:
                    numeric.append(float(v['value']))
                except (ValueError, TypeError):
                    pass
            if numeric:
                average = round(sum(numeric) / len(numeric), 1)

        await self.channel_layer.group_send(
            self.room_group_name,
            {
                'type': 'send_state',
                'state': {
                    'type': 'room_state',
                    'room_name': state['name'],
                    'ticket': state['ticket'],
                    'status': state['status'],
                    'vote_round': state['vote_round'],
                    'participants': participants,
                    'votes': votes,
                    'average': average,
                },
            },
        )

    async def send_state(self, event):
        await self.send(text_data=json.dumps(event['state']))

    @database_sync_to_async
    def get_room(self):
        return Room.objects.get(code=self.room_code)
