import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

export class EnvironmentLoader {
    constructor(scene) {
        this.scene = scene;
        this.loader = new GLTFLoader();
        this.loadedModels = {};
        this.instances = [];
    }

    async loadModel(name, path) {
        return new Promise((resolve, reject) => {
            this.loader.load(
                path,
                (gltf) => {
                    this.loadedModels[name] = gltf.scene;
                    resolve(gltf.scene);
                },
                undefined,
                (error) => {
                    console.warn(`Failed to load ${name}:`, error);
                    reject(error);
                }
            );
        });
    }

    async loadAllModels() {
        const models = [
            { name: 'barrel', path: 'assets/environment/barrel_large.gltf' },
            { name: 'barrelStack', path: 'assets/environment/barrel_small_stack.gltf' },
            { name: 'crates', path: 'assets/environment/crates_stacked.gltf' },
            { name: 'pillar', path: 'assets/environment/pillar.gltf' },
            { name: 'column', path: 'assets/environment/column.gltf' },
            { name: 'torch', path: 'assets/environment/torch_lit.gltf' },
            { name: 'torchMounted', path: 'assets/environment/torch_mounted.gltf' },
            { name: 'chest', path: 'assets/environment/chest.gltf' },
            { name: 'table', path: 'assets/environment/table_medium.gltf' },
            { name: 'chair', path: 'assets/environment/chair.gltf' },
        ];

        const promises = models.map(m => this.loadModel(m.name, m.path).catch(() => null));
        await Promise.all(promises);
        console.log('Environment models loaded:', Object.keys(this.loadedModels));
    }

    placeModel(name, x, y, z, rotationY = 0, scale = 1) {
        const template = this.loadedModels[name];
        if (!template) {
            console.warn(`Model ${name} not loaded`);
            return null;
        }

        const instance = template.clone();
        instance.position.set(x, y, z);
        instance.rotation.y = rotationY;
        instance.scale.setScalar(scale);

        // Enable shadows on all meshes
        instance.traverse((child) => {
            if (child.isMesh) {
                child.castShadow = true;
                child.receiveShadow = true;
            }
        });

        this.scene.add(instance);
        this.instances.push(instance);
        return instance;
    }

    createArenaEnvironment() {
        // Place pillars around the arena
        const pillarPositions = [
            { x: -20, z: -20 },
            { x: 20, z: -20 },
            { x: -20, z: 20 },
            { x: 20, z: 20 },
            { x: 0, z: -25 },
            { x: 0, z: 25 },
            { x: -25, z: 0 },
            { x: 25, z: 0 },
        ];

        for (const pos of pillarPositions) {
            this.placeModel('pillar', pos.x, 0, pos.z, Math.random() * Math.PI * 2, 2);
        }

        // Place barrels and crates around edges
        const propPositions = [
            { type: 'barrel', x: -15, z: -18, rot: 0.3 },
            { type: 'barrel', x: -16, z: -16, rot: 1.2 },
            { type: 'crates', x: 18, z: -15, rot: 0.8 },
            { type: 'barrelStack', x: 16, z: 15, rot: 2.1 },
            { type: 'barrel', x: -18, z: 12, rot: 0.5 },
            { type: 'crates', x: -14, z: 18, rot: 1.5 },
            { type: 'chest', x: 22, z: 0, rot: -Math.PI / 2 },
            { type: 'chest', x: -22, z: 0, rot: Math.PI / 2 },
        ];

        for (const prop of propPositions) {
            this.placeModel(prop.type, prop.x, 0, prop.z, prop.rot, 1.5);
        }

        // Place torches
        const torchPositions = [
            { x: -20, z: -20 },
            { x: 20, z: -20 },
            { x: -20, z: 20 },
            { x: 20, z: 20 },
        ];

        for (const pos of torchPositions) {
            const torch = this.placeModel('torch', pos.x, 0, pos.z, 0, 1.5);
            if (torch) {
                // Add point light for torch
                const light = new THREE.PointLight(0xff6622, 2, 10);
                light.position.set(pos.x, 2.5, pos.z);
                this.scene.add(light);
            }
        }

        // Place some tables and chairs
        this.placeModel('table', -12, 0, -22, 0.2, 1.5);
        this.placeModel('chair', -14, 0, -22, 0.8, 1.5);
        this.placeModel('chair', -10, 0, -22, -0.5, 1.5);

        this.placeModel('table', 12, 0, 22, 1.8, 1.5);
        this.placeModel('chair', 14, 0, 22, 2.5, 1.5);
    }

    dispose() {
        for (const instance of this.instances) {
            this.scene.remove(instance);
            instance.traverse((child) => {
                if (child.isMesh) {
                    if (child.geometry) child.geometry.dispose();
                    if (child.material) {
                        if (Array.isArray(child.material)) {
                            child.material.forEach(m => m.dispose());
                        } else {
                            child.material.dispose();
                        }
                    }
                }
            });
        }
        this.instances = [];
    }
}
