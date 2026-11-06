from rest_framework.routers import SimpleRouter

from uploads.views import AttachmentViewSet, UploadViewSet

router = SimpleRouter()
router.register("field/uploads", UploadViewSet, basename="field-upload")
router.register("attachments", AttachmentViewSet, basename="attachment")
urlpatterns = router.urls
