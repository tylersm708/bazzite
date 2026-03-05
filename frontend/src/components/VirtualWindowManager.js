import * as BABYLON from '@babylonjs/core';
import * as GUI from '@babylonjs/gui';

export class VirtualWindowManager {
  constructor(scene) {
    this.scene = scene;
    this.windows = new Map();
    this.selectedWindow = null;
  }

  createWindow(windowData) {
    const { id, title, position, size, content_type, content_url } = windowData;

    // Create window frame
    const windowFrame = BABYLON.MeshBuilder.CreatePlane(
      `window_${id}`,
      { width: size.width, height: size.height },
      this.scene
    );

    windowFrame.position = new BABYLON.Vector3(
      position.x,
      position.y,
      position.z
    );

    // Create window material
    const windowMaterial = new BABYLON.StandardMaterial(`windowMat_${id}`, this.scene);
    windowMaterial.diffuseColor = new BABYLON.Color3(0.9, 0.9, 0.95);
    windowMaterial.specularColor = new BABYLON.Color3(0.2, 0.2, 0.2);
    windowMaterial.emissiveColor = new BABYLON.Color3(0.1, 0.1, 0.15);
    windowFrame.material = windowMaterial;

    // Add GUI for window content
    const advancedTexture = GUI.AdvancedDynamicTexture.CreateForMesh(
      windowFrame,
      1024,
      768
    );

    // Window background
    const background = new GUI.Rectangle();
    background.width = 1;
    background.height = 1;
    background.thickness = 0;
    background.background = '#1a1a2e';
    advancedTexture.addControl(background);

    // Title bar
    const titleBar = new GUI.Rectangle();
    titleBar.width = 1;
    titleBar.height = '50px';
    titleBar.thickness = 2;
    titleBar.color = '#4a5568';
    titleBar.background = '#2d3748';
    titleBar.verticalAlignment = GUI.Control.VERTICAL_ALIGNMENT_TOP;
    advancedTexture.addControl(titleBar);

    // Title text
    const titleText = new GUI.TextBlock();
    titleText.text = title;
    titleText.color = 'white';
    titleText.fontSize = 24;
    titleText.textHorizontalAlignment = GUI.Control.HORIZONTAL_ALIGNMENT_LEFT;
    titleText.paddingLeft = '20px';
    titleBar.addControl(titleText);

    // Close button
    const closeButton = GUI.Button.CreateSimpleButton('closeBtn', '✕');
    closeButton.width = '50px';
    closeButton.height = '50px';
    closeButton.color = 'white';
    closeButton.fontSize = 24;
    closeButton.background = '#e53e3e';
    closeButton.horizontalAlignment = GUI.Control.HORIZONTAL_ALIGNMENT_RIGHT;
    closeButton.onPointerUpObservable.add(() => {
      this.closeWindow(id);
    });
    titleBar.addControl(closeButton);

    // Content area
    const contentArea = new GUI.Rectangle();
    contentArea.width = 0.95;
    contentArea.height = 0.85;
    contentArea.thickness = 0;
    contentArea.background = '#0f0f1e';
    contentArea.top = '30px';
    advancedTexture.addControl(contentArea);

    // Content based on type
    if (content_type === 'file') {
      this.renderFileContent(contentArea, content_url);
    } else if (content_type === 'app') {
      this.renderAppContent(contentArea, title);
    } else if (content_type === 'browser') {
      this.renderBrowserContent(contentArea, content_url);
    }

    // Make window interactive
    windowFrame.actionManager = new BABYLON.ActionManager(this.scene);
    
    // Hover effect
    windowFrame.actionManager.registerAction(
      new BABYLON.ExecuteCodeAction(
        BABYLON.ActionManager.OnPointerOverTrigger,
        () => {
          windowMaterial.emissiveColor = new BABYLON.Color3(0.2, 0.2, 0.3);
        }
      )
    );

    windowFrame.actionManager.registerAction(
      new BABYLON.ExecuteCodeAction(
        BABYLON.ActionManager.OnPointerOutTrigger,
        () => {
          windowMaterial.emissiveColor = new BABYLON.Color3(0.1, 0.1, 0.15);
        }
      )
    );

    // Store window data
    this.windows.set(id, {
      mesh: windowFrame,
      data: windowData,
      advancedTexture,
    });

    return windowFrame;
  }

  renderFileContent(container, filePath) {
    const fileText = new GUI.TextBlock();
    fileText.text = `📄 File: ${filePath || 'No file selected'}\n\nFile content would be displayed here.`;
    fileText.color = '#a0aec0';
    fileText.fontSize = 18;
    fileText.textWrapping = true;
    fileText.textVerticalAlignment = GUI.Control.VERTICAL_ALIGNMENT_TOP;
    fileText.paddingTop = '20px';
    fileText.paddingLeft = '20px';
    fileText.paddingRight = '20px';
    container.addControl(fileText);
  }

  renderAppContent(container, appName) {
    const appIcon = new GUI.TextBlock();
    appIcon.text = '🚀';
    appIcon.fontSize = 80;
    appIcon.color = '#63b3ed';
    appIcon.top = '-80px';
    container.addControl(appIcon);

    const appText = new GUI.TextBlock();
    appText.text = `${appName}\n\nApplication running...`;
    appText.color = '#cbd5e0';
    appText.fontSize = 20;
    appText.top = '40px';
    container.addControl(appText);
  }

  renderBrowserContent(container, url) {
    const browserText = new GUI.TextBlock();
    browserText.text = `🌐 Browser\n\n${url || 'about:blank'}\n\nWeb content would be displayed here.`;
    browserText.color = '#90cdf4';
    browserText.fontSize = 18;
    browserText.textWrapping = true;
    container.addControl(browserText);
  }

  updateWindowPosition(id, position) {
    const window = this.windows.get(id);
    if (window) {
      window.mesh.position = new BABYLON.Vector3(
        position.x,
        position.y,
        position.z
      );
    }
  }

  updateWindowSize(id, size) {
    const window = this.windows.get(id);
    if (window) {
      window.mesh.scaling = new BABYLON.Vector3(
        size.width / window.data.size.width,
        size.height / window.data.size.height,
        1
      );
    }
  }

  closeWindow(id) {
    const window = this.windows.get(id);
    if (window) {
      window.mesh.dispose();
      window.advancedTexture.dispose();
      this.windows.delete(id);
      
      // Notify parent component
      if (this.onWindowClose) {
        this.onWindowClose(id);
      }
    }
  }

  getWindow(id) {
    return this.windows.get(id);
  }

  getAllWindows() {
    return Array.from(this.windows.values());
  }

  clearAllWindows() {
    this.windows.forEach((window) => {
      window.mesh.dispose();
      window.advancedTexture.dispose();
    });
    this.windows.clear();
  }
}

export default VirtualWindowManager;
