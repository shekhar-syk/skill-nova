import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { Cpu, Eye, EyeOff, Layers, RotateCcw, Sliders } from 'lucide-react';

const MODELS = [
  {
    id: 'robot-arm',
    label: '6-DOF Robotic Arm',
    subtitle: 'Articulated industrial actuator assembly with harmonic drives and dual servo gripper',
  },
  {
    id: 'ai-chip',
    label: 'AI Accelerator Stack',
    subtitle: 'High-density SoC package, copper bus interconnects, vapor chamber & dual axial shroud',
  },
  {
    id: 'ev-motor',
    label: 'EV BLDC Motor Cutaway',
    subtitle: '12-slot copper stator windings, laminated rotor core, permanent magnet poles & cooling impeller',
  },
];

const FINISHES = {
  titanium: { label: 'Brushed Titanium', primaryColor: 0x94a3b8, metalness: 0.88, roughness: 0.24 },
  ceramic: { label: 'Matte Ceramic', primaryColor: 0xe2e8f0, metalness: 0.14, roughness: 0.62 },
  cobalt: { label: 'Cobalt Alloy', primaryColor: 0x4f46e5, metalness: 0.78, roughness: 0.28 },
};

const CAMERA_PRESETS = {
  iso: { label: 'Iso', pos: [4.6, 3.6, 5.2], target: [0, 0.8, 0] },
  front: { label: 'Front', pos: [0, 1.4, 6.2], target: [0, 0.8, 0] },
  top: { label: 'Top', pos: [0.01, 6.5, 0.01], target: [0, 0.5, 0] },
};

function registerExplodable(group, mesh, restPos, explodeDir, primaryTargets = null, isPrimary = false) {
  mesh.position.copy(restPos);
  mesh.userData.restPos = restPos.clone();
  mesh.userData.explodeDir = explodeDir.clone();
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  group.add(mesh);
  if (primaryTargets && isPrimary) {
    primaryTargets.push(mesh);
  }
}

function buildRobotArm(primaryTargets) {
  const root = new THREE.Group();

  const darkAlloy = new THREE.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.75, roughness: 0.35 });
  const accentViolet = new THREE.MeshStandardMaterial({ color: 0x6d28d9, metalness: 0.62, roughness: 0.26 });
  const chrome = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, metalness: 0.92, roughness: 0.14 });
  const primaryMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8, metalness: 0.88, roughness: 0.24 });

  // 1. Heavy Mounting Plinth
  const basePlate = new THREE.Mesh(new THREE.CylinderGeometry(1.35, 1.48, 0.32, 36), darkAlloy);
  registerExplodable(root, basePlate, new THREE.Vector3(0, 0.16, 0), new THREE.Vector3(0, -0.5, 0));

  // 2. Waist Rotating Turret
  const turret = new THREE.Mesh(new THREE.CylinderGeometry(0.85, 0.95, 0.45, 32), primaryMat);
  registerExplodable(root, turret, new THREE.Vector3(0, 0.58, 0), new THREE.Vector3(0, 0.35, 0), primaryTargets, true);

  // 3. Shoulder Servo Collar
  const shoulderJoint = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.9, 28), accentViolet);
  shoulderJoint.rotation.z = Math.PI / 2;
  registerExplodable(root, shoulderJoint, new THREE.Vector3(0, 1.05, 0), new THREE.Vector3(-0.7, 0.7, 0));

  // 4. Lower Articulated Boom
  const lowerBoom = new THREE.Mesh(new THREE.BoxGeometry(0.46, 1.45, 0.48), primaryMat);
  lowerBoom.rotation.z = -0.24;
  registerExplodable(root, lowerBoom, new THREE.Vector3(0.18, 1.72, 0), new THREE.Vector3(0.4, 1.05, 0), primaryTargets, true);

  // 5. Elbow Harmonic Actuator
  const elbow = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.32, 0.72, 24), accentViolet);
  elbow.rotation.z = Math.PI / 2;
  registerExplodable(root, elbow, new THREE.Vector3(0.36, 2.42, 0), new THREE.Vector3(0.75, 1.3, 0));

  // 6. Forearm Extension Boom
  const upperBoom = new THREE.Mesh(new THREE.BoxGeometry(1.35, 0.34, 0.36), primaryMat);
  upperBoom.rotation.z = 0.22;
  registerExplodable(root, upperBoom, new THREE.Vector3(0.98, 2.58, 0), new THREE.Vector3(1.25, 1.4, 0), primaryTargets, true);

  // 7. Wrist Gimbal Ring
  const wrist = new THREE.Mesh(new THREE.TorusGeometry(0.24, 0.08, 16, 28), chrome);
  wrist.rotation.y = Math.PI / 2;
  registerExplodable(root, wrist, new THREE.Vector3(1.68, 2.74, 0), new THREE.Vector3(1.85, 1.5, 0));

  // 8-9. Dual Parallel Gripper Fingers
  const fingerTop = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.09, 0.14), chrome);
  registerExplodable(root, fingerTop, new THREE.Vector3(1.96, 2.88, 0), new THREE.Vector3(2.3, 1.85, 0));

  const fingerBot = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.09, 0.14), chrome);
  registerExplodable(root, fingerBot, new THREE.Vector3(1.96, 2.6, 0), new THREE.Vector3(2.3, 1.2, 0));

  return root;
}

function buildAiChip(primaryTargets) {
  const root = new THREE.Group();

  const pcbMat = new THREE.MeshStandardMaterial({ color: 0x064e3b, metalness: 0.25, roughness: 0.55 });
  const copperMat = new THREE.MeshStandardMaterial({ color: 0xd97706, metalness: 0.9, roughness: 0.2 });
  const siliconMat = new THREE.MeshStandardMaterial({ color: 0x312e81, metalness: 0.85, roughness: 0.12 });
  const primaryMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8, metalness: 0.88, roughness: 0.24 });
  const accentViolet = new THREE.MeshStandardMaterial({ color: 0x7c3aed, metalness: 0.65, roughness: 0.22 });

  // 1. Multi-layer PCB Substrate
  const pcb = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.18, 2.6), pcbMat);
  registerExplodable(root, pcb, new THREE.Vector3(0, 0.2, 0), new THREE.Vector3(0, -0.7, 0));

  // 2. Gold/Copper Socket Interconnect Frame
  const socketFrame = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.14, 2.1), copperMat);
  registerExplodable(root, socketFrame, new THREE.Vector3(0, 0.38, 0), new THREE.Vector3(0, -0.2, 0));

  // 3. Tensor SoC Silicon Die
  const socDie = new THREE.Mesh(new THREE.BoxGeometry(1.35, 0.16, 1.35), siliconMat);
  registerExplodable(root, socDie, new THREE.Vector3(0, 0.54, 0), new THREE.Vector3(0, 0.35, 0));

  // 4-5. HBM Memory Stacks
  const hbmLeft = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.18, 1.25), accentViolet);
  registerExplodable(root, hbmLeft, new THREE.Vector3(-0.92, 0.55, 0), new THREE.Vector3(-1.0, 0.45, 0));

  const hbmRight = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.18, 1.25), accentViolet);
  registerExplodable(root, hbmRight, new THREE.Vector3(0.92, 0.55, 0), new THREE.Vector3(1.0, 0.45, 0));

  // 6. Copper Vapor Chamber Baseplate
  const vaporPlate = new THREE.Mesh(new THREE.BoxGeometry(2.35, 0.18, 2.05), copperMat);
  registerExplodable(root, vaporPlate, new THREE.Vector3(0, 0.78, 0), new THREE.Vector3(0, 0.95, 0));

  // 7-10. Finned Heatsink Array + Shroud
  for (let i = 0; i < 4; i++) {
    const fin = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.55, 0.12), primaryMat);
    const zOffset = -0.66 + i * 0.44;
    registerExplodable(
      root,
      fin,
      new THREE.Vector3(0, 1.18, zOffset),
      new THREE.Vector3(0, 1.55 + i * 0.12, zOffset * 0.8),
      primaryTargets,
      true
    );
  }

  // 11. Top Shroud Cap
  const shroud = new THREE.Mesh(new THREE.BoxGeometry(2.45, 0.16, 2.15), accentViolet);
  registerExplodable(root, shroud, new THREE.Vector3(0, 1.58, 0), new THREE.Vector3(0, 2.3, 0));

  return root;
}

function buildEvMotor(primaryTargets) {
  const root = new THREE.Group();

  const copperMat = new THREE.MeshStandardMaterial({ color: 0xb45309, metalness: 0.88, roughness: 0.25 });
  const darkIron = new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.82, roughness: 0.35 });
  const chrome = new THREE.MeshStandardMaterial({ color: 0xf1f5f9, metalness: 0.95, roughness: 0.1 });
  const primaryMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8, metalness: 0.88, roughness: 0.24 });
  const accentViolet = new THREE.MeshStandardMaterial({ color: 0x6d28d9, metalness: 0.68, roughness: 0.26 });

  // 1. Outer Finned Housing Cutaway Shell
  const shell = new THREE.Mesh(
    new THREE.CylinderGeometry(1.42, 1.42, 2.1, 36, 1, true, 0.35, Math.PI * 1.55),
    primaryMat
  );
  shell.material.side = THREE.DoubleSide;
  shell.rotation.z = Math.PI / 2;
  registerExplodable(root, shell, new THREE.Vector3(0, 1.45, 0), new THREE.Vector3(0, 1.1, 0), primaryTargets, true);

  // 2. Stator Lamination Ring
  const statorRing = new THREE.Mesh(new THREE.TorusGeometry(1.05, 0.22, 18, 36), darkIron);
  statorRing.rotation.y = Math.PI / 2;
  registerExplodable(root, statorRing, new THREE.Vector3(0, 1.45, 0), new THREE.Vector3(0, 0.5, 0));

  // 3-8. Six Radial Copper Stator Windings
  for (let i = 0; i < 6; i++) {
    const angle = (i / 6) * Math.PI * 2;
    const coil = new THREE.Mesh(new THREE.BoxGeometry(1.25, 0.26, 0.28), copperMat);
    const y = 1.45 + Math.cos(angle) * 0.92;
    const z = Math.sin(angle) * 0.92;
    coil.rotation.x = angle;
    registerExplodable(
      root,
      coil,
      new THREE.Vector3(0, y, z),
      new THREE.Vector3(0, Math.cos(angle) * 1.0, Math.sin(angle) * 1.0)
    );
  }

  // 9. Laminated Permanent-Magnet Rotor Core
  const rotor = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.62, 1.5, 24), accentViolet);
  rotor.rotation.z = Math.PI / 2;
  registerExplodable(root, rotor, new THREE.Vector3(0, 1.45, 0), new THREE.Vector3(-1.1, 0, 0));

  // 10. Hardened Drive Shaft
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 3.2, 20), chrome);
  shaft.rotation.z = Math.PI / 2;
  registerExplodable(root, shaft, new THREE.Vector3(0.25, 1.45, 0), new THREE.Vector3(1.6, 0, 0));

  // 11. Front & Rear End Bells
  const frontBell = new THREE.Mesh(new THREE.CylinderGeometry(1.38, 1.38, 0.22, 32), primaryMat);
  frontBell.rotation.z = Math.PI / 2;
  registerExplodable(root, frontBell, new THREE.Vector3(1.25, 1.45, 0), new THREE.Vector3(1.5, 0, 0), primaryTargets, true);

  const rearBell = new THREE.Mesh(new THREE.CylinderGeometry(1.38, 1.38, 0.22, 32), primaryMat);
  rearBell.rotation.z = Math.PI / 2;
  registerExplodable(root, rearBell, new THREE.Vector3(-1.25, 1.45, 0), new THREE.Vector3(-1.5, 0, 0), primaryTargets, true);

  return root;
}

export default function ThreeLabScene() {
  const containerRef = useRef(null);
  const sceneStateRef = useRef(null);

  const [activeModel, setActiveModel] = useState('robot-arm');
  const [explodeFactor, setExplodeFactor] = useState(0);
  const [finishId, setFinishId] = useState('titanium');
  const [dockVisible, setDockVisible] = useState(true);
  const [autoSpin, setAutoSpin] = useState(true);
  const [contextLost, setContextLost] = useState(false);

  const autoSpinRef = useRef(true);
  useEffect(() => {
    autoSpinRef.current = autoSpin;
  }, [autoSpin]);

  // Keyboard shortcut H toggles bottom control dock
  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.target && ['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName)) return;
      if (e.key === 'h' || e.key === 'H') {
        setDockVisible((prev) => !prev);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  // Main Three.js WebGL lifecycle
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return undefined;

    // Probe WebGL2 before creating the renderer to adapt cost settings cleanly
    const isSoftwareGl = (() => {
      try {
        const probeCanvas = document.createElement('canvas');
        const probeGl = probeCanvas.getContext('webgl2');
        if (!probeGl) return true;
        const ext = probeGl.getExtension('WEBGL_debug_renderer_info');
        const param = ext ? ext.UNMASKED_RENDERER_WEBGL : probeGl.RENDERER;
        const gpu = String(probeGl.getParameter(param) || '');
        probeGl.getExtension('WEBGL_lose_context')?.loseContext();
        return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
      } catch {
        return false;
      }
    })();

    if (isSoftwareGl) {
      setAutoSpin(false);
    }

    let renderer;
    try {
      renderer = new THREE.WebGLRenderer({
        antialias: !isSoftwareGl,
        powerPreference: 'high-performance',
      });
    } catch {
      setContextLost(true);
      return undefined;
    }

    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.setPixelRatio(isSoftwareGl ? 1 : Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.08;
    renderer.shadowMap.enabled = !isSoftwareGl;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.domElement.style.display = 'block';
    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '100%';
    container.appendChild(renderer.domElement);

    const onContextLost = (e) => {
      e.preventDefault();
      setContextLost(true);
    };
    const onContextRestored = () => {
      setContextLost(false);
    };
    renderer.domElement.addEventListener('webglcontextlost', onContextLost);
    renderer.domElement.addEventListener('webglcontextrestored', onContextRestored);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0a0f24);
    scene.fog = new THREE.FogExp2(0x0a0f24, 0.032);

    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    const roomEnv = new RoomEnvironment();
    const envTarget = pmremGenerator.fromScene(roomEnv, 0.04);
    scene.environment = envTarget.texture;
    scene.environmentIntensity = 0.72;
    roomEnv.dispose();
    pmremGenerator.dispose();

    const camera = new THREE.PerspectiveCamera(
      42,
      container.clientWidth / Math.max(1, container.clientHeight),
      0.1,
      100
    );
    camera.position.set(...CAMERA_PRESETS.iso.pos);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = !isSoftwareGl;
    controls.dampingFactor = 0.06;
    controls.minDistance = 2.4;
    controls.maxDistance = 12;
    controls.maxPolarAngle = Math.PI * 0.49;
    controls.target.set(...CAMERA_PRESETS.iso.target);

    // Three-point + Hemisphere lighting
    const hemiLight = new THREE.HemisphereLight(0xdbeafe, 0x1e1b4b, 0.55);
    scene.add(hemiLight);

    const keyLight = new THREE.DirectionalLight(0xfff7ed, 2.3);
    keyLight.position.set(5, 8, 5);
    keyLight.castShadow = !isSoftwareGl;
    keyLight.shadow.mapSize.set(1024, 1024);
    keyLight.shadow.camera.near = 1;
    keyLight.shadow.camera.far = 22;
    keyLight.shadow.camera.left = -4;
    keyLight.shadow.camera.right = 4;
    keyLight.shadow.camera.top = 4;
    keyLight.shadow.camera.bottom = -4;
    keyLight.shadow.bias = -0.0005;
    scene.add(keyLight);

    const rimLight = new THREE.DirectionalLight(0x8b5cf6, 1.0);
    rimLight.position.set(-5, 4, -5);
    scene.add(rimLight);

    // Studio floor + subtle grid
    const floorGeo = new THREE.CircleGeometry(7.5, 48);
    const floorMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.78, metalness: 0.12 });
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = !isSoftwareGl;
    scene.add(floor);

    const grid = new THREE.GridHelper(12, 24, 0x3b82f6, 0x1e293b);
    grid.position.y = 0.004;
    scene.add(grid);

    const modelHolder = new THREE.Group();
    scene.add(modelHolder);

    const primaryTargets = [];

    let disposed = false;
    let frameId = 0;
    let timerId = 0;
    let renderBusy = false;
    let renderDirty = false;
    let lastSpinTime = performance.now();

    function afterDraw(cb) {
      if (disposed) return;
      const gl = renderer.getContext();
      if (gl && typeof gl.fenceSync === 'function') {
        const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
        gl.flush();
        const poll = () => {
          if (disposed) {
            if (sync) gl.deleteSync(sync);
            return;
          }
          const state = sync && gl.getSyncParameter(sync, gl.SYNC_STATUS);
          if (state === gl.UNSIGNALED) {
            timerId = window.setTimeout(poll, 5);
          } else {
            if (sync) gl.deleteSync(sync);
            timerId = window.setTimeout(cb, 80);
          }
        };
        timerId = window.setTimeout(poll, 5);
      } else {
        timerId = window.setTimeout(cb, 80);
      }
    }

    function requestRender() {
      if (disposed) return;
      if (renderBusy) {
        renderDirty = true;
        return;
      }
      renderBusy = true;
      frameId = requestAnimationFrame(() => {
        if (disposed) return;
        renderDirty = false;
        const now = performance.now();
        const elapsedSec = Math.min((now - lastSpinTime) / 1000, 0.1);
        lastSpinTime = now;

        if (autoSpinRef.current && sceneStateRef.current?.currentGroup) {
          sceneStateRef.current.currentGroup.rotation.y += elapsedSec * 0.35;
        }
        controls.update();
        renderer.render(scene, camera);

        const done = () => {
          renderBusy = false;
          if (disposed) return;
          if (renderDirty || autoSpinRef.current) {
            requestRender();
          }
        };
        if (isSoftwareGl) {
          afterDraw(done);
        } else {
          done();
        }
      });
    }

    sceneStateRef.current = {
      scene,
      camera,
      controls,
      modelHolder,
      primaryTargets,
      currentGroup: null,
      requestRender,
      isSoftwareGl,
    };

    const onControlsChange = () => requestRender();
    controls.addEventListener('change', onControlsChange);

    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const w = entry.contentRect.width;
        const h = entry.contentRect.height;
        if (w > 0 && h > 0) {
          camera.aspect = w / h;
          camera.updateProjectionMatrix();
          renderer.setSize(w, h);
          requestRender();
        }
      }
    });
    resizeObserver.observe(container);

    requestRender();

    return () => {
      disposed = true;
      cancelAnimationFrame(frameId);
      window.clearTimeout(timerId);
      controls.removeEventListener('change', onControlsChange);
      resizeObserver.disconnect();
      renderer.domElement.removeEventListener('webglcontextlost', onContextLost);
      renderer.domElement.removeEventListener('webglcontextrestored', onContextRestored);

      scene.traverse((obj) => {
        if (obj.geometry) obj.geometry.dispose();
        if (obj.material) {
          if (Array.isArray(obj.material)) {
            obj.material.forEach((m) => m.dispose());
          } else {
            obj.material.dispose();
          }
        }
      });

      envTarget.dispose();
      controls.dispose();
      renderer.dispose();
      if (renderer.domElement.parentNode === container) {
        container.removeChild(renderer.domElement);
      }
      sceneStateRef.current = null;
    };
  }, []);

  // Swap active assembly cleanly
  useEffect(() => {
    const state = sceneStateRef.current;
    if (!state) return;

    if (state.currentGroup) {
      state.currentGroup.traverse((obj) => {
        if (obj.geometry) obj.geometry.dispose();
        if (obj.material) {
          if (Array.isArray(obj.material)) obj.material.forEach((m) => m.dispose());
          else obj.material.dispose();
        }
      });
      state.modelHolder.remove(state.currentGroup);
    }

    state.primaryTargets.length = 0;
    let group;
    if (activeModel === 'ai-chip') {
      group = buildAiChip(state.primaryTargets);
    } else if (activeModel === 'ev-motor') {
      group = buildEvMotor(state.primaryTargets);
    } else {
      group = buildRobotArm(state.primaryTargets);
    }

    state.currentGroup = group;
    state.modelHolder.add(group);
    setExplodeFactor(0);
    state.requestRender();
  }, [activeModel]);

  // Apply Exploded View displacement
  useEffect(() => {
    const state = sceneStateRef.current;
    const group = state?.currentGroup;
    if (!group) return;
    group.children.forEach((mesh) => {
      if (mesh.userData.restPos && mesh.userData.explodeDir) {
        mesh.position.copy(mesh.userData.restPos).addScaledVector(mesh.userData.explodeDir, explodeFactor);
      }
    });
    state.requestRender();
  }, [explodeFactor, activeModel]);

  // Apply Material Finish
  useEffect(() => {
    const state = sceneStateRef.current;
    const targets = state?.primaryTargets;
    const finish = FINISHES[finishId];
    if (!targets || !finish) return;
    targets.forEach((mesh) => {
      if (mesh.material) {
        mesh.material.color.setHex(finish.primaryColor);
        mesh.material.metalness = finish.metalness;
        mesh.material.roughness = finish.roughness;
      }
    });
    state.requestRender();
  }, [finishId, activeModel]);

  // Resume render loop when autoSpin toggles back on
  useEffect(() => {
    if (autoSpin) {
      sceneStateRef.current?.requestRender();
    }
  }, [autoSpin]);

  const applyCameraPreset = (presetKey) => {
    const state = sceneStateRef.current;
    const preset = CAMERA_PRESETS[presetKey];
    if (!state || !preset) return;
    state.camera.position.set(...preset.pos);
    state.controls.target.set(...preset.target);
    state.controls.update();
    state.requestRender();
  };

  const resetAll = () => {
    setExplodeFactor(0);
    setFinishId('titanium');
    const isSoft = sceneStateRef.current?.isSoftwareGl;
    setAutoSpin(!isSoft);
    if (sceneStateRef.current?.currentGroup) {
      sceneStateRef.current.currentGroup.rotation.set(0, 0, 0);
    }
    applyCameraPreset('iso');
  };

  const currentMeta = MODELS.find((m) => m.id === activeModel) || MODELS[0];

  return (
    <div className="relative w-full h-[540px] rounded-2xl overflow-hidden border border-slate-800 bg-[#0A0F24]">
      {/* Dedicated WebGL Mount Node */}
      <div ref={containerRef} className="w-full h-full" />

      {/* Top Left Compact Specimen Label */}
      <div className="pointer-events-none absolute top-4 left-4 bg-[#0A0F24]/90 border border-slate-700/80 rounded-xl px-3.5 py-2.5 max-w-xs">
        <p className="text-[11px] font-semibold text-violet-400">
          Interactive 3D Hardware Lab
        </p>
        <p className="font-display text-sm font-bold text-white mt-0.5">{currentMeta.label}</p>
        <p className="text-[11px] text-slate-300 mt-0.5 leading-snug">{currentMeta.subtitle}</p>
      </div>

      {/* Top Right Dock Show/Hide Button */}
      <button
        type="button"
        onClick={() => setDockVisible((v) => !v)}
        className="absolute top-4 right-4 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#0A0F24]/90 border border-slate-700 text-xs font-medium text-slate-200 hover:border-violet-400 cursor-pointer"
        title="Toggle controls (Hotkey: H)"
      >
        {dockVisible ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
        {dockVisible ? 'Hide Dock (H)' : 'Controls (H)'}
      </button>

      {contextLost && (
        <div className="absolute inset-0 bg-[#0A0F24]/95 flex flex-col items-center justify-center p-6 text-center text-white">
          <Cpu className="w-10 h-10 text-amber-400 mb-3" />
          <p className="font-display text-lg font-bold">WebGL Graphics Context Paused</p>
          <p className="text-xs text-slate-300 mt-1 max-w-md">
            Your browser temporarily reclaimed the 3D hardware context. Refresh or switch tabs to restore the viewport.
          </p>
        </div>
      )}

      {/* Single Collapsible Bottom Control Dock */}
      {dockVisible && (
        <div className="absolute bottom-4 left-4 right-4 bg-[#0A0F24]/95 border border-slate-700 rounded-xl px-4 py-3 flex flex-wrap items-center justify-between gap-4 text-xs text-slate-200">
          {/* Model Selector */}
          <div className="flex flex-wrap items-center gap-1.5">
            {MODELS.map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => setActiveModel(m.id)}
                className={`px-2.5 py-1.5 rounded-lg font-medium transition-colors cursor-pointer ${
                  activeModel === m.id
                    ? 'bg-violet-600 text-white'
                    : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>

          {/* Exploded View Slider */}
          <label className="flex items-center gap-2">
            <Layers className="w-3.5 h-3.5 text-violet-400" />
            <span className="font-mono text-[11px] whitespace-nowrap">Explode</span>
            <input
              type="range"
              min="0"
              max="1"
              step="0.02"
              value={explodeFactor}
              onChange={(e) => setExplodeFactor(Number(e.target.value))}
              className="w-24 accent-violet-500 cursor-pointer"
            />
          </label>

          {/* Finish & Camera Presets */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1">
              <Sliders className="w-3.5 h-3.5 text-slate-400" />
              <select
                value={finishId}
                onChange={(e) => setFinishId(e.target.value)}
                aria-label="Surface material finish"
                className="px-2 py-1 rounded bg-slate-800 border border-slate-700 text-xs text-slate-100"
              >
                {Object.entries(FINISHES).map(([key, item]) => (
                  <option key={key} value={key}>
                    {item.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-1">
              {Object.entries(CAMERA_PRESETS).map(([key, preset]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => applyCameraPreset(key)}
                  className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 cursor-pointer"
                >
                  {preset.label}
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={() => setAutoSpin((s) => !s)}
              className={`px-2 py-1 rounded cursor-pointer ${
                autoSpin ? 'bg-violet-900/70 text-violet-200 border border-violet-600' : 'bg-slate-800 text-slate-300'
              }`}
            >
              {autoSpin ? 'Spin On' : 'Spin Off'}
            </button>

            <button
              type="button"
              onClick={resetAll}
              className="p-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 cursor-pointer"
              title="Reset view"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
