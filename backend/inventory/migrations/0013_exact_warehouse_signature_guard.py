"""A receipt without its own signature needs a real warehouse-screen signature on the release.

0012 accepted `p.proof->'signature' IS NOT NULL`, which is also true for a JSON `null`, `false`,
an empty string or an object without a channel. The guard now demands the exact shape the release
records (`signature_mode.signature_proof`): an object whose channel is the warehouse screen.
"""

from importlib import import_module

from django.db import migrations

PRIOR = import_module("inventory.migrations.0012_receipt_without_own_signature")

LOOSE = "AND p.proof->'signature' IS NOT NULL)"
EXACT = (
    "AND jsonb_typeof(p.proof->'signature')='object'"
    " AND p.proof->'signature'->>'channel'='warehouse_screen')"
)
if PRIOR.GUARD.count(LOOSE) != 1:
    raise ValueError("The supply receipt guard of 0012 changed")
GUARD = PRIOR.GUARD.replace(LOOSE, EXACT)


class Migration(migrations.Migration):
    dependencies = [("inventory", "0012_receipt_without_own_signature")]
    operations = [migrations.RunSQL(GUARD, PRIOR.GUARD)]
