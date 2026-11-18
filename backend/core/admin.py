from django.contrib import admin
from .models import (Article, AuditLog, ComplianceReport, MediaStream,
                     Notification, User, VerificationLog)

for model in (User, MediaStream, Article, VerificationLog,
              Notification, AuditLog, ComplianceReport):
    admin.site.register(model)