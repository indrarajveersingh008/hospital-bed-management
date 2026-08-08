from fastapi import APIRouter, Depends
from app.api import deps
from app.models.user import User
from app.schemas.user import UserOut

router = APIRouter()


@router.get("/me", response_model=UserOut)
def read_current_user_profile(current_user: User = Depends(deps.get_current_user)):
    """
    Returns the profile information of the currently authenticated user.
    """
    return current_user
