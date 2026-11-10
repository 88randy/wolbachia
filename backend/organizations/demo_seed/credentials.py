"""The git-ignored credentials and starting-data note of the demo (writes one local file)."""

from pathlib import Path

from django.conf import settings
from django.db.models import Max

from geography.models import SamplingPoint
from organizations.demo_seed import geography, inventory, operations, people, releases, training
from organizations.demo_seed.run import DemoResult
from shifts.models import Shift

CREDENTIALS_FILE = "demo-credentials.local.md"


def credentials_path() -> Path:
    return Path(settings.BASE_DIR) / CREDENTIALS_FILE


def _users_table() -> list[str]:
    lines = ["| Username | Profile | Password |", "| --- | --- | --- |"]
    lines += [f"| {u.username} | {u.profile} | {u.password} |" for u in people.DEMO_USERS]
    return lines


def _data_section(result: DemoResult) -> list[str]:
    lines = ["## Starting data", ""]
    lines.append(f"- Organization slug: `{result.organization.slug}`")
    lines.append("- Quadrants: " + ", ".join(f"`{code}`" for code in sorted(result.quadrants)))
    for username, codes in operations.ASSIGNMENTS.items():
        lines.append(f"- {username} covers: " + ", ".join(codes))
    lines.append("- Motorcycles: " + ", ".join(f"`{m[0]}`" for m in operations.MOTORCYCLES))
    lines.append(f"- Release permit `{releases.PERMIT_CODE}`, device `{releases.DEVICE_CODE}`")
    lines.append(f"- Storage location `{inventory.LOCATION_CODE}`; supplies:")
    lines += [f"  - `{spec.code}` ({spec.label})" for spec in inventory.SUPPLIES]
    return lines


def _ovitrap_section(result: DemoResult) -> list[str]:
    lines = ["", "## Placed ovitraps (scan or type the QR text)", ""]
    lines += ["| Point | QR text | Reading | Bag |", "| --- | --- | --- | --- |"]
    for item in result.ovitraps:
        reading = "done this week" if item.has_reading else "pending (check it on the phone)"
        lines.append(f"| {item.point_code} | `{item.qr}` | {reading} | {item.bag_code or '-'} |")
    return lines


def _fleet_section(result: DemoResult) -> list[str]:
    """Last odometer per motorcycle: a new shift on the phone must open at or above it."""
    lines = ["", "## Odómetro (al abrir turno captura este valor o más)", ""]
    rows = (
        Shift.objects.filter(organization=result.organization)
        .values("motorcycle__code")
        .annotate(last=Max("odometer_close_km"))
        .order_by("motorcycle__code")
    )
    lines += [f"- {row['motorcycle__code']}: {row['last']} km" for row in rows]
    return lines


def _points_section(result: DemoResult) -> list[str]:
    """Where each demo point is (the model has no address field, so this is a local note)."""
    lines = ["", "## Puntos de muestreo (dirección sintética)", ""]
    lines += ["| Punto | Dirección |", "| --- | --- |"]
    points = SamplingPoint.objects.filter(
        organization=result.organization, code__regex=r"^Q-MER-0[1-8]-B[12]-P[1-9]$"
    ).order_by("code")
    lines += [f"| {point.code} | {geography.point_address(point.code)} |" for point in points]
    return lines


def _walkthrough_section() -> list[str]:
    """Spanish step order per profile; the text is a local note, not API copy."""
    wolb = "L-MER-WOLB"
    return [
        "",
        "## Recorrido sugerido",
        "",
        "1. **demo-admin (web)**: revisa cuadrantes Q-MER-01 a Q-MER-03, la flota "
        "(M-DEMO-01, M-DEMO-02), los tipos de incidencia y el permiso "
        f"{releases.PERMIT_CODE} con el dispositivo {releases.DEVICE_CODE}.",
        f"2. **demo-warehouse (web)**: en la ubicación {inventory.LOCATION_CODE} revisa los lotes "
        f"(L-MER-PADDLE, L-MER-BAG, {wolb}) y abre el plan de entrega de demo-courier-1. "
        "Libera ese plan (paso previo de la custodia).",
        "3. **demo-courier-1 (móvil)**: inicia sesión, inicia turno con la moto M-DEMO-01 y "
        "recibe los insumos del plan liberado (con firma). Sin recibirlos no hay custodia del "
        "lote y la liberación no pasa.",
        "4. **demo-courier-1 (móvil)**: servicio de ovitrampas en Q-MER-01-B1. Escanea el QR de "
        "Q-MER-01-B1-P4 y captura la revisión (sí/no tiene huevos, bolsa nueva). Coloca una "
        "ovitrampa nueva en cualquier otro punto libre. Registra combustible e incidencia.",
        f"5. **demo-courier-1 (móvil)**: tarea de liberación de hoy en {training.RELEASE_POINT}: "
        f"permiso {releases.PERMIT_CODE}, dispositivo {releases.DEVICE_CODE}, lote {wolb}. "
        f"La capacitación {training.COURSE_CODE} ya está certificada. "
        "La liberación queda pendiente de revisión de tránsito. Cierra el turno.",
        "6. **demo-supervisor (web)**: revisa y acepta la liberación en la bandeja de revisión; "
        "valida el turno y atiende la incidencia.",
        "7. **demo-entomologist (web)**: W34 recepción de bolsas B-MER-001 a B-MER-003, "
        "W35 conteo de huevos y muestras.",
        "8. **demo-promoter / demo-coordinator / demo-regulatory / demo-government**: "
        "cada uno revisa sus pantallas con los mismos datos (el gobierno solo ve el portal).",
        "",
        "Nota: demo-courier-2 tiene la certificación pero no tarea de liberación; sirve para "
        "probar un segundo teléfono con Q-MER-03 y M-DEMO-02.",
    ]


def write_credentials(result: DemoResult) -> Path:
    """Write users, DEV-ONLY passwords and the starting data to the ignored local file."""
    lines = [
        "# Demo credentials (DEV-ONLY, local database, synthetic people)",
        "",
        "Generated by `manage.py seed_demo`. Git-ignored. Never use these anywhere else.",
        "",
        *_users_table(),
        "",
        *_data_section(result),
        *_ovitrap_section(result),
        *_fleet_section(result),
        *_points_section(result),
        *_walkthrough_section(),
        "",
    ]
    path = credentials_path()
    path.write_text("\n".join(lines), encoding="utf-8", newline="\n")
    return path
