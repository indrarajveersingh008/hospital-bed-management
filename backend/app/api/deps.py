from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
import jwt

from app.core.database import get_db
from app.core import security
from app.models.user import User, UserRole, UserStatus
from app.models.hospital_staff import HospitalStaff

reusable_oauth2 = HTTPBearer()


def get_current_user(
    db: Session = Depends(get_db),
    token: HTTPAuthorizationCredentials = Depends(reusable_oauth2)
) -> User:
    """
    Dependency that decodes the access token and returns the current authenticated user.
    """
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials.",
        headers={"WWW-Authenticate": "Bearer"},
    )
    
    try:
        payload = security.decode_token(token.credentials)
        if payload.get("type") != "access":
            raise credentials_exception
        user_id_str = payload.get("sub")
        if user_id_str is None:
            raise credentials_exception
        user_id = int(user_id_str)
    except (jwt.PyJWTError, ValueError):
        raise credentials_exception

    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise credentials_exception
        
    if user.status != UserStatus.ACTIVE:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"User account is {user.status.value.lower()}.",
        )
        
    return user


def check_user_role(required_roles: list[UserRole]):
    """
    Factory dependency to enforce specific user roles.
    """
    def dependency(current_user: User = Depends(get_current_user)) -> User:
        if current_user.role not in required_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Not enough permissions."
            )
        return current_user
    return dependency


# Specialized role checkers
get_current_active_admin = check_user_role([UserRole.ADMIN])
get_current_active_hospital_admin = check_user_role([UserRole.HOSPITAL_ADMIN, UserRole.ADMIN])
