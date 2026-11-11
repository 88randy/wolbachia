/** English messages of the `scheduling` area: exactly the keys of `../es-MX/scheduling.ts`. */
import type { scheduling as source } from "../es-MX/scheduling.ts";

export const scheduling: Record<keyof typeof source, string> = {
  "scheduling.home.description":
    "Each week is built in five steps, in this order. Here you see which step you are on and what comes next.",
  "scheduling.home.hint":
    "First load which blocks are most urgent, then share the quadrants among the couriers, review what is scheduled and, if someone cannot visit their points, pass them to another courier.",
  "scheduling.home.week": "Week {week} · {from} to {to}",
  "scheduling.home.next": "Next: {step}",
  "scheduling.home.nextBadge": "Do this step next",
  "scheduling.home.waiting":
    "The remaining steps are done by other people on your team. You can see how they are going here.",
  "scheduling.home.allDone": "Everything is up to date this week.",
  "scheduling.home.loading": "Checking how the week is going…",
  "scheduling.home.stepOf": "Step {number}",
  "scheduling.home.state.done": "Done",
  "scheduling.home.state.pending": "Pending",
  "scheduling.home.state.attention": "Needs attention",
  "scheduling.home.state.optional": "Optional",

  "scheduling.step.risk.title": "Load or confirm the week's risk",
  "scheduling.step.risk.text":
    "Tell the system which blocks are most urgent this week: high, medium or low risk.",
  "scheduling.step.risk.done": "Blocks with risk: {count}.",
  "scheduling.step.risk.pending": "This week's risk has not been loaded yet.",
  "scheduling.step.risk.noPermission":
    "Your profile cannot load the list: ask whoever manages risk to upload it.",
  "scheduling.step.risk.load": "Load risk list",
  "scheduling.step.risk.see": "See the risk",
  "scheduling.step.assign.title": "Share the quadrants among couriers",
  "scheduling.step.assign.text":
    "Decide which courier covers each quadrant. A quadrant is a work area with several blocks.",
  "scheduling.step.assign.done": "All quadrants ({count}) have a courier.",
  "scheduling.step.assign.attention": "Quadrants without a courier: {count} of {total}.",
  "scheduling.step.assign.empty": "There are no quadrants to share yet.",
  "scheduling.step.assign.action": "Share quadrants",
  "scheduling.step.assign.see": "See the assignment",
  "scheduling.step.review.title": "Review the week's schedule",
  "scheduling.step.review.text":
    "See which points each courier visits each day, from most to least urgent.",
  "scheduling.step.review.done": "Points scheduled: {total} · Still to visit: {pending}.",
  "scheduling.step.review.pending": "The week is not built yet: there are no scheduled points.",
  "scheduling.step.review.build": "Build the week",
  "scheduling.step.review.action": "See the schedule",
  "scheduling.step.reassign.title": "Reassign what is still pending",
  "scheduling.step.reassign.text":
    "If a courier could not visit their points on a day that already passed, pass them to another courier.",
  "scheduling.step.reassign.done": "No points are pending from earlier days.",
  "scheduling.step.reassign.attention": "Points from earlier days not visited: {count}.",
  "scheduling.step.reassign.none": "You can do this once there are scheduled points.",
  "scheduling.step.reassign.action": "Reassign pending points",
  "scheduling.step.reassign.see": "See pending points",
  "scheduling.step.intervention.title": "Log what other institutions did",
  "scheduling.step.intervention.text":
    "Spraying or other third-party actions: log them so nobody repeats or contradicts their work.",
  "scheduling.step.intervention.done": "Interventions logged: {count}.",
  "scheduling.step.intervention.empty": "No interventions have been logged yet.",
  "scheduling.step.intervention.action": "Go to interventions",

  "scheduling.courier.none": "No courier",
  "scheduling.courier.numbered": "Courier {number}",
  "scheduling.courier.unknown": "Courier",

  "scheduling.glossary.load":
    "Pending: points the courier has not visited yet. Target: how many points they can visit well in one day (today: {target}).",
  "scheduling.glossary.risk":
    "Risk says how urgent it is to visit a block this week. Points in high-risk blocks are visited first.",
  "scheduling.glossary.reassign":
    "Reassigning means passing the points that were not visited from one courier to another.",

  "scheduling.plan.menu": "Weekly schedule",
  "scheduling.plan.title": "Schedule for week {week}",
  "scheduling.plan.description":
    "Who visits which points each day. Pick a number in the table to see that courier's day.",
  "scheduling.plan.weekRange": "{from} to {to}",
  "scheduling.plan.matrixTitle": "Pending points by courier and day",
  "scheduling.plan.matrixHint":
    "Each number is the points that courier has not visited yet that day. In yellow, with an icon: over the target ({target} per day).",
  "scheduling.plan.courier": "Courier",
  "scheduling.plan.previousWeek": "Previous week",
  "scheduling.plan.thisWeek": "This week",
  "scheduling.plan.nextWeek": "Next week",
  "scheduling.plan.noTasks": "No points are scheduled this week yet.",
  "scheduling.plan.noTasksHelp":
    "Before building it, load the week's risk and share the quadrants. Then press «Build the week».",
  "scheduling.plan.noTasksReadOnly":
    "Once whoever manages scheduling builds the week, you will see each day's points here.",
  "scheduling.plan.allDone":
    "No points are pending this week: everything scheduled has been visited.",
  "scheduling.plan.noWork": "Nothing pending that day",
  "scheduling.plan.openDay": "{name}, {day}: pending points {count}",
  "scheduling.plan.overTarget": "Over the target",
  "scheduling.plan.today": "Today",
  "scheduling.plan.pastBanner":
    "Some points from earlier days were not visited ({count}). Pass them to another courier so they are not lost.",
  "scheduling.plan.pastAction": "Reassign pending points",
  "scheduling.plan.pastPick": "Show {name}, {day}",
  "scheduling.generate.action": "Build the week",
  "scheduling.generate.title": "Build week {week}?",
  "scheduling.generate.consequence":
    "The system will schedule this week's points using the quadrant assignment and today's risk. Points that were already scheduled do not change.",
  "scheduling.generate.confirm": "Build the week",
  "scheduling.generate.done": "Done. New points scheduled: {count}.",
  "scheduling.generate.nothing": "The week was already built: there are no new points.",

  "scheduling.day.title": "{name} · {day}",
  "scheduling.day.subtitle": "From most to least urgent.",
  "scheduling.day.empty": "This courier has no points that day.",
  "scheduling.day.pick": "Pick a number in the table above to see a courier's day.",
  "scheduling.day.done": "Done: {count}",
  "scheduling.day.points": "Points: {count}",
  "scheduling.day.noRisk": "No risk assigned",
  "scheduling.day.noRiskHelp": "Load the week's risk to sort by urgency.",
  "scheduling.day.unassigned": "No courier",
  "scheduling.day.source": "Source: {source}",
  "scheduling.day.protocol": "Protocol: {protocol}",
  "scheduling.action.check": "Check {count}",
  "scheduling.action.place": "Place {count}",
  "scheduling.action.release": "Release {count}",
  "scheduling.legend.title": "What each action means",
  "scheduling.legend.check": "Check: collect the paddle from an ovitrap that is already placed.",
  "scheduling.legend.place": "Place: set a new ovitrap at the point.",
  "scheduling.legend.release":
    "Release: release Wolbachia mosquitoes at the point (needs a permit).",
  "scheduling.legend.risk": "Block urgency:",

  "scheduling.risk.high": "High",
  "scheduling.risk.medium": "Medium",
  "scheduling.risk.low": "Low",
  "scheduling.risk.none": "No category",
  "scheduling.risk.menu": "Risk by block",
  "scheduling.risk.title": "Risk by block · Week {week}",
  "scheduling.risk.description":
    "How urgent it is to visit each block this week. Week starting {day}.",
  "scheduling.risk.hint":
    "Risk is how urgent it is to visit a block. High is visited first. It comes from an official list or a company rule.",
  "scheduling.risk.caption": "Risk of each block",
  "scheduling.risk.block": "Block",
  "scheduling.risk.category": "Risk",
  "scheduling.risk.origin": "Where it comes from",
  "scheduling.risk.protocol": "Protocol",
  "scheduling.risk.sourceOfficial": "Official list",
  "scheduling.risk.sourceCompany": "Company rule",
  "scheduling.risk.import": "Load the week's list",
  "scheduling.risk.emptyTitle": "This week has no risk yet",
  "scheduling.risk.emptyHelp":
    "Upload the week's list so points are sorted from most to least urgent.",
  "scheduling.risk.emptyReadOnly":
    "Once someone loads the week's list, you will see each block's risk here.",
  "scheduling.risk.nextStep": "Next step: share the quadrants",
  "scheduling.risk.goAssign": "Share quadrants",

  "scheduling.import.title": "Load the week's risk",
  "scheduling.import.subtitle":
    "Upload a list with each block's risk. You will see a preview before anything changes.",
  "scheduling.import.step1": "Which list are you loading?",
  "scheduling.import.step1Hint": "Choose where the list comes from and which week it applies to.",
  "scheduling.import.step2": "Upload the file",
  "scheduling.import.step2Hint": "A CSV file with one row per block.",
  "scheduling.import.step3": "Review before applying",
  "scheduling.import.step3Hint":
    "Nothing has changed yet. Changes are made only when you press Apply.",
  "scheduling.import.stepName1": "Source",
  "scheduling.import.stepName2": "File",
  "scheduling.import.stepName3": "Review",
  "scheduling.import.stepsLabel": "Steps to load the risk",
  "scheduling.import.source": "Source of the list",
  "scheduling.import.sourceHelp":
    "Official list: the one sent by the health authority. Company rule: the one your team defines.",
  "scheduling.import.week": "Week it applies to",
  "scheduling.import.weekOption": "Week {week} · from {from}",
  "scheduling.import.file": "CSV file",
  "scheduling.import.chooseFile": "Choose file",
  "scheduling.import.changeFile": "Change file",
  "scheduling.import.noFile": "You have not chosen a file yet.",
  "scheduling.import.needFile": "Choose a file to see the preview.",
  "scheduling.import.formatTitle": "What should the file look like?",
  "scheduling.import.formatHint":
    "One row per block. Columns: block_code (the block's code), category (the risk: low, medium or high) and protocol (optional).",
  "scheduling.import.template": "Download template with your blocks",
  "scheduling.import.templateName": "risk-template.csv",
  "scheduling.import.preview": "See preview",
  "scheduling.import.apply": "Apply",
  "scheduling.import.summary": "Blocks that will be updated: {count}.",
  "scheduling.import.summaryByRisk": "High: {high} · Medium: {medium} · Low: {low}",
  "scheduling.import.willDo":
    "When you apply, the risk of those blocks in week {week} changes and points are sorted with it. The previous values stay in the history.",
  "scheduling.import.errorsTitle": "Rows with problems: {count}. Fix the file and upload it again.",
  "scheduling.import.errorRow": "Row {row}:",
  "scheduling.import.fixFile": "Upload another file",
  "scheduling.import.confirmTitle": "Apply the risk for week {week}?",
  "scheduling.import.confirmText":
    "The risk of the blocks in the file ({count}) will change and that week's points will be sorted with it. You can load another list later; the previous one stays in the history.",
  "scheduling.import.applied": "Done. Blocks updated: {count}.",
  "scheduling.import.nextStep": "Next step",
  "scheduling.import.nextText": "Now share the quadrants among the couriers.",
  "scheduling.import.seeResult": "See the week's risk",
  "scheduling.import.goAssign": "Share quadrants",
  "scheduling.import.error.invalid_columns": "The column titles are not the expected ones.",
  "scheduling.import.error.invalid_row": "Columns are missing or extra.",
  "scheduling.import.error.unsafe_cell": "There is a text that cannot be accepted.",
  "scheduling.import.error.invalid_block_code": "The block code is not valid.",
  "scheduling.import.error.invalid_category": "The risk must be low, medium or high.",
  "scheduling.import.error.invalid_protocol": "The protocol is too long.",
  "scheduling.import.error.duplicate_block": "The block appears more than once.",
  "scheduling.import.error.block_inaccessible":
    "You cannot access this block or it does not exist.",
  "scheduling.import.error.invalid_utf8": "The file could not be read. Save it as UTF-8 CSV.",
  "scheduling.import.error.invalid_csv": "The file is not valid CSV.",
  "scheduling.import.error.empty_import": "The file has no blocks.",
  "scheduling.import.error.file_too_large": "The file is too large.",
  "scheduling.import.error.too_many_rows": "The file has too many rows.",
  "scheduling.import.error.unknown": "This row could not be checked.",

  "scheduling.reassign.title": "Reassign {name}'s pending points",
  "scheduling.reassign.subtitle":
    "Reassigning means passing the points that were not visited to another courier. Pending points of {name} on this day: {count}.",
  "scheduling.reassign.to": "Pass them to",
  "scheduling.reassign.choose": "Choose who",
  "scheduling.reassign.option": "{name} ({load} pending that day)",
  "scheduling.reassign.fits": "{name} would have {total} points, within their target of {target}.",
  "scheduling.reassign.over": "{name} would have {total} points, over their target of {target}.",
  "scheduling.reassign.noOthers": "There are no other couriers to pass these points to.",
  "scheduling.reassign.blocked": "Only whoever manages scheduling can reassign.",
  "scheduling.reassign.apply": "Reassign points ({count})",
  "scheduling.reassign.confirmTitle": "Pass the pending points to {to}?",
  "scheduling.reassign.confirmText":
    "The pending points of {from} ({count}) will go to {to}. {from} will no longer see them on their phone. Points that were already visited do not change.",
  "scheduling.reassign.confirm": "Yes, reassign",
  "scheduling.reassign.done": "Done. The pending points are now with another courier.",

  "scheduling.assign.title": "Quadrants by courier",
  "scheduling.assign.description":
    "Each column is a courier. Drag a quadrant to another column, or use «Move to…». Changes are saved instantly and you can undo them.",
  "scheduling.assign.hint":
    "A quadrant is a work area with several blocks. Each quadrant is covered by one courier. The bar shows that courier's busiest day of pending points against their daily target.",
  "scheduling.assign.readOnly":
    "You can only view this screen. Ask whoever manages scheduling to make changes.",
  "scheduling.assign.empty": "There are no quadrants to share yet.",
  "scheduling.assign.emptyHelp":
    "Quadrants are created in Geography. Once they exist, you share them among couriers here.",
  "scheduling.assign.emptyAction": "Go to quadrants",
  "scheduling.assign.columnSummary": "Quadrants: {count}",
  "scheduling.assign.columnEmpty": "No quadrants. Drag one here.",
  "scheduling.assign.columnDrop": "Drop here to assign",
  "scheduling.assign.loadPeak": "Busiest day: {load} of {target} pending",
  "scheduling.assign.loadWeek": "Pending this week: {count}",
  "scheduling.assign.loadLabel": "Load of {name} against their target",
  "scheduling.assign.overTarget": "Over the target",
  "scheduling.assign.nearTarget": "Close to the target",
  "scheduling.assign.okTarget": "Within the target",
  "scheduling.assign.unassignedTitle": "No courier",
  "scheduling.assign.unassignedHelp":
    "Nobody will visit these quadrants until you move them to a courier.",
  "scheduling.assign.center": "Center: {name}",
  "scheduling.assign.drag": "Drag to move",
  "scheduling.assign.saving": "Saving…",
  "scheduling.assign.move": "Move to…",
  "scheduling.assign.moveAria": "Move quadrant {code} to another courier",
  "scheduling.assign.unassign": "Leave without courier",
  "scheduling.assign.moved":
    "{code} now belongs to {name}. Points already scheduled this week stay with their previous courier.",
  "scheduling.assign.movedNone":
    "{code} was left without a courier. Points already scheduled this week stay with their previous courier.",
  "scheduling.assign.undo": "Undo",
  "scheduling.assign.undone": "Done, {code} is back with {name}.",
  "scheduling.assign.undoneNone": "Done, {code} is back to having no courier.",
  "scheduling.assign.pendingNote":
    "Points already scheduled this week do not move by themselves: to pass them to another courier use «Reassign pending points» in the schedule.",
  "scheduling.assign.goPlan": "Go to the schedule",

  "scheduling.error.changed":
    "Someone else made a change. The screen is already updated; try again.",
  "scheduling.error.forbidden": "You do not have permission to make this change.",

  "scheduling.intervention.title": "Interventions by other institutions",
  "scheduling.intervention.description":
    "Spraying, fogging and larvicide done by other institutions. Log them here so nobody repeats or contradicts their work.",
  "scheduling.intervention.hint":
    "An intervention is an action against the mosquito done by another institution, such as spraying. You log the blocks and the dates.",
  "scheduling.intervention.empty": "No interventions have been logged yet",
  "scheduling.intervention.emptyHelp":
    "When another institution sprays or applies larvicide, log it here with the blocks it covered.",
  "scheduling.intervention.emptyReadOnly":
    "When someone logs an intervention, it will appear here.",
  "scheduling.intervention.new": "Log an intervention",
  "scheduling.intervention.newHint":
    "Note what was applied, who did it, when and in which blocks. It cannot be deleted: if you make a mistake, log another one.",
  "scheduling.intervention.sectionWhat": "What was done?",
  "scheduling.intervention.sectionWho": "Who and when?",
  "scheduling.intervention.sectionWhere": "In which blocks?",
  "scheduling.intervention.type": "Type of action",
  "scheduling.intervention.typePlaceholder": "Choose the type",
  "scheduling.intervention.other": "Describe it",
  "scheduling.intervention.product": "Product applied",
  "scheduling.intervention.institution": "Institution",
  "scheduling.intervention.from": "From",
  "scheduling.intervention.to": "To",
  "scheduling.intervention.dates": "Dates",
  "scheduling.intervention.range": "{from} to {to}",
  "scheduling.intervention.blocks": "Blocks covered",
  "scheduling.intervention.blocksColumn": "Blocks",
  "scheduling.intervention.blockSearch": "Search block",
  "scheduling.intervention.noBlocks": "No blocks match that text.",
  "scheduling.intervention.selected": "Chosen: {count}",
  "scheduling.intervention.selectShown": "Choose the ones shown",
  "scheduling.intervention.clearSelected": "Remove all",
  "scheduling.intervention.required": "This field is required.",
  "scheduling.intervention.needBlocks": "Choose at least one block.",
  "scheduling.intervention.badRange": "The end date cannot be before the start date.",
  "scheduling.intervention.invalid": "Check the data: something is not valid.",
  "scheduling.intervention.saved": "Intervention recorded.",
};
