# Center filter

The shell picker consumes backend-scoped centers and explicit /me/ scope. Selection is a convenience keyed by user id and organization slug. It never writes session state or expands grants. All pages are read before invalidating a remembered selection. Query context includes the selected center; authorization changes are published solely by session-controller.
