import * as BABYLON from '@babylonjs/core';
import * as GUI from '@babylonjs/gui';

export class FileBrowserVR {
  constructor(scene, position = { x: -2, y: 1.5, z: -3 }) {
    this.scene = scene;
    this.position = position;
    this.currentPath = null;
    this.files = [];
    this.browserMesh = null;
    this.advancedTexture = null;
    this.onFileSelect = null;
    this.onFolderNavigate = null;
  }

  async create() {
    // Create browser panel
    this.browserMesh = BABYLON.MeshBuilder.CreatePlane(
      'fileBrowser',
      { width: 2, height: 2.5 },
      this.scene
    );

    this.browserMesh.position = new BABYLON.Vector3(
      this.position.x,
      this.position.y,
      this.position.z
    );

    // Material
    const material = new BABYLON.StandardMaterial('browserMat', this.scene);
    material.diffuseColor = new BABYLON.Color3(0.15, 0.15, 0.2);
    material.specularColor = new BABYLON.Color3(0.1, 0.1, 0.1);
    material.emissiveColor = new BABYLON.Color3(0.05, 0.05, 0.1);
    this.browserMesh.material = material;

    // Create GUI
    this.advancedTexture = GUI.AdvancedDynamicTexture.CreateForMesh(
      this.browserMesh,
      1024,
      1280
    );

    this.renderUI();

    return this.browserMesh;
  }

  renderUI() {
    // Clear existing controls
    this.advancedTexture.dispose();
    this.advancedTexture = GUI.AdvancedDynamicTexture.CreateForMesh(
      this.browserMesh,
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
    headerText.text = '📁 File Browser';
    headerText.color = 'white';
    headerText.fontSize = 32;
    headerText.fontWeight = 'bold';
    header.addControl(headerText);

    // Current path display
    const pathBar = new GUI.Rectangle();
    pathBar.width = 1;
    pathBar.height = '60px';
    pathBar.thickness = 1;
    pathBar.color = '#2d3748';
    pathBar.background = '#16213e';
    pathBar.verticalAlignment = GUI.Control.VERTICAL_ALIGNMENT_TOP;
    pathBar.top = '80px';
    this.advancedTexture.addControl(pathBar);

    const pathText = new GUI.TextBlock();
    pathText.text = this.currentPath || 'Loading...';
    pathText.color = '#90cdf4';
    pathText.fontSize = 18;
    pathText.textHorizontalAlignment = GUI.Control.HORIZONTAL_ALIGNMENT_LEFT;
    pathText.paddingLeft = '20px';
    pathText.textWrapping = GUI.TextWrapping.Ellipsis;
    pathBar.addControl(pathText);

    // Scroll viewer for file list
    const scrollViewer = new GUI.ScrollViewer();
    scrollViewer.width = 0.95;
    scrollViewer.height = 0.82;
    scrollViewer.thickness = 0;
    scrollViewer.top = '140px';
    scrollViewer.verticalAlignment = GUI.Control.VERTICAL_ALIGNMENT_TOP;
    scrollViewer.barColor = '#4a5568';
    scrollViewer.barBackground = '#2d3748';
    this.advancedTexture.addControl(scrollViewer);

    // File list container
    const fileList = new GUI.StackPanel();
    fileList.width = 1;
    fileList.isVertical = true;
    fileList.spacing = 5;
    scrollViewer.addControl(fileList);

    // Render files
    if (this.files && this.files.length > 0) {
      this.files.forEach((file, index) => {
        const fileItem = this.createFileItem(file, index);
        fileList.addControl(fileItem);
      });
    } else {
      const emptyText = new GUI.TextBlock();
      emptyText.text = 'No files to display';
      emptyText.color = '#718096';
      emptyText.fontSize = 20;
      emptyText.height = '100px';
      fileList.addControl(emptyText);
    }
  }

  createFileItem(file, index) {
    const itemContainer = new GUI.Rectangle();
    itemContainer.width = 0.95;
    itemContainer.height = '80px';
    itemContainer.thickness = 1;
    itemContainer.color = '#2d3748';
    itemContainer.background = index % 2 === 0 ? '#1e2936' : '#243142';
    itemContainer.cornerRadius = 5;

    // Icon
    const icon = new GUI.TextBlock();
    icon.text = file.type === 'directory' ? '📁' : '📄';
    icon.fontSize = 32;
    icon.width = '80px';
    icon.horizontalAlignment = GUI.Control.HORIZONTAL_ALIGNMENT_LEFT;
    itemContainer.addControl(icon);

    // File name
    const fileName = new GUI.TextBlock();
    fileName.text = file.name;
    fileName.color = 'white';
    fileName.fontSize = 22;
    fileName.textHorizontalAlignment = GUI.Control.HORIZONTAL_ALIGNMENT_LEFT;
    fileName.paddingLeft = '100px';
    fileName.textWrapping = GUI.TextWrapping.Ellipsis;
    itemContainer.addControl(fileName);

    // File size (if file)
    if (file.type === 'file' && file.size) {
      const sizeText = new GUI.TextBlock();
      sizeText.text = this.formatFileSize(file.size);
      sizeText.color = '#a0aec0';
      sizeText.fontSize = 16;
      sizeText.horizontalAlignment = GUI.Control.HORIZONTAL_ALIGNMENT_RIGHT;
      sizeText.paddingRight = '20px';
      itemContainer.addControl(sizeText);
    }

    // Make clickable
    itemContainer.isPointerBlocker = true;
    itemContainer.onPointerEnterObservable.add(() => {
      itemContainer.background = '#3182ce';
    });

    itemContainer.onPointerOutObservable.add(() => {
      itemContainer.background = index % 2 === 0 ? '#1e2936' : '#243142';
    });

    itemContainer.onPointerUpObservable.add(() => {
      if (file.type === 'directory') {
        if (this.onFolderNavigate) {
          this.onFolderNavigate(file.path);
        }
      } else {
        if (this.onFileSelect) {
          this.onFileSelect(file);
        }
      }
    });

    return itemContainer;
  }

  updateFiles(files, currentPath) {
    this.files = files;
    this.currentPath = currentPath;
    this.renderUI();
  }

  formatFileSize(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  show() {
    if (this.browserMesh) {
      this.browserMesh.setEnabled(true);
    }
  }

  hide() {
    if (this.browserMesh) {
      this.browserMesh.setEnabled(false);
    }
  }

  dispose() {
    if (this.advancedTexture) {
      this.advancedTexture.dispose();
    }
    if (this.browserMesh) {
      this.browserMesh.dispose();
    }
  }
}

export default FileBrowserVR;
