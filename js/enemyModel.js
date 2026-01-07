import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

export class EnemyModelController {
    constructor(scene, modelType = 'warrior') {
        this.scene = scene;
        this.modelType = modelType;
        this.model = null;
        this.mixer = null;
        this.animations = {};
        this.currentAction = null;
        this.isLoaded = false;
        this.scale = 0.4;
    }

    async load() {
        const loader = new GLTFLoader();

        // Skeleton model types
        const modelPaths = {
            warrior: 'assets/models/Skeleton_Warrior.glb',
            mage: 'assets/models/Skeleton_Mage.glb',
            minion: 'assets/models/Skeleton_Minion.glb',
            rogue: 'assets/models/Skeleton_Rogue.glb'
        };

        const modelPath = modelPaths[this.modelType] || modelPaths.warrior;

        try {
            const gltf = await this.loadGLTF(loader, modelPath);
            this.model = gltf.scene;
            this.model.scale.setScalar(this.scale);

            // Setup materials
            this.model.traverse((child) => {
                if (child.isMesh) {
                    child.castShadow = true;
                    child.receiveShadow = true;
                }
            });

            // Create animation mixer
            this.mixer = new THREE.AnimationMixer(this.model);

            // Load animations
            await this.loadAnimations(loader);

            this.scene.add(this.model);
            this.isLoaded = true;

            // Start with idle
            this.playAnimation('idle', true);

            return true;
        } catch (error) {
            console.error('Failed to load enemy model:', error);
            return false;
        }
    }

    loadGLTF(loader, path) {
        return new Promise((resolve, reject) => {
            loader.load(
                path,
                (gltf) => resolve(gltf),
                undefined,
                (error) => reject(error)
            );
        });
    }

    async loadAnimations(loader) {
        const animationFiles = [
            'assets/models/Rig_Medium_General.glb',
            'assets/models/Rig_Medium_MovementBasic.glb'
        ];

        const animationMappings = {
            'Idle': 'idle',
            'Walk': 'walk',
            'Run': 'run',
            'Attack_1H': 'attack',
            'Hit': 'hit',
            'Death': 'death'
        };

        for (const animFile of animationFiles) {
            try {
                const gltf = await this.loadGLTF(loader, animFile);

                if (gltf.animations) {
                    for (const clip of gltf.animations) {
                        const animName = animationMappings[clip.name] || clip.name.toLowerCase();

                        if (this.animations[animName]) continue;

                        const action = this.mixer.clipAction(clip);

                        if (['idle', 'walk', 'run'].includes(animName)) {
                            action.setLoop(THREE.LoopRepeat);
                        } else if (animName === 'death') {
                            action.setLoop(THREE.LoopOnce);
                            action.clampWhenFinished = true;
                        } else {
                            action.setLoop(THREE.LoopOnce);
                            action.clampWhenFinished = true;
                        }

                        this.animations[animName] = action;
                    }
                }
            } catch (error) {
                console.warn(`Could not load animation file ${animFile}`);
            }
        }

        this.mixer.addEventListener('finished', (e) => {
            this.onAnimationFinished(e.action);
        });
    }

    onAnimationFinished(action) {
        const animName = action.getClip().name;

        if (animName === 'attack' || animName === 'hit') {
            this.playAnimation('idle', true);
        }
    }

    playAnimation(name, loop = false, crossfadeDuration = 0.2) {
        if (!this.animations[name]) return;

        const newAction = this.animations[name];

        if (this.currentAction === newAction) return;

        if (this.currentAction) {
            newAction.reset();
            newAction.setEffectiveTimeScale(1);
            newAction.setEffectiveWeight(1);
            newAction.crossFadeFrom(this.currentAction, crossfadeDuration, true);
            newAction.play();
        } else {
            newAction.reset();
            newAction.play();
        }

        this.currentAction = newAction;
    }

    playAttack() {
        if (this.animations.attack) {
            this.playAnimation('attack', false, 0.1);
        }
    }

    playHit() {
        if (this.animations.hit) {
            this.playAnimation('hit', false, 0.1);
        }
    }

    playDeath() {
        if (this.animations.death) {
            this.playAnimation('death', false, 0.2);
        }
    }

    update(deltaTime, isMoving) {
        if (!this.isLoaded) return;

        if (this.mixer) {
            this.mixer.update(deltaTime);
        }

        if (this.currentAction === this.animations.death) return;

        if (isMoving && this.currentAction !== this.animations.attack) {
            this.playAnimation('walk', true);
        } else if (!isMoving && this.currentAction !== this.animations.attack) {
            this.playAnimation('idle', true);
        }
    }

    setPosition(x, y, z) {
        if (this.model) {
            this.model.position.set(x, y, z);
        }
    }

    setRotation(yRotation) {
        if (this.model) {
            this.model.rotation.y = yRotation;
        }
    }

    dispose() {
        if (this.mixer) {
            this.mixer.stopAllAction();
        }
        if (this.model) {
            this.scene.remove(this.model);
            this.model.traverse((child) => {
                if (child.geometry) child.geometry.dispose();
                if (child.material) {
                    if (Array.isArray(child.material)) {
                        child.material.forEach(m => m.dispose());
                    } else {
                        child.material.dispose();
                    }
                }
            });
        }
    }
}
