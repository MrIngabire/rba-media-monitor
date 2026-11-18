"""Audit helper. §Ground rules: every state change logged."""
from .models import AuditLog


def log_action(request, message="", status_code=200):
    try:
        AuditLog.objects.create(
            user=request.user if request.user.is_authenticated else None,
            method=request.method,
            path=request.path,
            status_code=status_code,
            message=message[:255],
        )
    except Exception:
        pass