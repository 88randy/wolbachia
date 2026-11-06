import { VISIBLE_ASSIGNMENTS } from "./pending-work.ts";
const WITHOUT_LOCATION = "json_remove(visible.payload,'$.lat','$.lng')";
/** One read snapshot joins stable UUID + quadrant. Retained/inline task GPS is never current authority. */
export const LOCATED_ASSIGNMENTS = `WITH visible AS (${VISIBLE_ASSIGNMENTS})
  SELECT CASE WHEN point.id IS NULL THEN ${WITHOUT_LOCATION}
    ELSE json_set(${WITHOUT_LOCATION},'$.lat',json_extract(point.payload,'$.location[1]'),
      '$.lng',json_extract(point.payload,'$.location[0]')) END AS payload,visible.kept
  FROM visible LEFT JOIN day_sampling_point point ON point.id=json_extract(visible.payload,'$.point_id')
    AND point.removed=0 AND json_extract(point.payload,'$.is_retired')=0
    AND json_extract(point.payload,'$.quadrant_id')=json_extract(visible.payload,'$.quadrant_id')`;
