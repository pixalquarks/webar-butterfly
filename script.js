import * as THREE from "three";
import { ARButton } from "three/addons/webxr/ARButton.js";
import { GLTFLoader } from "./jsm/loaders/GLTFLoader.js";

let container;
let camera, scene, renderer, controls, clock;
let controller;

let reticle;

let hitTestSource = null;
let hitTestSourceRequested = false;

const models = new Map();
const mixers = [];

init();
animate();

function loadAnimatedModel(
  model,
  position = new THREE.Vector3(0, 0, 0),
  rotation = new THREE.Vector3(0, 0, 0)
) {
  let loader = new GLTFLoader().setPath("models/");
  loader.load(
    model + ".glb",
    function (glb) {
      const current_obj = glb.scene;

      const mainObj = current_obj.children[0];
      console.log(mainObj);
      const textureLoader = new THREE.TextureLoader();
      const alphaTexture = textureLoader.load("models/alphaMap.jpg");

      const texture = textureLoader.load("models/texture.jpg");
      const normal = textureLoader.load("models/normal.jpg");

      for (let i = 0; i < 3; i++) {
        if (
          mainObj.children[i].isMesh &&
          mainObj.children[i].name.includes("WING")
        ) {
          mainObj.children[i].material.transparent = true;
          mainObj.children[i].material.alphaMap = alphaTexture;
          mainObj.children[i].material.map = texture;
          mainObj.children[i].material.normalMap = normal;
        }
      }

      current_obj.position.x = position.x;
      current_obj.position.y = position.y;
      current_obj.position.z = position.z;

      current_obj.rotation.x = rotation.x;
      current_obj.rotation.y = rotation.y;
      current_obj.rotation.z = rotation.z;

      const mixer = new THREE.AnimationMixer(current_obj);
      glb.animations.forEach((clip) => {
        console.log("Playing clip");
        mixer.clipAction(clip).play();
      });
      mixers.push(mixer);
      scene.add(current_obj);

      render();
    },
    undefined,
    (err) => {
      console.error(err);
    }
  );
}

function init() {
  container = document.createElement("div");
  document.body.appendChild(container);

  scene = new THREE.Scene();
  clock = new THREE.Clock();

  camera = new THREE.PerspectiveCamera(
    70,
    window.innerWidth / window.innerHeight,
    0.01,
    20
  );

  const light = new THREE.HemisphereLight(0xffffff, 0xbbbbff, 1);
  light.position.set(0.5, 1, 0.25);
  scene.add(light);

  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.xr.enabled = true;
  container.appendChild(renderer.domElement);

  //

  document.body.appendChild(
    ARButton.createButton(renderer, { requiredFeatures: ["hit-test"] })
  );

  reticle = new THREE.Mesh(
    new THREE.RingGeometry(0.15, 0.2, 32).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial()
  );
  reticle.matrixAutoUpdate = false;
  reticle.visible = false;
  scene.add(reticle);

  loadAnimatedModel(
    "butterfly9",
    new THREE.Vector3(0, 0, -3),
    new THREE.Vector3(0, 90, 0)
  );
  loadAnimatedModel("butterfly9", new THREE.Vector3(-3, 2, -4));
  loadAnimatedModel("butterfly9", new THREE.Vector3(10, 4, -6));
  loadAnimatedModel("butterfly9", new THREE.Vector3(2, 3, 3));

  window.addEventListener("resize", onWindowResize);
}

function onWindowResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();

  renderer.setSize(window.innerWidth, window.innerHeight);
}

//

function animate() {
  renderer.setAnimationLoop(render);
}

function render(timestamp, frame) {
  if (frame) {
    const referenceSpace = renderer.xr.getReferenceSpace();
    const session = renderer.xr.getSession();

    if (hitTestSourceRequested === false) {
      session.requestReferenceSpace("viewer").then(function (referenceSpace) {
        session
          .requestHitTestSource({ space: referenceSpace })
          .then(function (source) {
            hitTestSource = source;
          });
      });

      session.addEventListener("end", function () {
        hitTestSourceRequested = false;
        hitTestSource = null;
      });

      hitTestSourceRequested = true;
    }

    if (hitTestSource) {
      const hitTestResults = frame.getHitTestResults(hitTestSource);

      if (hitTestResults.length) {
        const hit = hitTestResults[0];

        reticle.visible = true;
        reticle.matrix.fromArray(hit.getPose(referenceSpace).transform.matrix);
      } else {
        reticle.visible = false;
      }
    }
  }
  let delta = clock.getDelta();
  mixers.forEach((mixer) => {
    if (mixer) mixer.update(delta);
  });

  if (renderer.xr.isPresenting) {
    renderer.render(scene, camera);
  }
}
