import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import * as BABYLON from '@babylonjs/core';
import VRScene from './components/VRScene';
import { VirtualWindowManager } from './components/VirtualWindowManager';
import { FileBrowserVR } from './components/FileBrowserVR';
import { AppLauncherVR } from './components/AppLauncherVR';
import './App.css';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

function App() {
  const [scene, setScene] = useState(null);
  const [windowManager, setWindowManager] = useState(null);
  const [fileBrowser, setFileBrowser] = useState(null);
  const [appLauncher, setAppLauncher] = useState(null);
  const [windows, setWindows] = useState([]);
  const [vrStatus, setVrStatus] = useState(null);
  const [systemInfo, setSystemInfo] = useState(null);
  const [loading, setLoading] = useState(true);

  // Initialize VR scene and managers
  const handleSceneReady = useCallback((babylonScene) => {
    console.log('Scene ready');
    setScene(babylonScene);

    // Initialize window manager
    const winManager = new VirtualWindowManager(babylonScene);
    winManager.onWindowClose = async (windowId) => {
      try {
        await axios.delete(`${API}/windows/${windowId}`);
        setWindows((prev) => prev.filter((w) => w.id !== windowId));
      } catch (error) {
        console.error('Error closing window:', error);
      }
    };
    setWindowManager(winManager);

    // Initialize file browser  (positioned left and closer)
    const browser = new FileBrowserVR(babylonScene, { x: -1.5, y: 1.5, z: -2 });
    browser.create().then(() => {
      console.log('File browser created successfully');
    }).catch((err) => {
      console.error('Error creating file browser:', err);
    });
    browser.onFolderNavigate = async (path) => {
      await loadFiles(path, browser);
    };
    browser.onFileSelect = (file) => {
      createWindowForFile(file, winManager);
    };
    setFileBrowser(browser);

    // Add visual marker for file browser position
    const leftMarker = BABYLON.MeshBuilder.CreateBox('leftMarker', { size: 0.2 }, babylonScene);
    leftMarker.position = new BABYLON.Vector3(-1.5, 1.5, -2);
    const leftMat = new BABYLON.StandardMaterial('leftMat', babylonScene);
    leftMat.emissiveColor = new BABYLON.Color3(1, 0, 0);
    leftMarker.material = leftMat;

    // Initialize app launcher (positioned right and closer)
    const launcher = new AppLauncherVR(babylonScene, { x: 1.5, y: 1.5, z: -2 });
    launcher.create().then(() => {
      console.log('App launcher created successfully');
    }).catch((err) => {
      console.error('Error creating app launcher:', err);
    });
    launcher.onAppLaunch = (app) => {
      launchApplication(app, winManager);
    };
    setAppLauncher(launcher);

    // Add visual marker for app launcher position
    const rightMarker = BABYLON.MeshBuilder.CreateBox('rightMarker', { size: 0.2 }, babylonScene);
    rightMarker.position = new BABYLON.Vector3(1.5, 1.5, -2);
    const rightMat = new BABYLON.StandardMaterial('rightMat', babylonScene);
    rightMat.emissiveColor = new BABYLON.Color3(0, 1, 0);
    rightMarker.material = rightMat;

    setLoading(false);
  }, []);

  // Load files for file browser
  const loadFiles = async (path, browser) => {
    try {
      const response = await axios.get(`${API}/filesystem/browse`, {
        params: { path },
      });
      browser.updateFiles(response.data.items, response.data.current_path);
    } catch (error) {
      console.error('Error loading files:', error);
    }
  };

  // Load applications for app launcher
  const loadApps = async (launcher) => {
    try {
      const response = await axios.get(`${API}/apps/list`);
      launcher.updateApps(response.data.apps);
    } catch (error) {
      console.error('Error loading apps:', error);
    }
  };

  // Create window for file
  const createWindowForFile = async (file, winManager) => {
    try {
      const windowData = {
        title: file.name,
        position: { x: 0, y: 1.5, z: -2.5 },
        size: { width: 1.6, height: 1.2 },
        content_type: 'file',
        content_url: file.path,
      };

      const response = await axios.post(`${API}/windows/create`, windowData);
      const newWindow = response.data;
      
      winManager.createWindow(newWindow);
      setWindows((prev) => [...prev, newWindow]);
    } catch (error) {
      console.error('Error creating window:', error);
    }
  };

  // Launch application
  const launchApplication = async (app, winManager) => {
    try {
      const response = await axios.post(`${API}/apps/launch`, {
        app_path: app.path,
        window_title: app.name,
      });

      // Fetch the created window
      const windowsResponse = await axios.get(`${API}/windows/list`);
      const latestWindow = windowsResponse.data[windowsResponse.data.length - 1];
      
      if (latestWindow && winManager) {
        winManager.createWindow(latestWindow);
        setWindows(windowsResponse.data);
      }
    } catch (error) {
      console.error('Error launching app:', error);
    }
  };

  // Check VR status
  const checkVRStatus = async () => {
    try {
      const response = await axios.get(`${API}/steamvr/status`);
      setVrStatus(response.data);
    } catch (error) {
      console.error('Error checking VR status:', error);
    }
  };

  // Get system info
  const getSystemInfo = async () => {
    try {
      const response = await axios.get(`${API}/system/info`);
      setSystemInfo(response.data);
    } catch (error) {
      console.error('Error getting system info:', error);
    }
  };

  // Initialize data on component mount
  useEffect(() => {
    if (fileBrowser && appLauncher) {
      // Load initial files (home directory)
      axios.get(`${API}/filesystem/home`).then((response) => {
        loadFiles(response.data.path, fileBrowser);
      });

      // Load applications
      loadApps(appLauncher);

      // Check VR status
      checkVRStatus();
      
      // Get system info
      getSystemInfo();
    }
  }, [fileBrowser, appLauncher]);

  return (
    <div className="App" data-testid="vr-desktop-app">
      {/* Loading overlay */}
      {loading && (
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'rgba(0, 0, 0, 0.9)',
            color: 'white',
            fontSize: '24px',
            zIndex: 1000,
          }}
          data-testid="loading-overlay"
        >
          <div>
            <div style={{ marginBottom: '20px' }}>🔮 Loading VR Environment...</div>
            <div style={{ fontSize: '14px', opacity: 0.7 }}>
              Initializing Babylon.js and VR systems
            </div>
          </div>
        </div>
      )}

      {/* VR Scene */}
      <VRScene onSceneReady={handleSceneReady} windows={windows} />

      {/* Info Panel */}
      {!loading && (
        <div
          style={{
            position: 'absolute',
            bottom: 20,
            left: 20,
            background: 'rgba(0, 0, 0, 0.8)',
            color: 'white',
            padding: '15px 20px',
            borderRadius: '8px',
            fontFamily: 'monospace',
            fontSize: '12px',
            maxWidth: '400px',
          }}
          data-testid="info-panel"
        >
          <div style={{ fontWeight: 'bold', marginBottom: '10px', fontSize: '14px' }}>
            🖥️ VR Desktop Environment
          </div>
          <div style={{ opacity: 0.9, lineHeight: '1.6' }}>
            <div>• Look around to see File Browser and App Launcher</div>
            <div>• Click on files/apps to open virtual windows</div>
            <div>• Enter VR mode with Meta Quest for full experience</div>
            <div style={{ marginTop: '8px', paddingTop: '8px', borderTop: '1px solid rgba(255,255,255,0.3)' }}>
              Windows Open: {windows.length}
            </div>
            {vrStatus && (
              <div>
                SteamVR: {vrStatus.steamvr_running ? '✓ Running' : '✗ Not Detected'}
              </div>
            )}
            {systemInfo && (
              <div>Platform: {systemInfo.platform}</div>
            )}
          </div>
        </div>
      )}

      {/* Controls Help */}
      {!loading && (
        <div
          style={{
            position: 'absolute',
            bottom: 20,
            right: 20,
            background: 'rgba(0, 0, 0, 0.8)',
            color: 'white',
            padding: '15px 20px',
            borderRadius: '8px',
            fontFamily: 'monospace',
            fontSize: '12px',
          }}
          data-testid="controls-panel"
        >
          <div style={{ fontWeight: 'bold', marginBottom: '10px', fontSize: '14px' }}>
            🎮 Controls
          </div>
          <div style={{ opacity: 0.9, lineHeight: '1.6' }}>
            <div><strong>Desktop:</strong></div>
            <div>• WASD - Move</div>
            <div>• Mouse - Look around</div>
            <div>• Click - Interact</div>
            <div style={{ marginTop: '8px' }}><strong>VR:</strong></div>
            <div>• Trigger - Select/Click</div>
            <div>• Grip - Grab window</div>
            <div>• Thumbstick - Move</div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
