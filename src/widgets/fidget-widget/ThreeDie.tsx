import { useEffect, useRef, useState } from "react";
import * as THREE from "three";

// SVG polygon points and text Y for fallback rendering
const SVG_SHAPES: Record<string, string> = {
  d4: "50,8 93,88 7,88",
  d8: "50,5 95,50 50,95 5,50",
  d12: "50,5 7,34 22,87 78,87 93,34",
  d20: "50,5 97,92 3,92",
};
const TEXT_Y: Record<string, number> = { d4: 65, d8: 52, d12: 52, d20: 66 };
const TEXT_SIZE: Record<string, number> = { d4: 23, d8: 23, d12: 21, d20: 23 };

function canUseWebGL(): boolean {
  try {
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("webgl2") ?? canvas.getContext("webgl");
    return ctx !== null;
  } catch {
    return false;
  }
}

const WEBGL_AVAILABLE = typeof document !== "undefined" && canUseWebGL();

type ThreeDieType = "d4" | "d8" | "d12" | "d20";

// Maps each die type to its Three.js geometry constructor and face-normal data.
// Three.js BufferGeometry stores faces as triangles; for d12 (dodecahedron) each
// pentagonal face is split into 3 triangles, so we need face-group info to find
// a representative face normal for each logical face.
const GEOMETRY_FACTORIES: Record<ThreeDieType, () => THREE.BufferGeometry> = {
  d4: () => new THREE.TetrahedronGeometry(1.1),
  d8: () => new THREE.OctahedronGeometry(1.1),
  d12: () => new THREE.DodecahedronGeometry(1.1),
  d20: () => new THREE.IcosahedronGeometry(1.1),
};

// Number of logical faces per die type
const FACE_COUNT: Record<ThreeDieType, number> = {
  d4: 4,
  d8: 8,
  d12: 12,
  d20: 20,
};

// Triangles per logical face (all Platonic solids have uniform face subdivision)
const TRIS_PER_FACE: Record<ThreeDieType, number> = {
  d4: 1, // already triangles
  d8: 1,
  d12: 3, // pentagons split into 3 triangles each
  d20: 1,
};

const ROLL_DURATION_MS = 1400;
// Extra rotation added during the tumble (in radians)
const TUMBLE_ROTATIONS = Math.PI * 8;

// Compute per-face normals from a BufferGeometry, grouping triangles by TRIS_PER_FACE.
// Returns an array of unit normal vectors, one per logical face.
function computeFaceNormals(
  geo: THREE.BufferGeometry,
  trisPerFace: number,
): THREE.Vector3[] {
  geo.computeVertexNormals();
  const pos = geo.attributes.position;
  const normals: THREE.Vector3[] = [];
  const triCount = pos.count / 3;

  for (let face = 0; face < triCount / trisPerFace; face++) {
    const n = new THREE.Vector3();
    for (let t = 0; t < trisPerFace; t++) {
      const triIdx = face * trisPerFace + t;
      const vA = new THREE.Vector3().fromBufferAttribute(pos, triIdx * 3);
      const vB = new THREE.Vector3().fromBufferAttribute(pos, triIdx * 3 + 1);
      const vC = new THREE.Vector3().fromBufferAttribute(pos, triIdx * 3 + 2);
      const triNormal = new THREE.Vector3()
        .crossVectors(vB.clone().sub(vA), vC.clone().sub(vA))
        .normalize();
      n.add(triNormal);
    }
    normals.push(n.normalize());
  }
  return normals;
}

// Compute the quaternion that rotates faceNormal to face +Y (i.e. face pointing up).
function quaternionToFaceUp(faceNormal: THREE.Vector3): THREE.Quaternion {
  const up = new THREE.Vector3(0, 1, 0);
  return new THREE.Quaternion().setFromUnitVectors(faceNormal, up);
}

// Easing: ease-out cubic
function easeOut(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

const ROLL_DURATION_SVG = 1400;

function SvgFallback({
  type,
  result,
  rolling,
}: {
  type: ThreeDieType;
  result: number;
  rolling: boolean;
}) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [display, setDisplay] = useState(result);
  const sides = { d4: 4, d8: 8, d12: 12, d20: 20 }[type];

  useEffect(() => {
    setDisplay(result);
  }, [result]);

  useEffect(() => {
    if (!rolling || !svgRef.current) return;
    const el = svgRef.current;
    el.style.animation = "none";
    void (el as unknown as HTMLElement).offsetHeight;
    el.style.animation = `svg-roll ${ROLL_DURATION_SVG}ms ease-out forwards`;
    let count = 0;
    const iv = setInterval(() => {
      count++;
      setDisplay(Math.floor(Math.random() * sides) + 1);
      if (count >= 12) {
        clearInterval(iv);
        setDisplay(result);
      }
    }, ROLL_DURATION_SVG / 13);
    return () => clearInterval(iv);
  }, [rolling, result, sides]);

  return (
    <svg
      ref={svgRef}
      viewBox="0 0 100 100"
      width={100}
      height={100}
      style={{ display: "block", margin: "auto", overflow: "visible" }}
    >
      <defs>
        <filter id="die-shadow-3d">
          <feDropShadow
            dx="0"
            dy="2"
            stdDeviation="3"
            floodColor="#000"
            floodOpacity="0.5"
          />
        </filter>
      </defs>
      <polygon
        points={SVG_SHAPES[type]}
        fill="#1a1d2a"
        stroke="#4a5580"
        strokeWidth="2.5"
        strokeLinejoin="round"
        filter="url(#die-shadow-3d)"
      />
      <text
        x="50"
        y={TEXT_Y[type] ?? 54}
        textAnchor="middle"
        dominantBaseline="middle"
        fill="#dde2ec"
        fontSize={TEXT_SIZE[type] ?? 23}
        fontWeight="700"
        fontFamily="ui-monospace, monospace"
        style={{ userSelect: "none" }}
      >
        {display}
      </text>
    </svg>
  );
}

interface ThreeDieProps {
  type: ThreeDieType;
  result: number; // 1-based face result
  rolling: boolean;
  size?: number;
}

export function ThreeDie({ type, result, rolling, size = 120 }: ThreeDieProps) {
  if (!WEBGL_AVAILABLE) {
    return <SvgFallback type={type} result={result} rolling={rolling} />;
  }
  const mountRef = useRef<HTMLDivElement>(null);
  const stateRef = useRef<{
    renderer: THREE.WebGLRenderer;
    scene: THREE.Scene;
    camera: THREE.PerspectiveCamera;
    mesh: THREE.Mesh;
    faceNormals: THREE.Vector3[];
    materials: THREE.MeshPhongMaterial[];
    animFrame: number;
    rollStart: number | null;
    rollFrom: THREE.Quaternion;
    rollTumble: THREE.Quaternion;
    rollTo: THREE.Quaternion;
    rolling: boolean;
  } | null>(null);

  // Initialize Three.js scene once
  useEffect(() => {
    if (!mountRef.current) return;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(size, size);
    renderer.setClearColor(0x000000, 0);
    mountRef.current.appendChild(renderer.domElement);

    const scene = new THREE.Scene();

    const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
    camera.position.set(0, 0, 4);

    // Geometry + materials
    const geo = GEOMETRY_FACTORIES[type]();
    const trisPerFace = TRIS_PER_FACE[type];
    const faceCount = FACE_COUNT[type];
    const faceNormals = computeFaceNormals(geo, trisPerFace);

    // Assign a material per logical face so we can colour the "top" face differently
    const triCount = geo.attributes.position.count / 3;
    const faceIndices = new Uint16Array(triCount * 3);
    // Populate groups: one group per logical face
    for (let face = 0; face < faceCount; face++) {
      geo.addGroup(face * trisPerFace * 3, trisPerFace * 3, face);
    }
    // Rebuild index array matching vertex layout (sequential)
    for (let i = 0; i < triCount * 3; i++) faceIndices[i] = i;
    geo.setIndex(new THREE.BufferAttribute(faceIndices, 1));

    const materials = Array.from(
      { length: faceCount },
      () =>
        new THREE.MeshPhongMaterial({
          color: new THREE.Color("#1a1d2a"),
          emissive: new THREE.Color("#0a0c14"),
          specular: new THREE.Color("#4a5580"),
          shininess: 60,
          side: THREE.FrontSide,
        }),
    );

    const mesh = new THREE.Mesh(geo, materials);
    scene.add(mesh);

    // Wireframe overlay for edge definition
    const edgeGeo = new THREE.EdgesGeometry(GEOMETRY_FACTORIES[type](), 15);
    const edgeMat = new THREE.LineBasicMaterial({
      color: "#4a5580",
      linewidth: 1,
    });
    const edges = new THREE.LineSegments(edgeGeo, edgeMat);
    mesh.add(edges);

    // Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
    scene.add(ambientLight);
    const pointLight = new THREE.PointLight(0xffffff, 1.2, 20);
    pointLight.position.set(3, 5, 5);
    scene.add(pointLight);
    const fillLight = new THREE.PointLight(0x6080ff, 0.4, 20);
    fillLight.position.set(-3, -2, 2);
    scene.add(fillLight);

    // Start in a neutral resting orientation (face 0 up)
    const restQ = quaternionToFaceUp(faceNormals[0]);
    mesh.quaternion.copy(restQ);

    const state = {
      renderer,
      scene,
      camera,
      mesh,
      faceNormals,
      materials,
      animFrame: 0,
      rollStart: null as number | null,
      rollFrom: restQ.clone(),
      rollTumble: new THREE.Quaternion(),
      rollTo: restQ.clone(),
      rolling: false,
    };
    stateRef.current = state;

    // Render loop
    function animate(time: number) {
      state.animFrame = requestAnimationFrame(animate);

      if (state.rolling && state.rollStart !== null) {
        const elapsed = time - state.rollStart;
        const rawT = Math.min(elapsed / ROLL_DURATION_MS, 1);

        if (rawT < 0.7) {
          // First 70%: spin into tumble quaternion
          const t = easeOut(rawT / 0.7);
          mesh.quaternion.slerpQuaternions(state.rollFrom, state.rollTumble, t);
          // Add continuous tumble spin on top
          const spin = new THREE.Quaternion().setFromAxisAngle(
            new THREE.Vector3(0.6, 1, 0.3).normalize(),
            rawT * TUMBLE_ROTATIONS,
          );
          mesh.quaternion.multiply(spin);
        } else {
          // Last 30%: settle into final face-up orientation
          const t = easeOut((rawT - 0.7) / 0.3);
          mesh.quaternion.slerpQuaternions(state.rollTumble, state.rollTo, t);
        }

        if (rawT >= 1) {
          state.rolling = false;
          mesh.quaternion.copy(state.rollTo);
        }
      }

      renderer.render(scene, camera);
    }
    state.animFrame = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(state.animFrame);
      renderer.dispose();
      geo.dispose();
      edgeGeo.dispose();
      materials.forEach((m) => m.dispose());
      edgeMat.dispose();
      if (mountRef.current?.contains(renderer.domElement)) {
        mountRef.current.removeChild(renderer.domElement);
      }
      stateRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [type, size]);

  // Highlight the top face based on result, and trigger roll animation
  useEffect(() => {
    const state = stateRef.current;
    if (!state) return;

    const { mesh, faceNormals, materials } = state;
    const mats = materials as THREE.MeshPhongMaterial[];
    const faceCount = FACE_COUNT[type];

    // Map result (1-based) to face index (0-based)
    // Three.js Platonic solid faces aren't labelled, so we assign face i → value i+1
    const targetFaceIdx = (result - 1) % faceCount;
    const targetNormal = faceNormals[targetFaceIdx];

    // Compute final resting quaternion: target face pointing up (+Y)
    const finalQ = quaternionToFaceUp(targetNormal);

    if (rolling) {
      // Highlight the winning face
      mats.forEach((m, i) => {
        m.color.set(i === targetFaceIdx ? "#2a3060" : "#1a1d2a");
        m.emissive.set(i === targetFaceIdx ? "#1a2050" : "#0a0c14");
      });

      // Compute a random tumble mid-point quaternion
      const axis = new THREE.Vector3(
        Math.random() - 0.5,
        Math.random() - 0.5,
        Math.random() - 0.5,
      ).normalize();
      const tumbleQ = new THREE.Quaternion()
        .setFromAxisAngle(axis, Math.PI * (4 + Math.random() * 4))
        .multiply(mesh.quaternion);

      state.rollFrom = mesh.quaternion.clone();
      state.rollTumble = tumbleQ;
      state.rollTo = finalQ;
      state.rollStart = performance.now();
      state.rolling = true;
    } else {
      // Snap to result face without animation (initial render or die-switch)
      mesh.quaternion.copy(finalQ);
      // Dim all faces back to default on non-roll settle
      mats.forEach((m) => {
        m.color.set("#1a1d2a");
        m.emissive.set("#0a0c14");
      });
    }
  }, [rolling, result, type]);

  return (
    <div
      ref={mountRef}
      style={{ width: size, height: size, margin: "auto", cursor: "pointer" }}
    />
  );
}
