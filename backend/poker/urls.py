from django.urls import path
from poker import views

urlpatterns = [
    path("rooms/", views.Rooms.as_view(), name="room-create"),
    path("rooms/<str:code>/", views.Rooms.as_view(), name="room-detail"),
]
