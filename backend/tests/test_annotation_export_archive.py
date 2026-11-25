"""Dataset bytes and coordinate formats, independent of database/API authorization."""

import csv
import hashlib
import json
from datetime import UTC, date, datetime
from io import BytesIO, StringIO
from types import SimpleNamespace
from uuid import uuid4
from zipfile import ZIP_DEFLATED, ZIP_STORED, ZipFile

import pytest
from PIL import Image

from lab.annotation_export_archive import build_annotation_archive
from uploads import storage
from uploads.exceptions import UploadStorageError
from uploads.images import sanitize_image
from uploads.storage import open_dataset_export, store_dataset_export, store_source, store_verified


@pytest.fixture
def export_request():
    return SimpleNamespace(
        id=uuid4(),
        created_at=datetime(2026, 11, 24, 12, tzinfo=UTC),
        date_from=date(2026, 11, 1),
        date_to=date(2026, 11, 24),
        author_id=uuid4(),
        include_voided=False,
        format="coco",
    )


@pytest.fixture
def annotation(tmp_path, settings):
    settings.UPLOADS_PRIVATE_ROOT = tmp_path / "private"
    original = BytesIO()
    image = Image.new("RGB", (100, 50))
    metadata = Image.Exif()
    metadata[270] = "Synthetic author and location metadata"
    image.save(original, format="PNG", exif=metadata)
    content = original.getvalue()
    source = store_source(BytesIO(content), (len(content), hashlib.sha256(content).hexdigest()))
    sanitized = sanitize_image(content, "image/png")
    verified = store_verified(sanitized.content)
    return SimpleNamespace(
        id=uuid4(),
        public_id=uuid4(),
        count_id=uuid4(),
        count=SimpleNamespace(void_fact=None),
        export_voided=False,
        image_upload=SimpleNamespace(
            source=SimpleNamespace(object_key=source.key),
            verification=SimpleNamespace(
                object_key=verified.key,
                size_bytes=verified.size_bytes,
                sha256=verified.sha256,
                content_type="image/png",
            ),
        ),
        image_width=100,
        image_height=50,
        marks=[{"kind": "box", "x": 99, "y": 49, "w": 1, "h": 1}],
        box_count=1,
        point_count=0,
        created_at=datetime(2026, 11, 23, 12, tzinfo=UTC),
        bag=SimpleNamespace(code="PRIVATE-BAG-CODE"),
        created_by=SimpleNamespace(username="PRIVATE-AUTHOR-NAME"),
    )


def build_zip(export_request, annotations):
    archive_bytes = BytesIO()
    counts = build_annotation_archive(export_request, iter(annotations), archive_bytes)
    archive_bytes.seek(0)
    return ZipFile(archive_bytes), counts


def test_coco_detection_math_ids_sanitized_bytes_and_private_manifest(export_request, annotation):
    annotation.marks.append({"kind": "point", "x": 7, "y": 8})
    annotation.point_count = 1
    archive, counts = build_zip(export_request, [annotation])
    with archive:
        document = json.loads(archive.read("annotations.json"))
        image_entry, box = document["images"][0], document["annotations"][0]
        assert box == {
            "id": 1,
            "image_id": image_entry["id"],
            "bbox": [99, 49, 1, 1],
            "area": 1,
            "category_id": 1,
            "iscrowd": 0,
        }
        assert image_entry == {
            "id": 1,
            "file_name": f"images/{annotation.public_id}.png",
            "width": 100,
            "height": 50,
        }
        assert document["categories"] == [{"id": 1, "name": "aedes_egg"}]
        assert document["licenses"] == []
        assert document["info"]["description"] == "AedesVision training dataset"
        assert document["info"]["export_id"] == str(export_request.id)
        assert document["info"]["date_created"] == "2026-11-24T12:00:00Z"
        points = json.loads(archive.read("points.json"))
        assert points == {
            "images": [{"image_id": 1, "file_name": image_entry["file_name"], "points": [[7, 8]]}]
        }
        manifest = list(csv.DictReader(StringIO(archive.read("manifest.csv").decode())))
        assert manifest[0] == {
            "image_file": image_entry["file_name"],
            "annotation_id": str(annotation.public_id),
            "count_id": str(annotation.count_id),
            "box_count": "1",
            "point_count": "1",
            "voided": "false",
            "created_at": "2026-11-23T12:00:00Z",
        }
        with Image.open(BytesIO(archive.read(image_entry["file_name"]))) as image:
            assert not image.getexif()
        text_entries = b"".join(
            archive.read(name) for name in archive.namelist() if not name.startswith("images/")
        )
        assert str(export_request.author_id).encode() not in text_entries
        assert b"PRIVATE-BAG-CODE" not in text_entries
        assert b"PRIVATE-AUTHOR-NAME" not in text_entries
    assert (counts.image_count, counts.box_count, counts.point_count) == (1, 1, 1)


def test_yolo_border_full_image_and_point_only_labels(export_request, annotation):
    export_request.format = "yolo"
    annotation.marks.append({"kind": "box", "x": 0, "y": 0, "w": 100, "h": 50})
    annotation.box_count = 2
    point_only = SimpleNamespace(
        **{
            **vars(annotation),
            "public_id": uuid4(),
            "marks": [{"kind": "point", "x": 0, "y": 49}],
            "box_count": 0,
            "point_count": 1,
        }
    )
    archive, counts = build_zip(export_request, [annotation, point_only])
    with archive:
        assert archive.read(f"labels/{annotation.public_id}.txt").decode() == (
            "0 0.995000 0.990000 0.010000 0.020000\n0 0.500000 0.500000 1.000000 1.000000\n"
        )
        assert archive.read(f"labels/{point_only.public_id}.txt") == b""
        assert archive.read(f"images/{point_only.public_id}.png")
        assert json.loads(archive.read("points.json"))["images"][1]["points"] == [[0, 49]]
        assert archive.read("classes.txt") == b"aedes_egg\n"
        assert b"names: [aedes_egg]" in archive.read("data.yaml")
        assert b"nc: 1" in archive.read("data.yaml")
    assert (counts.image_count, counts.box_count, counts.point_count) == (2, 2, 1)


@pytest.mark.parametrize("file_format", ["coco", "yolo"])
def test_empty_dataset_still_has_valid_format_and_point_files(export_request, file_format):
    export_request.format = file_format
    archive, counts = build_zip(export_request, [])
    with archive:
        assert json.loads(archive.read("points.json")) == {"images": []}
        assert list(csv.DictReader(StringIO(archive.read("manifest.csv").decode()))) == []
        assert b"Images: 0; boxes: 0; points: 0" in archive.read("README.txt")
        if file_format == "coco":
            document = json.loads(archive.read("annotations.json"))
            assert document["images"] == document["annotations"] == []
        else:
            assert archive.read("classes.txt") == b"aedes_egg\n"
    assert (counts.image_count, counts.box_count, counts.point_count) == (0, 0, 0)


def test_manifest_flags_retained_voided_annotations(export_request, annotation):
    annotation.export_voided = True
    export_request.include_voided = True
    archive, _counts = build_zip(export_request, [annotation])
    with archive:
        manifest = list(csv.DictReader(StringIO(archive.read("manifest.csv").decode())))
        assert manifest[0]["voided"] == "true"
        assert b"include_voided=true" in archive.read("README.txt")


def test_changed_verified_bytes_fail_export_instead_of_shipping_them(export_request, annotation):
    annotation.image_upload.verification.sha256 = "0" * 64
    with pytest.raises(UploadStorageError):
        build_zip(export_request, [annotation])


def test_dataset_storage_streams_large_files_and_retries_never_overwrite(tmp_path, settings):
    settings.UPLOADS_PRIVATE_ROOT = tmp_path / "private"

    class BoundedReads(BytesIO):
        def read(self, size=-1):
            assert 0 < size <= 1024 * 1024
            return super().read(size)

    content = b"z" * (11 * 1024 * 1024)
    first = store_dataset_export(BoundedReads(content))
    second = store_dataset_export(BoundedReads(content))
    assert first.key != second.key
    assert first.size_bytes == len(content)
    assert first.sha256 == hashlib.sha256(content).hexdigest()
    with open_dataset_export(first.key) as stored:
        assert stored.read() == content
    with pytest.raises(ValueError, match="Invalid private evidence key"):
        open_dataset_export("../private.zip")


def test_dataset_final_key_is_invisible_until_copy_finishes(tmp_path, settings):
    settings.UPLOADS_PRIVATE_ROOT = tmp_path / "private"
    dataset_directory = settings.UPLOADS_PRIVATE_ROOT / "dataset"

    class InterruptedCopy(BytesIO):
        def read(self, size=-1):
            assert not list(dataset_directory.glob("*.zip"))
            if self.tell():
                raise OSError("Interrupted synthetic copy")
            return super().read(size)

    with pytest.raises(UploadStorageError):
        store_dataset_export(InterruptedCopy(b"archive"))
    assert not list(dataset_directory.iterdir())


def test_dataset_atomic_replace_failure_removes_unpublished_candidate(
    tmp_path, settings, monkeypatch
):
    settings.UPLOADS_PRIVATE_ROOT = tmp_path / "private"

    def fail_replace(source, destination):
        assert source.parent == destination.parent
        assert source.read_bytes() == b"complete archive"
        assert not destination.exists()
        raise OSError("Synthetic rename failure")

    monkeypatch.setattr(storage.os, "replace", fail_replace)
    with pytest.raises(UploadStorageError):
        store_dataset_export(BytesIO(b"complete archive"))
    assert not list((settings.UPLOADS_PRIVATE_ROOT / "dataset").iterdir())


def test_discard_dataset_removes_only_validated_archive_and_is_retryable(tmp_path, settings):
    settings.UPLOADS_PRIVATE_ROOT = tmp_path / "private"
    stored = store_dataset_export(BytesIO(b"archive"))
    storage.discard_dataset_export(stored.key)
    storage.discard_dataset_export(stored.key)
    with pytest.raises(UploadStorageError):
        open_dataset_export(stored.key)
    with pytest.raises(ValueError, match="Invalid private evidence key"):
        storage.discard_dataset_export("../private.zip")


def test_zip_stores_compressed_images_and_deflates_metadata(export_request, annotation):
    archive, _counts = build_zip(export_request, [annotation])
    with archive:
        assert archive.getinfo(f"images/{annotation.public_id}.png").compress_type == ZIP_STORED
        for name in ("annotations.json", "points.json", "manifest.csv", "README.txt"):
            assert archive.getinfo(name).compress_type == ZIP_DEFLATED


def test_yolo_configuration_requires_explicit_split(export_request):
    export_request.format = "yolo"
    archive, _counts = build_zip(export_request, [])
    with archive:
        configuration = archive.read("data.yaml").decode()
        assert "path:" not in configuration
        assert "train: images\n" in configuration
        assert "val: images\n" in configuration
        assert "split" in configuration
        readme = archive.read("README.txt").decode()
        assert "independent training/validation split" in readme


@pytest.mark.parametrize("file_format", ["coco", "yolo"])
def test_readme_warns_that_sanitized_photos_can_show_labels(export_request, file_format):
    export_request.format = file_format
    archive, _counts = build_zip(export_request, [])
    with archive:
        readme = archive.read("README.txt").decode()
        assert "in metadata, file names or manifest" in readme
        assert "handwritten codes or labels" in readme
