"""One closed people router; no personnel directory or organization selector."""

from django.urls import path

from people.views import (
    CertificationViewSet,
    EligibilityViewSet,
    EvaluationViewSet,
    NoticePolicyViewSet,
    RequirementViewSet,
    RubricViewSet,
    TrainingViewSet,
)

urlpatterns = [
    path(
        "trainings/",
        TrainingViewSet.as_view({"get": "list", "post": "create"}),
        name="training-list",
    ),
    path(
        "trainings/<uuid:pk>/versions/",
        TrainingViewSet.as_view({"get": "versions", "post": "publish_version"}),
        name="training-versions",
    ),
    path(
        "training-requirements/",
        RequirementViewSet.as_view({"get": "list"}),
        name="training-requirements",
    ),
    path(
        "training-requirements/<str:action_key>/versions/",
        RequirementViewSet.as_view({"post": "publish_version"}),
        name="training-requirement-versions",
    ),
    path(
        "users/<uuid:subject_id>/trainings/",
        CertificationViewSet.as_view({"get": "list", "post": "create"}),
        name="subject-trainings",
    ),
    path(
        "users/<uuid:subject_id>/trainings/<uuid:certification_id>/revoke/",
        CertificationViewSet.as_view({"post": "revoke"}),
        name="certification-revoke",
    ),
    path(
        "users/<uuid:subject_id>/trainings/<uuid:certification_id>/revocations/",
        CertificationViewSet.as_view({"get": "revocations"}),
        name="certification-revocations",
    ),
    path(
        "evaluation-rubrics/",
        RubricViewSet.as_view({"get": "list", "post": "create"}),
        name="evaluation-rubrics",
    ),
    path(
        "evaluation-rubrics/<uuid:pk>/versions/",
        RubricViewSet.as_view({"get": "versions", "post": "publish_version"}),
        name="evaluation-rubric-versions",
    ),
    path(
        "evaluation-notice-policy/",
        NoticePolicyViewSet.as_view({"get": "list"}),
        name="evaluation-notice-policy",
    ),
    path(
        "evaluation-notice-policy/versions/",
        NoticePolicyViewSet.as_view({"post": "publish_version"}),
        name="evaluation-notice-policy-versions",
    ),
    path(
        "evaluations/",
        EvaluationViewSet.as_view({"get": "list", "post": "create"}),
        name="evaluations",
    ),
    path(
        "evaluations/<uuid:pk>/revisions/",
        EvaluationViewSet.as_view({"post": "revise"}),
        name="evaluation-revise",
    ),
    path(
        "evaluations/<uuid:pk>/void/",
        EvaluationViewSet.as_view({"post": "void"}),
        name="evaluation-void",
    ),
    path(
        "evaluations/<uuid:pk>/attempts/",
        EvaluationViewSet.as_view({"get": "attempts"}),
        name="evaluation-attempts",
    ),
    path(
        "users/<uuid:subject_id>/eligibility/",
        EligibilityViewSet.as_view({"get": "retrieve"}),
        name="subject-eligibility",
    ),
]
