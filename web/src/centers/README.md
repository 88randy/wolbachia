# Center filter

The shell picker consumes backend-scoped centers and explicit /me/ scope. Selection is a convenience keyed by user id and organization slug. It never writes session state or expands grants. All pages are read before invalidating a remembered selection. Query context includes the selected center; authorization changes are published solely by session-controller.

Supported quadrant/motorcycle list and code queries apply URL center > active center > no filter. The generated contract has no center query for blocks or sampling points. The center-query test checks parameter precedence and unsupported endpoints; the center-filter test defers the A-to-B response and checks table/map isolation.
