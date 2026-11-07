"""Append-only custody facts, concrete ledger sources and deferred completeness.

These guards validate identities and committed effects. Current paired authority,
canonical hashing and biological policy remain in the retained domain writer.
No existing fact or signed JSON is rewritten by upgrade.
"""

from importlib import import_module

from django.db import migrations

CHECKS = {
    "transfer": """EXISTS (SELECT 1 FROM inventory_location a JOIN inventory_location b
        ON b.id=NEW.destination_id WHERE a.id=NEW.origin_id
        AND a.id<>b.id AND a.organization_id=NEW.organization_id AND b.organization_id=NEW.organization_id)
        AND NEW.content_hash ~ '^[0-9a-f]{64}$'""",
    "transferline": """EXISTS (SELECT 1 FROM inventory_transfer t
        JOIN inventory_lot l ON l.id=NEW.lot_id
        JOIN inventory_supplytypeversion u ON u.id=NEW.unit_version_id
        JOIN inventory_locationversion a ON a.id=NEW.origin_version_id
        JOIN inventory_locationversion b ON b.id=NEW.destination_version_id
        WHERE t.id=NEW.transfer_id AND t.organization_id=NEW.organization_id
        AND l.organization_id=NEW.organization_id AND u.organization_id=NEW.organization_id
        AND u.supply_type_id=l.supply_id AND a.location_id=t.origin_id AND b.location_id=t.destination_id
        AND a.organization_id=NEW.organization_id AND b.organization_id=NEW.organization_id
        AND ((u.identity_kind='lot' AND NEW.piece_id IS NULL) OR
            (u.identity_kind='piece' AND NEW.quantity=1 AND EXISTS (SELECT 1 FROM inventory_piece p
             WHERE p.id=NEW.piece_id AND p.lot_id=l.id AND p.organization_id=NEW.organization_id))))""",
    "transferevent": """EXISTS (SELECT 1 FROM inventory_transfer t
        WHERE t.id=NEW.transfer_id AND t.organization_id=NEW.organization_id)
        AND NEW.kind IN ('prepared','dispatch','receive','resolution')
        AND NEW.revision=1+(SELECT COALESCE(MAX(e.revision),0) FROM inventory_transferevent e WHERE e.transfer_id=NEW.transfer_id)
        AND ((NEW.kind='prepared' AND NEW.revision=1) OR (NEW.kind<>'prepared' AND NEW.revision>1))
        AND jsonb_typeof(NEW.manifest)='object' AND NEW.manifest_hash ~ '^[0-9a-f]{64}$'
        AND ((NEW.declared_source_uuid IS NULL AND NEW.source_payload_hash='') OR
             (NEW.declared_source_uuid IS NOT NULL AND NEW.kind IN ('dispatch','receive') AND NEW.source_payload_hash ~ '^[0-9a-f]{64}$'))""",
    "transfersourcelink": """EXISTS (SELECT 1 FROM inventory_transferevent e
        JOIN field_sync_fieldevent s ON s.id=NEW.source_event_id
        WHERE e.id=NEW.event_id AND e.organization_id=NEW.organization_id AND s.organization_id=NEW.organization_id
        AND e.created_by_id=s.created_by_id AND NEW.created_by_id=s.created_by_id
        AND e.declared_source_uuid=s.id AND e.source_payload_hash=s.payload_sha256
        AND s.type='transfer.'||e.kind AND s.voided_at IS NULL
        AND EXISTS (SELECT 1 FROM reviews_reviewsourcesnapshot f WHERE f.source_event_id=s.id
            AND f.resource_kind='transfer' AND f.resource_id=e.transfer_id AND f.organization_id=NEW.organization_id)
        AND (s.status='accepted' OR EXISTS (SELECT 1 FROM reviews_revieweffectreceipt r
            WHERE r.source_event_id=s.id AND r.payload_sha256=s.payload_sha256)))""",
    "transfervoidaudit": """EXISTS (SELECT 1 FROM inventory_transferevent e
        WHERE e.id=NEW.target_event_id AND e.organization_id=NEW.organization_id AND e.declared_source_uuid IS NOT NULL)
        AND char_length(NEW.reason) BETWEEN 10 AND 1000 AND NEW.void_payload_hash ~ '^[0-9a-f]{64}$'
        AND jsonb_typeof(NEW.compensation_event_ids)='array' AND jsonb_array_length(NEW.compensation_event_ids)>0""",
    "transfercommandreceipt": """EXISTS (SELECT 1 FROM inventory_transferevent e
        WHERE e.id=NEW.event_id AND e.organization_id=NEW.organization_id
        AND e.transfer_id=NEW.transfer_id AND e.command_id=NEW.command_id AND e.kind=NEW.kind
        AND e.created_by_id=NEW.created_by_id AND NEW.original_actor_id=e.created_by_id
        AND e.declared_source_uuid IS NOT DISTINCT FROM NEW.declared_source_uuid
        AND ((e.kind='resolution' AND NEW.expected_revision=0) OR NEW.expected_revision=e.revision-1))
        AND NEW.content_hash ~ '^[0-9a-f]{64}$'""",
    "transferreceiptline": """EXISTS (SELECT 1 FROM inventory_transferevent e
        JOIN inventory_transferline l ON l.id=NEW.line_id
        WHERE e.id=NEW.event_id AND e.kind='receive' AND e.transfer_id=l.transfer_id
        AND e.organization_id=NEW.organization_id AND l.organization_id=NEW.organization_id
        AND NEW.quantity<=l.quantity AND (l.piece_id IS NULL OR NEW.quantity=1))""",
    "discrepancy": """EXISTS (SELECT 1 FROM inventory_transferevent e
        WHERE e.id=NEW.receipt_event_id AND e.kind='receive' AND e.transfer_id=NEW.transfer_id
        AND e.organization_id=NEW.organization_id)""",
    "discrepancyline": """EXISTS (SELECT 1 FROM inventory_discrepancy d
        WHERE d.id=NEW.discrepancy_id AND d.organization_id=NEW.organization_id
        AND ((NEW.kind='missing' AND EXISTS (SELECT 1 FROM inventory_transferline l
            WHERE l.id=NEW.line_id AND l.transfer_id=d.transfer_id AND l.organization_id=NEW.organization_id
            AND NEW.quantity=l.quantity-COALESCE((SELECT SUM(r.quantity) FROM inventory_transferreceiptline r
                WHERE r.event_id=d.receipt_event_id AND r.line_id=l.id),0)))
        OR (NEW.kind IN ('identified_extra','unidentified_extra') AND NEW.line_id IS NULL
            AND NEW.observation->>'kind'=NEW.kind AND (NEW.observation->>'quantity')::numeric=NEW.quantity
            AND ((NEW.kind='unidentified_extra' AND NEW.observation ? 'unidentified_code'
                  AND NOT NEW.observation ?| ARRAY['lot_id','piece_id','unit_version_id'])
                 OR NEW.kind='identified_extra'))))""",
    "discrepancyresolution": """EXISTS (SELECT 1 FROM inventory_discrepancy d
        JOIN inventory_transferevent e ON e.id=NEW.event_id
        WHERE d.id=NEW.discrepancy_id AND d.organization_id=NEW.organization_id
        AND e.organization_id=NEW.organization_id AND e.transfer_id=d.transfer_id AND e.kind='resolution')
        AND NEW.expected_revision=0 AND char_length(NEW.reason) BETWEEN 10 AND 1000
        AND NEW.content_hash ~ '^[0-9a-f]{64}$' AND jsonb_typeof(NEW.evidence_ids)='array'""",
    "resolutionoutcome": """EXISTS (SELECT 1 FROM inventory_discrepancyresolution r
        JOIN inventory_discrepancy d ON d.id=r.discrepancy_id
        JOIN inventory_discrepancyline l ON l.id=NEW.line_id
        WHERE r.id=NEW.resolution_id AND r.organization_id=NEW.organization_id
        AND l.discrepancy_id=d.id AND l.organization_id=NEW.organization_id
        AND ((NEW.kind='ack_missing' AND l.kind='missing'
            AND NEW.dispatch_event_id IS NULL AND NEW.receipt_event_id IS NULL
            AND NEW.signature_upload_id IS NULL AND NEW.correction_transfer_id IS NULL AND NEW.correction_receipt_line_id IS NULL)
        OR (NEW.kind IN ('recover_dest','return_origin') AND l.kind='missing'
            AND NEW.correction_transfer_id IS NULL AND NEW.correction_receipt_line_id IS NULL
            AND NEW.receipt_event_id=d.receipt_event_id
            AND EXISTS (SELECT 1 FROM inventory_transferevent e WHERE e.id=NEW.dispatch_event_id
                AND e.transfer_id=d.transfer_id AND e.kind='dispatch')
            AND EXISTS (SELECT 1 FROM uploads_uploadverification v WHERE v.upload_id=NEW.signature_upload_id))
        OR (NEW.kind='reference_signed_correction' AND l.kind IN ('identified_extra','unidentified_extra')
            AND NEW.dispatch_event_id IS NULL AND NEW.signature_upload_id IS NULL
            AND NEW.correction_transfer_id<>d.transfer_id
            AND EXISTS (SELECT 1 FROM inventory_transferreceiptline c
                JOIN inventory_transferevent e ON e.id=c.event_id
                JOIN inventory_transfer t ON t.id=e.transfer_id
                JOIN inventory_transfer original ON original.id=d.transfer_id
                JOIN inventory_transferline actual ON actual.id=c.line_id
                JOIN inventory_lot lot ON lot.id=actual.lot_id
                WHERE c.id=NEW.correction_receipt_line_id AND e.id=NEW.receipt_event_id AND e.kind='receive'
                AND t.id=NEW.correction_transfer_id AND t.organization_id=NEW.organization_id
                AND t.destination_id=original.destination_id
                AND ((l.kind='identified_extra' AND l.observation->>'lot_id'=actual.lot_id::text
                    AND l.observation->>'piece_id' IS NOT DISTINCT FROM actual.piece_id::text
                    AND l.observation->>'unit_version_id'=actual.unit_version_id::text)
                  OR (l.kind='unidentified_extra' AND (l.observation->>'unidentified_code'=lot.code
                    OR l.observation->>'unidentified_code'=actual.piece_id::text)))))))""",
    "transferhold": """EXISTS (SELECT 1 FROM inventory_discrepancy d
        JOIN inventory_transfer t ON t.id=d.transfer_id JOIN inventory_lot l ON l.id=NEW.lot_id
        WHERE d.id=NEW.discrepancy_id AND d.organization_id=NEW.organization_id
        AND l.organization_id=NEW.organization_id AND NEW.location_id=t.destination_id
        AND NOT EXISTS (SELECT 1 FROM inventory_discrepancyresolution WHERE discrepancy_id=d.id)
        AND (NEW.piece_id IS NULL OR EXISTS (SELECT 1 FROM inventory_piece p
            WHERE p.id=NEW.piece_id AND p.lot_id=l.id AND p.organization_id=NEW.organization_id)))""",
    "transferholdresolution": """EXISTS (SELECT 1 FROM inventory_transferhold h
        JOIN inventory_discrepancyresolution r ON r.discrepancy_id=h.discrepancy_id
        WHERE h.id=NEW.hold_id AND r.id=NEW.resolution_id
        AND h.organization_id=NEW.organization_id AND r.organization_id=NEW.organization_id)""",
    "transferstockeffect": """EXISTS (SELECT 1 FROM inventory_transferevent e
        JOIN inventory_transfer t ON t.id=e.transfer_id JOIN inventory_transferline l ON l.id=NEW.line_id
        JOIN inventory_stockmovement m ON m.id=NEW.movement_id
        JOIN inventory_stockoperation o ON o.id=m.operation_id
        WHERE e.id=NEW.event_id AND e.transfer_id=NEW.transfer_id AND l.transfer_id=t.id
        AND e.organization_id=NEW.organization_id AND l.organization_id=NEW.organization_id
        AND m.organization_id=NEW.organization_id AND o.organization_id=NEW.organization_id
        AND o.transfer_event_id=e.id AND m.lot_id=l.lot_id AND m.unit_version_id=l.unit_version_id
        AND m.piece_id IS NOT DISTINCT FROM l.piece_id
        AND ((NEW.kind='dispatch' AND e.kind='dispatch' AND m.quantity=-l.quantity AND m.location_id=t.origin_id)
          OR (NEW.kind='receive' AND e.kind='receive' AND m.location_id=t.destination_id
              AND EXISTS (SELECT 1 FROM inventory_transferreceiptline r WHERE r.event_id=e.id AND r.line_id=l.id AND r.quantity=m.quantity))
          OR (NEW.kind IN ('recover_dest','return_origin') AND e.kind='resolution' AND m.quantity>0
              AND m.location_id=CASE WHEN NEW.kind='recover_dest' THEN t.destination_id ELSE t.origin_id END)))""",
    "transferevidencereference": """EXISTS (SELECT 1 FROM inventory_transferevent e
        JOIN uploads_upload u ON u.id=NEW.upload_id JOIN uploads_uploadverification v ON v.upload_id=u.id
        WHERE e.id=NEW.event_id AND e.organization_id=NEW.organization_id AND u.organization_id=NEW.organization_id
        AND u.uploader_id=e.created_by_id AND NEW.created_by_id=e.created_by_id)
        AND NEW.role IN ('signature','photo') AND jsonb_typeof(NEW.coverage)='array'""",
}
INSERT_ONLY = "\n".join(
    f"""CREATE FUNCTION inventory_{name}_custody_guard() RETURNS trigger AS $$
BEGIN
    IF TG_OP<>'INSERT' THEN RAISE EXCEPTION 'custody facts are insert-only'; END IF;
    IF NEW.created_by_id IS NULL OR NOT COALESCE(({condition}),FALSE) THEN
        RAISE EXCEPTION 'custody identity, provenance or organization mismatch';
    END IF;
    RETURN NEW;
END; $$ LANGUAGE plpgsql;
CREATE TRIGGER inventory_{name}_custody_guard BEFORE INSERT OR UPDATE OR DELETE ON inventory_{name}
FOR EACH ROW EXECUTE FUNCTION inventory_{name}_custody_guard();"""
    for name, condition in CHECKS.items()
)

LEDGER = """
CREATE FUNCTION inventory_transfer_ledger_guard() RETURNS trigger AS $$
BEGIN
    IF TG_TABLE_NAME='inventory_stockoperation' AND NEW.transfer_event_id IS NOT NULL AND NOT EXISTS (
        SELECT 1 FROM inventory_transferevent e WHERE e.id=NEW.transfer_event_id
        AND e.organization_id=NEW.organization_id AND e.created_by_id=NEW.created_by_id
        AND NEW.source_kind='transfer_'||e.kind AND NEW.source_id=e.id AND NEW.content_hash=e.manifest_hash
        AND e.kind IN ('dispatch','receive','resolution')
    ) THEN RAISE EXCEPTION 'stock operation requires its exact signed custody source'; END IF;
    RETURN NEW;
END; $$ LANGUAGE plpgsql;
CREATE TRIGGER inventory_transfer_ledger_guard BEFORE INSERT ON inventory_stockoperation
FOR EACH ROW EXECUTE FUNCTION inventory_transfer_ledger_guard();

CREATE FUNCTION inventory_condition_location_guard() RETURNS trigger AS $$
DECLARE measured_location uuid;
BEGIN
    -- Reentrant for the normal writer; also serialize raw cross-mode inserts.
    -- No account/source/Organization lock is taken below this domain identity.
    PERFORM 1 FROM inventory_lot WHERE id=NEW.lot_id FOR NO KEY UPDATE NOWAIT;
    IF NEW.capture_mode='explicit_location' THEN
        measured_location=NEW.capture_location_id;
    ELSE
        SELECT location_id INTO measured_location FROM inventory_locationversion WHERE id=NEW.location_version_id;
    END IF;
    IF NEW.capture_mode='explicit_location' AND NOT EXISTS (
        SELECT 1 FROM inventory_location s JOIN inventory_locationversion v ON v.id=NEW.location_version_id
        JOIN inventory_lotversion l ON l.id=NEW.lot_version_id
        WHERE s.id=NEW.capture_location_id AND s.organization_id=NEW.organization_id
        AND v.location_id=s.id AND v.organization_id=NEW.organization_id
        AND l.lot_id=NEW.lot_id AND l.organization_id=NEW.organization_id
        AND l.protocol_id IS NOT DISTINCT FROM NEW.protocol_id
    ) THEN RAISE EXCEPTION 'explicit condition requires its exact real location and lot version'; END IF;
    IF measured_location IS NOT NULL AND EXISTS (
        SELECT 1 FROM inventory_conditionreading r LEFT JOIN inventory_locationversion v ON v.id=r.location_version_id
        WHERE r.organization_id=NEW.organization_id AND r.lot_id=NEW.lot_id AND r.device_time=NEW.device_time
        AND r.capture_mode<>NEW.capture_mode
        AND measured_location=CASE WHEN r.capture_mode='explicit_location' THEN r.capture_location_id ELSE v.location_id END
    ) THEN RAISE EXCEPTION 'condition capture already has its original proven location receipt'; END IF;
    RETURN NEW;
END; $$ LANGUAGE plpgsql;
CREATE TRIGGER inventory_condition_location_guard BEFORE INSERT ON inventory_conditionreading
FOR EACH ROW EXECUTE FUNCTION inventory_condition_location_guard();
"""

COMPLETE = """
CREATE FUNCTION inventory_custody_complete() RETURNS trigger AS $$
DECLARE e inventory_transferevent; d inventory_discrepancy; r inventory_discrepancyresolution; event_uuid uuid;
BEGIN
    CASE TG_TABLE_NAME
        WHEN 'inventory_transferevent' THEN event_uuid=NEW.id;
        WHEN 'inventory_stockoperation' THEN event_uuid=NEW.transfer_event_id;
        WHEN 'inventory_stockmovement' THEN SELECT transfer_event_id INTO event_uuid FROM inventory_stockoperation WHERE id=NEW.operation_id;
        WHEN 'inventory_transferline' THEN SELECT id INTO event_uuid FROM inventory_transferevent WHERE transfer_id=NEW.transfer_id AND kind='prepared';
        WHEN 'inventory_discrepancy' THEN event_uuid=NEW.receipt_event_id;
        WHEN 'inventory_discrepancyline' THEN SELECT receipt_event_id INTO event_uuid FROM inventory_discrepancy WHERE id=NEW.discrepancy_id;
        WHEN 'inventory_transferhold' THEN SELECT receipt_event_id INTO event_uuid FROM inventory_discrepancy WHERE id=NEW.discrepancy_id;
        WHEN 'inventory_resolutionoutcome' THEN SELECT event_id INTO event_uuid FROM inventory_discrepancyresolution WHERE id=NEW.resolution_id;
        WHEN 'inventory_transferholdresolution' THEN SELECT event_id INTO event_uuid FROM inventory_discrepancyresolution WHERE id=NEW.resolution_id;
        ELSE event_uuid=NEW.event_id;
    END CASE;
    IF event_uuid IS NULL THEN RETURN NEW; END IF;
    SELECT * INTO e FROM inventory_transferevent WHERE id=event_uuid;
    IF e.kind='prepared' AND NOT EXISTS (SELECT 1 FROM inventory_transferline WHERE transfer_id=e.transfer_id) THEN
        RAISE EXCEPTION 'prepared custody requires its expected lines'; END IF;
    IF e.kind IN ('prepared','dispatch','receive') AND (
        jsonb_typeof(e.manifest->'lines') IS DISTINCT FROM 'array'
        OR jsonb_array_length(e.manifest->'lines')<>(SELECT COUNT(*) FROM inventory_transferline WHERE transfer_id=e.transfer_id)
        OR EXISTS (SELECT 1 FROM inventory_transferline l WHERE l.transfer_id=e.transfer_id AND NOT EXISTS (
            SELECT 1 FROM jsonb_array_elements(e.manifest->'lines') j WHERE j->>'id'=l.id::text
            AND j->>'lot_id'=l.lot_id::text AND j->>'unit_version_id'=l.unit_version_id::text
            AND j->>'piece_id' IS NOT DISTINCT FROM l.piece_id::text AND (j->>'quantity')::numeric=l.quantity))
    ) THEN RAISE EXCEPTION 'custody manifest differs from its exact expected lines'; END IF;
    IF e.kind<>'prepared' AND NOT EXISTS (SELECT 1 FROM inventory_transfercommandreceipt WHERE event_id=e.id) THEN
        RAISE EXCEPTION 'custody transition requires its replay receipt'; END IF;
    IF e.declared_source_uuid IS NOT NULL AND NOT EXISTS (SELECT 1 FROM inventory_transfersourcelink WHERE event_id=e.id) THEN
        RAISE EXCEPTION 'custody transition requires its effective original source'; END IF;
    IF e.kind IN ('dispatch','receive') AND NOT EXISTS (
        SELECT 1 FROM inventory_transferevidencereference WHERE event_id=e.id AND role='signature'
    ) THEN RAISE EXCEPTION 'signed custody requires verified signature evidence'; END IF;
    IF EXISTS (SELECT 1 FROM inventory_transferevidencereference p
        JOIN uploads_upload u ON u.id=p.upload_id JOIN uploads_uploadverification v ON v.upload_id=u.id
        WHERE p.event_id=e.id AND (NOT EXISTS (SELECT 1 FROM uploads_attachmentlink a
            WHERE a.upload_id=u.id AND a.organization_id=e.organization_id
            AND ((e.declared_source_uuid IS NULL AND a.transfer_event_id=e.id) OR a.field_event_id=e.declared_source_uuid))
            OR NOT EXISTS (SELECT 1 FROM jsonb_array_elements(e.manifest->'evidence') j
                WHERE j->>'upload_id'=u.public_id::text AND j->>'role'=p.role
                AND j->>'sha256'=v.sha256 AND j->'coverage'=p.coverage)))
        OR jsonb_typeof(e.manifest->'evidence') IS DISTINCT FROM 'array'
        OR jsonb_array_length(e.manifest->'evidence')<>(SELECT COUNT(*) FROM inventory_transferevidencereference WHERE event_id=e.id)
    THEN RAISE EXCEPTION 'signed custody requires its exact verified primary evidence bindings'; END IF;
    IF e.kind='dispatch' AND EXISTS (SELECT 1 FROM inventory_transferline l WHERE l.transfer_id=e.transfer_id
        AND NOT EXISTS (SELECT 1 FROM inventory_transferstockeffect f WHERE f.event_id=e.id AND f.line_id=l.id AND f.kind='dispatch'))
    THEN RAISE EXCEPTION 'dispatch requires every exact negative source leg'; END IF;
    IF e.kind='receive' THEN
        IF NOT EXISTS (SELECT 1 FROM inventory_transferevent WHERE transfer_id=e.transfer_id AND kind='dispatch') THEN
            RAISE EXCEPTION 'receipt requires its real signed dispatch'; END IF;
        IF EXISTS (SELECT 1 FROM inventory_transferreceiptline l WHERE l.event_id=e.id AND NOT EXISTS (
            SELECT 1 FROM inventory_transferstockeffect f WHERE f.event_id=e.id AND f.line_id=l.line_id AND f.kind='receive'))
        THEN RAISE EXCEPTION 'receipt requires every exact actual destination leg'; END IF;
        IF EXISTS (SELECT 1 FROM inventory_transferline l WHERE l.transfer_id=e.transfer_id
            AND COALESCE((e.manifest->'received'->>l.id::text)::numeric,0)<>
                COALESCE((SELECT SUM(quantity) FROM inventory_transferreceiptline WHERE event_id=e.id AND line_id=l.id),0))
        THEN RAISE EXCEPTION 'actual receipts differ from the signed reconciliation'; END IF;
        SELECT * INTO d FROM inventory_discrepancy WHERE receipt_event_id=e.id;
        IF EXISTS (SELECT 1 FROM inventory_transferline l WHERE l.transfer_id=e.transfer_id
            AND l.quantity>COALESCE((SELECT SUM(quantity) FROM inventory_transferreceiptline WHERE event_id=e.id AND line_id=l.id),0)
            AND NOT EXISTS (SELECT 1 FROM inventory_discrepancyline x WHERE x.discrepancy_id=d.id AND x.line_id=l.id AND x.kind='missing'))
        THEN RAISE EXCEPTION 'missing custody requires a durable discrepancy'; END IF;
        IF EXISTS (SELECT 1 FROM inventory_discrepancyline x WHERE x.discrepancy_id=d.id AND x.kind='missing'
            AND (NOT EXISTS (SELECT 1 FROM inventory_transferhold h JOIN inventory_transferline l ON l.id=x.line_id
                WHERE h.discrepancy_id=d.id AND h.lot_id=l.lot_id AND h.piece_id IS NOT DISTINCT FROM l.piece_id)
                OR NOT EXISTS (SELECT 1 FROM inventory_transferevidencereference p
                    WHERE p.event_id=e.id AND p.role='photo' AND p.coverage ? x.line_id::text)))
        THEN RAISE EXCEPTION 'missing custody requires quarantine and per-line photo coverage'; END IF;
        IF COALESCE(jsonb_array_length(e.manifest->'extras'),0)<>
            (SELECT COUNT(*) FROM inventory_discrepancyline WHERE discrepancy_id=d.id AND kind<>'missing')
        THEN RAISE EXCEPTION 'extra observations require durable discrepancies'; END IF;
        IF EXISTS (SELECT 1 FROM inventory_discrepancyline x WHERE x.discrepancy_id=d.id AND x.kind<>'missing'
            AND NOT (e.manifest->'extras' @> jsonb_build_array(x.observation)))
        THEN RAISE EXCEPTION 'extra observations differ from the signed reconciliation'; END IF;
    END IF;
    IF e.kind='resolution' THEN
        SELECT * INTO r FROM inventory_discrepancyresolution WHERE event_id=e.id;
        IF r.id IS NULL OR EXISTS (SELECT 1 FROM inventory_discrepancyline l WHERE l.discrepancy_id=r.discrepancy_id
            AND l.quantity<>COALESCE((SELECT SUM(quantity) FROM inventory_resolutionoutcome WHERE resolution_id=r.id AND line_id=l.id),0))
        THEN RAISE EXCEPTION 'resolution requires a complete exact quantity partition'; END IF;
        IF jsonb_array_length(e.manifest->'outcomes')<>(SELECT COUNT(*) FROM inventory_resolutionoutcome WHERE resolution_id=r.id)
            OR EXISTS (SELECT 1 FROM inventory_resolutionoutcome o WHERE o.resolution_id=r.id
                AND NOT (e.manifest->'outcomes' @> jsonb_build_array(o.proof)))
        THEN RAISE EXCEPTION 'resolution outcomes differ from their immutable manifest'; END IF;
        IF EXISTS (SELECT 1 FROM inventory_transferhold h WHERE h.discrepancy_id=r.discrepancy_id
            AND NOT EXISTS (SELECT 1 FROM inventory_transferholdresolution x WHERE x.hold_id=h.id AND x.resolution_id=r.id))
        THEN RAISE EXCEPTION 'resolution requires its owned hold dispositions'; END IF;
        IF EXISTS (SELECT 1 FROM inventory_resolutionoutcome o
            JOIN inventory_discrepancyline dl ON dl.id=o.line_id WHERE o.resolution_id=r.id
            AND o.kind IN ('recover_dest','return_origin') AND (NOT EXISTS (
                SELECT 1 FROM inventory_transferstockeffect f JOIN inventory_stockmovement m ON m.id=f.movement_id
                WHERE f.event_id=e.id AND f.line_id=dl.line_id AND f.kind=o.kind AND m.quantity=o.quantity)
                OR NOT EXISTS (SELECT 1 FROM inventory_transferevidencereference p
                    WHERE p.event_id=e.id AND p.upload_id=o.signature_upload_id AND p.role='signature')
                OR NOT EXISTS (SELECT 1 FROM inventory_transferevidencereference p WHERE p.event_id=e.id AND p.role='photo')))
        THEN RAISE EXCEPTION 'compensation requires its exact bounded leg and new receiving proof'; END IF;
        IF EXISTS (SELECT 1 FROM inventory_resolutionoutcome o JOIN inventory_transferreceiptline c ON c.id=o.correction_receipt_line_id
            WHERE o.resolution_id=r.id AND c.quantity<(SELECT SUM(quantity) FROM inventory_resolutionoutcome WHERE correction_receipt_line_id=c.id))
        THEN RAISE EXCEPTION 'signed correction receipt cannot be allocated twice'; END IF;
    END IF;
    IF EXISTS (SELECT 1 FROM inventory_stockmovement m JOIN inventory_stockoperation o ON o.id=m.operation_id
        WHERE o.transfer_event_id=e.id AND NOT EXISTS (SELECT 1 FROM inventory_transferstockeffect f WHERE f.movement_id=m.id))
    THEN RAISE EXCEPTION 'custody ledger cannot contain an unowned movement'; END IF;
    IF EXISTS (SELECT 1 FROM inventory_transferstockeffect f JOIN inventory_stockmovement m ON m.id=f.movement_id
        WHERE f.event_id=e.id AND e.kind='resolution' AND NOT EXISTS (
            SELECT 1 FROM inventory_resolutionoutcome o JOIN inventory_discrepancyline l ON l.id=o.line_id
            WHERE o.resolution_id=r.id AND l.line_id=f.line_id AND o.kind=f.kind AND o.quantity=m.quantity))
    THEN RAISE EXCEPTION 'compensation cannot exceed its exact recorded outcome'; END IF;
    RETURN NEW;
END; $$ LANGUAGE plpgsql;

CREATE FUNCTION inventory_transfer_parent_complete() RETURNS trigger AS $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM inventory_transferevent WHERE transfer_id=NEW.id AND kind='prepared') THEN
        RAISE EXCEPTION 'transfer requires its immutable prepared manifest'; END IF;
    RETURN NEW;
END; $$ LANGUAGE plpgsql;
CREATE CONSTRAINT TRIGGER inventory_transfer_parent_complete AFTER INSERT ON inventory_transfer
DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION inventory_transfer_parent_complete();

CREATE FUNCTION inventory_transfer_void_complete() RETURNS trigger AS $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM field_sync_fieldevent s
        JOIN inventory_transferevent e ON e.id=NEW.target_event_id
        JOIN field_sync_fieldevent t ON t.id=e.declared_source_uuid
        WHERE s.id=NEW.void_source_uuid AND s.type='record.void' AND s.organization_id=NEW.organization_id
        AND s.created_by_id=NEW.created_by_id AND s.payload_sha256=NEW.void_payload_hash
        AND s.voids_event_id=t.id
        AND t.created_by_id=s.created_by_id
        AND t.voided_at IS NOT NULL AND t.voided_by_id=s.created_by_id
        AND t.void_reason=NEW.reason AND t.void_reason_code=NEW.reason_code
        AND (s.status='accepted' OR EXISTS (SELECT 1 FROM reviews_revieweffectreceipt r WHERE r.source_event_id=s.id))
        AND NOT EXISTS (SELECT 1 FROM inventory_discrepancy d WHERE d.transfer_id=e.transfer_id
            AND NOT EXISTS (SELECT 1 FROM inventory_discrepancyresolution r WHERE r.discrepancy_id=d.id))
        AND NOT EXISTS (SELECT 1 FROM inventory_transferstockeffect f
            JOIN inventory_stockmovement m ON m.id=f.movement_id WHERE f.transfer_id=e.transfer_id
            GROUP BY m.lot_id,m.location_id,m.piece_id,m.unit_version_id HAVING SUM(m.quantity)<>0)
        AND NOT EXISTS (SELECT 1 FROM jsonb_array_elements_text(NEW.compensation_event_ids) ids(value)
            WHERE NOT EXISTS (SELECT 1 FROM inventory_discrepancyresolution r
                JOIN inventory_discrepancy d ON d.id=r.discrepancy_id
                JOIN inventory_resolutionoutcome o ON o.resolution_id=r.id
                WHERE r.event_id::text=ids.value AND d.transfer_id=e.transfer_id AND o.kind='return_origin')))
    THEN RAISE EXCEPTION 'custody void requires its real effective original correction source'; END IF;
    RETURN NEW;
END; $$ LANGUAGE plpgsql;
CREATE CONSTRAINT TRIGGER inventory_transfer_void_complete AFTER INSERT ON inventory_transfervoidaudit
DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION inventory_transfer_void_complete();
"""

COMPLETE_TABLES = (
    "transferevent",
    "transferline",
    "transfercommandreceipt",
    "transfersourcelink",
    "transferevidencereference",
    "transferreceiptline",
    "transferstockeffect",
    "discrepancy",
    "discrepancyline",
    "discrepancyresolution",
    "resolutionoutcome",
    "transferhold",
    "transferholdresolution",
    "stockoperation",
    "stockmovement",
)
COMPLETE += "\n".join(
    f"""CREATE CONSTRAINT TRIGGER inventory_{name}_custody_complete AFTER INSERT ON inventory_{name}
DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION inventory_custody_complete();"""
    for name in COMPLETE_TABLES
)

FORWARD_SQL = INSERT_ONLY + LEDGER + COMPLETE
REVERSE_SQL = (
    """
DROP TRIGGER inventory_transfer_void_complete ON inventory_transfervoidaudit;
DROP FUNCTION inventory_transfer_void_complete();
DROP TRIGGER inventory_transfer_parent_complete ON inventory_transfer;
DROP FUNCTION inventory_transfer_parent_complete();
DROP TRIGGER inventory_condition_location_guard ON inventory_conditionreading;
DROP FUNCTION inventory_condition_location_guard();
DROP TRIGGER inventory_transfer_ledger_guard ON inventory_stockoperation;
DROP FUNCTION inventory_transfer_ledger_guard();
"""
    + "\n".join(
        f"DROP TRIGGER inventory_{name}_custody_complete ON inventory_{name};"
        for name in COMPLETE_TABLES
    )
    + "\nDROP FUNCTION inventory_custody_complete();\n"
    + "\n".join(
        f"DROP TRIGGER inventory_{name}_custody_guard ON inventory_{name}; DROP FUNCTION inventory_{name}_custody_guard();"
        for name in reversed(CHECKS)
    )
)


class Migration(migrations.Migration):
    dependencies = [
        ("inventory", "0003_discrepancy_discrepancyline_discrepancyresolution_and_more"),
        ("uploads", "0004_remove_attachmentlink_attachment_exactly_one_parent_and_more"),
        ("reviews", "0003_append_only_reviews"),
    ]
    operations = [
        migrations.RunSQL(FORWARD_SQL, REVERSE_SQL),
        migrations.RunPython(
            migrations.RunPython.noop,
            import_module(
                "inventory.migrations.0003_discrepancy_discrepancyline_discrepancyresolution_and_more"
            ).protect_custody_reverse,
        ),
    ]
