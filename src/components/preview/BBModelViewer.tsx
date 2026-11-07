import { useEffect, useRef, useState } from "react";

/** Zeigt eine fertige Blockbench-Datei (.bbmodel) als drehbares 3D-Modell – direkt im Chat. */
export default function BBModelViewer({ json, className = "" }: { json: string; className?: string }) {
  const box = useRef<HTMLDivElement>(null);
  const [err, setErr] = useState("");
  useEffect(() => {
    const el = box.current; if (!el) return;
    let stop = () => {};
    let dead = false;
    (async () => {
      try {
        const THREE = await import("three");
        const { OrbitControls } = await import("three/examples/jsm/controls/OrbitControls.js");
        if (dead) return;
        const m = JSON.parse(json);
        const w = m.resolution?.width || 16, h = m.resolution?.height || 16;
        const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
        renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
        renderer.outputColorSpace = THREE.SRGBColorSpace;
        el.appendChild(renderer.domElement);
        const scene = new THREE.Scene();
        const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 2000);
        scene.add(new THREE.HemisphereLight(0xffffff, 0x404050, 2.2));
        const dir = new THREE.DirectionalLight(0xffffff, 1.4); dir.position.set(30, 50, 20); scene.add(dir);
        const src = m.textures?.[0]?.source;
        let mat: import("three").Material = new THREE.MeshLambertMaterial({ color: 0xb0b0b0 });
        if (src) {
          const tex = await new THREE.TextureLoader().loadAsync(src);
          tex.magFilter = THREE.NearestFilter; tex.minFilter = THREE.NearestFilter; tex.colorSpace = THREE.SRGBColorSpace;
          mat = new THREE.MeshLambertMaterial({ map: tex, transparent: true, alphaTest: 0.05 });
        }
        const root = new THREE.Group(); scene.add(root);
        // Reihenfolge der BoxGeometry-Flächen: +x, -x, +y, -y, +z, -z
        const ORDER = ["east", "west", "up", "down", "south", "north"];
        for (const e of m.elements || []) {
          if (!e.from || !e.to || e.visibility === false) continue;
          const size = [0, 1, 2].map((i) => Math.max(0.001, e.to[i] - e.from[i]));
          const g = new THREE.BoxGeometry(size[0], size[1], size[2]);
          const uv = g.getAttribute("uv") as import("three").BufferAttribute;
          ORDER.forEach((f, fi) => {
            const u = e.faces?.[f]?.uv; if (!u) return;
            const [u1, v1, u2, v2] = u.map((n: number, k: number) => n / (k % 2 ? h : w));
            const pts = [[u1, 1 - v1], [u2, 1 - v1], [u1, 1 - v2], [u2, 1 - v2]];
            pts.forEach((p, k) => uv.setXY(fi * 4 + k, p[0], p[1]));
          });
          const mesh = new THREE.Mesh(g, mat);
          const o = e.origin || [0, 0, 0];
          const pivot = new THREE.Group(); pivot.position.set(o[0], o[1], o[2]);
          const r = e.rotation || [0, 0, 0];
          pivot.rotation.set(THREE.MathUtils.degToRad(r[0]), THREE.MathUtils.degToRad(r[1]), THREE.MathUtils.degToRad(r[2]), "ZYX");
          mesh.position.set(e.from[0] + size[0] / 2 - o[0], e.from[1] + size[1] / 2 - o[1], e.from[2] + size[2] / 2 - o[2]);
          pivot.add(mesh); root.add(pivot);
        }
        const bb = new THREE.Box3().setFromObject(root); const c = bb.getCenter(new THREE.Vector3()); const s = bb.getSize(new THREE.Vector3()).length() || 16;
        root.position.sub(c);
        camera.position.set(s * 0.9, s * 0.6, s * 0.9);
        const controls = new OrbitControls(camera, renderer.domElement); controls.enableDamping = true; controls.autoRotate = true; controls.autoRotateSpeed = 1.2;
        const resize = () => { const W = el.clientWidth, H = el.clientHeight || 320; renderer.setSize(W, H); camera.aspect = W / H; camera.updateProjectionMatrix(); };
        const ro = new ResizeObserver(resize); ro.observe(el); resize();
        renderer.setAnimationLoop(() => { controls.update(); renderer.render(scene, camera); });
        stop = () => { ro.disconnect(); renderer.setAnimationLoop(null); controls.dispose(); renderer.dispose(); renderer.domElement.remove(); };
      } catch (e) { setErr("3D-Vorschau nicht möglich: " + (e instanceof Error ? e.message : String(e))); }
    })();
    return () => { dead = true; stop(); };
  }, [json]);
  return <div ref={box} className={`relative h-full min-h-[280px] w-full ${className}`}>{err && <p className="absolute inset-0 grid place-items-center text-sm text-muted-foreground">{err}</p>}</div>;
}
