/** English messages of the `mapEditor` area: exactly the keys of `../es-MX/mapEditor.ts`. */
import type { mapEditor as source } from "../es-MX/mapEditor.ts";

export const mapEditor: Record<keyof typeof source, string> = {
  "mapEditor.title": "Map editor",
  "mapEditor.description":
    "Draw quadrants, place sampling and release points, and correct their place on the map.",
  "mapEditor.panel": "Editor tools",
  "mapEditor.map.label": "Editor map",
  "mapEditor.map.unavailable":
    "The map cannot be shown on this computer. You can edit coordinates from each quadrant record.",

  "mapEditor.tool.group": "Tools",
  "mapEditor.tool.quadrant": "Draw quadrant",
  "mapEditor.tool.quadrantHint": "Click each corner",
  "mapEditor.tool.sampling": "Place sampling point",
  "mapEditor.tool.samplingHint": "Inside a block",
  "mapEditor.tool.release": "Place release point",
  "mapEditor.tool.releaseHint": "Inside a quadrant",
  "mapEditor.tool.move": "Move or correct",
  "mapEditor.tool.moveHint": "Drag corners and points",

  "mapEditor.field.quadrant": "Quadrant",
  "mapEditor.field.quadrantPlaceholder": "Choose a quadrant",
  "mapEditor.field.name": "Quadrant name",
  "mapEditor.field.center": "Center",
  "mapEditor.field.centerPlaceholder": "Choose the center",
  "mapEditor.field.pointName": "Point name",

  "mapEditor.fact.area": "Area",
  "mapEditor.fact.areaValue": "{area} km²",
  "mapEditor.fact.points": "Sampling points",
  "mapEditor.fact.blocks": "Blocks",

  "mapEditor.browse.help": "Choose a tool. To see a quadrant's data, click it on the map.",
  "mapEditor.browse.open": "Open the quadrant record",

  "mapEditor.quadrant.step1": "Click the map at each corner of the quadrant.",
  "mapEditor.quadrant.step2": "To finish, click the first or the last corner again.",
  "mapEditor.quadrant.corners": "Corners placed: {count}",
  "mapEditor.quadrant.closed": "Quadrant closed. Name it and save it.",
  "mapEditor.quadrant.adjust": "You can drag the corners to adjust the shape before saving.",

  "mapEditor.point.samplingStep": "Click inside a block to place the point.",
  "mapEditor.point.releaseStep": "Click inside a quadrant to place the point.",
  "mapEditor.point.inBlock": "Block {block} of quadrant {quadrant}.",
  "mapEditor.point.inQuadrant": "Quadrant {quadrant}.",
  "mapEditor.point.needBlock": "The point must be inside a block. Click somewhere else.",
  "mapEditor.point.needQuadrant": "The point must be inside a quadrant. Click somewhere else.",
  "mapEditor.point.outsidePermit":
    "This place is outside the permit zone. Releases cannot happen here until the permit includes it.",
  "mapEditor.point.again": "If you made a mistake, click somewhere else on the map.",

  "mapEditor.move.pick": "Choose the quadrant to correct on the map or in the list.",
  "mapEditor.move.help":
    "Drag a corner to change the shape. To move a point, click it and then drag it. Click the middle of a line to add a corner.",
  "mapEditor.move.changes": "Unsaved changes: {count}",
  "mapEditor.move.noChanges": "No changes yet.",
  "mapEditor.move.outside":
    "Points left outside the new shape: {count}. Decide what happens to each one.",
  "mapEditor.move.movedInside": "You moved it inside the quadrant.",
  "mapEditor.move.decision": "What happens to {point}",
  "mapEditor.move.choose": "Choose what happens",
  "mapEditor.move.keep": "Leave it where it is",
  "mapEditor.move.remove": "Retire the point",
  "mapEditor.move.reason": "Reason for the change",

  "mapEditor.action.undo": "Undo corner",
  "mapEditor.action.redraw": "Draw again",
  "mapEditor.action.saveQuadrant": "Save quadrant",
  "mapEditor.action.saveSampling": "Save sampling point",
  "mapEditor.action.saveRelease": "Save release point",
  "mapEditor.action.saveChanges": "Save changes",
  "mapEditor.action.discard": "Discard",
  "mapEditor.action.list": "See list",
  "mapEditor.advanced": "Advanced: edit coordinates",
  "mapEditor.action.openRecord": "Open record",
  "mapEditor.action.editOnMap": "Edit on the map",
  "mapEditor.action.open": "Edit map",

  "mapEditor.saved.quadrant": "Quadrant saved.",
  "mapEditor.saved.sampling": "Sampling point saved.",
  "mapEditor.saved.release": "Release point saved.",
  "mapEditor.saved.changes": "Changes saved.",

  "mapEditor.error.duplicateCode": "Another one already has that name. Use a different one.",
  "mapEditor.error.invalidCode": "Type a name of up to 50 characters.",
  "mapEditor.error.pointOutside": "The point ended up outside its block or its quadrant.",
  "mapEditor.error.shape":
    "The shape is not valid: check that lines do not cross and that it has at least 3 corners.",
  "mapEditor.error.reason": "Type the reason for the change.",

  "mapEditor.legend.title": "What you see on the map",
  "mapEditor.legend.center": "Quadrant of {center}",
  "mapEditor.legend.block": "Block",
  "mapEditor.legend.sampling": "Sampling point",
  "mapEditor.legend.release": "Release point",
};
