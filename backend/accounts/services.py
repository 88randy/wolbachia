from accounts.models import User


def create_user_without_password(username: str, email: str) -> User:
    """Create a user that cannot log in until a password is set (`manage.py changepassword`)."""
    user = User(username=username, email=email)
    user.set_unusable_password()
    user.full_clean()
    user.save()
    return user
