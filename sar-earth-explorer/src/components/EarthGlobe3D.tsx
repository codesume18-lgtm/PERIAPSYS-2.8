import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

type EarthMarker = {
  id: string;
  latitude: number;
  longitude: number;
  label: string;
};

type EarthGlobe3DProps = {
  activeStory: string;
  markers: EarthMarker[];
  showOrbit: boolean;
  showRadar: boolean;
  showChange: boolean;
  onSelectStory: (storyId: string) => void;
  onRotate: (longitude: number) => void;
};

const EARTH_TEXTURE =
  'https://gibs.earthdata.nasa.gov/wms/epsg4326/best/wms.cgi?SERVICE=WMS&REQUEST=GetMap&layers=BlueMarble_ShadedRelief&styles=&format=image/jpeg&transparent=false&version=1.1.1&srs=EPSG:4326&bbox=-180,-90,180,90&width=2048&height=1024&time=2016-01-01';

function latLonToVector3(
  latitude: number,
  longitude: number,
  radius: number,
): THREE.Vector3 {
  const phi = (90 - latitude) * (Math.PI / 180);
  const theta = (longitude + 180) * (Math.PI / 180);

  return new THREE.Vector3(
    -radius * Math.sin(phi) * Math.cos(theta),
    radius * Math.cos(phi),
    radius * Math.sin(phi) * Math.sin(theta),
  );
}

export default function EarthGlobe3D({
  activeStory,
  markers,
  showOrbit,
  showRadar,
  showChange,
  onSelectStory,
  onRotate,
}: EarthGlobe3DProps) {
  const mountRef = useRef<HTMLDivElement>(null);
  const activeStoryRef = useRef(activeStory);
  const markersRef = useRef(markers);
  const onSelectStoryRef = useRef(onSelectStory);
  const onRotateRef = useRef(onRotate);
  const markerGroupRef = useRef<THREE.Group | null>(null);
  const markerMeshesRef = useRef<Map<string, THREE.Object3D>>(new Map());

  useEffect(() => {
    activeStoryRef.current = activeStory;
    markersRef.current = markers;
    onSelectStoryRef.current = onSelectStory;
    onRotateRef.current = onRotate;
  }, [activeStory, markers, onSelectStory, onRotate]);

  // Rebuilds only the marker points/rings inside the existing marker group,
  // without touching the renderer/camera/scene. Safe to call whenever the
  // markers prop changes (e.g. once live NASA events finish loading).
  const syncMarkers = (markerList: EarthMarker[]) => {
    const group = markerGroupRef.current;
    if (!group) return;

    for (let i = group.children.length - 1; i >= 0; i -= 1) {
      const child = group.children[i];
      group.remove(child);
      if (child instanceof THREE.Mesh) {
        child.geometry.dispose();
        if (Array.isArray(child.material)) {
          child.material.forEach((material) => material.dispose());
        } else {
          child.material.dispose();
        }
      }
    }
    markerMeshesRef.current.clear();

    markerList.forEach((marker) => {
      const point = new THREE.Mesh(
        new THREE.SphereGeometry(0.055, 16, 16),
        new THREE.MeshBasicMaterial({ color: 0xffffff }),
      );
      point.position.copy(latLonToVector3(marker.latitude, marker.longitude, 1.78));
      point.userData.storyId = marker.id;
      group.add(point);

      const ring = new THREE.Mesh(
        new THREE.RingGeometry(0.08, 0.095, 32),
        new THREE.MeshBasicMaterial({
          color: 0xffffff,
          transparent: true,
          opacity: 0.52,
          side: THREE.DoubleSide,
        }),
      );
      ring.position.copy(point.position);
      ring.lookAt(0, 0, 0);
      ring.userData.storyId = marker.id;
      group.add(ring);
      markerMeshesRef.current.set(marker.id, point);
    });
  };

  // Keeps the globe's markers in sync whenever the markers prop changes
  // (e.g. live NASA EONET events arriving after the initial render), without
  // waiting for a layer toggle to rebuild the whole scene.
  useEffect(() => {
    syncMarkers(markers);
  }, [markers]);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 100);
    camera.position.set(0, 0.15, 5.4);

    const probe = document.createElement('canvas');
    const webglAvailable = Boolean(
      probe.getContext('webgl2') ?? probe.getContext('webgl'),
    );
    if (!webglAvailable) {
      const fallback = document.createElement('div');
      fallback.className = 'earth-globe-fallback';
      fallback.innerHTML =
        '<span>NASA EARTH TEXTURE<br /><small>WebGL fallback view</small></span>';
      mount.appendChild(fallback);
      return () => mount.removeChild(fallback);
    }

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        antialias: true,
        alpha: true,
        powerPreference: 'high-performance',
      });
    } catch {
      const fallback = document.createElement('div');
      fallback.className = 'earth-globe-fallback';
      fallback.innerHTML =
        '<span>NASA EARTH TEXTURE<br /><small>WebGL fallback view</small></span>';
      mount.appendChild(fallback);
      return () => mount.removeChild(fallback);
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setClearColor(0x000000, 0);
    mount.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enablePan = false;
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.minDistance = 3.9;
    controls.maxDistance = 7;
    controls.autoRotate = true;
    controls.autoRotateSpeed = 0.38;

    const ambientLight = new THREE.AmbientLight(0xffffff, 1.45);
    const keyLight = new THREE.DirectionalLight(0xffffff, 1.75);
    keyLight.position.set(-4, 3, 5);
    scene.add(ambientLight, keyLight);

    const globe = new THREE.Group();
    scene.add(globe);

    const earthGeometry = new THREE.SphereGeometry(1.72, 96, 96);
    const earthMaterial = new THREE.MeshPhongMaterial({
      color: 0xffffff,
      shininess: 8,
      specular: new THREE.Color(0x444444),
    });
    const earth = new THREE.Mesh(earthGeometry, earthMaterial);
    globe.add(earth);

    const atmosphere = new THREE.Mesh(
      new THREE.SphereGeometry(1.77, 64, 64),
      new THREE.MeshBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0.08,
        side: THREE.BackSide,
      }),
    );
    globe.add(atmosphere);

    const textureLoader = new THREE.TextureLoader();
    textureLoader.setCrossOrigin('anonymous');
    const texture = textureLoader.load(EARTH_TEXTURE);
    texture.colorSpace = THREE.SRGBColorSpace;
    earthMaterial.map = texture;
    earthMaterial.needsUpdate = true;

    const markerGroup = new THREE.Group();
    globe.add(markerGroup);
    markerGroupRef.current = markerGroup;
    syncMarkers(markersRef.current);

    const orbitGroup = new THREE.Group();
    const orbitMaterial = new THREE.LineBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.34,
    });
    const orbitPoints = new THREE.EllipseCurve(
      0,
      0,
      2.04,
      0.56,
      0,
      Math.PI * 2,
      false,
      0,
    )
      .getPoints(128)
      .map((point) => new THREE.Vector3(point.x, 0, point.y));
    const orbitLine = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints(orbitPoints),
      orbitMaterial,
    );
    orbitLine.rotation.set(0.2, -0.24, -0.25);
    orbitGroup.add(orbitLine);
    scene.add(orbitGroup);

    const radarGroup = new THREE.Group();
    const radarMaterial = new THREE.LineBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.2,
    });
    [1.88, 1.98, 2.1].forEach((radius) => {
      const points = new THREE.EllipseCurve(
        0,
        0,
        radius,
        radius * 0.28,
        0,
        Math.PI * 2,
        false,
        0,
      )
        .getPoints(96)
        .map((point) => new THREE.Vector3(point.x, 0, point.y));
      radarGroup.add(
        new THREE.Line(
          new THREE.BufferGeometry().setFromPoints(points),
          radarMaterial,
        ),
      );
    });
    radarGroup.rotation.set(0.9, 0.1, 0.25);
    scene.add(radarGroup);

    const changeGroup = new THREE.Group();
    const changeMaterial = new THREE.LineBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.42,
    });
    const latitudePoints = new THREE.EllipseCurve(
      0,
      0,
      1.76,
      0.48,
      0,
      Math.PI * 2,
      false,
      0,
    )
      .getPoints(128)
      .map((point) => new THREE.Vector3(point.x, point.y, 0));
    changeGroup.add(
      new THREE.Line(
        new THREE.BufferGeometry().setFromPoints(latitudePoints),
        changeMaterial,
      ),
    );
    changeGroup.rotation.set(Math.PI / 2, 0, 0.22);
    globe.add(changeGroup);

    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    let pointerDown = { x: 0, y: 0 };

    const handlePointerDown = (event: PointerEvent) => {
      pointerDown = { x: event.clientX, y: event.clientY };
    };

    const handlePointerUp = (event: PointerEvent) => {
      const distance = Math.hypot(
        event.clientX - pointerDown.x,
        event.clientY - pointerDown.y,
      );
      if (distance > 7) return;

      const bounds = renderer.domElement.getBoundingClientRect();
      pointer.x = ((event.clientX - bounds.left) / bounds.width) * 2 - 1;
      pointer.y = -((event.clientY - bounds.top) / bounds.height) * 2 + 1;
      raycaster.setFromCamera(pointer, camera);
      const intersections = raycaster.intersectObjects(
        Array.from(markerMeshesRef.current.values()),
      );
      const storyId = intersections[0]?.object.userData.storyId;
      if (typeof storyId === 'string') {
        onSelectStoryRef.current(storyId);
      }
    };

    renderer.domElement.addEventListener('pointerdown', handlePointerDown);
    renderer.domElement.addEventListener('pointerup', handlePointerUp);

    const resize = () => {
      const { width, height } = mount.getBoundingClientRect();
      if (!width || !height) return;
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height, false);
    };
    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(mount);
    resize();

    let animationFrame = 0;
    const animate = () => {
      animationFrame = requestAnimationFrame(animate);
      controls.update();

      const azimuth = THREE.MathUtils.radToDeg(
        Math.atan2(camera.position.x, camera.position.z),
      );
      onRotateRef.current(Math.max(-180, Math.min(180, azimuth)));

      markerMeshesRef.current.forEach((mesh, storyId) => {
        const active = storyId === activeStoryRef.current;
        const scale = active ? 1.6 : 1;
        mesh.scale.setScalar(scale);
      });

      orbitGroup.visible = showOrbit;
      radarGroup.visible = showRadar;
      changeGroup.visible = showChange;
      renderer.render(scene, camera);
    };
    animate();

    return () => {
      cancelAnimationFrame(animationFrame);
      resizeObserver.disconnect();
      controls.dispose();
      renderer.domElement.removeEventListener('pointerdown', handlePointerDown);
      renderer.domElement.removeEventListener('pointerup', handlePointerUp);
      texture.dispose();
      earthGeometry.dispose();
      earthMaterial.dispose();
      markerMeshesRef.current.forEach((mesh) => {
        if (mesh instanceof THREE.Mesh) {
          mesh.geometry.dispose();
          if (Array.isArray(mesh.material)) {
            mesh.material.forEach((material) => material.dispose());
          } else {
            mesh.material.dispose();
          }
        }
      });
      markerMeshesRef.current.clear();
      markerGroupRef.current = null;
      renderer.dispose();
      mount.removeChild(renderer.domElement);
    };
  }, [showChange, showOrbit, showRadar]);

  return (
    <div
      ref={mountRef}
      className="earth-globe-3d"
      aria-label="Interactive NASA Earth globe"
      role="img"
    />
  );
}