"""Action codes; profile names never authorize a lab operation."""

BAG_RECEIVE = "bag.receive"
COUNT_CREATE = "egg_count.create"
COUNT_READ = "egg_count.read"
COUNT_VOID = "egg_count.void"
REJECTION_CREATE = "lab_rejection.create"
METHOD_READ = "lab_method.read"
METHOD_MANAGE = "lab_method.manage"
METHOD_VERIFY = "lab_method.verify"
RECOUNT_CREATE = "recount.create"
RECOUNT_ADJUDICATE = "recount.adjudicate"
PADDLE_REUSE = "egg_paddle.reuse"
ENTOMOLOGIST_CODES = (
    "sample.read",
    "sample.receive",
    "sample.result_create",
    BAG_RECEIVE,
    COUNT_CREATE,
    COUNT_READ,
    REJECTION_CREATE,
    METHOD_READ,
    RECOUNT_CREATE,
)
ADMIN_CODES = (
    "sample.collect",
    "sample.void",
    *ENTOMOLOGIST_CODES,
    COUNT_VOID,
    METHOD_MANAGE,
    METHOD_VERIFY,
    RECOUNT_ADJUDICATE,
    PADDLE_REUSE,
)
