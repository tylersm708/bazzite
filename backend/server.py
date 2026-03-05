from fastapi import FastAPI, APIRouter, HTTPException
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict
from typing import List, Optional, Dict, Any
import uuid
from datetime import datetime, timezone
import platform
import subprocess
import psutil


ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Create the main app without a prefix
app = FastAPI()

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")


# Define Models
class StatusCheck(BaseModel):
    model_config = ConfigDict(extra="ignore")
    
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    client_name: str
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class StatusCheckCreate(BaseModel):
    client_name: str

class FileItem(BaseModel):
    name: str
    path: str
    type: str  # 'file' or 'directory'
    size: Optional[int] = None
    modified: Optional[str] = None

class VirtualWindow(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    title: str
    position: Dict[str, float]  # {x, y, z}
    size: Dict[str, float]  # {width, height}
    content_type: str  # 'app', 'file', 'browser'
    content_url: Optional[str] = None
    is_active: bool = True
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class WindowCreate(BaseModel):
    title: str
    position: Dict[str, float]
    size: Dict[str, float]
    content_type: str
    content_url: Optional[str] = None

class WindowUpdate(BaseModel):
    position: Optional[Dict[str, float]] = None
    size: Optional[Dict[str, float]] = None
    is_active: Optional[bool] = None

class AppInfo(BaseModel):
    name: str
    path: str
    icon: Optional[str] = None
    category: str

class LaunchApp(BaseModel):
    app_path: str
    window_title: str


# Original routes
@api_router.get("/")
async def root():
    return {"message": "VR Desktop Environment API"}

@api_router.post("/status", response_model=StatusCheck)
async def create_status_check(input: StatusCheckCreate):
    status_dict = input.model_dump()
    status_obj = StatusCheck(**status_dict)
    
    doc = status_obj.model_dump()
    doc['timestamp'] = doc['timestamp'].isoformat()
    
    _ = await db.status_checks.insert_one(doc)
    return status_obj

@api_router.get("/status", response_model=List[StatusCheck])
async def get_status_checks():
    status_checks = await db.status_checks.find({}, {"_id": 0}).to_list(1000)
    
    for check in status_checks:
        if isinstance(check['timestamp'], str):
            check['timestamp'] = datetime.fromisoformat(check['timestamp'])
    
    return status_checks


# File System APIs
@api_router.get("/filesystem/browse")
async def browse_filesystem(path: str = None):
    """Browse files and directories"""
    try:
        # Default to user home directory if no path provided
        if not path:
            path = str(Path.home())
        
        target_path = Path(path)
        
        if not target_path.exists():
            raise HTTPException(status_code=404, detail="Path not found")
        
        if not target_path.is_dir():
            raise HTTPException(status_code=400, detail="Path is not a directory")
        
        items = []
        
        # Add parent directory option if not at root
        if target_path.parent != target_path:
            items.append(FileItem(
                name="..",
                path=str(target_path.parent),
                type="directory"
            ))
        
        # List all items in directory
        for item in sorted(target_path.iterdir(), key=lambda x: (not x.is_dir(), x.name.lower())):
            try:
                stat = item.stat()
                items.append(FileItem(
                    name=item.name,
                    path=str(item),
                    type="directory" if item.is_dir() else "file",
                    size=stat.st_size if item.is_file() else None,
                    modified=datetime.fromtimestamp(stat.st_mtime).isoformat()
                ))
            except (OSError, PermissionError):
                # Skip items we can't access
                continue
        
        return {
            "current_path": str(target_path),
            "items": items
        }
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@api_router.get("/filesystem/home")
async def get_home_directory():
    """Get user home directory"""
    return {"path": str(Path.home())}


# Virtual Window Management APIs
@api_router.post("/windows/create", response_model=VirtualWindow)
async def create_window(window: WindowCreate):
    """Create a new virtual window"""
    try:
        window_obj = VirtualWindow(**window.model_dump())
        doc = window_obj.model_dump()
        doc['created_at'] = doc['created_at'].isoformat()
        
        await db.virtual_windows.insert_one(doc)
        return window_obj
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@api_router.get("/windows/list", response_model=List[VirtualWindow])
async def list_windows():
    """List all virtual windows"""
    try:
        windows = await db.virtual_windows.find(
            {"is_active": True},
            {"_id": 0}
        ).to_list(100)
        
        for window in windows:
            if isinstance(window['created_at'], str):
                window['created_at'] = datetime.fromisoformat(window['created_at'])
        
        return windows
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@api_router.put("/windows/{window_id}")
async def update_window(window_id: str, update: WindowUpdate):
    """Update window properties"""
    try:
        update_data = {k: v for k, v in update.model_dump().items() if v is not None}
        
        if not update_data:
            raise HTTPException(status_code=400, detail="No update data provided")
        
        result = await db.virtual_windows.update_one(
            {"id": window_id},
            {"$set": update_data}
        )
        
        if result.matched_count == 0:
            raise HTTPException(status_code=404, detail="Window not found")
        
        return {"message": "Window updated successfully"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@api_router.delete("/windows/{window_id}")
async def close_window(window_id: str):
    """Close/delete a virtual window"""
    try:
        result = await db.virtual_windows.update_one(
            {"id": window_id},
            {"$set": {"is_active": False}}
        )
        
        if result.matched_count == 0:
            raise HTTPException(status_code=404, detail="Window not found")
        
        return {"message": "Window closed successfully"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# App Launcher APIs
@api_router.get("/apps/list")
async def list_applications():
    """List available applications"""
    try:
        apps = []
        system = platform.system()
        
        if system == "Linux":
            # Check common application directories
            app_dirs = [
                Path("/usr/share/applications"),
                Path.home() / ".local/share/applications"
            ]
            
            for app_dir in app_dirs:
                if app_dir.exists():
                    for desktop_file in app_dir.glob("*.desktop"):
                        try:
                            apps.append(AppInfo(
                                name=desktop_file.stem.replace("-", " ").title(),
                                path=str(desktop_file),
                                category="Application"
                            ))
                        except:
                            continue
        
        # Add some common system apps as fallback
        common_apps = [
            AppInfo(name="File Manager", path="/file-manager", category="System"),
            AppInfo(name="Web Browser", path="/browser", category="Internet"),
            AppInfo(name="Terminal", path="/terminal", category="System"),
            AppInfo(name="Text Editor", path="/editor", category="Utilities"),
            AppInfo(name="Calculator", path="/calculator", category="Utilities"),
        ]
        
        if not apps:
            apps = common_apps
        else:
            apps.extend(common_apps)
        
        return {"apps": apps[:20]}  # Limit to 20 apps
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@api_router.post("/apps/launch")
async def launch_application(app: LaunchApp):
    """Launch an application"""
    try:
        # In a real implementation, this would launch the actual application
        # For VR environment, we'll create a virtual window instead
        window = WindowCreate(
            title=app.window_title,
            position={"x": 0, "y": 1.5, "z": -2},
            size={"width": 1.6, "height": 1.2},
            content_type="app",
            content_url=app.app_path
        )
        
        window_obj = VirtualWindow(**window.model_dump())
        doc = window_obj.model_dump()
        doc['created_at'] = doc['created_at'].isoformat()
        
        await db.virtual_windows.insert_one(doc)
        
        return {
            "message": "Application launched successfully",
            "window_id": window_obj.id
        }
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# SteamVR Integration APIs
@api_router.get("/steamvr/status")
async def get_steamvr_status():
    """Get SteamVR status and headset information"""
    try:
        # Check if SteamVR process is running
        steamvr_running = False
        
        for proc in psutil.process_iter(['name']):
            try:
                if 'vrserver' in proc.info['name'].lower() or 'steamvr' in proc.info['name'].lower():
                    steamvr_running = True
                    break
            except (psutil.NoSuchProcess, psutil.AccessDenied):
                continue
        
        return {
            "steamvr_running": steamvr_running,
            "webxr_available": True,  # Will be checked on client side
            "platform": platform.system(),
            "message": "VR ready" if steamvr_running else "SteamVR not detected"
        }
    
    except Exception as e:
        return {
            "steamvr_running": False,
            "webxr_available": True,
            "error": str(e)
        }


@api_router.get("/system/info")
async def get_system_info():
    """Get system information"""
    try:
        return {
            "platform": platform.system(),
            "platform_version": platform.version(),
            "processor": platform.processor(),
            "cpu_count": psutil.cpu_count(),
            "memory_total": psutil.virtual_memory().total,
            "memory_available": psutil.virtual_memory().available
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# Include the router in the main app
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
