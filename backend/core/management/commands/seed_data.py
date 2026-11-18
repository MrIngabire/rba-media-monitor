"""
Seed database script. 
Populates RBA AI Media Monitoring Platform with realistic media streams,
ingested articles, NLP scores, and editorial verification logs.
"""
import random
from datetime import timedelta
from django.core.management.base import BaseCommand
from django.utils import timezone
from core.models import (
    Article, ArticleStatus, AuditLog, Category,
    MediaStream, Notification, Role, User, VerificationLog
)

SAMPLE_ARTICLES = [
    (
        "Official Ministry Press Release on Kigali Innovation City Expansion",
        "The Ministry of ICT and Innovation officially confirmed in a press release that phase two construction of Kigali Innovation City will begin next month. The government spokesperson verified the approved infrastructure budget.",
        "RBA News Portal",
        Category.ONLINE_PORTAL,
        ["infrastructure", "ICT", "Kigali", "official"],
        96,
        4,
        ArticleStatus.VERIFIED_SAFE,
        "Confirmed safe by RBA editorial team following official ICT Ministry release."
    ),
    (
        "Unverified Viral Claim of Emergency Road Blockades in Northern Province",
        "Viral social media posts allege unofficial emergency road blockades along the Musanze highway due to weather damage. Rwanda National Police have not confirmed any closures. Anonymous accounts continue sharing unverified video clips.",
        "X (Twitter) Viral Feed",
        Category.SOCIAL_MEDIA,
        ["viral", "rumor", "Musanze", "unverified"],
        18,
        82,
        ArticleStatus.FLAGGED_FAKE,
        "Police spokesperson confirmed no blockades exist. Content marked as debunked rumor."
    ),
    (
        "Supposed Fuel Price Hike Rumor Circulating on WhatsApp Groups",
        "Voice notes circulating on WhatsApp claim RURA will announce an immediate 30% fuel price hike tonight. RURA has published no such notice and official channels advise the public to ignore unverified rumor threads.",
        "Radio Rwanda Broadcast Transcript",
        Category.RADIO_TRANSCRIPT,
        ["fuel", "rumor", "WhatsApp", "RURA"],
        35,
        65,
        ArticleStatus.PENDING_REVIEW,
        ""  # Awaiting Senior Editor Action
    ),
    (
        "Local Agricultural Cooperative Expansion Announcement in Eastern Province",
        "TV Rwanda Local Desk reports the confirmed expansion of a local maize agricultural cooperative in Kayonza District, verified by Ministry of Agriculture district officials.",
        "TV Rwanda Local Desk",
        Category.TV_NEWS,
        ["agriculture", "Kayonza", "official"],
        88,
        12,
        ArticleStatus.VERIFIED_SAFE,
        "Verified with Kayonza District agriculture officer."
    ),
    (
        "Rumored Cabinet Reshuffle Broadcasts Online Without Official Confirmation",
        "Unverified blog posts allege an unannounced government cabinet reshuffle scheduled for this weekend. No government spokesperson or official state house channel has confirmed the rumor.",
        "Online Portal Aggregator",
        Category.ONLINE_PORTAL,
        ["cabinet", "politics", "unverified"],
        22,
        78,
        ArticleStatus.PENDING_REVIEW,
        ""  # Awaiting Senior Editor Action
    ),
    (
        "Official RBA Broadcast: National Public Health Vaccination Campaign Launch",
        "RBA TV officially confirmed the nationwide rollout of the seasonal flu vaccination campaign by the Ministry of Health. Ministry officials confirmed dates across all district hospitals.",
        "RBA TV Broadcast",
        Category.TV_NEWS,
        ["health", "ministry", "verified"],
        92,
        8,
        ArticleStatus.VERIFIED_SAFE,
        "Cross-referenced with Ministry of Health press kit."
    ),
    (
        "Unverified Social Media Post Alleging New City Bus Fare Standard Rates",
        "Social media posts claim RURA has doubled public transport fares across Kigali starting tomorrow. RURA official social channels confirmed that current transport tariffs remain unchanged.",
        "X (Twitter) Viral Feed",
        Category.SOCIAL_MEDIA,
        ["transit", "rumor", "unverified", "Kigali"],
        28,
        72,
        ArticleStatus.FLAGGED_FAKE,
        "Debunked after official RURA statement confirmed tariffs are unchanged."
    ),
    (
        "Rwanda Education Board Officially Announces National Exam Results Schedule",
        "REB officially confirmed the publication date for primary and secondary national examination results via a press release. REB Director General verified the announcement.",
        "RBA News Portal",
        Category.ONLINE_PORTAL,
        ["education", "REB", "exams", "official"],
        95,
        5,
        ArticleStatus.VERIFIED_SAFE,
        "Cleared as safe following REB press release."
    ),
    (
        "Alleged Viral Video of Market Fire Unverified by Emergency Services",
        "A viral video circulating online claims a major fire broke out at Nyabugogo Market this morning. Kigali Fire and Rescue Services confirmed no fire incident occurred.",
        "Social Media Video Share",
        Category.SOCIAL_MEDIA,
        ["fire", "viral", "allegedly", "Nyabugogo"],
        15,
        85,
        ArticleStatus.FLAGGED_FAKE,
        "Debunked. Video was identified as archived footage from 2021."
    ),
    (
        "Confirmed: City of Kigali Inaugurates New Green Public Transport Corridors",
        "City of Kigali officials officially inaugurated dedicated electric bus lanes along major arterial routes. Verified via RURA and City Hall communications.",
        "TV Rwanda Local Desk",
        Category.TV_NEWS,
        ["transport", "Kigali", "official", "inauguration"],
        90,
        10,
        ArticleStatus.VERIFIED_SAFE,
        "Verified safe."
    ),
]

class Command(BaseCommand):
    help = "Seed RBA platform with realistic users, media sources, news articles, and audit logs."

    def add_arguments(self, parser):
        parser.add_argument("--fresh", action="store_true", help="Wipe existing database data first")

    def handle(self, *args, **opts):
        if opts["fresh"]:
            AuditLog.objects.all().delete()
            Notification.objects.all().delete()
            VerificationLog.objects.all().delete()
            Article.objects.all().delete()
            MediaStream.objects.all().delete()
            User.objects.all().delete()
            self.stdout.write(self.style.WARNING("Wiped existing database records."))

        # 1. Seed Users (Matching Book & System Roles)
        users = [
            ("josue.rutayisire@rba.rw", "Josue RUTAYISIRE", "BBICTR/2024/48011", Role.ANALYST),
            ("jean.delacroix@rba.rw", "Dr. Jean de la Croix", "RBA-SUP-001", Role.EDITOR),
            ("patrick.manzi@rba.rw", "Patrick MANZI", "RBA-ANALYST-01", Role.ANALYST),
            ("admin@rba.rw", "RBA Tech Admin", "RBA-ADMIN-01", Role.ADMIN),
        ]

        for email, name, reg, role in users:
            u, created = User.objects.get_or_create(
                email=email, defaults={"name": name, "reg_id": reg, "role": role}
            )
            if created:
                u.set_password("RbaDemo2026!")
                u.save()
            self.stdout.write(f"  User created: {email} / Password: RbaDemo2026!")

        analyst = User.objects.get(email="josue.rutayisire@rba.rw")
        editor = User.objects.get(email="jean.delacroix@rba.rw")

        # 2. Seed Media Sources / Streams
        streams = [
            MediaStream.objects.create(name="RBA News Portal", platform=Category.ONLINE_PORTAL),
            MediaStream.objects.create(name="X (Twitter) Viral Feed", platform=Category.SOCIAL_MEDIA),
            MediaStream.objects.create(name="Radio Rwanda Broadcast", platform=Category.RADIO_TRANSCRIPT),
            MediaStream.objects.create(name="TV Rwanda Local Desk", platform=Category.TV_NEWS),
        ]

        # 3. Seed Articles and Verification Logs over past months
        now = timezone.now()
        for i, (title, content, source, cat, kws, score, fake, st, comment) in enumerate(SAMPLE_ARTICLES):
            art = Article.objects.create(
                title=title,
                content=content,
                source_name=source,
                category=cat,
                keywords=kws,
                credibility_score=score,
                fake_probability=fake,
                status=st,
                editorial_comment=comment,
                author=analyst,
                stream=random.choice(streams),
            )
            
            # Spread timestamps across past months for realistic analytics trends
            days_back = (len(SAMPLE_ARTICLES) - i) * 12
            Article.objects.filter(pk=art.pk).update(created_at=now - timedelta(days=days_back))

            # Record Verification Logs for Editor decisions
            if st == ArticleStatus.FLAGGED_FAKE:
                VerificationLog.objects.create(
                    article=art,
                    editor=editor,
                    action="DEBUNK",
                    feedback=comment,
                )
            elif st == ArticleStatus.VERIFIED_SAFE:
                VerificationLog.objects.create(
                    article=art,
                    editor=editor,
                    action="VERIFY",
                    feedback=comment,
                )

            # In-app Notification for Items in Pending Review Queue
            if st == ArticleStatus.PENDING_REVIEW:
                Notification.objects.create(
                    recipient=editor,
                    article=art,
                    message=f"Flagged item awaiting review: {art.title[:60]}",
                )

        # 4. Seed Audit Logs
        for entry in [
            ("POST", "/api/articles/scan/", 201, "Article ingested: Kigali Innovation City Expansion"),
            ("GET", "/api/articles/editor_queue/", 200, "Editor queue viewed by Dr. Jean de la Croix"),
            ("POST", "/api/articles/2/debunk/", 200, "Article #2 debunked by Editor"),
            ("AUTH", "/api/auth/login/", 201, "JWT Token generated for Josue RUTAYISIRE"),
        ]:
            AuditLog.objects.create(
                user=analyst,
                method=entry[0],
                path=entry[1],
                status_code=entry[2],
                message=entry[3]
            )

        self.stdout.write(self.style.SUCCESS("Database successfully seeded!"))