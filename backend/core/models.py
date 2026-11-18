"""
Core data models. Book refs: §4.5.1 ERD, §3.7.1 RBAC, §1.3.2 objectives,
Fig 5.2–5.6 screens, §1.6 human-in-the-loop.
"""
from django.contrib.auth.models import AbstractBaseUser, BaseUserManager, PermissionsMixin
from django.db import models
from django.utils import timezone

class Role(models.TextChoices):
    ANALYST = "ANALYST", "Media Analyst"
    EDITOR = "EDITOR", "Senior Editor"
    ADMIN = "ADMIN", "Administrator"

class ArticleStatus(models.TextChoices):
    DRAFT = "DRAFT", "Draft"
    PENDING_REVIEW = "PENDING_REVIEW", "Pending Review"
    FLAGGED_FAKE = "FLAGGED_FAKE", "Flagged Fake"
    VERIFIED_SAFE = "VERIFIED_SAFE", "Verified Safe"

class Category(models.TextChoices):
    SOCIAL_MEDIA = "SOCIAL_MEDIA", "Social Media Broadcast"
    RADIO_TRANSCRIPT = "RADIO_TRANSCRIPT", "Radio Audio Transcript"
    TV_NEWS = "TV_NEWS", "TV News Report"
    ONLINE_PORTAL = "ONLINE_PORTAL", "Online News Website"

class UserManager(BaseUserManager):
    def create_user(self, email, password=None, **extra):
        if not email:
            raise ValueError("Email required")
        email = self.normalize_email(email)
        user = self.model(email=email, **extra)
        user.set_password(password or "ChangeMe123!")
        user.save(using=self._db)
        return user
    def create_superuser(self, email, password=None, **extra):
        extra.setdefault("role", Role.ADMIN)
        extra.setdefault("is_staff", True)
        extra.setdefault("is_superuser", True)
        return self.create_user(email, password, **extra)

class User(AbstractBaseUser, PermissionsMixin):
    """§3.7.1 RBAC: Analyst / Editor / Admin."""
    email = models.EmailField(unique=True)
    name = models.CharField(max_length=120)
    reg_id = models.CharField(max_length=40, blank=True, default="")
    role = models.CharField(max_length=12, choices=Role.choices, default=Role.ANALYST)
    status = models.CharField(max_length=12, default="Active")
    is_active = models.BooleanField(default=True)
    is_staff = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    USERNAME_FIELD = "email"
    REQUIRED_FIELDS = ["name"]
    objects = UserManager()
    def __str__(self):
        return f"{self.name} <{self.email}> [{self.role}]"

class MediaStream(models.Model):
    """Ingested feed source. §2.2.2, Fig 5.3."""
    name = models.CharField(max_length=160)
    platform = models.CharField(max_length=24, choices=Category.choices, default=Category.SOCIAL_MEDIA)
    active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    def __str__(self):
        return f"{self.name} ({self.platform})"

class Article(models.Model):
    """Ingested news item. Fig 5.2, 5.3, 5.4; §1.3.2(iii)."""
    title = models.CharField(max_length=300)
    content = models.TextField()
    source_name = models.CharField(max_length=160)
    category = models.CharField(max_length=24, choices=Category.choices, default=Category.SOCIAL_MEDIA)
    keywords = models.JSONField(default=list, blank=True)
    credibility_score = models.PositiveSmallIntegerField(default=0)  # 0..100
    fake_probability = models.PositiveSmallIntegerField(default=0)   # 0..100
    status = models.CharField(max_length=20, choices=ArticleStatus.choices, default=ArticleStatus.DRAFT)
    author = models.ForeignKey(User, on_delete=models.PROTECT, related_name="articles")
    stream = models.ForeignKey(MediaStream, on_delete=models.SET_NULL, null=True, blank=True, related_name="articles")
    editorial_comment = models.TextField(blank=True, default="")  # Added to match Book Appendix A.1
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["status"]),
            models.Index(fields=["fake_probability"]),
        ]
    def __str__(self):
        return f"#{self.pk} {self.title[:60]}"
    @property
    def risk_label(self):
        if self.fake_probability > 50:
            return "high"
        if self.fake_probability > 20:
            return "medium"
        return "low"
    @property
    def is_actionable(self):
        return self.status in (ArticleStatus.PENDING_REVIEW, ArticleStatus.FLAGGED_FAKE)

class VerificationLog(models.Model):
    """Editor decisions. §1.6 human-in-the-loop, Fig 5.4."""
    ACTIONS = [("DEBUNK", "Debunked"), ("VERIFY", "Verified Safe")]
    article = models.ForeignKey(Article, on_delete=models.CASCADE, related_name="verifications")
    editor = models.ForeignKey(User, on_delete=models.PROTECT, related_name="verifications")
    action = models.CharField(max_length=10, choices=ACTIONS)
    feedback = models.TextField(blank=True, default="")
    created_at = models.DateTimeField(auto_now_add=True)
    class Meta:
        ordering = ["-created_at"]

class Notification(models.Model):
    """Fig 4.4 'NotifyEditor', Fig 5.4 badge."""
    recipient = models.ForeignKey(User, on_delete=models.CASCADE, related_name="notifications")
    message = models.CharField(max_length=255)
    article = models.ForeignKey(Article, on_delete=models.SET_NULL, null=True, blank=True)
    read = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    class Meta:
        ordering = ["-created_at"]

class AuditLog(models.Model):
    """§Ground rules, Fig 5.6 audit terminal."""
    user = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True)
    method = models.CharField(max_length=8)
    path = models.CharField(max_length=255)
    status_code = models.PositiveSmallIntegerField(default=200)
    message = models.CharField(max_length=255, blank=True, default="")
    timestamp = models.DateTimeField(auto_now_add=True)
    class Meta:
        ordering = ["-timestamp"]

class ComplianceReport(models.Model):
    """Fig 5.5, §1.4."""
    period = models.CharField(max_length=20)  # e.g. "2026-07"
    total_ingested = models.PositiveIntegerField(default=0)
    total_debunked = models.PositiveIntegerField(default=0)
    avg_verification_minutes = models.FloatField(default=0.0)
    generated_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True)
    generated_at = models.DateTimeField(default=timezone.now)
    pdf_file = models.FileField(upload_to="reports/", blank=True, null=True)
    class Meta:
        ordering = ["-generated_at"]