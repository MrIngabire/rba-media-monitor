"""
RBAC decorators + permission classes. Book ref: §3.7.1, Fig 4.3.2–4.3.4.
"""
from functools import wraps
from rest_framework.exceptions import PermissionDenied
from rest_framework.permissions import BasePermission

from .models import Role


def require_role(*allowed_roles):
    """Decorator enforcing role membership on DRF function-based views."""
    def decorator(view_func):
        @wraps(view_func)
        def _wrapped(request, *args, **kwargs):
            user = getattr(request, "user", None)
            if not user or not user.is_authenticated:
                raise PermissionDenied("Authentication required")
            if user.role not in allowed_roles:
                raise PermissionDenied(
                    f"Role '{user.role}' not permitted. Allowed: {', '.join(allowed_roles)}"
                )
            return view_func(request, *args, **kwargs)
        return _wrapped
    return decorator


class IsAnalyst(BasePermission):
    def has_permission(self, request, view):
        return request.user.is_authenticated and request.user.role == Role.ANALYST


class IsEditor(BasePermission):
    def has_permission(self, request, view):
        return request.user.is_authenticated and request.user.role == Role.EDITOR


class IsAdmin(BasePermission):
    def has_permission(self, request, view):
        return request.user.is_authenticated and request.user.role == Role.ADMIN