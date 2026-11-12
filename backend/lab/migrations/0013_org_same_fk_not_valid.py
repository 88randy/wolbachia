"""Same-organization guarantee at the database, step 1: add composite FKs `NOT VALID`.

Isolation used to depend on service code only (reads filter `organization` at the root table). A
composite foreign key `(organization_id, <fk>) -> parent(organization_id, id)` makes PostgreSQL
refuse a child row that points to a parent of another organization. The Django FK on `<fk>` stays as
is (model state is unchanged); these constraints exist only in the database and are listed in
`backend/README.md`. `NOT VALID` enforces new writes at once without scanning existing rows; the
next migration validates them. `DEFERRABLE INITIALLY DEFERRED` matches Django's own FKs, so services
may still insert a child before its parent inside one transaction. MATCH SIMPLE leaves rows whose
nullable FK is NULL unchecked. Parents get their `UNIQUE (organization_id, id)` from the
`*_org_id_unique_targets` migrations of their apps.

Lock note (assumed `lock_timeout` 2s, default of the safe-migration skill): ADD FOREIGN KEY takes
SHARE ROW EXCLUSIVE on child and parent (blocks writes, not reads) for milliseconds, no table scan.
"""

import hashlib

from django.db import migrations

# (child table, child column, parent table). Each child row must live in the same organization as
# the parent row it points to: composite FK (organization_id, <column>) -> parent (organization_id, id).
PAIRS = [
    ("accounts_accesslog", "center_id", "organizations_center"),
    ("accounts_accesslog", "quadrant_id", "geography_quadrant"),
    ("accounts_personnel", "center_id", "organizations_center"),
    ("accounts_personnel", "quadrant_id", "geography_quadrant"),
    ("community_communityactivity", "zone_id", "geography_block"),
    ("community_communitysourcecancellation", "source_event_id", "field_sync_fieldevent"),
    ("community_communitysourcecancellation", "target_event_id", "field_sync_fieldevent"),
    ("community_communitysourcelink", "source_event_id", "field_sync_fieldevent"),
    ("field_sync_fieldevent", "voids_event_id", "field_sync_fieldevent"),
    ("fleet_fuelload", "event_id", "field_sync_fieldevent"),
    ("geography_block", "quadrant_id", "geography_quadrant"),
    ("geography_blockversion", "block_id", "geography_block"),
    ("geography_excludedpointresolution", "point_id", "geography_samplingpoint"),
    ("geography_excludedpointresolution", "point_version_id", "geography_pointversion"),
    ("geography_pointversion", "point_id", "geography_samplingpoint"),
    ("geography_quadrant", "center_id", "organizations_center"),
    ("geography_quadrantversion", "quadrant_id", "geography_quadrant"),
    ("geography_releasepoint", "quadrant_id", "geography_quadrant"),
    ("geography_samplingpoint", "block_id", "geography_block"),
    ("geography_thirdpartyinterventionblock", "block_id", "geography_block"),
    ("incidents_incident", "center_id", "organizations_center"),
    ("incidents_incident", "quadrant_id", "geography_quadrant"),
    ("incidents_incident", "source_event_id", "field_sync_fieldevent"),
    ("inventory_bagdisposition", "bag_id", "ovitraps_bag"),
    ("inventory_bagdisposition", "reading_id", "ovitraps_ovitrapreading"),
    ("inventory_bagdisposition", "source_event_id", "field_sync_fieldevent"),
    ("inventory_inventoryintent", "bag_id", "ovitraps_bag"),
    ("inventory_location", "center_id", "organizations_center"),
    ("inventory_location", "quadrant_id", "geography_quadrant"),
    ("inventory_lot", "center_id", "organizations_center"),
    ("inventory_lot", "quadrant_id", "geography_quadrant"),
    ("inventory_supplysourcelink", "source_event_id", "field_sync_fieldevent"),
    ("inventory_supplyuse", "work_point_id", "geography_samplingpoint"),
    ("inventory_supplyuse", "work_source_id", "field_sync_fieldevent"),
    ("inventory_supplyvoidsourcelink", "source_event_id", "field_sync_fieldevent"),
    ("inventory_transfersourcelink", "source_event_id", "field_sync_fieldevent"),
    ("lab_bagreceipt", "bag_id", "ovitraps_bag"),
    ("lab_bagreceipt", "reading_id", "ovitraps_ovitrapreading"),
    ("lab_bagreceipt", "source_id", "field_sync_fieldevent"),
    ("lab_dailyrecountsamplemember", "count_id", "lab_eggcountattempt"),
    ("lab_eggcountattempt", "bag_id", "ovitraps_bag"),
    ("lab_eggcountattempt", "receipt_id", "lab_bagreceipt"),
    ("lab_eggcountattempt", "replacement_of_id", "lab_eggcountattempt"),
    ("lab_labblindobservation", "count_id", "lab_eggcountattempt"),
    ("lab_labnumericdisclosure", "count_id", "lab_eggcountattempt"),
    ("lab_labrejection", "bag_id", "ovitraps_bag"),
    ("lab_labrejection", "receipt_id", "lab_bagreceipt"),
    ("lab_labresultrevision", "bag_id", "ovitraps_bag"),
    ("lab_labresultrevision", "count_id", "lab_eggcountattempt"),
    ("lab_labresultvoid", "count_id", "lab_eggcountattempt"),
    ("lab_paddlebagbinding", "bag_id", "ovitraps_bag"),
    ("lab_paddlebagbinding", "source_id", "field_sync_fieldevent"),
    ("lab_receptiondiscrepancy", "bag_id", "ovitraps_bag"),
    ("lab_receptiondiscrepancy", "source_id", "field_sync_fieldevent"),
    ("lab_recountattempt", "bag_id", "ovitraps_bag"),
    ("lab_recountattempt", "receipt_id", "lab_bagreceipt"),
    ("lab_recountrequest", "count_id", "lab_eggcountattempt"),
    ("lab_recountresolution", "selected_count_id", "lab_eggcountattempt"),
    ("lab_shipmentsource", "bag_id", "ovitraps_bag"),
    ("lab_shipmentsource", "center_id", "organizations_center"),
    ("lab_shipmentsource", "quadrant_id", "geography_quadrant"),
    ("lab_wolbachiasample", "center_id", "organizations_center"),
    ("lab_wolbachiasample", "event_id", "field_sync_fieldevent"),
    ("lab_wolbachiasample", "quadrant_id", "geography_quadrant"),
    ("lab_wolbachiasample", "reading_id", "ovitraps_ovitrapreading"),
    ("ovitraps_bag", "event_id", "field_sync_fieldevent"),
    ("ovitraps_bag", "reading_id", "ovitraps_ovitrapreading"),
    ("ovitraps_ovitrap", "event_id", "field_sync_fieldevent"),
    ("ovitraps_ovitrap", "point_version_id", "geography_pointversion"),
    ("ovitraps_ovitrap", "sampling_point_id", "geography_samplingpoint"),
    ("ovitraps_ovitrapincidentlink", "event_id", "field_sync_fieldevent"),
    ("ovitraps_ovitrapincidentlink", "ovitrap_id", "ovitraps_ovitrap"),
    ("ovitraps_ovitrapreading", "event_id", "field_sync_fieldevent"),
    ("ovitraps_ovitrapreading", "ovitrap_id", "ovitraps_ovitrap"),
    ("ovitraps_ovitrapreading", "point_version_id", "geography_pointversion"),
    ("ovitraps_ovitrapvoid", "event_id", "field_sync_fieldevent"),
    ("ovitraps_ovitrapvoid", "target_event_id", "field_sync_fieldevent"),
    ("ovitraps_physicalovitraplineage", "event_id", "field_sync_fieldevent"),
    ("ovitraps_physicalovitraplineage", "new_trap_id", "ovitraps_ovitrap"),
    ("ovitraps_physicalovitraplineage", "old_trap_id", "ovitraps_ovitrap"),
    ("ovitraps_physicalovitraplineage", "point_id", "geography_samplingpoint"),
    ("ovitraps_physicalovitraplineage", "point_version_id", "geography_pointversion"),
    ("ovitraps_placementattempt", "event_id", "field_sync_fieldevent"),
    ("ovitraps_placementattempt", "ovitrap_id", "ovitraps_ovitrap"),
    ("ovitraps_relocationdecision", "event_id", "field_sync_fieldevent"),
    ("ovitraps_relocationdecision", "published_point_version_id", "geography_pointversion"),
    ("ovitraps_relocationproposal", "event_id", "field_sync_fieldevent"),
    ("ovitraps_relocationproposal", "ovitrap_id", "ovitraps_ovitrap"),
    ("ovitraps_relocationproposal", "point_version_id", "geography_pointversion"),
    ("ovitraps_removalattempt", "event_id", "field_sync_fieldevent"),
    ("ovitraps_removalattempt", "ovitrap_id", "ovitraps_ovitrap"),
    ("ovitraps_removalattempt", "point_version_id", "geography_pointversion"),
    ("people_actiontrainingrequirementversion", "center_id", "organizations_center"),
    ("people_actiontrainingrequirementversion", "quadrant_id", "geography_quadrant"),
    ("people_certification", "center_id", "organizations_center"),
    ("people_certification", "quadrant_id", "geography_quadrant"),
    ("people_eligibilityassessmentreceipt", "center_id", "organizations_center"),
    ("people_eligibilityassessmentreceipt", "quadrant_id", "geography_quadrant"),
    ("people_evaluation", "center_id", "organizations_center"),
    ("people_evaluation", "quadrant_id", "geography_quadrant"),
    ("people_evaluationnoticepolicyversion", "center_id", "organizations_center"),
    ("people_evaluationnoticepolicyversion", "quadrant_id", "geography_quadrant"),
    ("privacy_apikey", "center_id", "organizations_center"),
    ("privacy_apikey", "quadrant_id", "geography_quadrant"),
    ("privacy_datatransferauthorization", "center_id", "organizations_center"),
    ("privacy_datatransferauthorization", "quadrant_id", "geography_quadrant"),
    ("releases_permit", "center_id", "organizations_center"),
    ("releases_permit", "quadrant_id", "geography_quadrant"),
    ("releases_releasedevice", "center_id", "organizations_center"),
    ("releases_releasedevice", "quadrant_id", "geography_quadrant"),
    ("reviews_reviewdependency", "source_event_id", "field_sync_fieldevent"),
    ("reviews_reviewdependencyresolution", "parent_source_id", "field_sync_fieldevent"),
    ("reviews_revieweffectreceipt", "source_event_id", "field_sync_fieldevent"),
    ("reviews_reviewitem", "field_event_id", "field_sync_fieldevent"),
    ("reviews_reviewparentclaim", "source_event_id", "field_sync_fieldevent"),
    ("reviews_reviewsafetydisposition", "source_event_id", "field_sync_fieldevent"),
    ("reviews_reviewsourcesnapshot", "source_event_id", "field_sync_fieldevent"),
    ("reviews_reviewsubjectscope", "source_event_id", "field_sync_fieldevent"),
    ("reviews_shiftdecision", "closed_event_id", "field_sync_fieldevent"),
    ("scheduling_assignmentversion", "quadrant_id", "geography_quadrant"),
    ("scheduling_riskcategoryversion", "block_id", "geography_block"),
    ("scheduling_scheduledtask", "point_id", "geography_samplingpoint"),
    ("shifts_motorcycle", "center_id", "organizations_center"),
    ("shifts_motorcycleblockevent", "field_event_id", "field_sync_fieldevent"),
    ("shifts_shift", "closed_event_id", "field_sync_fieldevent"),
    ("shifts_shift", "opened_event_id", "field_sync_fieldevent"),
    ("uploads_attachmentlink", "field_event_id", "field_sync_fieldevent"),
]


def constraint_name(table: str, column: str) -> str:
    return "orgfk_" + hashlib.sha1(f"{table}.{column}".encode()).hexdigest()[:20]


def add_sql() -> str:
    statements = ["SET LOCAL lock_timeout = '2s'"]
    for table, column, parent in PAIRS:
        statements.append(
            f'ALTER TABLE "{table}" ADD CONSTRAINT "{constraint_name(table, column)}" '
            f'FOREIGN KEY (organization_id, "{column}") REFERENCES "{parent}" (organization_id, id) '
            "DEFERRABLE INITIALLY DEFERRED NOT VALID"
        )
    return ";\n".join(statements)


def drop_sql() -> str:
    return ";\n".join(
        f'ALTER TABLE "{table}" DROP CONSTRAINT IF EXISTS "{constraint_name(table, column)}"'
        for table, column, _parent in PAIRS
    )


class Migration(migrations.Migration):
    dependencies = [
        ("accounts", "0009_accesslog_reason"),
        ("community", "0002_guards"),
        ("field_sync", "0007_org_id_unique_targets"),
        ("fleet", "0002_insert_only_guards"),
        ("geography", "0006_org_id_unique_targets"),
        ("incidents", "0003_alter_automaticincidentorigin_source_kind"),
        ("inventory", "0014_supply_gtin"),
        ("lab", "0012_org_id_unique_targets"),
        ("organizations", "0009_org_id_unique_targets"),
        ("ovitraps", "0006_org_id_unique_targets"),
        ("people", "0002_people_guards"),
        ("privacy", "0003_api_keys"),
        ("releases", "0007_readable_codes"),
        ("reviews", "0005_supply_source_dependency"),
        ("scheduling", "0003_release_task_action"),
        ("shifts", "0005_readable_codes"),
        ("uploads", "0011_allow_pdf_content_type"),
    ]

    operations = [migrations.RunSQL(sql=add_sql(), reverse_sql=drop_sql())]
