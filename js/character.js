import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

export class CharacterController {
    constructor(scene, characterClass = 'warrior') {
        this.scene = scene;
        this.characterClass = characterClass;
        this.model = null;
        this.mixer = null;
        this.animations = {};
        this.currentAction = null;
        this.isLoaded = false;
        this.loadProgress = 0;

        // Animation state
        this.animationState = 'idle';
        this.isAttacking = false;
        this.attackQueue = [];

        // Model scale (KayKit models are reasonably sized)
        this.scale = 0.5;
    }

    async load() {
        const loader = new GLTFLoader();

        // Select character model based on class
        const characterModels = {
            warrior: 'assets/models/Knight.glb',
            mage: 'assets/models/Mage.glb',
            barbarian: 'assets/models/Barbarian.glb',
            ranger: 'assets/models/Ranger.glb',
            rogue: 'assets/models/Rogue.glb'
        };

        const modelPath = characterModels[this.characterClass] || characterModels.warrior;

        try {
            // Load character model
            const gltf = await this.loadGLTF(loader, modelPath);
            this.model = gltf.scene;
            this.model.scale.setScalar(this.scale);

            // Setup materials for the character
            this.model.traverse((child) => {
                if (child.isMesh) {
                    child.castShadow = true;
                    child.receiveShadow = true;
                    if (child.material) {
                        if (Array.isArray(child.material)) {
                            child.material.forEach(m => this.fixMaterial(m));
                        } else {
                            this.fixMaterial(child.material);
                        }
                    }
                }
            });

            // Create animation mixer
            this.mixer = new THREE.AnimationMixer(this.model);

            // First check if character model has embedded animations
            if (gltf.animations && gltf.animations.length > 0) {
                console.log(`Character ${this.characterClass} has ${gltf.animations.length} embedded animations:`, gltf.animations.map(a => a.name));
                for (const clip of gltf.animations) {
                    const action = this.mixer.clipAction(clip);
                    action.setLoop(THREE.LoopRepeat);
                    this.animations[clip.name.toLowerCase()] = action;
                }
            }

            // Load additional animations from animation GLB files
            await this.loadAnimations(loader);

            this.scene.add(this.model);
            this.isLoaded = true;

            // Log what animations were loaded
            console.log('Character loaded:', this.characterClass, 'Animations:', Object.keys(this.animations));

            // Start with idle animation
            if (this.animations.idle) {
                this.playAnimation('idle', true);
            } else {
                console.warn('No idle animation found! Available:', Object.keys(this.animations));
            }

            return true;
        } catch (error) {
            console.error('Failed to load character:', error);
            return false;
        }
    }

    fixMaterial(material) {
        // Adjust material properties for better look
        if (material.isMeshStandardMaterial) {
            material.roughness = 0.7;
            material.metalness = 0.2;
        }
    }

    loadGLTF(loader, path) {
        return new Promise((resolve, reject) => {
            loader.load(
                path,
                (gltf) => resolve(gltf),
                (xhr) => {
                    if (xhr.total > 0) {
                        this.loadProgress = (xhr.loaded / xhr.total) * 100;
                    }
                },
                (error) => reject(error)
            );
        });
    }

    // Remove root motion from animation clips to prevent character moving on its own
    removeRootMotion(clip) {
        const filteredTracks = clip.tracks.filter(track => {
            const isPositionTrack = track.name.endsWith('.position');
            const isRootBone = track.name.includes('Root') ||
                              track.name.includes('Hips') ||
                              track.name.includes('Armature');

            // Remove position tracks on root bones
            if (isPositionTrack && isRootBone) {
                return false;
            }
            return true;
        });

        return new THREE.AnimationClip(clip.name, clip.duration, filteredTracks);
    }

    async loadAnimations(loader) {
        // KayKit animation files
        const animationFiles = [
            'assets/models/Rig_Medium_General.glb',
            'assets/models/Rig_Medium_MovementBasic.glb'
        ];

        // Animation name mappings (actual animation names to our names)
        const animationMappings = {
            // Movement animations
            'idle_a': 'idle',
            'idle_b': 'idle2',
            'walking_a': 'walk',
            'walking_b': 'walk2',
            'walking_c': 'walk3',
            'running_a': 'run',
            'running_b': 'run2',
            'jump_start': 'jump',
            'jump_idle': 'jumpIdle',
            'jump_land': 'land',
            'jump_full_short': 'jumpShort',
            'jump_full_long': 'jumpLong',
            // Combat animations
            'hit_a': 'impact',
            'hit_b': 'impact2',
            'death_a': 'death',
            'death_b': 'death2',
            // Additional
            'interact': 'interact',
            'pickup': 'pickup',
            'throw': 'throw',
            'use_item': 'useItem',
            'spawn_air': 'spawnAir',
            'spawn_ground': 'spawnGround'
        };

        // Load all animation files
        for (const animFile of animationFiles) {
            try {
                const gltf = await this.loadGLTF(loader, animFile);

                if (gltf.animations && gltf.animations.length > 0) {
                    console.log(`Loaded ${gltf.animations.length} animations from ${animFile}:`, gltf.animations.map(a => a.name));

                    for (const clip of gltf.animations) {
                        // Try to map the animation name
                        let animName = animationMappings[clip.name] || clip.name.toLowerCase();

                        // Skip if we already have this animation
                        if (this.animations[animName]) continue;

                        // Remove root motion
                        const cleanClip = this.removeRootMotion(clip);
                        cleanClip.name = animName;

                        const action = this.mixer.clipAction(cleanClip);

                        // Configure animation properties
                        if (['idle', 'idle2', 'walk', 'walk2', 'walk3', 'run', 'run2', 'jumpIdle'].includes(animName)) {
                            action.setLoop(THREE.LoopRepeat);
                        } else if (animName.startsWith('attack') || animName.startsWith('impact')) {
                            action.setLoop(THREE.LoopOnce);
                            action.clampWhenFinished = true;
                        } else if (animName.startsWith('death')) {
                            action.setLoop(THREE.LoopOnce);
                            action.clampWhenFinished = true;
                        } else if (['jump', 'jumpShort', 'jumpLong', 'land'].includes(animName)) {
                            action.setLoop(THREE.LoopOnce);
                            action.clampWhenFinished = false;
                        } else {
                            action.setLoop(THREE.LoopOnce);
                        }

                        this.animations[animName] = action;
                        console.log(`  - Registered animation: ${animName} (from ${clip.name})`);
                    }
                }
            } catch (error) {
                console.warn(`Could not load animation file ${animFile}:`, error.message);
            }
        }

        // Setup animation finished callback
        this.mixer.addEventListener('finished', (e) => {
            this.onAnimationFinished(e.action);
        });

        console.log('Available animations:', Object.keys(this.animations));
    }

    onAnimationFinished(action) {
        const animName = action.getClip().name;

        if (animName.startsWith('attack') || animName.startsWith('impact') || animName === 'throw') {
            this.isAttacking = false;
            this.attackStartTime = null;

            // Check if there's a queued attack
            if (this.attackQueue.length > 0) {
                const nextAttack = this.attackQueue.shift();
                this.playAttack(nextAttack);
            } else {
                this.returnToDefaultAnimation();
            }
        } else if (['jump', 'jumpShort', 'jumpLong', 'land', 'pickup', 'useItem'].includes(animName)) {
            this.returnToDefaultAnimation();
        }
    }

    returnToDefaultAnimation() {
        this.isAttacking = false;
        this.attackStartTime = null;
        if (['run', 'walk', 'strafeLeft', 'strafeRight'].includes(this.animationState)) {
            this.playAnimation(this.animationState, true);
        } else {
            this.playAnimation('idle', true);
        }
    }

    cancelAnimation() {
        this.isAttacking = false;
        this.attackStartTime = null;
        this.attackQueue = [];
        this.returnToDefaultAnimation();
    }

    playAnimation(name, loop = false, crossfadeDuration = 0.2) {
        if (!this.animations[name]) {
            // Try fallback animations
            if (name === 'strafe') name = 'strafeLeft';
            if (!this.animations[name]) {
                // Only warn if animations are loaded (otherwise still loading)
                if (this.isLoaded && Object.keys(this.animations).length > 0) {
                    console.warn(`Animation ${name} not found`);
                }
                return;
            }
        }

        const newAction = this.animations[name];

        if (this.currentAction === newAction) {
            return; // Already playing
        }

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

        if (!name.startsWith('attack') && name !== 'impact' && name !== 'death') {
            this.animationState = name;
        }
    }

    playAttack(attackNum = 1) {
        if (this.isAttacking) {
            if (this.attackQueue.length < 2) {
                this.attackQueue.push(attackNum);
            }
            return;
        }

        this.isAttacking = true;
        this.attackStartTime = Date.now();

        // Try attack animations, fall back to throw or impact
        const attackName = `attack${attackNum}`;
        if (this.animations[attackName]) {
            this.playAnimation(attackName, false, 0.1);
        } else if (this.animations.throw) {
            this.playAnimation('throw', false, 0.1);
        } else if (this.animations.impact) {
            this.playAnimation('impact', false, 0.1);
        }
    }

    playBlock() {
        if (!this.isAttacking) {
            this.playAnimation('block', false, 0.1);
        }
    }

    playImpact() {
        if (this.animations.impact && !this.isAttacking) {
            this.playAnimation('impact', false, 0.05);
            this.isAttacking = true;
        }
    }

    playDeath() {
        this.playAnimation('death', false, 0.2);
    }

    playJump() {
        if (this.animations.jump) {
            this.playAnimation('jump', false, 0.1);
        }
    }

    playRoll() {
        if (this.animations.roll && !this.isAttacking) {
            this.playAnimation('roll', false, 0.1);
        }
    }

    playPowerUp() {
        if (this.animations.powerUp) {
            this.playAnimation('powerUp', false, 0.2);
        }
    }

    update(deltaTime, isMoving, isRunning = true, isGrounded = true) {
        if (!this.isLoaded) return;

        if (this.mixer) {
            this.mixer.update(deltaTime);
        }

        // Don't change animation if dead
        if (this.currentAction === this.animations.death) return;

        // Clear stuck attacking state after timeout
        if (this.isAttacking && this.attackStartTime) {
            if (Date.now() - this.attackStartTime > 2000) {
                this.isAttacking = false;
                this.attackStartTime = null;
            }
        }

        // Update movement animations
        if (isMoving && !this.isAttacking) {
            if (isRunning && this.animations.run) {
                this.playAnimation('run', true);
            } else if (this.animations.walk) {
                this.playAnimation('walk', true);
            }
        } else if (!isMoving && !this.isAttacking) {
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

    getPosition() {
        return this.model ? this.model.position : new THREE.Vector3();
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
