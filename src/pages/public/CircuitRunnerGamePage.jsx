import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import * as THREE from 'three';
import { ArrowLeft, Award, Pause, Play, RotateCcw, Volume2, VolumeX } from 'lucide-react';
import { gameAudio } from '../../components/WebAudioSynth.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { api } from '../../services/api.js';

const STAGES = [
  { id: 1, name: 'Stage 1: Signal Grid', targetNodes: 14, speed: 17, obstacleRate: 0.95 },
  { id: 2, name: 'Stage 2: Core Bus', targetNodes: 20, speed: 22, obstacleRate: 0.72 },
  { id: 3, name: 'Stage 3: Overclock Matrix', targetNodes: 26, speed: 27, obstacleRate: 0.56 },
];

const LANES = [-3.6, -1.8, 0, 1.8, 3.6];

function buildRoverMesh() {
  const rover = new THREE.Group();

  const hullMat = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, metalness: 0.72, roughness: 0.24 });
  const violetMat = new THREE.MeshStandardMaterial({ color: 0x7c3aed, metalness: 0.55, roughness: 0.22, emissive: 0x3b0764, emissiveIntensity: 0.5 });
  const cyanMat = new THREE.MeshStandardMaterial({ color: 0x38bdf8, emissive: 0x0284c7, emissiveIntensity: 0.9, roughness: 0.15 });
  const tireMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.8, metalness: 0.2 });

  const chassis = new THREE.Mesh(new THREE.BoxGeometry(1.15, 0.36, 1.75), hullMat);
  chassis.position.y = 0.38;
  chassis.castShadow = true;
  rover.add(chassis);

  const canopy = new THREE.Mesh(new THREE.BoxGeometry(0.76, 0.24, 0.85), violetMat);
  canopy.position.set(0, 0.64, -0.05);
  rover.add(canopy);

  const coreStrip = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.08, 1.45), cyanMat);
  coreStrip.position.set(0, 0.58, 0);
  rover.add(coreStrip);

  const wheelGeo = new THREE.CylinderGeometry(0.24, 0.24, 0.22, 16);
  wheelGeo.rotateZ(Math.PI / 2);
  [
    [-0.68, 0.24, 0.58],
    [0.68, 0.24, 0.58],
    [-0.68, 0.24, -0.58],
    [0.68, 0.24, -0.58],
  ].forEach(([x, y, z]) => {
    const w = new THREE.Mesh(wheelGeo, tireMat);
    w.position.set(x, y, z);
    rover.add(w);
  });

  return rover;
}

export default function CircuitRunnerGamePage() {
  const { user } = useAuth();
  const mountRef = useRef(null);

  const [gameState, setGameState] = useState('TITLE'); // TITLE | PLAYING | PAUSED | VICTORY | GAMEOVER
  const [stageId, setStageId] = useState(1);
  const [muted, setMuted] = useState(false);
  const [contextLost, setContextLost] = useState(false);

  const [hud, setHud] = useState({
    score: 0,
    nodes: 0,
    targetNodes: 14,
    shields: 3,
    boostReady: 100,
  });

  const [rewardStatus, setRewardStatus] = useState(null);

  const gameStateRef = useRef(gameState);
  const stageIdRef = useRef(stageId);
  const inputRef = useRef({ left: false, right: false, boost: false });
  const resetTriggerRef = useRef(null);

  useEffect(() => {
    gameStateRef.current = gameState;
  }, [gameState]);

  useEffect(() => {
    stageIdRef.current = stageId;
  }, [stageId]);

  useEffect(() => {
    gameAudio.setMuted(muted);
  }, [muted]);

  const awardStageXp = async (clearedStageId, finalScore) => {
    if (!user) {
      setRewardStatus({ guest: true, message: 'Sign in to credit +25 XP per cleared stage to your SkillNova profile.' });
      return;
    }
    try {
      const res = await api.post('/gamification/game-reward', {
        stage: clearedStageId,
        score: finalScore,
      });
      if (res.data.awarded) {
        setRewardStatus({ awarded: true, message: `+${res.data.pointsAdded} XP credited to your SkillNova Ledger!` });
      } else {
        setRewardStatus({ awarded: false, message: 'Stage cleared! Stage mastery XP already earned previously.' });
      }
    } catch {
      setRewardStatus({ error: true, message: 'Stage cleared! (XP sync unavailable right now.)' });
    }
  };

  const startMission = (selectedStage = stageId) => {
    setStageId(selectedStage);
    stageIdRef.current = selectedStage;
    setRewardStatus(null);
    if (resetTriggerRef.current) resetTriggerRef.current(selectedStage);
    setGameState('PLAYING');
  };

  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') inputRef.current.left = true;
      if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') inputRef.current.right = true;
      if (e.key === ' ' || e.code === 'Space') {
        if (gameStateRef.current === 'PLAYING') {
          e.preventDefault();
          inputRef.current.boost = true;
        }
      }
      if (e.key === 'Enter' && gameStateRef.current === 'TITLE') {
        startMission(stageIdRef.current);
      }
      if (e.key === 'p' || e.key === 'P' || e.key === 'Escape') {
        if (gameStateRef.current === 'PLAYING') setGameState('PAUSED');
        else if (gameStateRef.current === 'PAUSED') setGameState('PLAYING');
      }
    };

    const onKeyUp = (e) => {
      if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') inputRef.current.left = false;
      if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') inputRef.current.right = false;
      if (e.key === ' ' || e.code === 'Space') inputRef.current.boost = false;
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, []);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return undefined;

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
    renderer.toneMappingExposure = 1.1;
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
    scene.background = new THREE.Color(0x060918);
    scene.fog = new THREE.Fog(0x060918, 22, 92);

    const camera = new THREE.PerspectiveCamera(58, container.clientWidth / Math.max(1, container.clientHeight), 0.1, 120);
    camera.position.set(0, 4.4, 8.2);
    camera.lookAt(0, 0.8, -12);

    const hemi = new THREE.HemisphereLight(0xa5b4fc, 0x090d1f, 0.85);
    scene.add(hemi);

    const keyLight = new THREE.DirectionalLight(0xffffff, 2.0);
    keyLight.position.set(6, 12, 8);
    scene.add(keyLight);

    // Track Surface + Moving Grid
    const trackMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.72, metalness: 0.25 });
    const track = new THREE.Mesh(new THREE.PlaneGeometry(11, 140), trackMat);
    track.rotation.x = -Math.PI / 2;
    track.position.z = -52;
    scene.add(track);

    const gridHelper = new THREE.GridHelper(110, 48, 0x6d28d9, 0x1e293b);
    gridHelper.position.set(0, 0.015, -45);
    scene.add(gridHelper);

    // Side glowing rails
    const railMat = new THREE.MeshStandardMaterial({ color: 0x38bdf8, emissive: 0x0284c7, emissiveIntensity: 0.8 });
    const leftRail = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.18, 140), railMat);
    leftRail.position.set(-5.2, 0.09, -52);
    scene.add(leftRail);
    const rightRail = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.18, 140), railMat);
    rightRail.position.set(5.2, 0.09, -52);
    scene.add(rightRail);

    const rover = buildRoverMesh();
    scene.add(rover);

    // InstancedMesh pools for Logic Nodes (collectibles) & Firewall Barriers (hazards)
    const MAX_NODES = 24;
    const MAX_HAZARDS = 24;

    const nodeGeo = new THREE.OctahedronGeometry(0.42, 0);
    const nodeMat = new THREE.MeshStandardMaterial({
      color: 0x38bdf8,
      emissive: 0x0ea5e9,
      emissiveIntensity: 1.1,
      roughness: 0.15,
      metalness: 0.6,
    });
    const nodeInstanced = new THREE.InstancedMesh(nodeGeo, nodeMat, MAX_NODES);
    scene.add(nodeInstanced);

    const hazardGeo = new THREE.BoxGeometry(1.32, 0.95, 0.9);
    const hazardMat = new THREE.MeshStandardMaterial({
      color: 0xf43f5e,
      emissive: 0xbe123c,
      emissiveIntensity: 0.7,
      roughness: 0.35,
      metalness: 0.4,
    });
    const hazardInstanced = new THREE.InstancedMesh(hazardGeo, hazardMat, MAX_HAZARDS);
    scene.add(hazardInstanced);

    const dummy = new THREE.Object3D();

    const sim = {
      roverX: 0,
      targetLaneX: 0,
      score: 0,
      nodesCollected: 0,
      shields: 3,
      boostCharge: 100,
      boostActiveTimer: 0,
      invulnTimer: 0,
      spawnTimer: 0,
      activeNodes: [],
      activeHazards: [],
    };

    const syncHud = () => {
      const stageCfg = STAGES.find((s) => s.id === stageIdRef.current) || STAGES[0];
      setHud({
        score: Math.round(sim.score),
        nodes: sim.nodesCollected,
        targetNodes: stageCfg.targetNodes,
        shields: sim.shields,
        boostReady: Math.round(sim.boostCharge),
      });
    };

    const resetSim = (stageNum) => {
      sim.roverX = 0;
      sim.score = 0;
      sim.nodesCollected = 0;
      sim.shields = 3;
      sim.boostCharge = 100;
      sim.boostActiveTimer = 0;
      sim.invulnTimer = 0;
      sim.spawnTimer = 0.25;
      sim.activeNodes = [];
      sim.activeHazards = [];
      rover.position.set(0, 0, 0);
      rover.rotation.set(0, 0, 0);
      const st = STAGES.find((s) => s.id === stageNum) || STAGES[0];
      setHud({
        score: 0,
        nodes: 0,
        targetNodes: st.targetNodes,
        shields: 3,
        boostReady: 100,
      });
    };

    resetTriggerRef.current = resetSim;

    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const w = entry.contentRect.width;
        const h = entry.contentRect.height;
        if (w > 0 && h > 0) {
          camera.aspect = w / h;
          camera.updateProjectionMatrix();
          renderer.setSize(w, h);
        }
      }
    });
    resizeObserver.observe(container);

    const clock = new THREE.Clock();
    let rafId = 0;
    let timerId = 0;
    let disposed = false;

    const afterDraw = (cb) => {
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
    };

    const scheduleNext = (tickFn) => {
      if (disposed) return;
      if (isSoftwareGl) {
        afterDraw(tickFn);
      } else {
        rafId = requestAnimationFrame(tickFn);
      }
    };

    const updateInstances = (elapsed) => {
      for (let i = 0; i < MAX_NODES; i++) {
        const item = sim.activeNodes[i];
        if (item) {
          dummy.position.set(item.x, 0.58 + Math.sin(elapsed * 4 + i) * 0.12, item.z);
          dummy.rotation.set(0, elapsed * 2.4 + i, 0);
          dummy.scale.setScalar(1);
        } else {
          dummy.position.set(0, -40, 0);
          dummy.scale.setScalar(0.001);
        }
        dummy.updateMatrix();
        nodeInstanced.setMatrixAt(i, dummy.matrix);
      }
      nodeInstanced.instanceMatrix.needsUpdate = true;

      for (let i = 0; i < MAX_HAZARDS; i++) {
        const item = sim.activeHazards[i];
        if (item) {
          dummy.position.set(item.x, 0.48, item.z);
          dummy.rotation.set(0, 0, 0);
          dummy.scale.setScalar(1);
        } else {
          dummy.position.set(0, -40, 0);
          dummy.scale.setScalar(0.001);
        }
        dummy.updateMatrix();
        hazardInstanced.setMatrixAt(i, dummy.matrix);
      }
      hazardInstanced.instanceMatrix.needsUpdate = true;
    };

    const animate = () => {
      if (disposed) return;
      const dt = Math.min(clock.getDelta(), 0.1);
      const elapsed = clock.elapsedTime;
      const mode = gameStateRef.current;

      if (mode === 'TITLE') {
        rover.position.set(0, 0.12 + Math.sin(elapsed * 2) * 0.05, 0);
        rover.rotation.y = elapsed * 0.55;
        rover.rotation.z = 0;
        camera.position.set(Math.sin(elapsed * 0.25) * 2.2, 3.2, 6.2);
        camera.lookAt(0, 0.5, 0);
        updateInstances(elapsed);
        renderer.render(scene, camera);
        scheduleNext(animate);
        return;
      }

      if (mode !== 'PLAYING') {
        updateInstances(elapsed);
        renderer.render(scene, camera);
        scheduleNext(animate);
        return;
      }

      const stageCfg = STAGES.find((s) => s.id === stageIdRef.current) || STAGES[0];
      camera.position.lerp(new THREE.Vector3(sim.roverX * 0.35, 4.4, 8.2), 0.12);
      camera.lookAt(sim.roverX * 0.25, 0.7, -12);

      // Steering
      const steerDir = (inputRef.current.right ? 1 : 0) - (inputRef.current.left ? 1 : 0);
      sim.roverX = THREE.MathUtils.clamp(sim.roverX + steerDir * 10.5 * dt, -4.1, 4.1);
      rover.position.x = sim.roverX;
      rover.position.y = 0;
      rover.rotation.y = THREE.MathUtils.lerp(rover.rotation.y, -steerDir * 0.18, 0.2);
      rover.rotation.z = THREE.MathUtils.lerp(rover.rotation.z, -steerDir * 0.14, 0.2);

      // Boost mechanic
      if (inputRef.current.boost && sim.boostCharge >= 35 && sim.boostActiveTimer <= 0) {
        sim.boostActiveTimer = 1.6;
        sim.boostCharge = Math.max(0, sim.boostCharge - 50);
        gameAudio.playBoost();
      }
      if (sim.boostActiveTimer > 0) {
        sim.boostActiveTimer = Math.max(0, sim.boostActiveTimer - dt);
      } else {
        sim.boostCharge = Math.min(100, sim.boostCharge + dt * 14);
      }

      if (sim.invulnTimer > 0) {
        sim.invulnTimer = Math.max(0, sim.invulnTimer - dt);
        rover.visible = Math.floor(elapsed * 16) % 2 === 0;
      } else {
        rover.visible = true;
      }

      const speed = stageCfg.speed * (sim.boostActiveTimer > 0 ? 1.55 : 1);
      gridHelper.position.z = ((gridHelper.position.z + speed * dt + 45) % 4.58) - 45;
      sim.score += speed * dt * 1.5;

      // Spawner
      sim.spawnTimer -= dt;
      if (sim.spawnTimer <= 0) {
        sim.spawnTimer = stageCfg.obstacleRate / (sim.boostActiveTimer > 0 ? 1.3 : 1);
        const laneIdx = Math.floor(Math.random() * LANES.length);
        const isNode = Math.random() < 0.56;
        if (isNode && sim.activeNodes.length < MAX_NODES) {
          sim.activeNodes.push({ x: LANES[laneIdx], z: -78 });
        } else if (!isNode && sim.activeHazards.length < MAX_HAZARDS) {
          sim.activeHazards.push({ x: LANES[laneIdx], z: -78 });
        }
      }

      // Advance & check collisions for nodes
      for (let i = sim.activeNodes.length - 1; i >= 0; i--) {
        const node = sim.activeNodes[i];
        node.z += speed * dt;
        if (Math.abs(node.z) < 1.05 && Math.abs(node.x - sim.roverX) < 1.08) {
          sim.activeNodes.splice(i, 1);
          sim.nodesCollected += 1;
          sim.score += 100;
          gameAudio.playCollect();

          if (sim.nodesCollected >= stageCfg.targetNodes) {
            gameAudio.playVictory();
            syncHud();
            updateInstances(elapsed);
            renderer.render(scene, camera);
            setGameState('VICTORY');
            awardStageXp(stageCfg.id, sim.score);
            scheduleNext(animate);
            return;
          }
          continue;
        }
        if (node.z > 8) sim.activeNodes.splice(i, 1);
      }

      // Advance & check collisions for hazards
      for (let i = sim.activeHazards.length - 1; i >= 0; i--) {
        const haz = sim.activeHazards[i];
        haz.z += speed * dt;
        if (
          sim.invulnTimer <= 0 &&
          sim.boostActiveTimer <= 0 &&
          Math.abs(haz.z) < 1.05 &&
          Math.abs(haz.x - sim.roverX) < 1.15
        ) {
          sim.activeHazards.splice(i, 1);
          sim.shields -= 1;
          sim.invulnTimer = 1.4;
          gameAudio.playHit();
          if (sim.shields <= 0) {
            syncHud();
            updateInstances(elapsed);
            renderer.render(scene, camera);
            setGameState('GAMEOVER');
            scheduleNext(animate);
            return;
          }
          continue;
        }
        if (haz.z > 8) sim.activeHazards.splice(i, 1);
      }

      syncHud();
      updateInstances(elapsed);
      renderer.render(scene, camera);
      scheduleNext(animate);
    };

    rafId = requestAnimationFrame(animate);

    return () => {
      disposed = true;
      cancelAnimationFrame(rafId);
      window.clearTimeout(timerId);
      resizeObserver.disconnect();
      renderer.domElement.removeEventListener('webglcontextlost', onContextLost);
      renderer.domElement.removeEventListener('webglcontextrestored', onContextRestored);
      scene.traverse((obj) => {
        if (obj.geometry) obj.geometry.dispose();
        if (obj.material) {
          if (Array.isArray(obj.material)) obj.material.forEach((m) => m.dispose());
          else obj.material.dispose();
        }
      });
      renderer.dispose();
      if (renderer.domElement.parentNode === container) {
        container.removeChild(renderer.domElement);
      }
      gameAudio.dispose();
    };
  }, []);

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-[#060918] text-white select-none">
      {/* Full-Viewport Live WebGL Canvas */}
      <div ref={mountRef} className="w-full h-full" />

      {contextLost && (
        <div className="absolute inset-0 z-30 bg-[#060918]/95 flex flex-col items-center justify-center p-6 text-center space-y-4">
          <h2 className="font-display text-2xl font-bold text-white">3D Viewport Temporarily Paused</h2>
          <p className="text-sm text-slate-300 max-w-md">
            Your browser reclaimed the WebGL graphics context. Reload the page or return to Interactive Labs.
          </p>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="px-5 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 text-sm font-semibold cursor-pointer"
            >
              Reload Game
            </button>
            <Link
              to="/labs"
              className="px-5 py-2.5 rounded-xl border border-slate-600 hover:border-slate-400 text-sm font-semibold text-slate-200"
            >
              Back to Labs
            </Link>
          </div>
        </div>
      )}

      {/* TITLE SCREEN */}
      {gameState === 'TITLE' && (
        <div className="absolute inset-0 flex flex-col items-center justify-between p-6 sm:p-10 pointer-events-none">
          <div className="w-full flex items-center justify-between pointer-events-auto">
            <Link
              to="/labs"
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg bg-[#0A0F24]/90 border border-slate-700 text-xs font-medium text-slate-200 hover:border-violet-400"
            >
              <ArrowLeft className="w-4 h-4" /> Back to Labs
            </Link>
            <button
              type="button"
              onClick={() => setMuted((m) => !m)}
              className="p-2.5 rounded-lg bg-[#0A0F24]/90 border border-slate-700 text-slate-200 hover:border-violet-400 cursor-pointer"
              aria-label="Toggle audio"
            >
              {muted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
            </button>
          </div>

          {/* Crisp SVG Title Lockup + Start Controls */}
          <div className="text-center max-w-xl space-y-6 pointer-events-auto bg-[#060918]/85 border border-slate-800 rounded-2xl px-8 py-8">
            <svg viewBox="0 0 520 76" className="w-full max-w-md mx-auto" aria-label="CIRCUIT RUNNER 3D">
              <defs>
                <linearGradient id="crTitleGrad" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor="#38BDF8" />
                  <stop offset="55%" stopColor="#8B5CF6" />
                  <stop offset="100%" stopColor="#E2E8F0" />
                </linearGradient>
              </defs>
              <text
                x="260"
                y="46"
                textAnchor="middle"
                fill="url(#crTitleGrad)"
                fontFamily="Plus Jakarta Sans, sans-serif"
                fontWeight="800"
                fontSize="38"
                letterSpacing="2"
              >
                CIRCUIT RUNNER 3D
              </text>
              <text
                x="260"
                y="68"
                textAnchor="middle"
                fill="#94A3B8"
                fontFamily="JetBrains Mono, monospace"
                fontSize="12"
                letterSpacing="3"
              >
                SKILLNOVA DATA-BUS CHALLENGE
              </text>
            </svg>

            <div className="flex flex-wrap items-center justify-center gap-2">
              {STAGES.map((st) => (
                <button
                  key={st.id}
                  type="button"
                  onClick={() => setStageId(st.id)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors cursor-pointer ${
                    stageId === st.id
                      ? 'bg-violet-600 border-violet-400 text-white'
                      : 'bg-slate-900 border-slate-700 text-slate-300 hover:border-slate-500'
                  }`}
                >
                  {st.name}
                </button>
              ))}
            </div>

            <div>
              <button
                type="button"
                onClick={() => startMission(stageId)}
                className="inline-flex items-center gap-2.5 px-8 py-3.5 rounded-xl bg-violet-600 hover:bg-violet-500 text-white font-display font-bold text-base transition-colors cursor-pointer"
              >
                <Play className="w-5 h-5" /> Start Mission
              </button>
            </div>

            <p className="font-mono text-[11px] text-slate-400">
              WASD / Arrow Keys Steer · Space Overclock Boost · P / Esc Pause
            </p>
          </div>

          <div className="h-4" />
        </div>
      )}

      {/* PLAYING PERIMETER HUD */}
      {gameState !== 'TITLE' && (
        <>
          <div className="absolute top-4 left-4 right-4 flex items-center justify-between gap-4 pointer-events-none">
            <div className="pointer-events-auto flex items-center gap-4 bg-[#0A0F24]/90 border border-slate-700 rounded-xl px-4 py-2.5 font-mono text-xs tabular-nums">
              <div>
                <span className="text-slate-400 block text-[10px]">NODES</span>
                <span className="text-sky-400 font-bold text-sm">
                  {hud.nodes} / {hud.targetNodes}
                </span>
              </div>
              <div className="h-6 w-px bg-slate-700" />
              <div>
                <span className="text-slate-400 block text-[10px]">SCORE</span>
                <span className="text-white font-bold text-sm">{hud.score}</span>
              </div>
              <div className="h-6 w-px bg-slate-700" />
              <div>
                <span className="text-slate-400 block text-[10px]">SHIELDS</span>
                <span className="text-emerald-400 font-bold text-sm">{hud.shields}</span>
              </div>
              <div className="h-6 w-px bg-slate-700" />
              <div>
                <span className="text-slate-400 block text-[10px]">BOOST</span>
                <span className="text-violet-400 font-bold text-sm">{hud.boostReady}%</span>
              </div>
            </div>

            <div className="pointer-events-auto flex items-center gap-2">
              <button
                type="button"
                onClick={() => setMuted((m) => !m)}
                className="p-2.5 rounded-lg bg-[#0A0F24]/90 border border-slate-700 text-slate-200 hover:border-violet-400 cursor-pointer"
                aria-label="Toggle mute"
              >
                {muted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
              </button>
              <button
                type="button"
                onClick={() => setGameState((s) => (s === 'PAUSED' ? 'PLAYING' : 'PAUSED'))}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[#0A0F24]/90 border border-slate-700 text-xs font-medium text-slate-200 hover:border-violet-400 cursor-pointer"
              >
                <Pause className="w-3.5 h-3.5" /> Pause
              </button>
            </div>
          </div>

          {/* Touch Steering Pad for Mobile / Tablet */}
          {gameState === 'PLAYING' && (
            <div className="sm:hidden absolute bottom-5 left-4 right-4 flex items-center justify-between gap-3">
              <div className="flex gap-2">
                <button
                  type="button"
                  onTouchStart={() => { inputRef.current.left = true; }}
                  onTouchEnd={() => { inputRef.current.left = false; }}
                  className="px-6 py-3.5 rounded-xl bg-[#0A0F24]/90 border border-slate-700 text-sm font-bold"
                >
                  Left
                </button>
                <button
                  type="button"
                  onTouchStart={() => { inputRef.current.right = true; }}
                  onTouchEnd={() => { inputRef.current.right = false; }}
                  className="px-6 py-3.5 rounded-xl bg-[#0A0F24]/90 border border-slate-700 text-sm font-bold"
                >
                  Right
                </button>
              </div>
              <button
                type="button"
                onTouchStart={() => { inputRef.current.boost = true; }}
                onTouchEnd={() => { inputRef.current.boost = false; }}
                className="px-5 py-3.5 rounded-xl bg-violet-600/95 border border-violet-400 text-sm font-bold"
              >
                Boost
              </button>
            </div>
          )}
        </>
      )}

      {/* PAUSE / VICTORY / GAME OVER MODAL */}
      {(gameState === 'PAUSED' || gameState === 'VICTORY' || gameState === 'GAMEOVER') && (
        <div className="absolute inset-0 bg-[#060918]/80 flex items-center justify-center p-4">
          <div className="w-full max-w-md rounded-2xl bg-[#0A0F24] border border-slate-700 p-7 text-center space-y-5">
            {gameState === 'VICTORY' && <Award className="w-12 h-12 text-amber-400 mx-auto" />}

            <div>
              <p className="text-xs font-semibold text-violet-400">
                {gameState === 'PAUSED'
                  ? 'Mission Paused'
                  : gameState === 'VICTORY'
                  ? `Stage ${stageId} Complete`
                  : 'Firewall Collision'}
              </p>
              <h2 className="font-display text-2xl font-extrabold text-white mt-1">
                {gameState === 'PAUSED'
                  ? 'Paused'
                  : gameState === 'VICTORY'
                  ? 'Circuit Stabilized!'
                  : 'System Halted'}
              </h2>
              <p className="font-mono text-sm text-slate-300 mt-2 tabular-nums">
                Score: {hud.score} · Nodes: {hud.nodes}/{hud.targetNodes}
              </p>
            </div>

            {rewardStatus && (
              <div className="px-4 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-xs text-emerald-300">
                {rewardStatus.message}
              </div>
            )}

            <div className="flex flex-wrap items-center justify-center gap-3">
              {gameState === 'PAUSED' && (
                <button
                  type="button"
                  onClick={() => setGameState('PLAYING')}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 text-sm font-semibold cursor-pointer"
                >
                  <Play className="w-4 h-4" /> Resume
                </button>
              )}

              {gameState === 'VICTORY' && stageId < 3 && (
                <button
                  type="button"
                  onClick={() => startMission(stageId + 1)}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 text-sm font-semibold cursor-pointer"
                >
                  <Play className="w-4 h-4" /> Next Stage
                </button>
              )}

              <button
                type="button"
                onClick={() => startMission(stageId)}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-sm font-semibold cursor-pointer"
              >
                <RotateCcw className="w-4 h-4" /> Retry Stage
              </button>

              <Link
                to="/labs"
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl border border-slate-600 hover:border-slate-400 text-sm font-semibold text-slate-200"
              >
                Exit to Labs
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
