"""Action codes; profile names never authorize a lab operation."""

BAG_RECEIVE = "bag.receive"
COUNT_CREATE = "egg_count.create"
COUNT_READ = "egg_count.read"
COUNT_VOID = "egg_count.void"
REJECTION_CREATE = "lab_rejection.create"
METHOD_READ = "lab_method.read"
METHOD_MANAGE = "lab_method.manage"
METHOD_VERIFY = "lab_method.verify"
ENTOMOLOGIST_CODES = (BAG_RECEIVE, COUNT_CREATE, COUNT_READ, REJECTION_CREATE, METHOD_READ)
ADMIN_CODES = (*ENTOMOLOGIST_CODES, COUNT_VOID, METHOD_MANAGE, METHOD_VERIFY)
