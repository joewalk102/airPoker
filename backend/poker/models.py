import uuid
from django.db import models


class Room(models.Model):
    code = models.CharField(max_length=8, unique=True)
    name = models.CharField(max_length=100)
    organizer_token = models.UUIDField(default=uuid.uuid4, unique=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f'{self.name} ({self.code})'
