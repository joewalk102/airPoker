import secrets
import string
from django.db import IntegrityError
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from .models import Room


def _generate_code():
    chars = string.ascii_uppercase + string.digits
    return ''.join(secrets.choice(chars) for _ in range(6))


class RoomCreateView(APIView):
    def post(self, request):
        name = (request.data.get('name') or 'Planning Poker').strip()[:100]
        for _ in range(10):
            try:
                room = Room.objects.create(name=name, code=_generate_code())
                break
            except IntegrityError:
                continue
        else:
            return Response(
                {'error': 'Could not generate a unique room code, please try again'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

        return Response(
            {
                'code': room.code,
                'name': room.name,
                'organizer_token': str(room.organizer_token),
            },
            status=status.HTTP_201_CREATED,
        )


class RoomDetailView(APIView):
    def get(self, request, code):
        try:
            room = Room.objects.get(code=code.upper())
            return Response({'code': room.code, 'name': room.name})
        except Room.DoesNotExist:
            return Response({'error': 'Room not found'}, status=status.HTTP_404_NOT_FOUND)
