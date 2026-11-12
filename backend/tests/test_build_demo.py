"""`build_demo`: it must refuse unless it targets a demo database and is told to wipe it."""

import pytest
from django.core.management import call_command
from django.core.management.base import CommandError

from organizations.management.commands import build_demo
from organizations.models import Organization


@pytest.fixture
def demo_name(monkeypatch):
    monkeypatch.setattr(build_demo, "target_database_name", lambda: "aedesvision_demo_x")


@pytest.mark.django_db
def test_refuses_a_database_that_is_not_a_demo_database(settings):
    settings.DEBUG = True

    with pytest.raises(CommandError, match="does not start with"):
        call_command("build_demo", "--fresh", "--yes-wipe")

    assert not Organization.objects.exists()


@pytest.mark.django_db
def test_refuses_without_the_explicit_wipe_flag(settings, demo_name):
    settings.DEBUG = True

    with pytest.raises(CommandError, match="--yes-wipe"):
        call_command("build_demo", "--fresh")


@pytest.mark.django_db
def test_refuses_without_fresh(settings, demo_name):
    settings.DEBUG = True

    with pytest.raises(CommandError, match="--fresh"):
        call_command("build_demo", "--yes-wipe")
