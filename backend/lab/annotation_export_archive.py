"""Stream detector archives from immutable selections and verified, sanitized image bytes."""

import csv
import hashlib
import io
import json
import shutil
from collections.abc import Iterable
from contextlib import ExitStack
from dataclasses import dataclass
from datetime import UTC, datetime
from tempfile import TemporaryFile
from typing import IO
from zipfile import ZIP_DEFLATED, ZIP_STORED, ZipFile

from lab.models import EggAnnotation, EggAnnotationExport
from uploads.exceptions import UploadStorageError
from uploads.storage import read_object

IMAGE_EXTENSIONS = {"image/jpeg": "jpg", "image/png": "png", "image/webp": "webp"}
MANIFEST_COLUMNS = (
    "image_file",
    "annotation_id",
    "count_id",
    "box_count",
    "point_count",
    "voided",
    "created_at",
)
YOLO_CONFIGURATION = (
    "# Unsplit export: create an independent training/validation split before training.\n"
    "train: images\nval: images\nnc: 1\nnames: [aedes_egg]\n"
)


@dataclass(frozen=True)
class ExportCounts:
    image_count: int = 0
    box_count: int = 0
    point_count: int = 0


@dataclass
class _JsonArray:
    """Only one row is serialized in memory; the growing array stays on disk."""

    stream: IO[bytes]
    count: int = 0

    def append(self, value: object) -> None:
        if self.count:
            self.stream.write(b",")
        self.stream.write(json.dumps(value, separators=(",", ":")).encode())
        self.count += 1

    def copy_to(self, output: IO[bytes]) -> None:
        output.write(b"[")
        self.stream.seek(0)
        shutil.copyfileobj(self.stream, output)
        output.write(b"]")


@dataclass(frozen=True)
class _ArchiveEntries:
    images: _JsonArray
    boxes: _JsonArray
    points: _JsonArray
    manifest: IO[bytes]
    is_yolo: bool


def _utc(value: datetime) -> str:
    return value.astimezone(UTC).isoformat().replace("+00:00", "Z")


def _write_csv_row(output: IO[bytes], cells: Iterable[object]) -> None:
    row = io.StringIO(newline="")
    csv.writer(row, lineterminator="\n").writerow(cells)
    output.write(row.getvalue().encode())


def _image_file(annotation: EggAnnotation) -> str:
    content_type = annotation.image_upload.verification.content_type
    if content_type not in IMAGE_EXTENSIONS:
        raise UploadStorageError
    return f"images/{annotation.public_id}.{IMAGE_EXTENSIONS[content_type]}"


def _write_image(archive: ZipFile, annotation: EggAnnotation) -> str:
    verified = annotation.image_upload.verification
    content = read_object(verified.object_key)
    if (
        len(content) != verified.size_bytes
        or hashlib.sha256(content).hexdigest() != verified.sha256
    ):
        raise UploadStorageError
    image_file = _image_file(annotation)
    archive.writestr(image_file, content, compress_type=ZIP_STORED)
    return image_file


def _append_image(entries: _ArchiveEntries, annotation: EggAnnotation, image_file: str) -> int:
    image_id = entries.images.count + 1
    entries.images.append(
        {
            "id": image_id,
            "file_name": image_file,
            "width": annotation.image_width,
            "height": annotation.image_height,
        }
    )
    entries.points.append(
        {
            "image_id": image_id,
            "file_name": image_file,
            "points": [
                [mark["x"], mark["y"]] for mark in annotation.marks if mark["kind"] == "point"
            ],
        }
    )
    _write_csv_row(
        entries.manifest,
        (
            image_file,
            str(annotation.public_id),
            str(annotation.count_id),
            annotation.box_count,
            annotation.point_count,
            str(bool(getattr(annotation, "export_voided", False))).lower(),
            _utc(annotation.created_at),
        ),
    )
    return image_id


def _append_boxes(entries: _ArchiveEntries, annotation: EggAnnotation, image_id: int) -> None:
    for mark in annotation.marks:
        if mark["kind"] == "box":
            entries.boxes.append(
                {
                    "id": entries.boxes.count + 1,
                    "image_id": image_id,
                    "bbox": [mark["x"], mark["y"], mark["w"], mark["h"]],
                    "area": mark["w"] * mark["h"],
                    "category_id": 1,
                    "iscrowd": 0,
                }
            )


def _write_labels(archive: ZipFile, annotation: EggAnnotation) -> None:
    with archive.open(f"labels/{annotation.public_id}.txt", "w") as labels:
        for mark in annotation.marks:
            if mark["kind"] != "box":
                continue
            center_x = (mark["x"] + mark["w"] / 2) / annotation.image_width
            center_y = (mark["y"] + mark["h"] / 2) / annotation.image_height
            width = mark["w"] / annotation.image_width
            height = mark["h"] / annotation.image_height
            labels.write(f"0 {center_x:.6f} {center_y:.6f} {width:.6f} {height:.6f}\n".encode())


def _write_coco(archive: ZipFile, entries: _ArchiveEntries, export: EggAnnotationExport) -> None:
    metadata = {
        "description": "AedesVision training dataset",
        "export_id": str(export.id),
        "date_created": _utc(export.created_at),
    }
    with archive.open("annotations.json", "w", force_zip64=True) as document:
        document.write(b'{"info":' + json.dumps(metadata).encode() + b',"licenses":[],"images":')
        entries.images.copy_to(document)
        document.write(b',"annotations":')
        entries.boxes.copy_to(document)
        document.write(b',"categories":[{"id":1,"name":"aedes_egg"}]}')


def _write_common(archive: ZipFile, entries: _ArchiveEntries) -> None:
    with archive.open("points.json", "w", force_zip64=True) as points:
        points.write(b'{"images":')
        entries.points.copy_to(points)
        points.write(b"}")
    entries.manifest.seek(0)
    with archive.open("manifest.csv", "w", force_zip64=True) as manifest:
        shutil.copyfileobj(entries.manifest, manifest)


def _readme(export: EggAnnotationExport, counts: ExportCounts) -> str:
    return (
        "AedesVision training dataset\n"
        f"Export: {export.id}; created_at: {_utc(export.created_at)}; format: {export.format}\n"
        f"Images: {counts.image_count}; boxes: {counts.box_count}; points: {counts.point_count}\n"
        f"Filters: date_from={export.date_from}; date_to={export.date_to} (inclusive organization-local days); "
        f"author_filter_applied={str(export.author_id is not None).lower()}; "
        f"include_voided={str(export.include_voided).lower()}\n"
        "Selection and voided flags are fixed when the export is requested. Voided counts are excluded "
        "by default; include_voided includes them with voided=true in manifest.csv.\n"
        "Coordinates: verified oriented image pixels, origin at top-left; x increases right, y down.\n"
        "Boxes are [x,y,width,height]; COCO bbox and area use pixels and category_id=1 (aedes_egg).\n"
        "YOLO labels use class 0 and normalized center_x center_y width height, six decimals.\n"
        'points.json schema: {"images":[{"image_id":1,"file_name":"images/<annotation-id>.<ext>",'
        '"points":[[x,y],...]}]}. Points stay pixel points and never become detector boxes.\n'
        "Every selected image appears, including point-only images (empty YOLO label files).\n"
        "YOLO data.yaml references the unsplit images directory for both train and val. Create an independent "
        "training/validation split before training. classes.txt contains aedes_egg.\n"
        "manifest.csv: image_file,annotation_id,count_id,box_count,point_count,voided,created_at (UTC). "
        "Annotation IDs are public UUIDs; count IDs are opaque UUIDs. No authors, organization IDs, "
        "locations, bag or ovitrap codes are included. Filenames use annotation public IDs only.\n"
        "Images are verified sanitized uploads without EXIF metadata; original uploads are not included.\n"
        "There are no personal data in metadata, file names or manifest. Photos themselves may show "
        "handwritten codes or labels; review the images before sharing or training.\n"
    )


def _write_rows(
    archive: ZipFile, entries: _ArchiveEntries, rows: Iterable[EggAnnotation]
) -> ExportCounts:
    box_count = point_count = 0
    for annotation in rows:
        image_file = _write_image(archive, annotation)
        image_id = _append_image(entries, annotation, image_file)
        if entries.is_yolo:
            _write_labels(archive, annotation)
        else:
            _append_boxes(entries, annotation, image_id)
        box_count += annotation.box_count
        point_count += annotation.point_count
    return ExportCounts(entries.images.count, box_count, point_count)


def build_annotation_archive(
    export: EggAnnotationExport, rows: Iterable[EggAnnotation], output: IO[bytes]
) -> ExportCounts:
    """Write one ZIP without retaining dataset images or accumulated JSON in memory."""
    with ExitStack() as resources:
        streams = [resources.enter_context(TemporaryFile()) for _ in range(4)]
        entries = _ArchiveEntries(
            _JsonArray(streams[0]),
            _JsonArray(streams[1]),
            _JsonArray(streams[2]),
            streams[3],
            export.format == "yolo",
        )
        _write_csv_row(entries.manifest, MANIFEST_COLUMNS)
        archive = resources.enter_context(ZipFile(output, "w", ZIP_DEFLATED, allowZip64=True))
        counts = _write_rows(archive, entries, rows)
        _write_common(archive, entries)
        if export.format == "coco":
            _write_coco(archive, entries, export)
        else:
            archive.writestr("data.yaml", YOLO_CONFIGURATION)
            archive.writestr("classes.txt", "aedes_egg\n")
        archive.writestr("README.txt", _readme(export, counts))
    return counts
