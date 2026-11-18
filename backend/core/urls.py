"""URL registration. Book refs per endpoint (see views.py docstrings)."""
from django.urls import path, include
from rest_framework.routers import DefaultRouter
from . import views

# Router for dynamic Media Sources CRUD (Admin)
router = DefaultRouter()
router.register(r'media-sources-crud', views.MediaStreamViewSet, basename='media-sources-crud')

urlpatterns = [
    # Auth
    path("auth/login/", views.login_view),
    path("auth/refresh/", views.refresh_view),
    path("auth/me/", views.me_view),
    path("auth/logout/", views.logout_view),
    
    # Dashboard
    path("dashboard/stats/", views.dashboard_stats_view),
    
    # Articles
    path("articles/", views.article_list_view),
    path("articles/scan/", views.article_scan_view),
    path("articles/editor_queue/", views.editor_queue_view),
    path("articles/<int:pk>/", views.article_detail_view),
    path("articles/<int:pk>/route/", views.article_route_view),
    path("articles/<int:pk>/debunk/", views.article_debunk_view),
    path("articles/<int:pk>/verify/", views.article_verify_view),
    
    # Analytics
    path("analytics/summary/", views.analytics_summary_view),
    path("analytics/export_pdf/", views.analytics_export_pdf_view),
    
    # Admin
    path("admin/overview/", views.admin_overview_view),
    path("users/", views.users_view),
    path("users/<int:pk>/", views.user_delete_view),
    path("audit-logs/", views.audit_logs_view),
    
    # Notifications
    path("notifications/", views.notifications_view),
    path("notifications/<int:pk>/read/", views.notification_read_view),
    
    # MediaStreams (Read-only support & Admin CRUD router)
    path("media-streams/", views.media_streams_view),
] + router.urls