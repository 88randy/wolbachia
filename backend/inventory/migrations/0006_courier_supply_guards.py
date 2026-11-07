"""Append-only genuine supply sources, shared reservations and complete signed effects.

Each row validator has its own table-specific function. Deferred constraints validate
the finished transaction, including source rows inserted before their command receipt.
Current authority and scientific policy stay with the existing retained writers.
"""

from django.db import migrations
from django.db.migrations.exceptions import IrreversibleError

CHECKS = {
    "couriertransitpolicyversion": """EXISTS(SELECT 1 FROM inventory_supplytypeversion v
      WHERE v.id=NEW.supply_version_id AND v.organization_id=NEW.organization_id)
      AND (NEW.revision=1 OR EXISTS(SELECT 1 FROM inventory_couriertransitpolicyversion previous
        WHERE previous.supply_version_id=NEW.supply_version_id AND previous.revision=NEW.revision-1))
      AND NEW.mode='manual_evidence_review' AND btrim(NEW.name)<>''
      AND btrim(NEW.procedure)<>'' AND btrim(NEW.reference)<>''
      AND NEW.proof_roles='["photo"]'::jsonb""",
    "supplymaterialmappingversion": """EXISTS(SELECT 1 FROM inventory_supplytypeversion v
      WHERE v.id=NEW.supply_version_id AND v.organization_id=NEW.organization_id)
      AND (NEW.revision=1 OR EXISTS(SELECT 1 FROM inventory_supplymaterialmappingversion previous
        WHERE previous.supply_version_id=NEW.supply_version_id AND previous.action=NEW.action
        AND previous.revision=NEW.revision-1))
      AND NEW.action IN ('place','check') AND NEW.quantity>0 AND btrim(NEW.reference)<>''""",
    "supplyassignment": """EXISTS(SELECT 1 FROM inventory_location l
      JOIN organizations_membership m ON m.organization_id=l.organization_id
      WHERE l.id=NEW.origin_id AND l.organization_id=NEW.organization_id AND m.user_id=NEW.courier_id)
      AND (NEW.shift_id IS NULL OR EXISTS(SELECT 1 FROM shifts_shift s WHERE s.id=NEW.shift_id
        AND s.organization_id=NEW.organization_id AND s.courier_id=NEW.courier_id))""",
    "supplyassignmentversion": """EXISTS(SELECT 1 FROM inventory_supplyassignment a
      WHERE a.id=NEW.assignment_id AND a.organization_id=NEW.organization_id)
      AND ((NEW.revision=1 AND NEW.previous_id IS NULL) OR EXISTS(
        SELECT 1 FROM inventory_supplyassignmentversion previous WHERE previous.id=NEW.previous_id
        AND previous.assignment_id=NEW.assignment_id AND previous.revision=NEW.revision-1))
      AND jsonb_typeof(NEW.planning_proof)='object'""",
    "supplyassignmentline": """EXISTS(SELECT 1 FROM inventory_supplyassignmentversion v
      JOIN inventory_lot l ON l.id=NEW.lot_id JOIN inventory_supplytypeversion u ON u.id=NEW.unit_version_id
      WHERE v.id=NEW.version_id AND v.organization_id=NEW.organization_id
      AND l.organization_id=NEW.organization_id AND u.organization_id=NEW.organization_id
      AND u.supply_type_id=l.supply_id AND NEW.quantity>0
      AND ((u.identity_kind='lot' AND NEW.piece_id IS NULL) OR
        (u.identity_kind='piece' AND NEW.quantity=1 AND EXISTS(SELECT 1 FROM inventory_piece p
          WHERE p.id=NEW.piece_id AND p.lot_id=l.id AND p.organization_id=NEW.organization_id))))""",
    "supplyassignmentcommandreceipt": """EXISTS(SELECT 1 FROM inventory_supplyassignmentversion v
      WHERE v.id=NEW.version_id AND v.organization_id=NEW.organization_id AND v.created_by_id=NEW.created_by_id
      AND NEW.response->'assignment'->>'id'=v.assignment_id::text
      AND NEW.response->'assignment'->>'version_id'=v.id::text
      AND (NEW.response->'assignment'->>'revision')::integer=v.revision)
      AND NEW.input_hash ~ '^[0-9a-f]{64}$'""",
    "reconciliation": """EXISTS(SELECT 1 FROM inventory_supplyassignment a
      WHERE a.id=NEW.assignment_id AND a.organization_id=NEW.organization_id)""",
    "inventoryintent": """NEW.kind IN ('assignment_release','release_cancel','return_accept',
        'reconcile_justify','lot_write_off','bag_disposal')
      AND NEW.canonical_input->>'kind'=NEW.kind AND NEW.input_hash ~ '^[0-9a-f]{64}$'
      AND jsonb_typeof(NEW.declared_evidence)='array'
      AND jsonb_typeof(NEW.prepared_response)='object'
      AND ((NEW.kind IN ('assignment_release','release_cancel','return_accept','reconcile_justify')
        AND NEW.lot_id IS NULL AND NEW.location_id IS NULL AND NEW.piece_id IS NULL
        AND NEW.unit_version_id IS NULL AND NEW.bag_id IS NULL
        AND EXISTS(SELECT 1 FROM inventory_supplyassignment a WHERE a.id=NEW.assignment_id
          AND a.organization_id=NEW.organization_id)
        AND ((NEW.kind='assignment_release' AND NEW.release_id IS NULL AND NEW.reconciliation_id IS NULL
          AND NEW.declaration_id IS NULL AND NEW.canonical_input->>'assignment_id'=NEW.assignment_id::text)
        OR (NEW.kind='release_cancel' AND NEW.reconciliation_id IS NULL AND NEW.declaration_id IS NULL
          AND EXISTS(SELECT 1 FROM inventory_originreleaseproof p JOIN inventory_supplyassignmentversion v
            ON v.id=p.version_id WHERE p.id=NEW.release_id AND v.assignment_id=NEW.assignment_id
            AND p.organization_id=NEW.organization_id AND NEW.canonical_input->>'release_id'=p.id::text))
        OR (NEW.kind='return_accept' AND NEW.release_id IS NULL AND NEW.reconciliation_id IS NULL
          AND EXISTS(SELECT 1 FROM inventory_returndeclaration d JOIN inventory_supplyevent e ON e.id=d.event_id
            WHERE d.id=NEW.declaration_id AND d.organization_id=NEW.organization_id
            AND e.assignment_id=NEW.assignment_id AND NEW.canonical_input->>'declaration_id'=d.id::text))
        OR (NEW.kind='reconcile_justify' AND NEW.release_id IS NULL AND NEW.declaration_id IS NULL
          AND EXISTS(SELECT 1 FROM inventory_reconciliation r WHERE r.id=NEW.reconciliation_id
            AND r.organization_id=NEW.organization_id AND r.assignment_id=NEW.assignment_id
            AND NEW.canonical_input->>'reconciliation_id'=r.id::text))))
      OR (NEW.kind='lot_write_off' AND NEW.assignment_id IS NULL AND NEW.release_id IS NULL
        AND NEW.reconciliation_id IS NULL AND NEW.declaration_id IS NULL AND NEW.bag_id IS NULL
        AND EXISTS(SELECT 1 FROM inventory_lot l JOIN inventory_location s ON s.id=NEW.location_id
          JOIN inventory_supplytypeversion u ON u.id=NEW.unit_version_id
          WHERE l.id=NEW.lot_id AND l.organization_id=NEW.organization_id AND s.organization_id=NEW.organization_id
          AND u.organization_id=NEW.organization_id AND u.supply_type_id=l.supply_id
          AND NEW.canonical_input->>'lot_id'=l.id::text AND NEW.canonical_input->>'location_id'=s.id::text
          AND NEW.canonical_input->>'unit_version_id'=u.id::text
          AND ((u.identity_kind='lot' AND NEW.piece_id IS NULL) OR EXISTS(SELECT 1 FROM inventory_piece p
            WHERE u.identity_kind='piece' AND p.id=NEW.piece_id AND p.lot_id=l.id
            AND p.organization_id=NEW.organization_id))))
      OR (NEW.kind='bag_disposal' AND NEW.assignment_id IS NULL AND NEW.release_id IS NULL
        AND NEW.reconciliation_id IS NULL AND NEW.declaration_id IS NULL AND NEW.lot_id IS NULL
        AND NEW.location_id IS NULL AND NEW.piece_id IS NULL AND NEW.unit_version_id IS NULL
        AND EXISTS(SELECT 1 FROM ovitraps_bag b WHERE b.id=NEW.bag_id
          AND b.organization_id=NEW.organization_id AND NEW.canonical_input->>'bag_id'=b.id::text)))""",
    "inventoryintentexecution": """EXISTS(SELECT 1 FROM inventory_inventoryintent i WHERE i.id=NEW.intent_id
      AND i.organization_id=NEW.organization_id AND i.created_by_id=NEW.created_by_id)
      AND NEW.response_status=201 AND jsonb_typeof(NEW.response)='object'""",
    "originreleaseproof": """EXISTS(SELECT 1 FROM inventory_supplyassignmentversion v
      JOIN inventory_inventoryintent i ON i.id=NEW.intent_id
      WHERE v.id=NEW.version_id AND v.organization_id=NEW.organization_id AND i.organization_id=NEW.organization_id
      AND i.kind='assignment_release' AND i.assignment_id=v.assignment_id AND i.expected_revision=v.revision
      AND i.created_by_id=NEW.created_by_id)
      AND NEW.manifest_hash ~ '^[0-9a-f]{64}$' AND jsonb_typeof(NEW.proof)='object'""",
    "originreleaseline": """EXISTS(SELECT 1 FROM inventory_originreleaseproof p
      JOIN inventory_supplyassignmentline l ON l.id=NEW.line_id WHERE p.id=NEW.release_id
      AND p.organization_id=NEW.organization_id AND l.organization_id=NEW.organization_id
      AND l.version_id=p.version_id AND NEW.quantity>0 AND NEW.quantity<=l.quantity
      AND (l.piece_id IS NULL OR NEW.quantity=1)
      AND (NEW.transit_policy_id IS NULL OR EXISTS(SELECT 1 FROM inventory_couriertransitpolicyversion t
        JOIN inventory_lotversion lv ON lv.lot_id=l.lot_id WHERE t.id=NEW.transit_policy_id
        AND t.organization_id=NEW.organization_id AND t.supply_version_id=lv.supply_version_id)))
      AND jsonb_typeof(NEW.safety_proof)='object'""",
    "releasecancellation": """EXISTS(SELECT 1 FROM inventory_originreleaseproof p
      JOIN inventory_inventoryintent i ON i.id=NEW.intent_id WHERE p.id=NEW.release_id
      AND p.organization_id=NEW.organization_id AND i.organization_id=NEW.organization_id
      AND i.kind='release_cancel' AND i.release_id=p.id AND i.created_by_id=NEW.created_by_id)
      AND char_length(btrim(NEW.reason)) BETWEEN 10 AND 1000 AND btrim(NEW.reason_code)<>''""",
    "releasecancellationline": """EXISTS(SELECT 1 FROM inventory_releasecancellation c
      JOIN inventory_originreleaseline l ON l.id=NEW.release_line_id WHERE c.id=NEW.cancellation_id
      AND c.organization_id=NEW.organization_id AND l.organization_id=NEW.organization_id
      AND c.release_id=l.release_id AND NEW.quantity>0 AND NEW.quantity<=l.quantity)""",
    "supplyevent": """EXISTS(SELECT 1 FROM inventory_supplyassignment a WHERE a.id=NEW.assignment_id
      AND a.organization_id=NEW.organization_id AND a.courier_id=NEW.created_by_id)
      AND NEW.kind IN ('receive','reconcile') AND NEW.revision>0
      AND NEW.canonical_input->>'assignment_id'=NEW.assignment_id::text
      AND NEW.canonical_input->>'command_id'=NEW.command_id::text
      AND (NEW.canonical_input->>'expected_revision')::integer=NEW.expected_revision
      AND NEW.input_hash ~ '^[0-9a-f]{64}$' AND NEW.source_payload_hash ~ '^[0-9a-f]{64}$'
      AND ((NEW.kind='receive' AND jsonb_typeof(NEW.canonical_input->'actual_lines')='array')
        OR (NEW.kind='reconcile' AND jsonb_typeof(NEW.canonical_input->'used')='array'
          AND jsonb_typeof(NEW.canonical_input->'shrinkage')='array'
          AND jsonb_typeof(NEW.canonical_input->'returned')='array'))
      AND jsonb_typeof(NEW.original_proof)='object'""",
    "supplysourcelink": """EXISTS(SELECT 1 FROM inventory_supplyevent e
      JOIN field_sync_fieldevent s ON s.id=NEW.source_event_id WHERE e.id=NEW.event_id
      AND e.organization_id=NEW.organization_id AND s.organization_id=NEW.organization_id
      AND e.created_by_id=s.created_by_id AND NEW.created_by_id=s.created_by_id
      AND e.declared_source_uuid=s.id AND e.source_payload_hash=s.payload_sha256
      AND s.type='supplies.'||e.kind AND (s.voided_at IS NULL OR EXISTS(
        SELECT 1 FROM inventory_supplyvoidaudit audit WHERE audit.event_id=e.id))
      AND EXISTS(SELECT 1 FROM reviews_reviewsourcesnapshot captured WHERE captured.source_event_id=s.id
        AND captured.resource_kind='supply_assignment' AND captured.resource_id=e.assignment_id
        AND captured.organization_id=NEW.organization_id)
      AND (s.status='accepted' OR EXISTS(SELECT 1 FROM reviews_revieweffectreceipt receipt
        WHERE receipt.source_event_id=s.id AND receipt.payload_sha256=s.payload_sha256)))""",
    "supplyreceipt": """EXISTS(SELECT 1 FROM inventory_supplyevent e
      JOIN inventory_originreleaseproof p ON p.id=NEW.release_id
      JOIN inventory_supplyassignmentversion v ON v.id=p.version_id
      JOIN uploads_upload u ON u.id=NEW.signature_id JOIN uploads_uploadverification verified ON verified.upload_id=u.id
      WHERE e.id=NEW.event_id AND e.kind='receive' AND e.organization_id=NEW.organization_id
      AND p.organization_id=NEW.organization_id AND v.assignment_id=e.assignment_id
      AND u.organization_id=NEW.organization_id AND u.uploader_id=e.created_by_id
      AND e.canonical_input->>'signature_upload_id'=u.public_id::text
      AND NEW.created_by_id=e.created_by_id AND e.canonical_input->>'release_id'=p.id::text
      AND (e.canonical_input->>'plan_revision')::integer=v.revision)
      AND jsonb_typeof(NEW.observations)='array'""",
    "supplyreceiptline": """EXISTS(SELECT 1 FROM inventory_supplyreceipt r
      JOIN inventory_originreleaseline l ON l.id=NEW.release_line_id
      JOIN inventory_supplyassignmentline plan ON plan.id=l.line_id WHERE r.id=NEW.receipt_id
      AND r.organization_id=NEW.organization_id AND l.organization_id=NEW.organization_id
      AND r.release_id=l.release_id AND NEW.quantity>=0 AND NEW.quantity<=l.quantity
      AND (plan.piece_id IS NULL OR NEW.quantity IN (0,1)))""",
    "supplyuse": """EXISTS(SELECT 1 FROM inventory_supplyevent e
      JOIN inventory_supplyreceiptline r ON r.id=NEW.receipt_line_id
      JOIN inventory_supplyreceipt signed ON signed.id=r.receipt_id
      JOIN inventory_supplyevent parent ON parent.id=signed.event_id
      JOIN inventory_originreleaseline release ON release.id=r.release_line_id
      JOIN inventory_supplyassignmentline plan ON plan.id=release.line_id
      JOIN inventory_couriertransitpolicyversion policy ON policy.id=NEW.transit_policy_id
      WHERE e.id=NEW.event_id AND e.kind='reconcile' AND e.assignment_id=parent.assignment_id
      AND e.organization_id=NEW.organization_id AND r.organization_id=NEW.organization_id
      AND policy.organization_id=NEW.organization_id AND policy.id=release.transit_policy_id
      AND NEW.created_by_id=e.created_by_id AND NEW.quantity>0 AND (plan.piece_id IS NULL OR NEW.quantity=1)
      AND ((NEW.work_kind='manual' AND NEW.work_source_id IS NULL AND NEW.work_point_id IS NULL
        AND char_length(btrim(NEW.manual_reason)) BETWEEN 10 AND 1000)
      OR (NEW.work_kind='field_event' AND NEW.manual_reason='' AND EXISTS(SELECT 1 FROM field_sync_fieldevent s
        WHERE s.id=NEW.work_source_id AND s.organization_id=NEW.organization_id AND s.created_by_id=e.created_by_id
        AND s.type IN ('ovitrap.place','ovitrap.check') AND lab_effective_source(s.id)
        AND (EXISTS(SELECT 1 FROM ovitraps_ovitrap trap WHERE trap.event_id=s.id AND trap.sampling_point_id=NEW.work_point_id)
          OR EXISTS(SELECT 1 FROM ovitraps_ovitrapreading reading JOIN ovitraps_ovitrap trap ON trap.id=reading.ovitrap_id
          WHERE reading.event_id=s.id AND trap.sampling_point_id=NEW.work_point_id))))))
      AND jsonb_typeof(NEW.transit_proof)='object'""",
    "supplyshrinkage": """EXISTS(SELECT 1 FROM inventory_supplyevent e
      JOIN inventory_supplyreceiptline r ON r.id=NEW.receipt_line_id
      JOIN inventory_supplyreceipt signed ON signed.id=r.receipt_id
      JOIN inventory_supplyevent parent ON parent.id=signed.event_id
      JOIN inventory_originreleaseline release ON release.id=r.release_line_id
      JOIN inventory_supplyassignmentline plan ON plan.id=release.line_id
      WHERE e.id=NEW.event_id AND e.kind='reconcile' AND e.assignment_id=parent.assignment_id
      AND e.organization_id=NEW.organization_id AND r.organization_id=NEW.organization_id
      AND e.created_by_id=NEW.created_by_id AND NEW.quantity>0 AND (plan.piece_id IS NULL OR NEW.quantity=1))
      AND char_length(btrim(NEW.reason)) BETWEEN 10 AND 1000 AND btrim(NEW.reason_code)<>''
      AND jsonb_typeof(NEW.evidence_ids)='array' AND jsonb_array_length(NEW.evidence_ids)>0""",
    "returndeclaration": """EXISTS(SELECT 1 FROM inventory_supplyevent e
      JOIN inventory_supplyreceiptline r ON r.id=NEW.receipt_line_id
      JOIN inventory_supplyreceipt signed ON signed.id=r.receipt_id
      JOIN inventory_supplyevent parent ON parent.id=signed.event_id
      JOIN inventory_location destination ON destination.id=NEW.destination_id
      JOIN inventory_originreleaseline release ON release.id=r.release_line_id
      JOIN inventory_supplyassignmentline plan ON plan.id=release.line_id
      WHERE e.id=NEW.event_id AND e.kind='reconcile' AND e.assignment_id=parent.assignment_id
      AND e.organization_id=NEW.organization_id AND r.organization_id=NEW.organization_id
      AND destination.organization_id=NEW.organization_id AND e.created_by_id=NEW.created_by_id
      AND NEW.quantity>0 AND (plan.piece_id IS NULL OR NEW.quantity=1))""",
    "returnacceptance": """EXISTS(SELECT 1 FROM inventory_returndeclaration d
      JOIN inventory_supplyreceiptline r ON r.id=d.receipt_line_id
      JOIN inventory_originreleaseline release ON release.id=r.release_line_id
      JOIN inventory_supplyassignmentline plan ON plan.id=release.line_id
      JOIN inventory_inventoryintentexecution x ON x.id=NEW.execution_id
      JOIN inventory_inventoryintent i ON i.id=x.intent_id
      JOIN uploads_upload u ON u.id=NEW.signature_id JOIN uploads_uploadverification verified ON verified.upload_id=u.id
      JOIN uploads_attachmentlink link ON link.upload_id=u.id
      WHERE d.id=NEW.declaration_id AND d.organization_id=NEW.organization_id AND x.organization_id=NEW.organization_id
      AND i.kind='return_accept' AND i.declaration_id=d.id AND i.created_by_id=NEW.created_by_id
      AND u.organization_id=NEW.organization_id AND u.uploader_id=NEW.created_by_id
      AND link.inventory_intent_id=i.id AND NEW.quantity>0 AND NEW.quantity<=d.quantity
      AND (plan.piece_id IS NULL OR NEW.quantity=1))""",
    "reconciliationversion": """EXISTS(SELECT 1 FROM inventory_reconciliation r WHERE r.id=NEW.reconciliation_id
      AND r.organization_id=NEW.organization_id)
      AND ((NEW.revision=1 AND NEW.previous_id IS NULL) OR EXISTS(
        SELECT 1 FROM inventory_reconciliationversion previous WHERE previous.id=NEW.previous_id
        AND previous.reconciliation_id=NEW.reconciliation_id AND previous.revision=NEW.revision-1))
      AND num_nonnulls(NEW.source_event_id,NEW.acceptance_id,NEW.close_source_uuid,NEW.void_audit_id)=1
      AND ((NEW.close_source_uuid IS NOT NULL AND NEW.shift_id IS NOT NULL) OR
        (NEW.close_source_uuid IS NULL AND NEW.shift_id IS NULL))
      AND NEW.frame_hash ~ '^[0-9a-f]{64}$' AND jsonb_typeof(NEW.frame)='object'""",
    "reconciliationline": """EXISTS(SELECT 1 FROM inventory_reconciliationversion v
      JOIN inventory_reconciliation r ON r.id=v.reconciliation_id
      JOIN inventory_supplyassignmentline plan ON plan.id=NEW.assignment_line_id
      JOIN inventory_supplyassignmentversion pv ON pv.id=plan.version_id
      WHERE v.id=NEW.version_id AND v.organization_id=NEW.organization_id
      AND plan.organization_id=NEW.organization_id AND pv.assignment_id=r.assignment_id)
      AND NEW.planned>=0 AND NEW.used>=0 AND NEW.returned>=0 AND NEW.shrinkage>=0
      AND ((NEW.credited IS NULL AND NEW.difference IS NULL AND NEW.delivery_variance IS NULL) OR
        (NEW.credited>=0 AND NEW.difference=NEW.credited-NEW.used-NEW.returned-NEW.shrinkage
          AND NEW.delivery_variance=NEW.planned-NEW.credited))""",
    "supplydiscrepancy": """EXISTS(SELECT 1 FROM inventory_reconciliationversion v WHERE v.id=NEW.frame_id
      AND v.organization_id=NEW.organization_id AND v.reconciliation_id=NEW.reconciliation_id)
      AND jsonb_typeof(NEW.reasons)='array' AND jsonb_array_length(NEW.reasons)>0""",
    "supplydiscrepancydecision": """EXISTS(SELECT 1 FROM inventory_supplydiscrepancy d
      JOIN inventory_reconciliationversion v ON v.id=NEW.frame_id
      JOIN inventory_inventoryintentexecution x ON x.id=NEW.execution_id
      JOIN inventory_inventoryintent i ON i.id=x.intent_id
      WHERE d.id=NEW.discrepancy_id AND d.organization_id=NEW.organization_id
      AND v.organization_id=NEW.organization_id AND v.reconciliation_id=d.reconciliation_id
      AND i.kind='reconcile_justify' AND i.reconciliation_id=d.reconciliation_id
      AND x.organization_id=NEW.organization_id AND i.created_by_id=NEW.created_by_id)
      AND char_length(btrim(NEW.reason)) BETWEEN 10 AND 1000 AND btrim(NEW.reason_code)<>''
      AND jsonb_typeof(NEW.evidence_ids)='array'""",
    "lotwriteoff": """EXISTS(SELECT 1 FROM inventory_inventoryintentexecution x
      JOIN inventory_inventoryintent i ON i.id=x.intent_id
      JOIN inventory_lot l ON l.id=NEW.lot_id JOIN inventory_supplytypeversion u ON u.id=NEW.unit_version_id
      WHERE x.id=NEW.execution_id AND x.organization_id=NEW.organization_id AND i.kind='lot_write_off'
      AND i.created_by_id=NEW.created_by_id AND i.lot_id=l.id AND i.location_id=NEW.location_id
      AND i.piece_id IS NOT DISTINCT FROM NEW.piece_id AND i.unit_version_id=u.id
      AND l.organization_id=NEW.organization_id AND u.organization_id=NEW.organization_id AND u.supply_type_id=l.supply_id
      AND NEW.quantity=(i.canonical_input->>'quantity')::numeric AND NEW.quantity>0
      AND (NEW.piece_id IS NULL OR NEW.quantity=1) AND NEW.owner_id::text=i.canonical_input->>'owner_id'
      AND NEW.date::text=i.canonical_input->>'date'
      AND EXISTS(SELECT 1 FROM organizations_membership m WHERE m.organization_id=NEW.organization_id AND m.user_id=NEW.owner_id)
      AND (NOT EXISTS(SELECT 1 FROM inventory_lotversion lv JOIN inventory_supplytypeversion biological
        ON biological.id=lv.supply_version_id WHERE lv.lot_id=l.id AND biological.is_biological
        AND lv.revision=(SELECT MAX(revision) FROM inventory_lotversion WHERE lot_id=l.id)) OR NEW.rpbi_id IS NOT NULL)
      AND (NEW.rpbi_id IS NULL OR EXISTS(SELECT 1 FROM uploads_upload upload
        JOIN uploads_uploadverification verified ON verified.upload_id=upload.id
        JOIN uploads_attachmentlink link ON link.upload_id=upload.id
        WHERE upload.id=NEW.rpbi_id AND upload.organization_id=NEW.organization_id
        AND upload.uploader_id=NEW.created_by_id AND link.inventory_intent_id=i.id)))
      AND char_length(btrim(NEW.reason)) BETWEEN 10 AND 1000 AND btrim(NEW.reason_code)<>''""",
    "bagdisposition": """EXISTS(SELECT 1 FROM ovitraps_bag b
      JOIN ovitraps_ovitrapreading reading ON reading.id=b.reading_id
      JOIN inventory_inventoryintentexecution x ON x.id=NEW.execution_id
      JOIN inventory_inventoryintent i ON i.id=x.intent_id
      JOIN uploads_upload upload ON upload.id=NEW.rpbi_id
      JOIN uploads_uploadverification verified ON verified.upload_id=upload.id
      JOIN uploads_attachmentlink link ON link.upload_id=upload.id
      JOIN lab_bagreceipt receipt ON receipt.bag_id=b.id
      JOIN lab_labresultrevision result ON result.bag_id=b.id
      JOIN lab_eggcountattempt count ON count.id=result.count_id
      JOIN lab_dailyrecountsamplemember member ON member.count_id=count.id
      JOIN lab_dailyrecountsample sample ON sample.id=member.sample_id
      WHERE b.id=NEW.bag_id AND b.organization_id=NEW.organization_id AND reading.paddle_present
      AND NEW.reading_id=b.reading_id AND NEW.source_event_id=reading.event_id AND lab_effective_source(reading.event_id)
      AND x.organization_id=NEW.organization_id AND i.kind='bag_disposal' AND i.bag_id=b.id
      AND i.created_by_id=NEW.created_by_id AND upload.organization_id=NEW.organization_id
      AND upload.uploader_id=NEW.created_by_id AND link.inventory_intent_id=i.id
      AND receipt.reading_id=reading.id AND receipt.source_id=reading.event_id AND receipt.kind='bag'
      AND result.revision=(SELECT MAX(revision) FROM lab_labresultrevision WHERE bag_id=b.id)
      AND member.selected=false AND sample.organization_id=NEW.organization_id AND member.organization_id=NEW.organization_id
      AND count.created_at>=sample.utc_from AND count.created_at<sample.utc_before
      AND NEW.dependency_proof->>'receipt_id'=receipt.id::text
      AND NEW.dependency_proof->>'result_revision_id'=result.id::text
      AND NEW.dependency_proof->>'count_id'=count.id::text
      AND NEW.dependency_proof->>'sample_id'=sample.id::text
      AND NEW.dependency_proof->>'sample_member_id'=member.id::text
      AND NEW.dependency_proof->>'sample_frame_hash'=sample.frame_hash
      AND NEW.dependency_proof->'selected'='false'::jsonb
      AND NEW.dependency_proof->'pending_request_ids'='[]'::jsonb
      AND NOT EXISTS(SELECT 1 FROM lab_recountrequest request JOIN lab_eggcountattempt prior_count ON prior_count.id=request.count_id
        WHERE prior_count.bag_id=b.id AND NOT EXISTS(SELECT 1 FROM lab_recountrequestsupersession superseded
          WHERE superseded.request_id=request.id))
      AND NEW.owner_id::text=i.canonical_input->>'owner_id' AND NEW.date::text=i.canonical_input->>'date'
      AND EXISTS(SELECT 1 FROM organizations_membership m WHERE m.organization_id=NEW.organization_id AND m.user_id=NEW.owner_id))
      AND char_length(btrim(NEW.reason)) BETWEEN 10 AND 1000 AND btrim(NEW.reason_code)<>''""",
}

CHECKS["supplyvoidaudit"] = """EXISTS(SELECT 1 FROM inventory_supplyevent e
  WHERE e.id=NEW.event_id AND e.organization_id=NEW.organization_id AND e.created_by_id=NEW.created_by_id)
  AND NEW.source_payload_hash ~ '^[0-9a-f]{64}$' AND jsonb_typeof(NEW.compensation_proof)='object'
  AND char_length(btrim(NEW.reason)) BETWEEN 10 AND 1000 AND btrim(NEW.reason_code)<>''"""
CHECKS["supplyvoidsourcelink"] = """EXISTS(SELECT 1 FROM inventory_supplyvoidaudit audit
  JOIN field_sync_fieldevent source ON source.id=NEW.source_event_id
  JOIN inventory_supplysourcelink original ON original.event_id=audit.event_id
  WHERE audit.id=NEW.audit_id AND audit.organization_id=NEW.organization_id
  AND audit.declared_source_uuid=source.id AND audit.source_payload_hash=source.payload_sha256
  AND source.organization_id=NEW.organization_id AND source.created_by_id=NEW.created_by_id
  AND source.type='record.void' AND source.voids_event_id=original.source_event_id
  AND (source.status='accepted' OR EXISTS(SELECT 1 FROM reviews_revieweffectreceipt r
    WHERE r.source_event_id=source.id AND r.payload_sha256=source.payload_sha256)))"""
CHECKS["supplyledgersource"] = """NEW.content_hash ~ '^[0-9a-f]{64}$'
  AND num_nonnulls(NEW.event_id,NEW.execution_id,NEW.compensation_id)=1
  AND ((NEW.kind IN ('supply_receive','supply_reconcile') AND EXISTS(SELECT 1 FROM inventory_supplyevent e
    WHERE e.id=NEW.event_id AND e.organization_id=NEW.organization_id AND e.created_by_id=NEW.created_by_id
    AND NEW.kind='supply_'||e.kind AND NEW.content_hash=e.input_hash))
  OR (NEW.kind IN ('supply_return','lot_write_off') AND EXISTS(SELECT 1 FROM inventory_inventoryintentexecution x
    JOIN inventory_inventoryintent i ON i.id=x.intent_id WHERE x.id=NEW.execution_id
    AND x.organization_id=NEW.organization_id AND i.created_by_id=NEW.created_by_id
    AND NEW.content_hash=i.input_hash AND ((NEW.kind='supply_return' AND i.kind='return_accept')
      OR (NEW.kind='lot_write_off' AND i.kind='lot_write_off'))))
  OR (NEW.kind='supply_compensation' AND EXISTS(SELECT 1 FROM inventory_supplyvoidaudit audit
    WHERE audit.id=NEW.compensation_id AND audit.organization_id=NEW.organization_id
    AND audit.created_by_id=NEW.created_by_id AND NEW.content_hash=audit.source_payload_hash)))"""
CHECKS["supplystockeffect"] = """EXISTS(SELECT 1 FROM inventory_supplyledgersource source
  JOIN inventory_stockmovement movement ON movement.id=NEW.movement_id
  JOIN inventory_stockoperation operation ON operation.id=movement.operation_id
  WHERE source.id=NEW.source_id AND source.organization_id=NEW.organization_id
  AND movement.organization_id=NEW.organization_id AND operation.supply_source_id=source.id
  AND NEW.created_by_id=source.created_by_id AND movement.created_by_id=source.created_by_id
  AND operation.created_by_id=source.created_by_id
  AND ((source.kind='lot_write_off' AND NEW.kind='write_off' AND NEW.assignment_line_id IS NULL
    AND NEW.receipt_line_id IS NULL AND EXISTS(SELECT 1 FROM inventory_lotwriteoff loss
      WHERE loss.execution_id=source.execution_id AND movement.lot_id=loss.lot_id
      AND movement.location_id=loss.location_id AND movement.unit_version_id=loss.unit_version_id
      AND movement.piece_id IS NOT DISTINCT FROM loss.piece_id AND movement.quantity=-loss.quantity))
  OR EXISTS(SELECT 1 FROM inventory_supplyreceiptline receipt
    JOIN inventory_supplyreceipt signed ON signed.id=receipt.receipt_id
    JOIN inventory_supplyevent received ON received.id=signed.event_id
    JOIN inventory_originreleaseline release ON release.id=receipt.release_line_id
    JOIN inventory_supplyassignmentline plan ON plan.id=release.line_id
    JOIN inventory_supplyassignment assignment ON assignment.id=received.assignment_id
    WHERE receipt.id=NEW.receipt_line_id AND plan.id=NEW.assignment_line_id
    AND receipt.organization_id=NEW.organization_id AND movement.lot_id=plan.lot_id
    AND movement.piece_id IS NOT DISTINCT FROM plan.piece_id AND movement.unit_version_id=plan.unit_version_id
    AND ((source.kind='supply_receive' AND source.event_id=received.id
      AND ((NEW.kind='origin_debit' AND movement.location_id=assignment.origin_id AND movement.quantity=-receipt.quantity)
        OR (NEW.kind='courier_credit' AND movement.assignment_id=assignment.id AND movement.quantity=receipt.quantity)))
    OR (source.kind='supply_reconcile' AND movement.assignment_id=assignment.id AND movement.quantity<0
      AND NEW.kind IN ('used','shrinkage') AND EXISTS(SELECT 1 FROM inventory_supplyevent e
        WHERE e.id=source.event_id AND e.assignment_id=assignment.id))
    OR (source.kind='supply_return' AND EXISTS(SELECT 1 FROM inventory_returnacceptance accepted
      JOIN inventory_returndeclaration declaration ON declaration.id=accepted.declaration_id
      WHERE accepted.execution_id=source.execution_id AND declaration.receipt_line_id=receipt.id
      AND ((NEW.kind='returned' AND movement.assignment_id=assignment.id AND movement.quantity=-accepted.quantity)
        OR (NEW.kind='return_credit' AND movement.location_id=declaration.destination_id AND movement.quantity=accepted.quantity))))
    OR (source.kind='supply_compensation' AND EXISTS(SELECT 1 FROM inventory_supplyvoidaudit audit
      WHERE audit.id=source.compensation_id AND audit.event_id=received.id
      AND ((NEW.kind='void_debit' AND movement.assignment_id=assignment.id AND movement.quantity=-receipt.quantity)
        OR (NEW.kind='void_credit' AND movement.location_id=assignment.origin_id AND movement.quantity=receipt.quantity))))))))"""
CHECKS[
    "supplysourceresult"
] = """EXISTS(SELECT 1 FROM inventory_supplyevent e WHERE e.id=NEW.event_id
  AND e.organization_id=NEW.organization_id AND e.created_by_id=NEW.created_by_id)
  AND jsonb_typeof(NEW.response)='object'"""

INSERT_ONLY = """
CREATE FUNCTION inventory_supply_insert_only() RETURNS trigger AS $$
BEGIN
  IF TG_OP<>'INSERT' THEN RAISE EXCEPTION 'supply facts are insert-only'; END IF;
  IF NEW.created_by_id IS NULL THEN RAISE EXCEPTION 'supply facts require a real author'; END IF;
  -- The ordinary writer already owns this lock. Raw concurrent custody writes serialize too.
  PERFORM 1 FROM organizations_organization WHERE id=NEW.organization_id FOR NO KEY UPDATE NOWAIT;
  RETURN NEW;
END; $$ LANGUAGE plpgsql;
""" + "\n".join(
    f"""CREATE FUNCTION inventory_{name}_supply_guard() RETURNS trigger AS $$
BEGIN
  IF NEW.created_by_id IS NULL OR NOT COALESCE(({condition}),false) THEN
    RAISE EXCEPTION 'supply identity, source or organization mismatch';
  END IF;
  RETURN NEW;
END; $$ LANGUAGE plpgsql;
CREATE TRIGGER inventory_{name}_guard BEFORE INSERT OR UPDATE OR DELETE ON inventory_{name}
FOR EACH ROW EXECUTE FUNCTION inventory_supply_insert_only();
CREATE CONSTRAINT TRIGGER inventory_{name}_supply_complete AFTER INSERT ON inventory_{name}
DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION inventory_{name}_supply_guard();"""
    for name, condition in CHECKS.items()
)

BALANCE = """
CREATE FUNCTION inventory_supply_balance_at(org uuid,lot uuid,unit uuid,piece uuid,location uuid,assignment uuid)
RETURNS void AS $$
DECLARE actual numeric; reserved numeric;
BEGIN
  SELECT COALESCE(SUM(m.quantity),0) INTO actual FROM inventory_stockmovement m
    WHERE m.organization_id=org AND m.lot_id=lot AND m.unit_version_id=unit
    AND m.piece_id IS NOT DISTINCT FROM piece AND m.location_id IS NOT DISTINCT FROM location
    AND m.assignment_id IS NOT DISTINCT FROM assignment;
  IF actual<0 THEN RAISE EXCEPTION 'custody balance cannot become negative'; END IF;
  IF location IS NOT NULL THEN
    SELECT COALESCE(SUM(released.quantity
      -COALESCE((SELECT SUM(c.quantity) FROM inventory_releasecancellationline c WHERE c.release_line_id=released.id),0)
      -COALESCE((SELECT SUM(r.quantity) FROM inventory_supplyreceiptline r
        JOIN inventory_supplyreceipt signed ON signed.id=r.receipt_id
        WHERE r.release_line_id=released.id AND NOT EXISTS(SELECT 1 FROM inventory_supplyvoidaudit v WHERE v.event_id=signed.event_id)),0)),0)
    INTO reserved FROM inventory_originreleaseline released
      JOIN inventory_supplyassignmentline plan ON plan.id=released.line_id
      JOIN inventory_supplyassignmentversion version ON version.id=plan.version_id
      JOIN inventory_supplyassignment a ON a.id=version.assignment_id
      WHERE released.organization_id=org AND a.origin_id=location AND plan.lot_id=lot
      AND plan.unit_version_id=unit AND plan.piece_id IS NOT DISTINCT FROM piece;
    IF reserved<0 OR actual<reserved THEN
      RAISE EXCEPTION 'signed release reservations exceed shared available stock';
    END IF;
  END IF;
END; $$ LANGUAGE plpgsql;

CREATE FUNCTION inventory_supply_stock_lock() RETURNS trigger AS $$
BEGIN
  PERFORM 1 FROM organizations_organization WHERE id=NEW.organization_id FOR NO KEY UPDATE NOWAIT;
  RETURN NEW;
END; $$ LANGUAGE plpgsql;
CREATE TRIGGER inventory_supply_stock_lock BEFORE INSERT ON inventory_stockmovement
FOR EACH ROW EXECUTE FUNCTION inventory_supply_stock_lock();

CREATE FUNCTION inventory_supply_movement_complete() RETURNS trigger AS $$
DECLARE operation inventory_stockoperation; source inventory_supplyledgersource; actual_source uuid;
BEGIN
  SELECT * INTO operation FROM inventory_stockoperation WHERE id=NEW.operation_id;
  IF NOT EXISTS(SELECT 1 FROM inventory_lot lot JOIN inventory_supplytypeversion unit ON unit.id=NEW.unit_version_id
    WHERE lot.id=NEW.lot_id AND lot.organization_id=NEW.organization_id AND unit.organization_id=NEW.organization_id
    AND unit.supply_type_id=lot.supply_id AND ((unit.identity_kind='lot' AND NEW.piece_id IS NULL)
      OR (unit.identity_kind='piece' AND EXISTS(SELECT 1 FROM inventory_piece p
      WHERE p.id=NEW.piece_id AND p.lot_id=lot.id AND p.organization_id=NEW.organization_id AND abs(NEW.quantity)=1))))
    THEN RAISE EXCEPTION 'ledger quantity, lot, piece or unit mismatch'; END IF;
  IF NEW.assignment_id IS NOT NULL THEN
    IF operation.supply_source_id IS NULL OR NOT EXISTS(SELECT 1 FROM inventory_supplyassignment a
      WHERE a.id=NEW.assignment_id AND a.organization_id=NEW.organization_id)
      THEN RAISE EXCEPTION 'assignment custody requires its genuine supply source'; END IF;
  END IF;
  IF operation.supply_source_id IS NOT NULL THEN
    SELECT * INTO source FROM inventory_supplyledgersource WHERE id=operation.supply_source_id;
    IF source.event_id IS NOT NULL THEN actual_source=source.event_id;
    ELSIF source.compensation_id IS NOT NULL THEN actual_source=source.compensation_id;
    ELSIF source.kind='supply_return' THEN SELECT id INTO actual_source FROM inventory_returnacceptance WHERE execution_id=source.execution_id;
    ELSIF source.kind='lot_write_off' THEN SELECT id INTO actual_source FROM inventory_lotwriteoff WHERE execution_id=source.execution_id;
    END IF;
    IF actual_source IS NULL OR operation.source_id IS DISTINCT FROM actual_source
      OR operation.source_kind IS DISTINCT FROM source.kind OR operation.content_hash IS DISTINCT FROM source.content_hash
      OR source.organization_id IS DISTINCT FROM NEW.organization_id
      OR NOT EXISTS(SELECT 1 FROM inventory_supplystockeffect e WHERE e.movement_id=NEW.id AND e.source_id=source.id)
      THEN RAISE EXCEPTION 'movement requires its exact concrete supply effect'; END IF;
  END IF;
  PERFORM inventory_supply_balance_at(NEW.organization_id,NEW.lot_id,NEW.unit_version_id,NEW.piece_id,NEW.location_id,NEW.assignment_id);
  RETURN NEW;
END; $$ LANGUAGE plpgsql;
CREATE CONSTRAINT TRIGGER inventory_supply_movement_complete AFTER INSERT ON inventory_stockmovement
DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION inventory_supply_movement_complete();

CREATE FUNCTION inventory_supply_reservation_complete() RETURNS trigger AS $$
DECLARE release_uuid uuid; released inventory_originreleaseline; plan inventory_supplyassignmentline;
  assignment inventory_supplyassignment; cancelled numeric; credited numeric;
BEGIN
  CASE TG_TABLE_NAME
    WHEN 'inventory_originreleaseline' THEN release_uuid=NEW.id;
    WHEN 'inventory_releasecancellationline' THEN release_uuid=NEW.release_line_id;
    WHEN 'inventory_supplyreceiptline' THEN release_uuid=NEW.release_line_id;
  END CASE;
  SELECT * INTO released FROM inventory_originreleaseline WHERE id=release_uuid;
  SELECT * INTO plan FROM inventory_supplyassignmentline WHERE id=released.line_id;
  SELECT a.* INTO assignment FROM inventory_supplyassignment a
    JOIN inventory_supplyassignmentversion v ON v.assignment_id=a.id WHERE v.id=plan.version_id;
  SELECT COALESCE(SUM(quantity),0) INTO cancelled FROM inventory_releasecancellationline WHERE release_line_id=release_uuid;
  SELECT COALESCE(SUM(r.quantity),0) INTO credited FROM inventory_supplyreceiptline r
    JOIN inventory_supplyreceipt signed ON signed.id=r.receipt_id WHERE r.release_line_id=release_uuid
    AND NOT EXISTS(SELECT 1 FROM inventory_supplyvoidaudit audit WHERE audit.event_id=signed.event_id);
  IF cancelled+credited>released.quantity OR
    (SELECT COALESCE(SUM(quantity),0) FROM inventory_originreleaseline WHERE line_id=plan.id)
    -(SELECT COALESCE(SUM(c.quantity),0) FROM inventory_releasecancellationline c
      JOIN inventory_originreleaseline l ON l.id=c.release_line_id WHERE l.line_id=plan.id)>plan.quantity
    THEN RAISE EXCEPTION 'release, cancellation or receipt exceeds exact reserved manifest'; END IF;
  PERFORM inventory_supply_balance_at(released.organization_id,plan.lot_id,plan.unit_version_id,plan.piece_id,assignment.origin_id,NULL);
  RETURN NEW;
END; $$ LANGUAGE plpgsql;
""" + "\n".join(
    f"""CREATE CONSTRAINT TRIGGER inventory_{name}_reservation_complete AFTER INSERT ON inventory_{name}
DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION inventory_supply_reservation_complete();"""
    for name in ("originreleaseline", "releasecancellationline", "supplyreceiptline")
)

SOURCE_COMPLETE = """
CREATE FUNCTION inventory_supply_receipt_remaining(receipt_uuid uuid) RETURNS numeric AS $$
DECLARE actual numeric; used numeric; lost numeric; returned numeric;
BEGIN
  SELECT quantity INTO actual FROM inventory_supplyreceiptline WHERE id=receipt_uuid;
  IF actual IS NULL THEN RAISE EXCEPTION 'custody requires a real receipt line'; END IF;
  SELECT COALESCE(SUM(u.quantity),0) INTO used FROM inventory_supplyuse u WHERE u.receipt_line_id=receipt_uuid
    AND NOT EXISTS(SELECT 1 FROM inventory_supplyvoidaudit v WHERE v.event_id=u.event_id);
  SELECT COALESCE(SUM(s.quantity),0) INTO lost FROM inventory_supplyshrinkage s WHERE s.receipt_line_id=receipt_uuid
    AND NOT EXISTS(SELECT 1 FROM inventory_supplyvoidaudit v WHERE v.event_id=s.event_id);
  SELECT COALESCE(SUM(a.quantity),0) INTO returned FROM inventory_returnacceptance a
    JOIN inventory_returndeclaration d ON d.id=a.declaration_id WHERE d.receipt_line_id=receipt_uuid;
  IF used+lost+returned>actual THEN RAISE EXCEPTION 'receipt custody cannot be spent twice'; END IF;
  RETURN actual-used-lost-returned;
END; $$ LANGUAGE plpgsql;

CREATE FUNCTION inventory_supply_source_complete(supply_event_uuid uuid) RETURNS void AS $$
DECLARE event inventory_supplyevent; signed_receipt inventory_supplyreceipt; line record; effect numeric;
  observed jsonb; used numeric; lost numeric; evidence_uuid text;
BEGIN
  SELECT * INTO event FROM inventory_supplyevent WHERE id=supply_event_uuid;
  IF event.id IS NULL THEN RAISE EXCEPTION 'supply effect has no real event'; END IF;
  IF NOT EXISTS(SELECT 1 FROM inventory_supplysourcelink WHERE event_id=event.id)
    OR NOT EXISTS(SELECT 1 FROM inventory_supplysourceresult WHERE event_id=event.id)
    OR NOT EXISTS(SELECT 1 FROM inventory_reconciliationversion frame
      JOIN inventory_reconciliation reconciliation ON reconciliation.id=frame.reconciliation_id
      WHERE frame.source_event_id=event.id AND frame.revision=event.revision
      AND reconciliation.assignment_id=event.assignment_id)
    THEN RAISE EXCEPTION 'supply source requires exact source, result and reconciliation receipts'; END IF;
  IF event.kind='receive' THEN
    SELECT * INTO signed_receipt FROM inventory_supplyreceipt WHERE event_id=event.id;
    IF signed_receipt.id IS NULL OR NOT EXISTS(SELECT 1 FROM uploads_attachmentlink link
      JOIN uploads_upload upload ON upload.id=link.upload_id
      JOIN field_sync_fieldevent source ON source.id=link.field_event_id
      WHERE link.upload_id=signed_receipt.signature_id AND source.id=event.declared_source_uuid
      AND upload.device_id=source.device_id)
      THEN RAISE EXCEPTION 'signed receipt requires its exact verified source parent'; END IF;
    IF (SELECT COUNT(*) FROM inventory_supplyreceiptline WHERE receipt_id=signed_receipt.id)
      <>jsonb_array_length(event.canonical_input->'actual_lines')
      THEN RAISE EXCEPTION 'signed observation lines must remain complete'; END IF;
    FOR observed IN SELECT value FROM jsonb_array_elements(event.canonical_input->'actual_lines') LOOP
      IF NOT EXISTS(SELECT 1 FROM inventory_supplyreceiptline r WHERE r.receipt_id=signed_receipt.id
        AND r.id::text=observed->>'id' AND r.release_line_id::text=observed->>'release_line_id'
        AND r.quantity=(observed->>'quantity')::numeric)
        THEN RAISE EXCEPTION 'receipt line differs from the exact signed observation'; END IF;
    END LOOP;
    FOR line IN SELECT * FROM inventory_supplyreceiptline WHERE receipt_id=signed_receipt.id LOOP
      IF line.quantity>0 THEN
        IF (SELECT COUNT(*) FROM inventory_supplystockeffect effect JOIN inventory_supplyledgersource source
          ON source.id=effect.source_id WHERE source.event_id=event.id AND effect.receipt_line_id=line.id
          AND effect.kind='origin_debit')<>1 OR
          (SELECT COUNT(*) FROM inventory_supplystockeffect effect JOIN inventory_supplyledgersource source
          ON source.id=effect.source_id WHERE source.event_id=event.id AND effect.receipt_line_id=line.id
          AND effect.kind='courier_credit')<>1
          THEN RAISE EXCEPTION 'credited receipt requires both exact custody legs'; END IF;
      ELSE
        IF EXISTS(SELECT 1 FROM inventory_supplystockeffect effect JOIN inventory_supplyledgersource source
          ON source.id=effect.source_id WHERE source.event_id=event.id AND effect.receipt_line_id=line.id)
          THEN RAISE EXCEPTION 'signed zero observation cannot post stock'; END IF;
      END IF;
    END LOOP;
  ELSE
    IF (SELECT COUNT(*) FROM inventory_supplyuse WHERE event_id=event.id)<>jsonb_array_length(event.canonical_input->'used')
      OR (SELECT COUNT(*) FROM inventory_supplyshrinkage WHERE event_id=event.id)<>jsonb_array_length(event.canonical_input->'shrinkage')
      OR (SELECT COUNT(*) FROM inventory_returndeclaration WHERE event_id=event.id)<>jsonb_array_length(event.canonical_input->'returned')
      THEN RAISE EXCEPTION 'reconciliation must retain every actual declared delta'; END IF;
    IF EXISTS((SELECT receipt_line_id::text,quantity,work_kind,work_source_id::text,manual_reason,transit_policy_id::text
      FROM inventory_supplyuse WHERE event_id=event.id)
      EXCEPT ALL (SELECT row->>'receipt_line_id',(row->>'quantity')::numeric,row->>'work_kind',
        row->>'work_source_id',COALESCE(row->>'manual_reason',''),row->>'transit_policy_id'
        FROM jsonb_array_elements(event.canonical_input->'used') row))
      OR EXISTS((SELECT receipt_line_id::text,quantity,reason_code,reason,evidence_ids
        FROM inventory_supplyshrinkage WHERE event_id=event.id)
      EXCEPT ALL (SELECT row->>'receipt_line_id',(row->>'quantity')::numeric,row->>'reason_code',row->>'reason',row->'evidence_ids'
        FROM jsonb_array_elements(event.canonical_input->'shrinkage') row))
      OR EXISTS((SELECT receipt_line_id::text,quantity,destination_id::text FROM inventory_returndeclaration WHERE event_id=event.id)
      EXCEPT ALL (SELECT row->>'receipt_line_id',(row->>'quantity')::numeric,row->>'destination_id'
        FROM jsonb_array_elements(event.canonical_input->'returned') row))
      THEN RAISE EXCEPTION 'reconciliation effects differ from exact captured facts'; END IF;
    FOR observed IN SELECT row FROM jsonb_array_elements(event.canonical_input->'used') row
      UNION ALL SELECT row FROM jsonb_array_elements(event.canonical_input->'shrinkage') row
      UNION ALL SELECT row FROM jsonb_array_elements(event.canonical_input->'returned') row LOOP
      IF NOT EXISTS(SELECT 1 FROM inventory_supplyreceiptline receipt
        JOIN inventory_supplyreceipt captured_receipt ON captured_receipt.id=receipt.receipt_id
        JOIN inventory_supplyevent parent ON parent.id=captured_receipt.event_id
        WHERE receipt.id::text=observed->>'receipt_line_id'
        AND parent.declared_source_uuid::text=observed->>'receipt_source_event_id'
        AND parent.assignment_id=event.assignment_id AND parent.created_by_id=event.created_by_id)
        THEN RAISE EXCEPTION 'delta requires the exact authored real receipt source'; END IF;
      FOR evidence_uuid IN SELECT value FROM jsonb_array_elements_text(
        COALESCE(observed->'transit_evidence_ids',observed->'evidence_ids','[]'::jsonb)) LOOP
        IF NOT EXISTS(SELECT 1 FROM uploads_upload upload
          JOIN uploads_uploadverification verified ON verified.upload_id=upload.id
          JOIN uploads_attachmentlink link ON link.upload_id=upload.id
          JOIN field_sync_fieldevent source ON source.id=link.field_event_id
          WHERE upload.public_id::text=evidence_uuid AND upload.organization_id=event.organization_id
          AND upload.uploader_id=event.created_by_id AND upload.device_id=source.device_id
          AND source.id=event.declared_source_uuid)
          THEN RAISE EXCEPTION 'delta evidence requires verified bytes on its exact source'; END IF;
      END LOOP;
    END LOOP;
    FOR line IN SELECT DISTINCT receipt_line_id FROM (
      SELECT receipt_line_id FROM inventory_supplyuse WHERE event_id=event.id UNION ALL
      SELECT receipt_line_id FROM inventory_supplyshrinkage WHERE event_id=event.id UNION ALL
      SELECT receipt_line_id FROM inventory_returndeclaration WHERE event_id=event.id) sources LOOP
      SELECT COALESCE(SUM(quantity),0) INTO used FROM inventory_supplyuse WHERE event_id=event.id AND receipt_line_id=line.receipt_line_id;
      SELECT COALESCE(SUM(quantity),0) INTO lost FROM inventory_supplyshrinkage WHERE event_id=event.id AND receipt_line_id=line.receipt_line_id;
      PERFORM inventory_supply_receipt_remaining(line.receipt_line_id);
      SELECT COALESCE(SUM(-movement.quantity),0) INTO effect FROM inventory_supplystockeffect e
        JOIN inventory_supplyledgersource source ON source.id=e.source_id JOIN inventory_stockmovement movement ON movement.id=e.movement_id
        WHERE source.event_id=event.id AND e.receipt_line_id=line.receipt_line_id AND e.kind='used';
      IF effect<>used THEN RAISE EXCEPTION 'use requires its exact single source debit'; END IF;
      SELECT COALESCE(SUM(-movement.quantity),0) INTO effect FROM inventory_supplystockeffect e
        JOIN inventory_supplyledgersource source ON source.id=e.source_id JOIN inventory_stockmovement movement ON movement.id=e.movement_id
        WHERE source.event_id=event.id AND e.receipt_line_id=line.receipt_line_id AND e.kind='shrinkage';
      IF effect<>lost THEN RAISE EXCEPTION 'loss requires its exact single source debit'; END IF;
    END LOOP;
  END IF;
END; $$ LANGUAGE plpgsql;

CREATE FUNCTION inventory_supply_event_complete() RETURNS trigger AS $$
DECLARE event_id uuid;
BEGIN
  CASE TG_TABLE_NAME
    WHEN 'inventory_supplyevent' THEN event_id=NEW.id;
    WHEN 'inventory_supplyreceipt' THEN event_id=NEW.event_id;
    WHEN 'inventory_supplyuse' THEN event_id=NEW.event_id;
    WHEN 'inventory_supplyshrinkage' THEN event_id=NEW.event_id;
    WHEN 'inventory_returndeclaration' THEN event_id=NEW.event_id;
  END CASE;
  PERFORM inventory_supply_source_complete(event_id);
  RETURN NEW;
END; $$ LANGUAGE plpgsql;
""" + "\n".join(
    f"""CREATE CONSTRAINT TRIGGER inventory_{name}_source_complete AFTER INSERT ON inventory_{name}
DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION inventory_supply_event_complete();"""
    for name in (
        "supplyevent",
        "supplyreceipt",
        "supplyuse",
        "supplyshrinkage",
        "returndeclaration",
    )
)

EXECUTION_COMPLETE = """
CREATE FUNCTION inventory_supply_execution_complete() RETURNS trigger AS $$
DECLARE intent inventory_inventoryintent; accepted inventory_returnacceptance; loss inventory_lotwriteoff;
  fact_uuid uuid; expected_body text; receipt record; used numeric; lost numeric; returned numeric;
BEGIN
  SELECT * INTO intent FROM inventory_inventoryintent WHERE id=NEW.intent_id;
  CASE intent.kind
    WHEN 'assignment_release' THEN
      SELECT id INTO fact_uuid FROM inventory_originreleaseproof WHERE intent_id=intent.id;
      expected_body='release';
      IF fact_uuid IS NOT NULL AND
        (SELECT COUNT(*) FROM inventory_originreleaseline WHERE release_id=fact_uuid)
        <>(SELECT COUNT(*) FROM inventory_supplyassignmentline plan JOIN inventory_originreleaseproof release
          ON release.version_id=plan.version_id WHERE release.id=fact_uuid)
        THEN RAISE EXCEPTION 'release requires its complete actual manifest'; END IF;
    WHEN 'release_cancel' THEN
      SELECT id INTO fact_uuid FROM inventory_releasecancellation WHERE intent_id=intent.id;
      expected_body='cancellation';
      IF fact_uuid IS NOT NULL AND NOT EXISTS(SELECT 1 FROM inventory_releasecancellationline WHERE cancellation_id=fact_uuid)
        THEN RAISE EXCEPTION 'cancellation requires actual uncancelled quantities'; END IF;
    WHEN 'return_accept' THEN
      SELECT * INTO accepted FROM inventory_returnacceptance WHERE execution_id=NEW.id;
      fact_uuid=accepted.id; expected_body='acceptance';
      IF (SELECT COUNT(*) FROM inventory_supplystockeffect effect JOIN inventory_supplyledgersource source
        ON source.id=effect.source_id WHERE source.execution_id=NEW.id AND effect.kind='returned')<>1
        OR (SELECT COUNT(*) FROM inventory_supplystockeffect effect JOIN inventory_supplyledgersource source
        ON source.id=effect.source_id WHERE source.execution_id=NEW.id AND effect.kind='return_credit')<>1
        THEN RAISE EXCEPTION 'return acceptance requires both exact physical custody legs'; END IF;
      IF (SELECT COALESCE(SUM(quantity),0) FROM inventory_returnacceptance WHERE declaration_id=accepted.declaration_id)
        >(SELECT quantity FROM inventory_returndeclaration WHERE id=accepted.declaration_id)
        THEN RAISE EXCEPTION 'acceptance exceeds its signed return declaration'; END IF;
      IF NOT EXISTS(SELECT 1 FROM inventory_reconciliationversion WHERE acceptance_id=accepted.id)
        THEN RAISE EXCEPTION 'accepted return requires its reconciliation frame'; END IF;
    WHEN 'reconcile_justify' THEN
      SELECT id INTO fact_uuid FROM inventory_supplydiscrepancydecision WHERE execution_id=NEW.id;
      expected_body='justification';
    WHEN 'lot_write_off' THEN
      SELECT * INTO loss FROM inventory_lotwriteoff WHERE execution_id=NEW.id;
      fact_uuid=loss.id; expected_body='write_off';
      IF (SELECT COUNT(*) FROM inventory_supplystockeffect effect JOIN inventory_supplyledgersource source
        ON source.id=effect.source_id WHERE source.execution_id=NEW.id AND effect.kind='write_off')<>1
        THEN RAISE EXCEPTION 'numeric write-off requires its exact source debit'; END IF;
    WHEN 'bag_disposal' THEN
      SELECT id INTO fact_uuid FROM inventory_bagdisposition WHERE execution_id=NEW.id;
      expected_body='write_off';
    ELSE RAISE EXCEPTION 'unknown inventory intent effect';
  END CASE;
  IF fact_uuid IS NULL OR NEW.response->expected_body->>'id' IS DISTINCT FROM fact_uuid::text
    THEN RAISE EXCEPTION 'execution receipt must name its exact typed immutable effect'; END IF;
  IF intent.assignment_id IS NOT NULL THEN
    FOR receipt IN SELECT r.id,r.quantity FROM inventory_supplyreceiptline r
      JOIN inventory_supplyreceipt signed ON signed.id=r.receipt_id
      JOIN inventory_supplyevent event ON event.id=signed.event_id
      WHERE event.assignment_id=intent.assignment_id AND NOT EXISTS(SELECT 1 FROM inventory_supplyvoidaudit v WHERE v.event_id=event.id)
    LOOP
      SELECT COALESCE(SUM(u.quantity),0) INTO used FROM inventory_supplyuse u WHERE u.receipt_line_id=receipt.id
        AND NOT EXISTS(SELECT 1 FROM inventory_supplyvoidaudit v WHERE v.event_id=u.event_id);
      SELECT COALESCE(SUM(s.quantity),0) INTO lost FROM inventory_supplyshrinkage s WHERE s.receipt_line_id=receipt.id
        AND NOT EXISTS(SELECT 1 FROM inventory_supplyvoidaudit v WHERE v.event_id=s.event_id);
      SELECT COALESCE(SUM(a.quantity),0) INTO returned FROM inventory_returnacceptance a
        JOIN inventory_returndeclaration d ON d.id=a.declaration_id WHERE d.receipt_line_id=receipt.id;
      IF used+lost+returned>receipt.quantity THEN RAISE EXCEPTION 'receipt custody cannot be spent twice'; END IF;
    END LOOP;
  END IF;
  RETURN NEW;
END; $$ LANGUAGE plpgsql;
CREATE CONSTRAINT TRIGGER inventory_supply_execution_complete AFTER INSERT ON inventory_inventoryintentexecution
DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION inventory_supply_execution_complete();
"""

AUDIT_COMPLETE = """
CREATE FUNCTION inventory_supply_plan_complete() RETURNS trigger AS $$
DECLARE version_uuid uuid;
BEGIN
  IF TG_TABLE_NAME='inventory_supplyassignment' THEN
    IF NOT EXISTS(SELECT 1 FROM inventory_reconciliation WHERE assignment_id=NEW.id)
      OR NOT EXISTS(SELECT 1 FROM inventory_supplyassignmentversion WHERE assignment_id=NEW.id AND revision=1)
      THEN RAISE EXCEPTION 'assignment requires its complete actual plan and reconciliation'; END IF;
  ELSE
    version_uuid=NEW.id;
    IF NOT EXISTS(SELECT 1 FROM inventory_supplyassignmentline WHERE version_id=version_uuid)
      OR NOT EXISTS(SELECT 1 FROM inventory_supplyassignmentcommandreceipt WHERE version_id=version_uuid)
      OR EXISTS(SELECT lot_id,piece_id,unit_version_id FROM inventory_supplyassignmentline
        WHERE version_id=version_uuid GROUP BY lot_id,piece_id,unit_version_id HAVING COUNT(*)>1)
      THEN RAISE EXCEPTION 'assignment version requires its complete actual plan and command'; END IF;
  END IF;
  RETURN NEW;
END; $$ LANGUAGE plpgsql;
CREATE CONSTRAINT TRIGGER inventory_assignment_plan_complete AFTER INSERT ON inventory_supplyassignment
DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION inventory_supply_plan_complete();
CREATE CONSTRAINT TRIGGER inventory_assignment_version_complete AFTER INSERT ON inventory_supplyassignmentversion
DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION inventory_supply_plan_complete();

CREATE FUNCTION inventory_supply_frame_complete() RETURNS trigger AS $$
DECLARE assignment_uuid uuid; entry jsonb;
BEGIN
  SELECT assignment_id INTO assignment_uuid FROM inventory_reconciliation WHERE id=NEW.reconciliation_id;
  IF NEW.source_event_id IS NOT NULL THEN
    IF NOT EXISTS(SELECT 1 FROM inventory_supplyevent source WHERE source.id=NEW.source_event_id
      AND source.organization_id=NEW.organization_id AND source.assignment_id=assignment_uuid AND source.revision=NEW.revision)
      THEN RAISE EXCEPTION 'reconciliation requires its genuine source cause'; END IF;
  ELSIF NEW.acceptance_id IS NOT NULL THEN
    IF NOT EXISTS(SELECT 1 FROM inventory_returnacceptance accepted
      JOIN inventory_returndeclaration declaration ON declaration.id=accepted.declaration_id
      JOIN inventory_supplyevent source ON source.id=declaration.event_id
      WHERE accepted.id=NEW.acceptance_id AND accepted.organization_id=NEW.organization_id
      AND source.assignment_id=assignment_uuid)
      THEN RAISE EXCEPTION 'reconciliation requires its genuine accepted return'; END IF;
  ELSIF NEW.void_audit_id IS NOT NULL THEN
    IF NOT EXISTS(SELECT 1 FROM inventory_supplyvoidaudit audit JOIN inventory_supplyevent source ON source.id=audit.event_id
      WHERE audit.id=NEW.void_audit_id AND audit.organization_id=NEW.organization_id AND source.assignment_id=assignment_uuid)
      THEN RAISE EXCEPTION 'reconciliation requires its genuine compensation'; END IF;
  ELSE
    IF NOT EXISTS(SELECT 1 FROM field_sync_fieldevent source
      JOIN shifts_shift shift ON shift.id=NEW.shift_id
      JOIN inventory_supplyassignment assignment ON assignment.id=assignment_uuid
      JOIN organizations_organization organization ON organization.id=NEW.organization_id
      WHERE source.id=NEW.close_source_uuid AND source.type='shift.close' AND source.shift_id=shift.id
      AND source.organization_id=NEW.organization_id AND shift.organization_id=NEW.organization_id
      AND shift.courier_id=assignment.courier_id AND source.created_by_id=assignment.courier_id
      AND shift.closed_event_id=source.id AND (assignment.shift_id=shift.id OR (assignment.shift_id IS NULL
        AND assignment.date=(source.device_time AT TIME ZONE organization.timezone)::date))
      AND (source.status='accepted' OR EXISTS(SELECT 1 FROM reviews_revieweffectreceipt receipt
        WHERE receipt.source_event_id=source.id AND receipt.payload_sha256=source.payload_sha256)))
      THEN RAISE EXCEPTION 'close reconciliation requires the actual effective courier shift'; END IF;
  END IF;
  IF NEW.frame->>'assignment_id' IS DISTINCT FROM assignment_uuid::text
    OR jsonb_typeof(NEW.frame->'lines') IS DISTINCT FROM 'array'
    OR (SELECT COUNT(*) FROM inventory_reconciliationline WHERE version_id=NEW.id)<>jsonb_array_length(NEW.frame->'lines')
    THEN RAISE EXCEPTION 'reconciliation must retain its complete exact frame'; END IF;
  FOR entry IN SELECT value FROM jsonb_array_elements(NEW.frame->'lines') LOOP
    IF NOT EXISTS(SELECT 1 FROM inventory_reconciliationline line
      JOIN inventory_supplyassignmentline planned ON planned.id=line.assignment_line_id
      JOIN inventory_supplyassignmentversion version ON version.id=planned.version_id
      WHERE line.version_id=NEW.id AND line.assignment_line_id::text=entry->>'assignment_line_id'
      AND version.revision=(entry->>'plan_revision')::integer
      AND line.planned=(entry->>'planned')::numeric
      AND line.credited IS NOT DISTINCT FROM (entry->>'credited')::numeric
      AND line.used=(entry->>'used')::numeric AND line.returned=(entry->>'returned')::numeric
      AND line.shrinkage=(entry->>'shrinkage')::numeric
      AND line.difference IS NOT DISTINCT FROM (entry->>'difference')::numeric
      AND line.delivery_variance IS NOT DISTINCT FROM (entry->>'delivery_variance')::numeric)
      THEN RAISE EXCEPTION 'reconciliation row differs from retained signed frame'; END IF;
  END LOOP;
  RETURN NEW;
END; $$ LANGUAGE plpgsql;
CREATE CONSTRAINT TRIGGER inventory_supply_frame_complete AFTER INSERT ON inventory_reconciliationversion
DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION inventory_supply_frame_complete();

CREATE FUNCTION inventory_supply_void_complete() RETURNS trigger AS $$
DECLARE event inventory_supplyevent; line record;
BEGIN
  SELECT * INTO event FROM inventory_supplyevent WHERE id=NEW.event_id;
  IF NOT EXISTS(SELECT 1 FROM inventory_supplyvoidsourcelink link
    JOIN field_sync_fieldevent source ON source.id=link.source_event_id
    JOIN inventory_supplysourcelink original ON original.event_id=event.id
    JOIN field_sync_fieldevent target ON target.id=original.source_event_id
    WHERE link.audit_id=NEW.id AND target.voided_at IS NOT NULL
    AND target.voided_by_id=NEW.created_by_id AND target.void_reason=NEW.reason
    AND target.void_reason_code=NEW.reason_code AND source.voids_event_id=target.id)
    OR NOT EXISTS(SELECT 1 FROM inventory_reconciliationversion WHERE void_audit_id=NEW.id)
    THEN RAISE EXCEPTION 'supply void requires exact source and compensation audit'; END IF;
  IF event.kind='reconcile' THEN
    IF EXISTS(SELECT 1 FROM inventory_supplyuse WHERE event_id=event.id)
      OR EXISTS(SELECT 1 FROM inventory_supplyshrinkage WHERE event_id=event.id)
      OR EXISTS(SELECT 1 FROM inventory_returnacceptance a JOIN inventory_returndeclaration d ON d.id=a.declaration_id
        WHERE d.event_id=event.id)
      THEN RAISE EXCEPTION 'irreversible use, loss or accepted return must survive source void'; END IF;
  ELSE
    FOR line IN SELECT r.id,r.quantity FROM inventory_supplyreceiptline r
      JOIN inventory_supplyreceipt signed ON signed.id=r.receipt_id WHERE signed.event_id=event.id LOOP
      IF EXISTS(SELECT 1 FROM inventory_supplyuse WHERE receipt_line_id=line.id)
        OR EXISTS(SELECT 1 FROM inventory_supplyshrinkage WHERE receipt_line_id=line.id)
        OR EXISTS(SELECT 1 FROM inventory_returndeclaration d WHERE d.receipt_line_id=line.id
          AND NOT EXISTS(SELECT 1 FROM inventory_supplyvoidaudit v WHERE v.event_id=d.event_id))
        THEN RAISE EXCEPTION 'receipt dependents require preservation before compensation'; END IF;
      IF line.quantity>0 THEN
        IF (SELECT COUNT(*) FROM inventory_supplystockeffect effect JOIN inventory_supplyledgersource source
          ON source.id=effect.source_id WHERE source.compensation_id=NEW.id AND effect.receipt_line_id=line.id
          AND effect.kind='void_debit')<>1 OR
          (SELECT COUNT(*) FROM inventory_supplystockeffect effect JOIN inventory_supplyledgersource source
          ON source.id=effect.source_id WHERE source.compensation_id=NEW.id AND effect.receipt_line_id=line.id
          AND effect.kind='void_credit')<>1
          THEN RAISE EXCEPTION 'receipt compensation requires both exact inverse custody legs'; END IF;
      END IF;
    END LOOP;
  END IF;
  RETURN NEW;
END; $$ LANGUAGE plpgsql;
CREATE CONSTRAINT TRIGGER inventory_supply_void_complete AFTER INSERT ON inventory_supplyvoidaudit
DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION inventory_supply_void_complete();
"""

REVERSE_COMPLETE = (
    "\n".join(
        f"DROP TRIGGER inventory_{name}_source_complete ON inventory_{name};"
        for name in (
            "supplyevent",
            "supplyreceipt",
            "supplyuse",
            "supplyshrinkage",
            "returndeclaration",
        )
    )
    + "\n".join(
        f"DROP TRIGGER inventory_{name}_reservation_complete ON inventory_{name};"
        for name in ("originreleaseline", "releasecancellationline", "supplyreceiptline")
    )
    + """
DROP TRIGGER inventory_supply_stock_lock ON inventory_stockmovement;
DROP TRIGGER inventory_supply_movement_complete ON inventory_stockmovement;
DROP TRIGGER inventory_supply_execution_complete ON inventory_inventoryintentexecution;
DROP FUNCTION inventory_supply_execution_complete();
DROP TRIGGER inventory_assignment_plan_complete ON inventory_supplyassignment;
DROP TRIGGER inventory_assignment_version_complete ON inventory_supplyassignmentversion;
DROP TRIGGER inventory_supply_frame_complete ON inventory_reconciliationversion;
DROP TRIGGER inventory_supply_void_complete ON inventory_supplyvoidaudit;
DROP FUNCTION inventory_supply_plan_complete(); DROP FUNCTION inventory_supply_frame_complete();
DROP FUNCTION inventory_supply_void_complete();
DROP FUNCTION inventory_supply_event_complete(); DROP FUNCTION inventory_supply_source_complete(uuid);
DROP FUNCTION inventory_supply_receipt_remaining(uuid);
DROP FUNCTION inventory_supply_reservation_complete(); DROP FUNCTION inventory_supply_movement_complete();
DROP FUNCTION inventory_supply_stock_lock(); DROP FUNCTION inventory_supply_balance_at(uuid,uuid,uuid,uuid,uuid,uuid);
"""
)


def protect_reverse(apps, schema_editor):
    for name in CHECKS:
        with schema_editor.connection.cursor() as cursor:
            cursor.execute(f'SELECT EXISTS(SELECT 1 FROM "inventory_{name}")')
            if cursor.fetchone()[0]:
                raise IrreversibleError(
                    "Retain signed supply custody, disposition and audit facts."
                )


class Migration(migrations.Migration):
    dependencies = [
        ("inventory", "0005_courier_supplies"),
        ("lab", "0003_material_disposition_guard"),
        ("uploads", "0006_inventory_intent_parent"),
        ("reviews", "0005_supply_source_dependency"),
    ]
    operations = [
        migrations.RunSQL(
            INSERT_ONLY + BALANCE + SOURCE_COMPLETE + EXECUTION_COMPLETE + AUDIT_COMPLETE,
            "\n".join(
                f"DROP TRIGGER inventory_{name}_guard ON inventory_{name}; "
                f"DROP TRIGGER inventory_{name}_supply_complete ON inventory_{name}; "
                f"DROP FUNCTION inventory_{name}_supply_guard();"
                for name in reversed(CHECKS)
            )
            + "\nDROP FUNCTION inventory_supply_insert_only();"
            + REVERSE_COMPLETE,
        ),
        migrations.RunPython(migrations.RunPython.noop, protect_reverse),
    ]
