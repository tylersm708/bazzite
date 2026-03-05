import * as BABYLON from '@babylonjs/core';
import * as GUI from '@babylonjs/gui';

export class AppLauncherVR {
  constructor(scene, position = { x: 2, y: 1.5, z: -3 }) {
    this.scene = scene;
    this.position = position;
    this.apps = [];
    this.launcherMesh = null;
    this.advancedTexture = null;
    this.onAppLaunch = null;
  }

  async create() {
    // Create launcher panel
    this.launcherMesh = BABYLON.MeshBuilder.CreatePlane(
      'appLauncher',
      { width: 2, height: 2.5 },
      this.scene
    );

    this.launcherMesh.position = new BABYLON.Vector3(
      this.position.x,
      this.position.y,
      this.position.z
    );

    // Material
    const material = new BABYLON.StandardMaterial('launcherMat', this.scene);
    material.diffuseColor = new BABYLON.Color3(0.15, 0.15, 0.2);
    material.specularColor = new BABYLON.Color3(0.1, 0.1, 0.1);
    material.emissiveColor = new BABYLON.Color3(0.05, 0.05, 0.1);
    this.launcherMesh.material = material;

    // Create GUI
    this.advancedTexture = GUI.AdvancedDynamicTexture.CreateForMesh(
      this.launcherMesh,
      1024,
      1280
    );

    this.renderUI();

    return this.launcherMesh;
  }

  renderUI() {
    // Clear existing controls
    if (this.advancedTexture) {
      this.advancedTexture.dispose();
    }
    
    this.advancedTexture = GUI.AdvancedDynamicTexture.CreateForMesh(
      this.launcherMesh,
      1024,
      1280
    );

    // Background
    const background = new GUI.Rectangle();
    background.width = 1;
    background.height = 1;
    background.thickness = 0;
    background.background = '#1a1a2e';
    this.advancedTexture.addControl(background);

    // Header
    const header = new GUI.Rectangle();
    header.width = 1;
    header.height = '80px';
    header.thickness = 2;
    header.color = '#4a5568';
    header.background = '#2d3748';
    header.verticalAlignment = GUI.Control.VERTICAL_ALIGNMENT_TOP;
    this.advancedTexture.addControl(header);

    const headerText = new GUI.TextBlock();
    headerText.text = '🚀 App Launcher';
    headerText.color = 'white';
    headerText.fontSize = 32;
    headerText.fontWeight = 'bold';
    header.addControl(headerText);

    // Scroll viewer for app grid
    const scrollViewer = new GUI.ScrollViewer();
    scrollViewer.width = 0.95;
    scrollViewer.height = 0.92;
    scrollViewer.thickness = 0;
    scrollViewer.top = '80px';
    scrollViewer.verticalAlignment = GUI.Control.VERTICAL_ALIGNMENT_TOP;
    scrollViewer.barColor = '#4a5568';
    scrollViewer.barBackground = '#2d3748';
    this.advancedTexture.addControl(scrollViewer);

    // App grid container
    const appGrid = new GUI.StackPanel();
    appGrid.width = 1;
    appGrid.isVertical = true;
    appGrid.spacing = 10;
    appGrid.paddingTop = '20px';
    scrollViewer.addControl(appGrid);

    // Render apps
    if (this.apps && this.apps.length > 0) {
      // Group apps in rows of 2
      for (let i = 0; i < this.apps.length; i += 2) {
        const row = new GUI.Container();
        row.width = 1;
        row.height = '180px';
        row.isVertical = false;
        
        // First app in row
        const app1 = this.createAppItem(this.apps[i]);
        app1.left = i % 4 === 0 ? '50px' : '50px';
        row.addControl(app1);
        
        // Second app in row (if exists)
        if (i + 1 < this.apps.length) {
          const app2 = this.createAppItem(this.apps[i + 1]);
          app2.left = '550px';
          row.addControl(app2);
        }
        
        appGrid.addControl(row);
      }
    } else {
      const emptyText = new GUI.TextBlock();
      emptyText.text = 'Loading applications...';
      emptyText.color = '#718096';
      emptyText.fontSize = 20;
      emptyText.height = '100px';
      appGrid.addControl(emptyText);
    }
  }

  createAppItem(app) {
    const appContainer = new GUI.Rectangle();
    appContainer.width = '420px';
    appContainer.height = '160px';
    appContainer.thickness = 2;
    appContainer.color = '#2d3748';
    appContainer.background = '#243142';
    appContainer.cornerRadius = 10;

    // App icon
    const iconContainer = new GUI.Rectangle();
    iconContainer.width = '100px';
    iconContainer.height = '100px';
    iconContainer.thickness = 0;
    iconContainer.background = '#3182ce';
    iconContainer.cornerRadius = 15;
    iconContainer.left = '-130px';
    appContainer.addControl(iconContainer);

    const iconText = new GUI.TextBlock();
    iconText.text = this.getAppIcon(app.category);
    iconText.fontSize = 48;
    iconContainer.addControl(iconText);

    // App name
    const appName = new GUI.TextBlock();
    appName.text = app.name;
    appName.color = 'white';
    appName.fontSize = 22;
    appName.fontWeight = 'bold';
    appName.textHorizontalAlignment = GUI.Control.HORIZONTAL_ALIGNMENT_LEFT;
    appName.paddingLeft = '130px';
    appName.top = '-30px';
    appName.textWrapping = GUI.TextWrapping.WordWrap;
    appContainer.addControl(appName);

    // App category
    const appCategory = new GUI.TextBlock();
    appCategory.text = app.category;
    appCategory.color = '#90cdf4';
    appCategory.fontSize = 16;
    appCategory.textHorizontalAlignment = GUI.Control.HORIZONTAL_ALIGNMENT_LEFT;
    appCategory.paddingLeft = '130px';
    appCategory.top = '20px';
    appContainer.addControl(appCategory);

    // Make clickable
    appContainer.isPointerBlocker = true;
    appContainer.onPointerEnterObservable.add(() => {
      appContainer.background = '#2c5282';
      appContainer.color = '#63b3ed';
    });

    appContainer.onPointerOutObservable.add(() => {
      appContainer.background = '#243142';
      appContainer.color = '#2d3748';
    });

    appContainer.onPointerUpObservable.add(() => {
      if (this.onAppLaunch) {
        this.onAppLaunch(app);
      }
    });

    return appContainer;
  }

  getAppIcon(category) {
    const icons = {
      'System': '⚙️',
      'Internet': '🌐',
      'Utilities': '🔧',
      'Application': '📱',
      'Development': '💻',
      'Graphics': '🎨',
      'Office': '📝',
      'Games': '🎮',
      'Media': '🎵',
    };
    return icons[category] || '📦';
  }

  updateApps(apps) {
    this.apps = apps;
    this.renderUI();
  }

  show() {
    if (this.launcherMesh) {
      this.launcherMesh.setEnabled(true);
    }
  }

  hide() {
    if (this.launcherMesh) {
      this.launcherMesh.setEnabled(false);
    }
  }

  dispose() {
    if (this.advancedTexture) {
      this.advancedTexture.dispose();
    }
    if (this.launcherMesh) {
      this.launcherMesh.dispose();
    }
  }
}

export default AppLauncherVR;
