"""SA01 geography permission catalog, seeded through organization defaults."""

QUADRANT_READ = "quadrant.read"
# Codes and outlines only (pickers and names); never blocks, points, authors or history.
QUADRANT_LOOKUP = "quadrant.lookup"
QUADRANT_PUBLISH = "quadrant.publish"
SAMPLING_POINT_CREATE = "sampling_point.create"
GEOGRAPHY_WRITE_CODES = (QUADRANT_READ, QUADRANT_PUBLISH, SAMPLING_POINT_CREATE)
INTERVENTION_READ = "intervention.read"
INTERVENTION_CREATE = "intervention.create"
QUADRANT_CLOSE = "quadrant.close"
