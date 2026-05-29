import asyncio
import uuid

from channels.testing import WebsocketCommunicator
from config.asgi import application
from django.test import Client, TestCase
from django.urls import reverse

from .models import Room


class RoomModelTestCase(TestCase):
    """Test the Room model."""

    def get_unique_code(self):
        """Get a unique room code."""
        return uuid.uuid4().hex[:8].upper()

    def test_room_creation(self):
        """Test creating a room."""
        code = self.get_unique_code()
        room = Room.objects.create(name="Test Room", code=code)
        self.assertEqual(room.name, "Test Room")
        self.assertEqual(room.code, code)
        self.assertIsNotNone(room.organizer_token)
        self.assertIsNotNone(room.created_at)

    def test_room_string_representation(self):
        """Test room string representation."""
        code = self.get_unique_code()
        room = Room.objects.create(name="Test Room", code=code)
        self.assertEqual(str(room), f"Test Room ({code})")

    def test_organizer_token_uniqueness(self):
        """Test that organizer tokens are unique."""
        code1 = self.get_unique_code()
        code2 = self.get_unique_code()
        room1 = Room.objects.create(name="Room 1", code=code1)
        room2 = Room.objects.create(name="Room 2", code="ABC124")
        self.assertNotEqual(room1.organizer_token, room2.organizer_token)


class RoomCreateViewTestCase(TestCase):
    """Test the room creation REST endpoint."""

    def setUp(self):
        self.client = Client()
        self.create_url = reverse("room-create")

    def test_create_room_with_name(self):
        """Test creating a room with a custom name."""
        response = self.client.post(
            self.create_url,
            {"name": "Sprint Planning"},
            content_type="application/json",
        )
        self.assertEqual(response.status_code, 201)
        data = response.json()
        self.assertIn("code", data)
        self.assertIn("name", data)
        self.assertIn("organizer_token", data)
        self.assertEqual(data["name"], "Sprint Planning")
        room = Room.objects.get(code=data["code"])
        self.assertEqual(room.name, "Sprint Planning")

    def test_create_room_without_name(self):
        """Test creating a room with default name."""
        response = self.client.post(
            self.create_url, {}, content_type="application/json"
        )
        self.assertEqual(response.status_code, 201)
        data = response.json()
        self.assertEqual(data["name"], "Planning Poker")

    def test_create_room_with_whitespace_name(self):
        """Test creating a room with whitespace-only name uses default."""
        response = self.client.post(
            self.create_url,
            {"name": "   "},
            content_type="application/json",
        )
        self.assertEqual(response.status_code, 201)
        data = response.json()
        self.assertEqual(data["name"], "Planning Poker")

    def test_create_room_name_truncated(self):
        """Test that room names are truncated to 100 characters."""
        long_name = "A" * 150
        response = self.client.post(
            self.create_url,
            {"name": long_name},
            content_type="application/json",
        )
        self.assertEqual(response.status_code, 201)
        data = response.json()
        self.assertEqual(len(data["name"]), 100)

    def test_create_room_generates_unique_code(self):
        """Test that each room gets a unique code."""
        response1 = self.client.post(
            self.create_url,
            {"name": "Room 1"},
            content_type="application/json",
        )
        response2 = self.client.post(
            self.create_url,
            {"name": "Room 2"},
            content_type="application/json",
        )
        self.assertEqual(response1.status_code, 201)
        self.assertEqual(response2.status_code, 201)
        code1 = response1.json()["code"]
        code2 = response2.json()["code"]
        self.assertNotEqual(code1, code2)

    def test_organizer_token_in_response(self):
        """Test that organizer token is returned and valid."""
        response = self.client.post(
            self.create_url,
            {"name": "Test Room"},
            content_type="application/json",
        )
        data = response.json()
        token = data["organizer_token"]
        room = Room.objects.get(code=data["code"])
        self.assertEqual(str(room.organizer_token), token)


class RoomDetailViewTestCase(TestCase):
    """Test the room detail REST endpoint."""

    def setUp(self):
        self.client = Client()
        self.code = uuid.uuid4().hex[:8].upper()
        self.room = Room.objects.create(name="Test Room", code=self.code)

    def test_get_room_by_code(self):
        """Test retrieving a room by code."""
        response = self.client.get(reverse("room-detail", args=[self.code]))
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data["code"], self.code)
        self.assertEqual(data["name"], "Test Room")

    def test_get_room_case_insensitive(self):
        """Test that room code lookup is case-insensitive."""
        response = self.client.get(reverse("room-detail", args=[self.code.lower()]))
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data["code"], self.code)

    def test_get_nonexistent_room(self):
        """Test retrieving a room that doesn't exist."""
        response = self.client.get(reverse("room-detail", args=["NONEXISTENT"]))
        self.assertEqual(response.status_code, 404)
        data = response.json()
        self.assertEqual(data["error"], "Room not found")


class PokerConsumerTestCase(TestCase):
    """Test the WebSocket consumer."""

    def setUp(self):
        """Set up test fixtures."""
        pass

    def get_unique_code(self):
        """Get a unique room code."""
        return uuid.uuid4().hex[:8].upper()

    async def async_test_connect_valid_room(self):
        """Test connecting to a valid room."""
        code = self.get_unique_code()
        room = await self.async_create_room("Test Room", code)
        communicator = WebsocketCommunicator(
            application, f"ws/room/{code}/", headers=[(b"origin", b"http://localhost")]
        )
        connected, subprotocol = await communicator.connect()
        self.assertTrue(connected)
        await communicator.disconnect()

    async def async_test_connect_invalid_room(self):
        """Test connecting to a non-existent room."""
        communicator = WebsocketCommunicator(
            application,
            "ws/room/NONEXISTENT/",
            headers=[(b"origin", b"http://localhost")],
        )
        connected, subprotocol = await communicator.connect()
        self.assertFalse(connected)

    async def async_test_join_message(self):
        """Test sending a join message."""
        code = self.get_unique_code()
        room = await self.async_create_room("Test Room", code)
        communicator = WebsocketCommunicator(
            application, f"ws/room/{code}/", headers=[(b"origin", b"http://localhost")]
        )
        connected, _ = await communicator.connect()
        self.assertTrue(connected)

        await communicator.send_json_to(
            {
                "type": "join",
                "name": "Alice",
                "organizer_token": "",
                "participant_id": str(uuid.uuid4()),
            }
        )

        response = await communicator.receive_json_from(timeout=5)
        self.assertEqual(response["type"], "room_state")
        self.assertEqual(len(response["participants"]), 1)
        self.assertEqual(response["participants"][0]["name"], "Alice")
        self.assertFalse(response["participants"][0]["is_organizer"])

        await communicator.disconnect()

    async def async_test_join_as_organizer(self):
        """Test joining as organizer."""
        code = self.get_unique_code()
        room = await self.async_create_room("Test Room", code)
        organizer_token = str(room.organizer_token)

        communicator = WebsocketCommunicator(
            application, f"ws/room/{code}/", headers=[(b"origin", b"http://localhost")]
        )
        connected, _ = await communicator.connect()
        self.assertTrue(connected)

        await communicator.send_json_to(
            {
                "type": "join",
                "name": "Organizer",
                "organizer_token": organizer_token,
                "participant_id": str(uuid.uuid4()),
            }
        )

        response = await communicator.receive_json_from(timeout=5)
        self.assertEqual(response["type"], "room_state")
        self.assertTrue(response["participants"][0]["is_organizer"])

        await communicator.disconnect()

    async def async_test_vote_message(self):
        """Test sending a vote message."""
        code = self.get_unique_code()
        room = await self.async_create_room("Test Room", code)
        organizer_token = str(room.organizer_token)
        communicator = WebsocketCommunicator(
            application, f"ws/room/{code}/", headers=[(b"origin", b"http://localhost")]
        )
        connected, _ = await communicator.connect()
        self.assertTrue(connected)

        participant_id = str(uuid.uuid4())
        await communicator.send_json_to(
            {
                "type": "join",
                "name": "Alice",
                "organizer_token": organizer_token,
                "participant_id": participant_id,
            }
        )
        await communicator.receive_json_from(timeout=5)

        # Set ticket as organizer
        await communicator.send_json_to(
            {
                "type": "set_ticket",
                "ticket": "PROJ-123",
            }
        )
        response = await communicator.receive_json_from(timeout=5)
        self.assertEqual(response["status"], "voting")

        # Vote
        await communicator.send_json_to(
            {
                "type": "vote",
                "value": "5",
            }
        )
        response = await communicator.receive_json_from(timeout=5)
        self.assertTrue(response["participants"][0]["has_voted"])
        self.assertEqual(response["votes"], None)  # Not revealed yet

        await communicator.disconnect()

    async def async_test_invalid_vote(self):
        """Test sending an invalid vote."""
        code = self.get_unique_code()
        room = await self.async_create_room("Test Room", code)
        communicator = WebsocketCommunicator(
            application, f"ws/room/{code}/", headers=[(b"origin", b"http://localhost")]
        )
        connected, _ = await communicator.connect()
        self.assertTrue(connected)

        await communicator.send_json_to(
            {
                "type": "join",
                "name": "Alice",
                "organizer_token": "",
                "participant_id": str(uuid.uuid4()),
            }
        )
        await communicator.receive_json_from(timeout=5)

        # Try to vote before status is "voting"
        await communicator.send_json_to(
            {
                "type": "vote",
                "value": "5",
            }
        )
        response = await communicator.receive_json_from(timeout=5)
        self.assertEqual(len(response["participants"]), 1)
        self.assertFalse(response["participants"][0]["has_voted"])

        await communicator.disconnect()

    async def async_test_reveal_message(self):
        """Test reveal message and average calculation."""
        code = self.get_unique_code()
        room = await self.async_create_room("Test Room", code)
        organizer_token = str(room.organizer_token)

        # Organizer connects
        org_comm = WebsocketCommunicator(
            application, f"ws/room/{code}/", headers=[(b"origin", b"http://localhost")]
        )
        connected, _ = await org_comm.connect()
        self.assertTrue(connected)

        org_id = str(uuid.uuid4())
        await org_comm.send_json_to(
            {
                "type": "join",
                "name": "Organizer",
                "organizer_token": organizer_token,
                "participant_id": org_id,
            }
        )
        await org_comm.receive_json_from(timeout=5)

        # Participant connects
        part_comm = WebsocketCommunicator(
            application, f"ws/room/{code}/", headers=[(b"origin", b"http://localhost")]
        )
        connected, _ = await part_comm.connect()
        await part_comm.send_json_to(
            {
                "type": "join",
                "name": "Participant",
                "organizer_token": "",
                "participant_id": str(uuid.uuid4()),
            }
        )
        await part_comm.receive_json_from(timeout=5)

        # Organizer sets ticket
        await org_comm.send_json_to(
            {
                "type": "set_ticket",
                "ticket": "PROJ-123",
            }
        )
        await org_comm.receive_json_from(timeout=5)
        await part_comm.receive_json_from(timeout=5)

        # Both vote
        await org_comm.send_json_to(
            {
                "type": "vote",
                "value": "5",
            }
        )
        await org_comm.receive_json_from(timeout=5)

        await part_comm.send_json_to(
            {
                "type": "vote",
                "value": "3",
            }
        )
        await part_comm.receive_json_from(timeout=5)

        # Give some time for broadcasts to be processed
        await asyncio.sleep(0.1)

        # Drain all pending messages on both participants before reveal
        for comm in [org_comm, part_comm]:
            while True:
                try:
                    await asyncio.wait_for(comm.receive_json_from(), timeout=0.05)
                except asyncio.TimeoutError:
                    break

        # Organizer reveals
        await org_comm.send_json_to(
            {
                "type": "reveal",
            }
        )

        org_response = await org_comm.receive_json_from(timeout=5)
        self.assertEqual(org_response["status"], "revealed")
        self.assertIsNotNone(org_response["votes"])
        self.assertEqual(org_response["average"], 4.0)
        self.assertEqual(len(org_response["votes"]), 2)

        part_response = await part_comm.receive_json_from(timeout=5)
        self.assertEqual(part_response["status"], "revealed")
        self.assertEqual(part_response["average"], 4.0)

        await org_comm.disconnect()
        await part_comm.disconnect()

    async def async_test_average_calculation(self):
        """Test average calculation with non-numeric votes."""
        code = self.get_unique_code()
        room = await self.async_create_room("Test Room", code)
        organizer_token = str(room.organizer_token)

        # Organizer connects
        org_comm = WebsocketCommunicator(
            application, f"ws/room/{code}/", headers=[(b"origin", b"http://localhost")]
        )
        connected, _ = await org_comm.connect()

        await org_comm.send_json_to(
            {
                "type": "join",
                "name": "Organizer",
                "organizer_token": organizer_token,
                "participant_id": str(uuid.uuid4()),
            }
        )
        await org_comm.receive_json_from(timeout=5)

        # Participants connect and vote
        votes = ["1", "2", "?", "☕", "3"]
        communicators = []

        for i, vote_value in enumerate(votes):
            comm = WebsocketCommunicator(
                application,
                f"ws/room/{code}/",
                headers=[(b"origin", b"http://localhost")],
            )
            connected, _ = await comm.connect()
            await comm.send_json_to(
                {
                    "type": "join",
                    "name": f"Participant{i}",
                    "organizer_token": "",
                    "participant_id": str(uuid.uuid4()),
                }
            )
            await comm.receive_json_from(timeout=5)

            communicators.append(comm)

        # Set ticket
        await org_comm.send_json_to(
            {
                "type": "set_ticket",
                "ticket": "PROJ-123",
            }
        )
        await org_comm.receive_json_from(timeout=5)

        for comm in communicators:
            await comm.receive_json_from(timeout=5)

        # All vote
        for comm, vote_value in zip(communicators, votes):
            await comm.send_json_to(
                {
                    "type": "vote",
                    "value": vote_value,
                }
            )
            await comm.receive_json_from(timeout=5)

        # Consume any pending broadcasts on organizer before revealing
        # (participant vote broadcasts may be queued)
        while True:
            try:
                await asyncio.wait_for(org_comm.receive_json_from(), timeout=0.1)
            except asyncio.TimeoutError:
                break  # No more pending messages

        # Organizer reveals
        await org_comm.send_json_to(
            {
                "type": "reveal",
            }
        )

        response = await org_comm.receive_json_from(timeout=5)
        self.assertEqual(response["status"], "revealed")
        # Average of 1, 2, 3 (excluding ? and ☕)
        self.assertEqual(response["average"], 2.0)

        for comm in communicators:
            await comm.disconnect()
        await org_comm.disconnect()

    async def async_test_set_ticket_clears_votes(self):
        """Test that setting a new ticket clears votes."""
        code = self.get_unique_code()
        room = await self.async_create_room("Test Room", code)
        organizer_token = str(room.organizer_token)

        org_comm = WebsocketCommunicator(
            application, f"ws/room/{code}/", headers=[(b"origin", b"http://localhost")]
        )
        connected, _ = await org_comm.connect()

        await org_comm.send_json_to(
            {
                "type": "join",
                "name": "Organizer",
                "organizer_token": organizer_token,
                "participant_id": str(uuid.uuid4()),
            }
        )
        await org_comm.receive_json_from(timeout=5)

        # Set first ticket
        await org_comm.send_json_to(
            {
                "type": "set_ticket",
                "ticket": "PROJ-123",
            }
        )
        response = await org_comm.receive_json_from(timeout=5)
        self.assertEqual(response["status"], "voting")
        self.assertEqual(response["vote_round"], 1)

        # Vote
        await org_comm.send_json_to(
            {
                "type": "vote",
                "value": "5",
            }
        )
        response = await org_comm.receive_json_from(timeout=5)
        self.assertTrue(response["participants"][0]["has_voted"])

        # Set next ticket
        await org_comm.send_json_to(
            {
                "type": "set_ticket",
                "ticket": "PROJ-124",
            }
        )
        response = await org_comm.receive_json_from(timeout=5)
        self.assertEqual(response["vote_round"], 2)
        self.assertFalse(response["participants"][0]["has_voted"])
        self.assertIsNone(response["votes"])  # votes is None when status != "revealed"

        await org_comm.disconnect()

    async def async_test_non_organizer_cannot_reveal(self):
        """Test that non-organizers cannot reveal votes."""
        code = self.get_unique_code()
        room = await self.async_create_room("Test Room", code)
        organizer_token = str(room.organizer_token)

        # Organizer sets up
        org_comm = WebsocketCommunicator(
            application, f"ws/room/{code}/", headers=[(b"origin", b"http://localhost")]
        )
        connected, _ = await org_comm.connect()

        await org_comm.send_json_to(
            {
                "type": "join",
                "name": "Organizer",
                "organizer_token": organizer_token,
                "participant_id": str(uuid.uuid4()),
            }
        )
        await org_comm.receive_json_from(timeout=5)

        await org_comm.send_json_to(
            {
                "type": "set_ticket",
                "ticket": "PROJ-123",
            }
        )
        await org_comm.receive_json_from(timeout=5)

        # Participant tries to reveal
        part_comm = WebsocketCommunicator(
            application, f"ws/room/{code}/", headers=[(b"origin", b"http://localhost")]
        )
        connected, _ = await part_comm.connect()

        await part_comm.send_json_to(
            {
                "type": "join",
                "name": "Participant",
                "organizer_token": "",
                "participant_id": str(uuid.uuid4()),
            }
        )
        await part_comm.receive_json_from(timeout=5)

        # Try to reveal
        await part_comm.send_json_to(
            {
                "type": "reveal",
            }
        )
        response = await part_comm.receive_json_from(timeout=5)
        self.assertEqual(response["status"], "voting")  # Should still be voting

        await org_comm.disconnect()
        await part_comm.disconnect()

    @staticmethod
    async def async_create_room(name, code):
        """Helper to create a room."""
        return await Room.objects.acreate(name=name, code=code)

    def test_connect_valid_room(self):
        """Sync wrapper for async test."""
        import asyncio

        asyncio.run(self.async_test_connect_valid_room())

    def test_connect_invalid_room(self):
        """Sync wrapper for async test."""
        import asyncio

        asyncio.run(self.async_test_connect_invalid_room())

    def test_join_message(self):
        """Sync wrapper for async test."""
        import asyncio

        asyncio.run(self.async_test_join_message())

    def test_join_as_organizer(self):
        """Sync wrapper for async test."""
        import asyncio

        asyncio.run(self.async_test_join_as_organizer())

    def test_vote_message(self):
        """Sync wrapper for async test."""
        import asyncio

        asyncio.run(self.async_test_vote_message())

    def test_invalid_vote(self):
        """Sync wrapper for async test."""
        import asyncio

        asyncio.run(self.async_test_invalid_vote())

    def test_reveal_message(self):
        """Sync wrapper for async test."""
        import asyncio

        asyncio.run(self.async_test_reveal_message())

    def test_average_calculation(self):
        """Sync wrapper for async test."""
        import asyncio

        asyncio.run(self.async_test_average_calculation())

    def test_set_ticket_clears_votes(self):
        """Sync wrapper for async test."""
        import asyncio

        asyncio.run(self.async_test_set_ticket_clears_votes())

    def test_non_organizer_cannot_reveal(self):
        """Sync wrapper for async test."""
        import asyncio

        asyncio.run(self.async_test_non_organizer_cannot_reveal())
