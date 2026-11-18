"""
API views — every Phase 0 use case. Book refs cited per endpoint.
"""
import io
import json
from datetime import datetime
from django.db.models import Avg, Count, Q
from django.http import FileResponse
from django.utils import timezone
from django.core.mail import send_mail
from rest_framework import status, viewsets
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework_simplejwt.tokens import RefreshToken
from .audit import log_action
from .models import (
    Article, ArticleStatus, AuditLog, ComplianceReport, MediaStream,
    Notification, Role, User, VerificationLog,
)
from .permissions import IsAdmin, require_role
from .serializers import (
    ArticleSerializer, AuditLogSerializer, ComplianceReportSerializer,
    LoginSerializer, MediaStreamSerializer, NotificationSerializer,
    ScanInputSerializer, UserCreateSerializer, UserSerializer,
    VerificationSerializer,
)

# ---------- UC-01 / UC-02 / UC-17: Auth ----------
@api_view(["POST"])
@permission_classes([AllowAny])
def login_view(request):
    """Fig 5.1 — Sign In (JWT)."""
    ser = LoginSerializer(data=request.data)
    ser.is_valid(raise_exception=True)
    user = ser.validated_data["user"]
    refresh = RefreshToken.for_user(user)
    AuditLog.objects.create(user=user, method="POST", path=request.path, status_code=201,
                            message=f"AUTH Token Generated for {user.name} (Role: {user.role})")
    return Response({
        "access": str(refresh.access_token),
        "refresh": str(refresh),
        "user": UserSerializer(user).data,
    }, status=status.HTTP_201_CREATED)

@api_view(["POST"])
@permission_classes([AllowAny])
def refresh_view(request):
    """UC-17: refresh access token."""
    token = request.data.get("refresh")
    if not token:
        return Response({"detail": "refresh required"}, status=400)
    try:
        ref = RefreshToken(token)
        return Response({"access": str(ref.access_token)})
    except Exception:
        return Response({"detail": "invalid refresh"}, status=401)

@api_view(["GET"])
@permission_classes([IsAuthenticated])
def me_view(request):
    """UC-02 / Ground rule — identity must come from /auth/me/."""
    return Response(UserSerializer(request.user).data)

@api_view(["POST"])
@permission_classes([IsAuthenticated])
def logout_view(request):
    """UC-17: client discards token; server logs it."""
    log_action(request, "logout", 200)
    return Response({"detail": "logged out"})

# ---------- UC-03: Analyst dashboard stats ----------
@api_view(["GET"])
@permission_classes([IsAuthenticated])
@require_role(Role.ANALYST, Role.EDITOR, Role.ADMIN)
def dashboard_stats_view(request):
    """Fig 5.2 — real metrics computed from DB (ground rule: no hardcoded analytics)."""
    qs = Article.objects.all()
    total = qs.count()
    verified = qs.filter(status=ArticleStatus.VERIFIED_SAFE).count()
    flagged = qs.filter(status=ArticleStatus.FLAGGED_FAKE).count()
    pending = qs.filter(status=ArticleStatus.PENDING_REVIEW).count()
    return Response({
        "total_scanned": total,
        "verified_safe": verified,
        "flagged_fake": flagged,
        "pending_review": pending,
    })

# ---------- UC-04: List articles ----------
@api_view(["GET"])
@permission_classes([IsAuthenticated])
def article_list_view(request):
    """Fig 5.2 — Live Ingested Media Stream Grid + filter."""
    qs = Article.objects.select_related("author").all()
    status_filter = request.query_params.get("status")
    if status_filter and status_filter != "ALL":
        qs = qs.filter(status=status_filter)
    return Response(ArticleSerializer(qs, many=True).data)

@api_view(["GET"])
@permission_classes([IsAuthenticated])
def article_detail_view(request, pk):
    try:
        art = Article.objects.select_related("author").get(pk=pk)
    except Article.DoesNotExist:
        return Response({"detail": "not found"}, status=404)
    return Response(ArticleSerializer(art).data)

# ---------- UC-05 / UC-06: Scan + route ----------
def _heuristic_score(title: str, content: str) -> tuple[int, int]:
    """Deviation D-2 — deterministic fake-news scorer (no BERT in scope)."""
    text = f"{title} {content}".lower()
    red_flags = ["rumor", "unofficial", "claim", "unverified", "allegedly",
                 "fake", "viral", "leak", "conspiracy", "anonymous"]
    green_flags = ["official", "ministry", "press release", "confirmed",
                   "verified", "police", "spokesperson", "approved"]
    score = 60
    for w in red_flags:
        if w in text:
            score -= 9
    for w in green_flags:
        if w in text:
            score += 9
    score = max(3, min(97, score))
    return score, 100 - score

@api_view(["POST"])
@permission_classes([IsAuthenticated])
@require_role(Role.ANALYST)
def article_scan_view(request):
    """Fig 5.3 — Ingest + AI credibility scan + console email trigger."""
    ser = ScanInputSerializer(data=request.data)
    ser.is_valid(raise_exception=True)
    data = ser.validated_data
    score, fake = _heuristic_score(data["title"], data["content"])
    art = Article.objects.create(
        title=data["title"],
        content=data["content"],
        source_name=data["source_name"],
        category=data["category"],
        keywords=data.get("keywords", []),
        credibility_score=score,
        fake_probability=fake,
        status=ArticleStatus.PENDING_REVIEW if fake > 50 else ArticleStatus.VERIFIED_SAFE,
        author=request.user,
    )
    log_action(request, f"Article #{art.pk} Ingested & Scanned (score={score})", 201)
    
    if fake > 50:
        editor_emails = list(User.objects.filter(role=Role.EDITOR).values_list("email", flat=True))
        if editor_emails:
            send_mail(
                subject=f"[RBA Alert] High Fake Risk Detected: #{art.pk}",
                message=f"An article titled '{art.title}' has been flagged with a fake probability of {fake}%. Please log in to review.",
                from_email=None,
                recipient_list=editor_emails,
                fail_silently=True,
            )
        for editor in User.objects.filter(role=Role.EDITOR):
            Notification.objects.create(
                recipient=editor,
                article=art,
                message=f"New flagged item awaiting review: {art.title[:60]}",
            )
    return Response(ArticleSerializer(art).data, status=201)

@api_view(["PATCH"])
@permission_classes([IsAuthenticated])
@require_role(Role.ANALYST)
def article_route_view(request, pk):
    """UC-06 — Save scanned item to dashboard & route to editor queue."""
    try:
        art = Article.objects.get(pk=pk)
    except Article.DoesNotExist:
        return Response({"detail": "not found"}, status=404)
    if art.author_id != request.user.id:
        return Response({"detail": "only author can route"}, status=403)
    art.status = ArticleStatus.PENDING_REVIEW
    art.save(update_fields=["status", "updated_at"])
    log_action(request, f"Article #{art.pk} routed to Editor queue", 200)
    return Response(ArticleSerializer(art).data)

# ---------- UC-07: Editor queue ----------
@api_view(["GET"])
@permission_classes([IsAuthenticated])
@require_role(Role.EDITOR, Role.ADMIN)
def editor_queue_view(request):
    """Fig 5.4 — Flagged & Pending Content Queue."""
    qs = Article.objects.filter(
        status__in=[ArticleStatus.PENDING_REVIEW, ArticleStatus.FLAGGED_FAKE]
    ).select_related("author")
    return Response(ArticleSerializer(qs, many=True).data)

# ---------- UC-08 / UC-09: Editor decisions ----------
def _editor_decision(request, pk, action: str):
    try:
        art = Article.objects.get(pk=pk)
    except Article.DoesNotExist:
        return Response({"detail": "not found"}, status=404)
    
    editorial_comment = request.data.get("editorial_comment", request.data.get("feedback", ""))
    art.editorial_comment = editorial_comment

    if action == "DEBUNK":
        art.status = ArticleStatus.FLAGGED_FAKE
    else:
        art.status = ArticleStatus.VERIFIED_SAFE
        
    art.save(update_fields=["status", "editorial_comment", "updated_at"])
    
    VerificationLog.objects.create(
        article=art, editor=request.user, action=action, feedback=editorial_comment,
    )
    Notification.objects.create(
        recipient=art.author,
        article=art,
        message=f"Editor {request.user.name} {action.lower()}ed article #{art.pk}",
    )
    log_action(request, f"Article #{art.pk} {action}", 200)
    return Response(ArticleSerializer(art).data)

@api_view(["POST"])
@permission_classes([IsAuthenticated])
@require_role(Role.EDITOR)
def article_debunk_view(request, pk):
    """Fig 5.4 — Authorize Debunking (BR-03, BR-05, BR-08)."""
    return _editor_decision(request, pk, "DEBUNK")

@api_view(["POST"])
@permission_classes([IsAuthenticated])
@require_role(Role.EDITOR)
def article_verify_view(request, pk):
    """Fig 5.4 — Clear as Safe (BR-05)."""
    return _editor_decision(request, pk, "VERIFY")

# ---------- UC-10: Analytics ----------
@api_view(["GET"])
@permission_classes([IsAuthenticated])
@require_role(Role.EDITOR, Role.ADMIN)
def analytics_summary_view(request):
    """Fig 5.5 — real aggregates from DB (BR-09)."""
    total = Article.objects.count()
    debunked = Article.objects.filter(status=ArticleStatus.FLAGGED_FAKE).count()
    logs = VerificationLog.objects.select_related("article")
    if logs.exists():
        deltas = [(l.created_at - l.article.created_at).total_seconds() / 60 for l in logs]
        avg_min = round(sum(deltas) / len(deltas), 1)
    else:
        avg_min = 0.0
    months = {}
    for a in Article.objects.all():
        key = a.created_at.strftime("%Y-%m")
        bucket = months.setdefault(key, {"total": 0, "fake": 0})
        bucket["total"] += 1
        if a.status == ArticleStatus.FLAGGED_FAKE:
            bucket["fake"] += 1
    trend = [{"period": k, **v} for k, v in sorted(months.items())]
    return Response({
        "total_ingested": total,
        "total_debunked": debunked,
        "avg_verification_minutes": avg_min,
        "trend": trend,
    })

# ---------- UC-11: PDF export ----------
@api_view(["GET"])
@permission_classes([IsAuthenticated])
@require_role(Role.EDITOR, Role.ADMIN)
def analytics_export_pdf_view(request):
    """Fig 5.5 — Export compliance report. G-4: real PDF via ReportLab."""
    from reportlab.lib.pagesizes import A4
    from reportlab.pdfgen import canvas
    total = Article.objects.count()
    debunked = Article.objects.filter(status=ArticleStatus.FLAGGED_FAKE).count()
    buf = io.BytesIO()
    p = canvas.Canvas(buf, pagesize=A4)
    p.setFont("Helvetica-Bold", 14)
    p.drawString(50, 800, "RWANDA BROADCASTING AGENCY")
    p.setFont("Helvetica-Bold", 12)
    p.drawString(50, 780, "Fake News Detection Compliance Report")
    p.setFont("Helvetica", 10)
    p.drawString(50, 755, f"Generated: {timezone.now().strftime('%Y-%m-%d %H:%M')}")
    p.drawString(50, 740, f"Generated by: {request.user.name} ({request.user.role})")
    p.drawString(50, 715, f"Total Media Ingested: {total}")
    p.drawString(50, 700, f"Fake News Debunked: {debunked}")
    p.drawString(50, 685, "Institutional Status: " +
                 ("All flagged items actioned" if debunked else "No debunks on record"))
    p.showPage()
    p.save()
    buf.seek(0)
    ComplianceReport.objects.create(
        period=timezone.now().strftime("%Y-%m"),
        total_ingested=total,
        total_debunked=debunked,
        generated_by=request.user,
    )
    log_action(request, "Compliance PDF generated", 200)
    return FileResponse(buf, as_attachment=True,
                        filename=f"RBA_Compliance_{timezone.now():%Y%m%d}.pdf",
                        content_type="application/pdf")

# ---------- UC-12: Admin overview ----------
@api_view(["GET"])
@permission_classes([IsAuthenticated])
@require_role(Role.ADMIN)
def admin_overview_view(request):
    """Fig 5.6 — System overview summary."""
    return Response({
        "users_total": User.objects.count(),
        "users_by_role": list(User.objects.values("role").annotate(count=Count("id"))),
        "articles_total": Article.objects.count(),
        "audit_total": AuditLog.objects.count(),
    })

# ---------- UC-13 / UC-14: Users (Admin) ----------
@api_view(["GET", "POST"])
@permission_classes([IsAuthenticated])
@require_role(Role.ADMIN)
def users_view(request):
    if request.method == "GET":
        return Response(UserSerializer(User.objects.all().order_by("id"), many=True).data)
    ser = UserCreateSerializer(data=request.data)
    ser.is_valid(raise_exception=True)
    user = ser.save()
    log_action(request, f"User {user.email} provisioned role={user.role}", 201)
    return Response(UserSerializer(user).data, status=201)

@api_view(["DELETE"])
@permission_classes([IsAuthenticated])
@require_role(Role.ADMIN)
def user_delete_view(request, pk):
    try:
        user = User.objects.get(pk=pk)
    except User.DoesNotExist:
        return Response({"detail": "not found"}, status=404)
    if user.id == request.user.id:
        return Response({"detail": "cannot delete self"}, status=400)
    email = user.email
    user.delete()
    log_action(request, f"User {email} removed", 200)
    return Response(status=204)

# ---------- UC-15: Audit logs ----------
@api_view(["GET"])
@permission_classes([IsAuthenticated])
@require_role(Role.ADMIN)
def audit_logs_view(request):
    qs = AuditLog.objects.select_related("user").all()[:200]
    return Response(AuditLogSerializer(qs, many=True).data)

# ---------- UC-16: Notifications ----------
@api_view(["GET"])
@permission_classes([IsAuthenticated])
def notifications_view(request):
    qs = Notification.objects.filter(recipient=request.user).select_related("article")
    return Response(NotificationSerializer(qs, many=True).data)

@api_view(["POST"])
@permission_classes([IsAuthenticated])
def notification_read_view(request, pk):
    try:
        n = Notification.objects.get(pk=pk, recipient=request.user)
    except Notification.DoesNotExist:
        return Response({"detail": "not found"}, status=404)
    n.read = True
    n.save(update_fields=["read"])
    return Response(NotificationSerializer(n).data)

# ---------- MediaStreams (support & CRUD ViewSet) ----------
@api_view(["GET"])
@permission_classes([IsAuthenticated])
def media_streams_view(request):
    return Response(MediaStreamSerializer(MediaStream.objects.all(), many=True).data)

class MediaStreamViewSet(viewsets.ModelViewSet):
    """Admin CRUD for Media Sources matching ERD MEDIA_SOURC definition."""
    queryset = MediaStream.objects.all().order_by("-id")
    serializer_class = MediaStreamSerializer

    def get_permissions(self):
        if self.request.method in ["POST", "PUT", "PATCH", "DELETE"]:
            return [IsAdmin()]
        return [IsAuthenticated()]