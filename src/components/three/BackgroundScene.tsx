"use client";

import { Suspense, useMemo, useRef } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Sparkles } from "@react-three/drei";
import * as THREE from "three";
import { useScrollStateRef } from "@/lib/scroll-context";

const YELLOW = "#f5d90a";

/**
 * One waypoint per landing-page section (Hero -> Footer), evenly spaced
 * across scroll progress 0-1. Interpolating between neighbours gives a
 * gentle cylindrical/orbital drift instead of one straight linear dolly.
 */
const CAMERA_WAYPOINTS: { x: number; y: number; z: number }[] = [
  { x: 0, y: 0, z: 9 }, // Hero
  { x: 1.2, y: -0.3, z: 8.2 }, // Trust bar
  { x: -1.3, y: -0.6, z: 7.6 }, // Coaches
  { x: 0.8, y: -0.9, z: 7.0 }, // How it works
  { x: -1.5, y: -1.1, z: 6.6 }, // Pricing
  { x: 1.0, y: -1.4, z: 7.0 }, // Testimonials
  { x: 0, y: -1.7, z: 8.0 }, // Footer
];

function waypointTarget(progress: number) {
  const n = CAMERA_WAYPOINTS.length;
  const scaled = THREE.MathUtils.clamp(progress, 0, 1) * (n - 1);
  const i0 = Math.floor(scaled);
  const i1 = Math.min(i0 + 1, n - 1);
  const t = scaled - i0;
  const a = CAMERA_WAYPOINTS[i0];
  const b = CAMERA_WAYPOINTS[i1];
  return {
    x: THREE.MathUtils.lerp(a.x, b.x, t),
    y: THREE.MathUtils.lerp(a.y, b.y, t),
    z: THREE.MathUtils.lerp(a.z, b.z, t),
  };
}

function useMousePosition() {
  const mouse = useRef({ x: 0, y: 0 });
  useMemo(() => {
    if (typeof window === "undefined") return;
    window.addEventListener("pointermove", (e) => {
      mouse.current.x = (e.clientX / window.innerWidth) * 2 - 1;
      mouse.current.y = -(e.clientY / window.innerHeight) * 2 + 1;
    });
  }, []);
  return mouse;
}

function Rig() {
  const scrollState = useScrollStateRef();
  const mouse = useMousePosition();
  const { camera } = useThree();

  useFrame((_, delta) => {
    const p = scrollState.current.progress;
    const target = waypointTarget(p);
    camera.position.z = THREE.MathUtils.damp(camera.position.z, target.z, 2.2, delta);
    camera.position.y = THREE.MathUtils.damp(camera.position.y, target.y, 2.2, delta);
    camera.position.x = THREE.MathUtils.damp(camera.position.x, target.x + mouse.current.x * 0.4, 2.2, delta);
    camera.lookAt(target.x * 0.35, target.y * 0.6, 0);
  });

  return null;
}

function Lights() {
  const light = useRef<THREE.PointLight>(null);
  const scrollState = useScrollStateRef();

  useFrame((state, delta) => {
    if (!light.current) return;
    const p = scrollState.current.progress;
    const target = waypointTarget(p);
    light.current.position.x = THREE.MathUtils.damp(
      light.current.position.x,
      target.x * -1.4 + Math.sin(state.clock.elapsedTime * 0.2) * 1.2,
      2,
      delta
    );
    light.current.position.y = THREE.MathUtils.damp(light.current.position.y, 2 - p * 3, 2, delta);
    light.current.intensity = THREE.MathUtils.damp(light.current.intensity, 18 + Math.sin(p * Math.PI * 4) * 6, 2, delta);
  });

  return (
    <>
      <ambientLight intensity={0.28} />
      <directionalLight position={[4, 6, 3]} intensity={0.5} color="#ffffff" />
      <pointLight ref={light} position={[3, 2, 2]} color={YELLOW} intensity={18} distance={12} />
    </>
  );
}

function SceneContent() {
  return (
    <>
      <Rig />
      <Lights />
      <Sparkles count={70} scale={[10, 8, 6]} size={1.4} speed={0.2} color={YELLOW} opacity={0.35} />
      <Sparkles count={50} scale={[12, 10, 8]} size={0.9} speed={0.12} color="#ffffff" opacity={0.18} />
      <fog attach="fog" args={["#060606", 6, 15]} />
    </>
  );
}

export default function BackgroundScene() {
  return (
    <div className="pointer-events-none fixed inset-0 z-0" aria-hidden="true">
      <Canvas dpr={[1, 1.6]} gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }} camera={{ position: [0, 0, 9], fov: 45 }}>
        <Suspense fallback={null}>
          <SceneContent />
        </Suspense>
      </Canvas>
      <div className="absolute inset-0 bg-gradient-to-b from-black/10 via-transparent to-black/60" />
    </div>
  );
}
