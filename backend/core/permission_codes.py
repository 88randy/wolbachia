"""Permission codes (`<resource>.<action>`) that views require and the seed grants to profiles.

A profile holds codes as data (decision 13); these constants only name the ones the code uses.
"""

CATALOG_READ = "catalog.read"
CATALOG_ITEM_CREATE = "catalog_item.create"
CATALOG_ITEM_UPDATE = "catalog_item.update"
CATALOG_ITEM_DEACTIVATE = "catalog_item.deactivate"
CATALOG_ITEM_ACTIVATE = "catalog_item.activate"

RULE_PARAMETER_READ = "rule_parameter.read"
RULE_PARAMETER_VERSION_CREATE = "rule_parameter_version.create"
