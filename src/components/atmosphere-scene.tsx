"use client";

import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useEffect, useLayoutEffect, useRef, type RefObject } from "react";
import { Color, MathUtils, Object3D, Vector3, type InstancedMesh } from "three";

export type Viewpoint = "street" | "roof" | "sky";

export type AtmosphereProps = {
  viewpoint: Viewpoint;
  paused: boolean;
  pointer: RefObject<{ x: number; y: number }>;
  redraw: RefObject<(() => void) | null>;
  onPaint: () => void;
  onUnavailable: () => void;
};

const cameras: Record<Viewpoint, [number, number, number]> = {
  street: [17, 6.4, 24],
  roof: [21, 17, 27],
  sky: [13, 29, 24],
};
const lookAt = new Vector3(0, 1.2, 0);

const palettes = ["#5a3b39", "#9a5745", "#b5795d", "#cc9e7e", "#4f4546", "#876659"];

function sample(seed: number) {
  const number = Math.sin(seed * 127.1 + 311.7) * 43758.5453123;
  return number - Math.floor(number);
}

const buildings = Array.from({ length: 110 }, (_, index) => {
  const col = index % 11;
  const row = Math.floor(index / 11);
  const x = (col - 5) * 2.03 + (sample(index + 5) - 0.5) * 0.48;
  const z = (row - 4.5) * 2.04 + (sample(index + 80) - 0.5) * 0.4;
  const height = 0.9 + sample(index + 54) * (row < 3 ? 4.8 : 2.6);
  const width = 0.9 + sample(index + 9) * 0.61;
  const depth = 0.92 + sample(index + 6) * 0.67;
  return { x, z, height, width, depth, color: palettes[index % palettes.length] };
}).filter(({ x, z }) => Math.abs(x + z * 0.55 - 0.8) > 1.45);

function CityModel() {
  const walls = useRef<InstancedMesh>(null);
  const roofs = useRef<InstancedMesh>(null);
  const windows = useRef<InstancedMesh>(null);

  useLayoutEffect(() => {
    if (!walls.current || !roofs.current || !windows.current) return;
    const transform = new Object3D();
    buildings.forEach(({ x, z, height, width, depth, color }, index) => {
      transform.position.set(x, height * 0.5, z);
      transform.scale.set(width, height, depth);
      transform.updateMatrix();
      walls.current?.setMatrixAt(index, transform.matrix);
      walls.current?.setColorAt(index, new Color(color));
      transform.position.set(x, height + 0.072, z);
      transform.scale.set(width * 1.075, 0.15, depth * 1.075);
      transform.updateMatrix();
      roofs.current?.setMatrixAt(index, transform.matrix);
      roofs.current?.setColorAt(index, new Color(color).multiplyScalar(1.2));
      for (let floor = 0; floor < 2; floor++) {
        const windowY = height * (0.36 + floor * 0.34);
        for (let bay = 0; bay < 2; bay++) {
          const windowIndex = index * 8 + floor * 4 + bay * 2;
          const lateral = (bay === 0 ? -1 : 1) * 0.225;
          const tone = sample(windowIndex + 47) > 0.8 ? "#efad75" : "#432c2c";
          transform.position.set(x + lateral * width, windowY, z + depth * 0.5 + 0.015);
          transform.scale.set(width * 0.2, Math.min(height * 0.15, 0.28), 0.03);
          transform.updateMatrix();
          windows.current?.setMatrixAt(windowIndex, transform.matrix);
          windows.current?.setColorAt(windowIndex, new Color(tone));
          transform.position.set(x + width * 0.5 + 0.015, windowY, z + lateral * depth);
          transform.scale.set(0.03, Math.min(height * 0.15, 0.28), depth * 0.2);
          transform.updateMatrix();
          windows.current?.setMatrixAt(windowIndex + 1, transform.matrix);
          windows.current?.setColorAt(windowIndex + 1, new Color(tone));
        }
      }
    });
    for (const mesh of [walls.current, roofs.current, windows.current]) {
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
      mesh.computeBoundingSphere();
    }
  }, []);

  return (
    <>
      <mesh receiveShadow position={[0, -0.2, 0]}>
        <boxGeometry args={[29, 0.4, 26]} />
        <meshStandardMaterial color="#54423b" metalness={0.08} roughness={0.92} />
      </mesh>
      <mesh receiveShadow position={[0.8, 0.03, 0]} rotation={[0, -0.54, 0]}>
        <boxGeometry args={[1.7, 0.065, 25]} />
        <meshStandardMaterial color="#292627" roughness={0.94} />
      </mesh>
      <ElevatedMetro />
      <instancedMesh ref={walls} args={[undefined, undefined, buildings.length]} castShadow receiveShadow>
        <boxGeometry />
        <meshStandardMaterial metalness={0.07} roughness={0.82} />
      </instancedMesh>
      <instancedMesh ref={roofs} args={[undefined, undefined, buildings.length]} castShadow receiveShadow>
        <boxGeometry />
        <meshStandardMaterial metalness={0.16} roughness={0.67} />
      </instancedMesh>
      <instancedMesh ref={windows} args={[undefined, undefined, buildings.length * 8]}>
        <boxGeometry />
        <meshStandardMaterial roughness={0.68} metalness={0.18} />
      </instancedMesh>
      <mesh receiveShadow rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.42, 0]}>
        <planeGeometry args={[235, 235]} />
        <meshStandardMaterial color="#3e2c29" roughness={1} />
      </mesh>
    </>
  );
}

function ElevatedMetro() {
  return (
    <group position={[0.8, 0, 0]} rotation={[0, -0.54, 0]}>
      <mesh position={[0, 1.33, 0]} castShadow receiveShadow>
        <boxGeometry args={[1.47, 0.24, 24.6]} />
        <meshStandardMaterial color="#81675b" roughness={0.9} />
      </mesh>
      {[-9.2, -5.9, -2.6, 0.7, 4, 7.3, 10.6].map((z) => (
        <mesh key={z} position={[0, 0.6, z]} castShadow>
          <boxGeometry args={[0.32, 1.2, 0.43]} />
          <meshStandardMaterial color="#71584f" roughness={0.86} />
        </mesh>
      ))}
      {[-0.58, 0.58].map((x) => (
        <mesh key={x} position={[x, 1.48, 0]}>
          <boxGeometry args={[0.055, 0.075, 24.5]} />
          <meshStandardMaterial color="#a48874" roughness={0.61} />
        </mesh>
      ))}
      {[5.7, 3.86, 2.02, 0.18].map((z) => (
        <group key={z} position={[0.02, 1.74, z]}>
          <mesh castShadow>
            <boxGeometry args={[0.78, 0.51, 1.71]} />
            <meshStandardMaterial color="#d4aa88" roughness={0.5} metalness={0.48} />
          </mesh>
          <mesh position={[0, -0.065, 0]}>
            <boxGeometry args={[0.79, 0.095, 1.72]} />
            <meshStandardMaterial color="#963c32" roughness={0.67} />
          </mesh>
          <mesh position={[0, 0.075, 0]}>
            <boxGeometry args={[0.79, 0.135, 1.29]} />
            <meshStandardMaterial color="#3e3538" roughness={0.52} />
          </mesh>
        </group>
      ))}
      {[-0.22, 0.24].map((x) => (
        <mesh key={x} position={[x, 1.66, 6.57]}>
          <boxGeometry args={[0.09, 0.074, 0.028]} />
          <meshStandardMaterial color="#ffce8a" emissive="#ffb062" emissiveIntensity={3.4} toneMapped={false} />
        </mesh>
      ))}
    </group>
  );
}

function Perspective({ viewpoint, paused, pointer, redraw, onPaint, onUnavailable }: AtmosphereProps) {
  const { gl, invalidate } = useThree();
  const painted = useRef(false);
  const destination = useRef(new Vector3());

  useEffect(() => {
    const canvas = gl.domElement;
    const contextLost = () => onUnavailable();
    redraw.current = invalidate;
    canvas.addEventListener("webglcontextlost", contextLost);
    return () => {
      redraw.current = null;
      canvas.removeEventListener("webglcontextlost", contextLost);
    };
  }, [gl, invalidate, onUnavailable, redraw]);

  useEffect(() => { invalidate(); }, [viewpoint, paused, invalidate]);

  useFrame(({ camera }, delta) => {
    const [x, y, z] = cameras[viewpoint];
    const tilt = paused ? { x: 0, y: 0 } : pointer.current;
    destination.current.set(x + tilt.x * 3, y - tilt.y * 1.7, z + tilt.x * 2);
    const moving = !paused && camera.position.distanceToSquared(destination.current) > 0.0001;
    if (moving) camera.position.lerp(destination.current, MathUtils.damp(0, 1, 6, MathUtils.clamp(delta, 0.016, 0.033)));
    else camera.position.copy(destination.current);
    camera.lookAt(lookAt);
    if (!painted.current) {
      painted.current = true;
      onPaint();
    }
    if (moving) invalidate();
  });

  return null;
}

export function AtmosphereScene(props: AtmosphereProps) {
  return (
    <Canvas camera={{ position: cameras.roof, fov: 45, near: 0.2, far: 110 }} dpr={[1, 1.25]}
      frameloop="demand" gl={{ antialias: true, powerPreference: "low-power", alpha: false }} shadows>
      <color attach="background" args={["#a67157"]} />
      <fogExp2 attach="fog" args={["#a67157", 0.019]} />
      <hemisphereLight args={["#ffe2bd", "#74575f", 1.7]} />
      <directionalLight position={[13, 22, -17]} color="#ffe2bd" intensity={2.4} castShadow
        shadow-mapSize={[512, 512]} shadow-camera-left={-22} shadow-camera-right={22}
        shadow-camera-top={22} shadow-camera-bottom={-22} shadow-normalBias={0.04} />
      <CityModel />
      <Perspective {...props} />
    </Canvas>
  );
}
