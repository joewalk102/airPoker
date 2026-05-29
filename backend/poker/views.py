import secrets
import string

from django.db import IntegrityError
from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import Room


class Rooms(APIView):
    """
    APIView for creating a new room.

    GET /api/rooms/<code>/
    POST /api/rooms/
    """

    def get(self, request, code):
        """
        Retrieve details of a room by its code.

        Args:
            request (Request): The HTTP request object.
            code (str): The unique code of the room.

        Returns:
            Response: HTTP response with room details or error message.
        """
        try:
            room = Room.objects.get(code=code.upper())
            return Response({"code": room.code, "name": room.name})
        except Room.DoesNotExist:
            return Response(
                {"error": "Room not found"}, status=status.HTTP_404_NOT_FOUND
            )

    def post(self, request):
        """
        Create a new room, including a unique code.

        Args:
            request (Request): The HTTP request object containing room creation data.

        Returns:
            Response: HTTP response with room details or error message.
        """
        name = (request.data.get("name", "").strip() or "Planning Poker")[:100]
        for _ in range(10):
            try:
                room = Room.objects.create(name=name, code=self._generate_code())
                break
            except IntegrityError:
                continue
        else:
            return Response(
                {"error": "Could not generate a unique room code, please try again"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

        return Response(
            {
                "code": room.code,
                "name": room.name,
                "organizer_token": str(room.organizer_token),
            },
            status=status.HTTP_201_CREATED,
        )

    @staticmethod
    def _generate_code():
        """
        Generate a random 6-digit code.

        Returns:
            str: A randomly generated 6-digit code.
        """
        chars = string.ascii_uppercase + string.digits
        return "".join(secrets.choice(chars) for _ in range(6))
