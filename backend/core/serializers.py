"""
Serializers. Book refs: Fig 5.1–5.6, §1.3.2(iii), §1.6.
"""
from django.contrib.auth import authenticate
from rest_framework import serializers

from .models import (
    Article, ArticleStatus, AuditLog, ComplianceReport, MediaStream,
    Notification, User, VerificationLog,
)


class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ("id", "email", "name", "reg_id", "role", "status", "created_at")
        read_only_fields = ("id", "created_at", "status")


class LoginSerializer(serializers.Serializer):
    email = serializers.EmailField()
    password = serializers.CharField(write_only=True)

    def validate(self, attrs):
        user = authenticate(email=attrs["email"], password=attrs["password"])
        if not user:
            raise serializers.ValidationError("Invalid email or password")
        if not user.is_active:
            raise serializers.ValidationError("Account disabled")
        attrs["user"] = user
        return attrs


class MediaStreamSerializer(serializers.ModelSerializer):
    class Meta:
        model = MediaStream
        fields = "__all__"


class ArticleSerializer(serializers.ModelSerializer):
    author_name = serializers.CharField(source="author.name", read_only=True)
    risk_label = serializers.CharField(read_only=True)

    class Meta:
        model = Article
        fields = (
            "id", "title", "content", "source_name", "category", "keywords",
            "credibility_score", "fake_probability", "status", "author",
            "author_name", "stream", "risk_label", "created_at", "updated_at",
        )
        read_only_fields = (
            "id", "credibility_score", "fake_probability", "status",
            "author", "created_at", "updated_at",
        )

    def validate_keywords(self, value):
        if not isinstance(value, list):
            raise serializers.ValidationError("keywords must be a list")
        return value


class ScanInputSerializer(serializers.Serializer):
    """Fig 5.3 form input."""
    title = serializers.CharField(max_length=300)
    content = serializers.CharField()
    source_name = serializers.CharField(max_length=160)
    category = serializers.ChoiceField(choices=[c[0] for c in Article.category.field.choices])
    keywords = serializers.ListField(child=serializers.CharField(), required=False, default=list)


class VerificationSerializer(serializers.ModelSerializer):
    editor_name = serializers.CharField(source="editor.name", read_only=True)

    class Meta:
        model = VerificationLog
        fields = ("id", "article", "editor", "editor_name", "action", "feedback", "created_at")
        read_only_fields = ("id", "editor", "created_at")


class NotificationSerializer(serializers.ModelSerializer):
    class Meta:
        model = Notification
        fields = "__all__"
        read_only_fields = ("recipient", "created_at")


class AuditLogSerializer(serializers.ModelSerializer):
    user_name = serializers.CharField(source="user.name", read_only=True, default="")

    class Meta:
        model = AuditLog
        fields = "__all__"


class ComplianceReportSerializer(serializers.ModelSerializer):
    class Meta:
        model = ComplianceReport
        fields = "__all__"
        read_only_fields = ("generated_by", "generated_at", "pdf_file")


class UserCreateSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, required=False, default="ChangeMe123!")

    class Meta:
        model = User
        fields = ("id", "email", "name", "reg_id", "role", "password")

    def create(self, validated):
        password = validated.pop("password", "ChangeMe123!")
        return User.objects.create_user(password=password, **validated)