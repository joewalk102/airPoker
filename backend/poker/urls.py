from django.urls import path
from . import views

urlpatterns = [
    path('rooms/', views.RoomCreateView.as_view()),
    path('rooms/<str:code>/', views.RoomDetailView.as_view()),
]
