import React, { useEffect, useRef, useState } from 'react';
import * as BABYLON from '@babylonjs/core';
import { GridMaterial } from '@babylonjs/materials';
import '@babylonjs/loaders';

const VRScene = ({ onSceneReady, onWindowCreate, windows }) => {
  const canvasRef = useRef(null);
  const [vrSupported, setVrSupported] = useState(false);
  const [vrActive, setVrActive] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Create engine
    const engine = new BABYLON.Engine(canvas, true, {
      preserveDrawingBuffer: true,
      stencil: true,
    });

    // Create scene
    const scene = new BABYLON.Scene(engine);
    scene.clearColor = new BABYLON.Color4(0.1, 0.1, 0.15, 1);

    // Create VR camera
    const camera = new BABYLON.UniversalCamera(
      'camera',
      new BABYLON.Vector3(0, 1.6, 0),
      scene
    );
    camera.attachControl(canvas, true);
    camera.speed = 0.1;
    camera.angularSensibility = 2000;

    // Add lights
    const ambientLight = new BABYLON.HemisphericLight(
      'ambientLight',
      new BABYLON.Vector3(0, 1, 0),
      scene
    );
    ambientLight.intensity = 0.6;

    const directionalLight = new BABYLON.DirectionalLight(
      'dirLight',
      new BABYLON.Vector3(-1, -2, -1),
      scene
    );
    directionalLight.intensity = 0.5;

    // Create environment (floor and walls)
    createEnvironment(scene);

    // Setup VR experience
    const vrHelper = scene.createDefaultVRExperience({
      createDeviceOrientationCamera: false,
      useXR: true,
    });

    // Check WebXR support
    if (vrHelper.webVRCamera) {
      setVrSupported(true);
    }

    // XR Setup for Meta Quest
    scene.createDefaultXRExperienceAsync({
      floorMeshes: [scene.getMeshByName('ground')],
      uiOptions: {
        sessionMode: 'immersive-vr',
      },
    }).then((xrHelper) => {
      setVrSupported(true);
      
      xrHelper.baseExperience.onStateChangedObservable.add((state) => {
        if (state === BABYLON.WebXRState.IN_XR) {
          setVrActive(true);
          console.log('VR Session Started');
        } else if (state === BABYLON.WebXRState.NOT_IN_XR) {
          setVrActive(false);
          console.log('VR Session Ended');
        }
      });

      // Controller input
      xrHelper.input.onControllerAddedObservable.add((controller) => {
        controller.onMotionControllerInitObservable.add((motionController) => {
          console.log('Controller connected:', motionController.handness);
          
          // Setup controller interactions
          setupControllerInteractions(controller, motionController, scene);
        });
      });
    }).catch((error) => {
      console.log('WebXR not supported:', error);
      setVrSupported(false);
    });

    // Render loop
    engine.runRenderLoop(() => {
      scene.render();
    });

    // Handle resize
    const handleResize = () => {
      engine.resize();
    };
    window.addEventListener('resize', handleResize);

    // Pass scene to parent
    if (onSceneReady) {
      onSceneReady(scene);
    }

    // Cleanup
    return () => {
      window.removeEventListener('resize', handleResize);
      scene.dispose();
      engine.dispose();
    };
  }, [onSceneReady]);

  // Update windows in scene when windows prop changes
  useEffect(() => {
    // This will be handled by parent component updating scene
  }, [windows]);

  return (
    <div style={{ width: '100%', height: '100vh', position: 'relative' }}>
      <canvas
        ref={canvasRef}
        style={{ width: '100%', height: '100%', display: 'block' }}
        data-testid="vr-canvas"
      />
      
      {/* VR Status Overlay */}
      <div
        style={{
          position: 'absolute',
          top: 20,
          left: 20,
          background: 'rgba(0, 0, 0, 0.7)',
          color: 'white',
          padding: '10px 20px',
          borderRadius: '8px',
          fontFamily: 'monospace',
        }}
        data-testid="vr-status"
      >
        <div>VR Support: {vrSupported ? '✓ Available' : '✗ Not Available'}</div>
        <div>VR Active: {vrActive ? '✓ In VR' : '✗ Desktop Mode'}</div>
        <div style={{ fontSize: '0.8em', marginTop: '5px', opacity: 0.7 }}>
          {vrSupported ? 'Click VR button to enter VR mode' : 'WebXR not supported in this browser'}
        </div>
      </div>
    </div>
  );
};

// Helper function to create the environment
function createEnvironment(scene) {
  // Ground/Floor
  const ground = BABYLON.MeshBuilder.CreateGround(
    'ground',
    { width: 20, height: 20 },
    scene
  );
  const groundMaterial = new BABYLON.StandardMaterial('groundMat', scene);
  groundMaterial.diffuseColor = new BABYLON.Color3(0.2, 0.25, 0.3);
  groundMaterial.specularColor = new BABYLON.Color3(0.1, 0.1, 0.1);
  ground.material = groundMaterial;
  ground.position.y = 0;

  // Grid on floor
  const gridMaterial = new GridMaterial('gridMat', scene);
  gridMaterial.gridRatio = 0.5;
  gridMaterial.majorUnitFrequency = 5;
  gridMaterial.minorUnitVisibility = 0.3;
  gridMaterial.mainColor = new BABYLON.Color3(0.3, 0.4, 0.5);
  gridMaterial.lineColor = new BABYLON.Color3(0.1, 0.15, 0.2);
  gridMaterial.opacity = 0.8;
  ground.material = gridMaterial;

  // Skybox
  const skybox = BABYLON.MeshBuilder.CreateBox('skybox', { size: 1000 }, scene);
  const skyboxMaterial = new BABYLON.StandardMaterial('skyboxMat', scene);
  skyboxMaterial.backFaceCulling = false;
  skyboxMaterial.disableLighting = true;
  skyboxMaterial.diffuseColor = new BABYLON.Color3(0, 0, 0);
  skyboxMaterial.specularColor = new BABYLON.Color3(0, 0, 0);
  skyboxMaterial.emissiveColor = new BABYLON.Color3(0.05, 0.05, 0.1);
  skybox.material = skyboxMaterial;
  skybox.infiniteDistance = true;

  // Add some ambient particles for depth
  createAmbientParticles(scene);
}

// Create ambient particles for visual depth
function createAmbientParticles(scene) {
  const particleSystem = new BABYLON.ParticleSystem('particles', 200, scene);
  
  particleSystem.particleTexture = new BABYLON.Texture(
    'https://raw.githubusercontent.com/BabylonJS/Babylon.js/master/packages/tools/playground/public/textures/flare.png',
    scene
  );

  particleSystem.emitter = new BABYLON.Vector3(0, 2, 0);
  particleSystem.minEmitBox = new BABYLON.Vector3(-10, 0, -10);
  particleSystem.maxEmitBox = new BABYLON.Vector3(10, 5, 10);

  particleSystem.color1 = new BABYLON.Color4(0.3, 0.5, 1, 0.3);
  particleSystem.color2 = new BABYLON.Color4(0.5, 0.7, 1, 0.2);
  particleSystem.colorDead = new BABYLON.Color4(0, 0, 0, 0);

  particleSystem.minSize = 0.05;
  particleSystem.maxSize = 0.15;

  particleSystem.minLifeTime = 5;
  particleSystem.maxLifeTime = 10;

  particleSystem.emitRate = 20;

  particleSystem.direction1 = new BABYLON.Vector3(-0.5, 0.5, -0.5);
  particleSystem.direction2 = new BABYLON.Vector3(0.5, 1, 0.5);

  particleSystem.minEmitPower = 0.1;
  particleSystem.maxEmitPower = 0.3;
  particleSystem.updateSpeed = 0.01;

  particleSystem.start();
}

// Setup controller interactions
function setupControllerInteractions(controller, motionController, scene) {
  const xr_ids = motionController.getComponentIds();

  // Trigger button
  let triggerComponent = motionController.getComponent(xr_ids[0]);
  if (triggerComponent) {
    triggerComponent.onButtonStateChangedObservable.add(() => {
      if (triggerComponent.pressed) {
        console.log('Trigger pressed on', motionController.handness);
        // Handle trigger press - e.g., select/click on UI
      }
    });
  }

  // Grip button
  let gripComponent = motionController.getComponent('xr-standard-squeeze');
  if (gripComponent) {
    gripComponent.onButtonStateChangedObservable.add(() => {
      if (gripComponent.pressed) {
        console.log('Grip pressed on', motionController.handness);
        // Handle grip - e.g., grab window
      }
    });
  }

  // Thumbstick/Touchpad
  let thumbstickComponent = motionController.getComponent('xr-standard-thumbstick');
  if (thumbstickComponent) {
    thumbstickComponent.onAxisValueChangedObservable.add((axes) => {
      // Handle movement with thumbstick
      if (Math.abs(axes.x) > 0.1 || Math.abs(axes.y) > 0.1) {
        console.log('Thumbstick:', axes.x, axes.y);
      }
    });
  }

  // Add pointer ray for controller
  const ray = new BABYLON.Ray(new BABYLON.Vector3(), new BABYLON.Vector3(0, 0, 1));
  const rayHelper = new BABYLON.RayHelper(ray);
  rayHelper.show(scene, new BABYLON.Color3(1, 0, 0));
}

export default VRScene;
