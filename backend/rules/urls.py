from rest_framework.routers import SimpleRouter

from rules.views import KEY_REGEX, RuleParameterVersionViewSet, RuleParameterViewSet

router = SimpleRouter()
router.register("rule-parameters", RuleParameterViewSet, basename="rule-parameter")
# Nested by hand (a regex prefix) instead of adding drf-nested-routers as a dependency.
router.register(
    rf"rule-parameters/(?P<parameter_key>{KEY_REGEX})/versions",
    RuleParameterVersionViewSet,
    basename="rule-parameter-version",
)

urlpatterns = router.urls
