import * as THREE from 'three';
import { CharacterController } from './character.js';

export class Player {
    constructor(scene, game, characterClass = 'warrior') {
        this.scene = scene;
        this.game = game; // Reference to game for effects
        this.characterClass = characterClass;
        this.position = new THREE.Vector3(0, 0, 0);
        this.velocity = new THREE.Vector3(0, 0, 0);
        this.rotation = 0; // Y-axis rotation

        // Stats
        this.maxHealth = 100;
        this.health = this.maxHealth;
        this.moveSpeed = 8;
        this.jumpForce = 12;
        this.isGrounded = true;

        // Combat
        this.targetEnemy = null;
        this.attackRange = 2.5;
        this.autoAttackCooldown = 0;
        this.autoAttackCooldownMax = 0.8; // Faster attacks
        this.autoAttackDamage = 25;

        // Abilities
        this.abilities = {
            cleave: {
                cooldown: 5,
                cooldownRemaining: 0,
                damage: 40,
                range: 5.5,
                angle: Math.PI * 0.7, // 126 degrees (wider)
                isCharging: false,
                isActive: false
            },
            bladestorm: {
                cooldown: 6,
                cooldownRemaining: 0,
                spinDamage: 15,
                diskDamage: 25,
                duration: 3,
                isCharging: false,
                isActive: false,
                activeTime: 0
            },
            parry: {
                cooldown: 5,
                cooldownRemaining: 0,
                duration: 0.4,
                perfectWindow: 0.15,
                riposteDamage: 50,
                perfectDamage: 100,
                isActive: false,
                activeTime: 0
            },
            charge: {
                cooldown: 8,
                cooldownRemaining: 0,
                stunDuration: 1,
                isActive: false
            },
            potion: {
                cooldown: 10,
                cooldownRemaining: 0,
                healAmount: 30,
                isActive: false
            }
        };

        // Character controller for animated model
        this.character = new CharacterController(scene, this.characterClass);
        this.useAnimatedCharacter = false;
        this.characterLoading = false;

        // Visual representation (fallback)
        this.createMesh();

        // Try to load animated character
        this.loadCharacter();
    }

    async loadCharacter() {
        this.characterLoading = true;
        // Hide fallback mesh immediately while loading
        this.group.visible = false;

        try {
            const success = await this.character.load();
            if (success) {
                this.useAnimatedCharacter = true;
                console.log('Using animated character model');
            } else {
                // Show fallback if loading failed
                this.group.visible = true;
            }
        } catch (error) {
            console.warn('Failed to load animated character, using fallback:', error);
            this.group.visible = true;
        }
        this.characterLoading = false;
    }

    createMesh() {
        this.group = new THREE.Group();

        // Materials
        const skinMaterial = new THREE.MeshStandardMaterial({
            color: 0xffddaa,
            roughness: 0.7
        });
        const armorMaterial = new THREE.MeshStandardMaterial({
            color: 0x4488ff,
            roughness: 0.5,
            metalness: 0.3
        });
        const darkArmorMaterial = new THREE.MeshStandardMaterial({
            color: 0x2255aa,
            roughness: 0.5,
            metalness: 0.3
        });
        const bootMaterial = new THREE.MeshStandardMaterial({
            color: 0x4a3728,
            roughness: 0.8
        });

        // === TORSO ===
        const torsoGeometry = new THREE.BoxGeometry(0.6, 0.7, 0.35);
        const torso = new THREE.Mesh(torsoGeometry, armorMaterial);
        torso.position.y = 1.15;
        torso.castShadow = true;
        this.group.add(torso);

        // Chest plate detail
        const chestGeometry = new THREE.BoxGeometry(0.5, 0.5, 0.1);
        const chest = new THREE.Mesh(chestGeometry, darkArmorMaterial);
        chest.position.set(0, 1.2, 0.2);
        this.group.add(chest);

        // === LEGS ===
        // Left leg
        this.leftLeg = new THREE.Group();
        const leftThighGeometry = new THREE.CapsuleGeometry(0.12, 0.3, 4, 8);
        const leftThigh = new THREE.Mesh(leftThighGeometry, darkArmorMaterial);
        leftThigh.position.y = -0.25;
        this.leftLeg.add(leftThigh);

        const leftShinGeometry = new THREE.CapsuleGeometry(0.1, 0.3, 4, 8);
        const leftShin = new THREE.Mesh(leftShinGeometry, darkArmorMaterial);
        leftShin.position.y = -0.55;
        this.leftLeg.add(leftShin);

        const leftBootGeometry = new THREE.BoxGeometry(0.15, 0.15, 0.25);
        const leftBoot = new THREE.Mesh(leftBootGeometry, bootMaterial);
        leftBoot.position.set(0, -0.78, 0.05);
        this.leftLeg.add(leftBoot);

        this.leftLeg.position.set(-0.15, 0.8, 0);
        this.group.add(this.leftLeg);

        // Right leg
        this.rightLeg = new THREE.Group();
        const rightThighGeometry = new THREE.CapsuleGeometry(0.12, 0.3, 4, 8);
        const rightThigh = new THREE.Mesh(rightThighGeometry, darkArmorMaterial);
        rightThigh.position.y = -0.25;
        this.rightLeg.add(rightThigh);

        const rightShinGeometry = new THREE.CapsuleGeometry(0.1, 0.3, 4, 8);
        const rightShin = new THREE.Mesh(rightShinGeometry, darkArmorMaterial);
        rightShin.position.y = -0.55;
        this.rightLeg.add(rightShin);

        const rightBootGeometry = new THREE.BoxGeometry(0.15, 0.15, 0.25);
        const rightBoot = new THREE.Mesh(rightBootGeometry, bootMaterial);
        rightBoot.position.set(0, -0.78, 0.05);
        this.rightLeg.add(rightBoot);

        this.rightLeg.position.set(0.15, 0.8, 0);
        this.group.add(this.rightLeg);

        // === ARMS ===
        // Left arm (shield arm)
        this.leftArm = new THREE.Group();
        const leftShoulderGeometry = new THREE.SphereGeometry(0.12, 8, 8);
        const leftShoulder = new THREE.Mesh(leftShoulderGeometry, armorMaterial);
        this.leftArm.add(leftShoulder);

        const leftUpperArmGeometry = new THREE.CapsuleGeometry(0.08, 0.25, 4, 8);
        const leftUpperArm = new THREE.Mesh(leftUpperArmGeometry, skinMaterial);
        leftUpperArm.position.y = -0.2;
        this.leftArm.add(leftUpperArm);

        const leftForearmGeometry = new THREE.CapsuleGeometry(0.07, 0.2, 4, 8);
        const leftForearm = new THREE.Mesh(leftForearmGeometry, skinMaterial);
        leftForearm.position.y = -0.42;
        this.leftArm.add(leftForearm);

        // Small shield
        const shieldGeometry = new THREE.BoxGeometry(0.35, 0.45, 0.05);
        const shieldMaterial = new THREE.MeshStandardMaterial({
            color: 0x666688,
            roughness: 0.3,
            metalness: 0.7
        });
        const shield = new THREE.Mesh(shieldGeometry, shieldMaterial);
        shield.position.set(0, -0.45, 0.15);
        this.leftArm.add(shield);

        this.leftArm.position.set(-0.42, 1.35, 0);
        this.leftArm.rotation.z = 0.2;
        this.group.add(this.leftArm);

        // Right arm (sword arm)
        this.rightArm = new THREE.Group();
        const rightShoulderGeometry = new THREE.SphereGeometry(0.12, 8, 8);
        const rightShoulder = new THREE.Mesh(rightShoulderGeometry, armorMaterial);
        this.rightArm.add(rightShoulder);

        const rightUpperArmGeometry = new THREE.CapsuleGeometry(0.08, 0.25, 4, 8);
        const rightUpperArm = new THREE.Mesh(rightUpperArmGeometry, skinMaterial);
        rightUpperArm.position.y = -0.2;
        this.rightArm.add(rightUpperArm);

        const rightForearmGeometry = new THREE.CapsuleGeometry(0.07, 0.2, 4, 8);
        const rightForearm = new THREE.Mesh(rightForearmGeometry, skinMaterial);
        rightForearm.position.y = -0.42;
        this.rightArm.add(rightForearm);

        this.rightArm.position.set(0.42, 1.35, 0);
        this.rightArm.rotation.z = -0.2;
        this.group.add(this.rightArm);

        // === HEAD ===
        const headGeometry = new THREE.SphereGeometry(0.25, 16, 12);
        this.headMesh = new THREE.Mesh(headGeometry, skinMaterial);
        this.headMesh.position.y = 1.7;
        this.headMesh.castShadow = true;
        this.group.add(this.headMesh);

        // Helmet
        const helmetGeometry = new THREE.SphereGeometry(0.28, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.6);
        const helmetMaterial = new THREE.MeshStandardMaterial({
            color: 0x4488ff,
            roughness: 0.3,
            metalness: 0.5
        });
        const helmet = new THREE.Mesh(helmetGeometry, helmetMaterial);
        helmet.position.y = 1.75;
        this.group.add(helmet);

        // Eyes (to show facing direction)
        const eyeMaterial = new THREE.MeshBasicMaterial({ color: 0x000000 });
        const eyeGeometry = new THREE.SphereGeometry(0.04, 8, 8);

        const leftEye = new THREE.Mesh(eyeGeometry, eyeMaterial);
        leftEye.position.set(-0.08, 1.72, 0.22);
        this.group.add(leftEye);

        const rightEye = new THREE.Mesh(eyeGeometry, eyeMaterial);
        rightEye.position.set(0.08, 1.72, 0.22);
        this.group.add(rightEye);

        // === SWORD ===
        const swordGroup = new THREE.Group();

        const bladeGeometry = new THREE.BoxGeometry(0.06, 1.0, 0.02);
        const bladeMaterial = new THREE.MeshStandardMaterial({
            color: 0xdddddd,
            roughness: 0.2,
            metalness: 0.9
        });
        const blade = new THREE.Mesh(bladeGeometry, bladeMaterial);
        blade.position.y = 0.5;
        swordGroup.add(blade);

        // Blade tip
        const tipGeometry = new THREE.ConeGeometry(0.03, 0.15, 4);
        const tip = new THREE.Mesh(tipGeometry, bladeMaterial);
        tip.position.y = 1.05;
        swordGroup.add(tip);

        const hiltGeometry = new THREE.BoxGeometry(0.25, 0.06, 0.06);
        const hiltMaterial = new THREE.MeshStandardMaterial({
            color: 0xffd700,
            roughness: 0.4,
            metalness: 0.6
        });
        const hilt = new THREE.Mesh(hiltGeometry, hiltMaterial);
        swordGroup.add(hilt);

        const handleGeometry = new THREE.CylinderGeometry(0.03, 0.03, 0.2, 8);
        const handleMaterial = new THREE.MeshStandardMaterial({ color: 0x8B4513 });
        const handle = new THREE.Mesh(handleGeometry, handleMaterial);
        handle.position.y = -0.12;
        swordGroup.add(handle);

        // Attach sword to right hand
        swordGroup.position.set(0, -0.55, 0.1);
        swordGroup.rotation.x = -0.3;
        this.swordMesh = swordGroup;
        this.rightArm.add(swordGroup);

        // Animation state
        this.walkCycle = 0;

        this.scene.add(this.group);
    }

    setTarget(enemy) {
        // Clear previous target highlight
        if (this.targetEnemy && this.targetEnemy.setTargeted) {
            this.targetEnemy.setTargeted(false);
        }

        this.targetEnemy = enemy;

        // Set new target highlight
        if (enemy && enemy.setTargeted) {
            enemy.setTargeted(true);
        }
    }

    update(deltaTime, input, cameraController) {
        // Process movement (pass input to check if mouse turning)
        const isMoving = this.handleMovement(deltaTime, input, cameraController, input.rightMouseDown);

        // Process abilities
        this.updateAbilities(deltaTime);

        // Auto-attack cooldown
        if (this.autoAttackCooldown > 0) {
            this.autoAttackCooldown -= deltaTime;
        }

        // Automatically attack target if in range
        if (this.targetEnemy && this.targetEnemy.isAlive && this.autoAttackCooldown <= 0) {
            const dx = this.targetEnemy.position.x - this.position.x;
            const dz = this.targetEnemy.position.z - this.position.z;
            const dist = Math.sqrt(dx * dx + dz * dz);
            if (dist <= this.attackRange) {
                this.performAutoAttack();
            }
        }

        // Bladestorm tick damage
        if (this.abilities.bladestorm.isActive && this.game) {
            this.bladestormTick(this.game.enemies);
        }

        // Update visual position - use animated character if loaded
        if (this.useAnimatedCharacter) {
            this.character.setPosition(this.position.x, this.position.y, this.position.z);
            this.character.setRotation(this.rotation);
            this.character.update(deltaTime, isMoving, true, this.isGrounded);
        } else {
            // Fallback to procedural mesh
            this.group.position.copy(this.position);
            this.group.rotation.y = this.rotation;

            // Walk animation for fallback
            if (isMoving && this.isGrounded) {
                this.walkCycle += deltaTime * 12;
                const legSwing = Math.sin(this.walkCycle) * 0.5;
                const armSwing = Math.sin(this.walkCycle) * 0.3;

                this.leftLeg.rotation.x = legSwing;
                this.rightLeg.rotation.x = -legSwing;
                this.leftArm.rotation.x = -armSwing;
                this.rightArm.rotation.x = armSwing;
            } else {
                this.walkCycle = 0;
                this.leftLeg.rotation.x *= 0.9;
                this.rightLeg.rotation.x *= 0.9;
                this.leftArm.rotation.x *= 0.9;
                this.rightArm.rotation.x *= 0.9;
            }
        }
    }

    handleMovement(deltaTime, input, cameraController, isMouseTurning = false) {
        // Forward/backward movement (W/S)
        const forwardBack = new THREE.Vector3();
        if (input.keys.w || input.keys.arrowup) forwardBack.z -= 1;
        if (input.keys.s || input.keys.arrowdown) forwardBack.z += 1;

        // Strafe movement (A/D) - sideways, no turning
        const strafe = new THREE.Vector3();
        if (input.keys.a || input.keys.arrowleft) strafe.x -= 1;
        if (input.keys.d || input.keys.arrowright) strafe.x += 1;

        // Calculate final movement direction
        const moveDir = new THREE.Vector3();
        const cameraYaw = -cameraController.yaw;
        const cos = Math.cos(cameraYaw);
        const sin = Math.sin(cameraYaw);

        // Rotate forward/back by camera yaw
        if (forwardBack.length() > 0) {
            const rotatedZ = forwardBack.z * cos;
            const rotatedX = -forwardBack.z * sin;
            moveDir.x += rotatedX;
            moveDir.z += rotatedZ;
        }

        // Rotate strafe by camera yaw (perpendicular)
        if (strafe.length() > 0) {
            const rotatedX = strafe.x * cos;
            const rotatedZ = strafe.x * sin;
            moveDir.x += rotatedX;
            moveDir.z += rotatedZ;
        }

        let isMoving = false;
        if (moveDir.length() > 0) {
            isMoving = true;
            moveDir.normalize();

            // Apply movement
            this.position.x += moveDir.x * this.moveSpeed * deltaTime;
            this.position.z += moveDir.z * this.moveSpeed * deltaTime;

            // Only turn character when moving forward (W), not backward or strafing
            // Also don't override rotation when mouse turning (right-click held)
            if (forwardBack.z < 0 && !isMouseTurning) {
                // Only when pressing W (forward), update facing direction
                const forwardDir = new THREE.Vector3(-forwardBack.z * sin, 0, forwardBack.z * cos);
                if (forwardDir.length() > 0) {
                    this.rotation = Math.atan2(forwardDir.x, forwardDir.z);
                }
            }
        }

        // Jumping (spacebar is ' ' key)
        if (input.keys[' '] && this.isGrounded) {
            this.velocity.y = this.jumpForce;
            this.isGrounded = false;
            input.keys[' '] = false; // Consume jump input

            // Play jump animation
            if (this.useAnimatedCharacter) {
                this.character.playJump();
            }
        }

        // Apply gravity
        if (!this.isGrounded) {
            this.velocity.y -= 30 * deltaTime;
            this.position.y += this.velocity.y * deltaTime;

            if (this.position.y <= 0) {
                this.position.y = 0;
                this.velocity.y = 0;
                this.isGrounded = true;
            }
        }

        // Keep in bounds
        const bounds = 95;
        this.position.x = Math.max(-bounds, Math.min(bounds, this.position.x));
        this.position.z = Math.max(-bounds, Math.min(bounds, this.position.z));

        return isMoving;
    }

    updateAbilities(deltaTime) {
        // Update cooldowns
        for (const key in this.abilities) {
            const ability = this.abilities[key];
            if (ability.cooldownRemaining > 0) {
                ability.cooldownRemaining -= deltaTime;
                if (ability.cooldownRemaining < 0) ability.cooldownRemaining = 0;
            }
        }

        // Parry duration
        if (this.abilities.parry.isActive) {
            this.abilities.parry.activeTime += deltaTime;
            if (this.abilities.parry.activeTime >= this.abilities.parry.duration) {
                this.abilities.parry.isActive = false;
                this.abilities.parry.activeTime = 0;
            }
        }

        // Bladestorm duration
        if (this.abilities.bladestorm.isActive) {
            this.abilities.bladestorm.activeTime += deltaTime;
            if (this.abilities.bladestorm.activeTime >= this.abilities.bladestorm.duration) {
                this.endBladestorm();
            }
        }
    }

    // Target-based auto attack
    performAutoAttack() {
        if (this.autoAttackCooldown > 0) return false;
        if (!this.targetEnemy || !this.targetEnemy.isAlive) return false;

        // Check range (horizontal distance so jumping doesn't affect range)
        const dx = this.targetEnemy.position.x - this.position.x;
        const dz = this.targetEnemy.position.z - this.position.z;
        const horizontalDist = Math.sqrt(dx * dx + dz * dz);

        if (horizontalDist > this.attackRange) return false;

        this.autoAttackCooldown = this.autoAttackCooldownMax;

        // Face the target
        this.rotation = Math.atan2(dx, dz);

        // Play attack animation
        if (this.useAnimatedCharacter) {
            // Cycle through attack animations
            this.attackAnimIndex = ((this.attackAnimIndex || 0) % 4) + 1;
            this.character.playAttack(this.attackAnimIndex);
        }

        // Visual swing effect toward target
        if (this.game && this.game.effects) {
            this.game.effects.createSwingEffect(this.position, this.rotation, 0xffffff);
        }

        // Swing trail particles
        if (this.game && this.game.particles) {
            const startPos = this.position.clone();
            startPos.y += 1;
            const endPos = this.targetEnemy.position.clone();
            endPos.y += 1;
            this.game.particles.swingTrail(startPos, endPos);
        }

        // Deal damage and show damage number
        this.targetEnemy.takeDamage(this.autoAttackDamage, this);
        if (this.game && this.game.effects) {
            this.game.effects.createDamageNumber(this.targetEnemy.position, this.autoAttackDamage);
        }

        return true;
    }

    // Ability: Cleave
    useCleave(enemies) {
        const ability = this.abilities.cleave;
        if (ability.cooldownRemaining > 0) return false;

        ability.cooldownRemaining = ability.cooldown;

        // Play attack animation for cleave
        if (this.useAnimatedCharacter) {
            this.character.playAttack(2); // Use a different attack for cleave
        }

        // Visual effect
        if (this.game && this.game.effects) {
            this.game.effects.createCleaveEffect(this.position, this.rotation);
        }

        // Particle effect - cleave wave
        if (this.game && this.game.particles) {
            const forward = new THREE.Vector3(
                Math.sin(this.rotation),
                0,
                Math.cos(this.rotation)
            );
            this.game.particles.cleaveWave(this.position, forward, ability.range);
        }

        // Hit enemies in front cone - uses horizontal distance so jumping doesn't miss
        let hitCount = 0;
        for (const enemy of enemies) {
            if (!enemy.isAlive) continue;

            // Horizontal distance only (ignore Y so attacks work while jumping)
            const dx = enemy.position.x - this.position.x;
            const dz = enemy.position.z - this.position.z;
            const horizontalDist = Math.sqrt(dx * dx + dz * dz);

            if (horizontalDist > ability.range) continue;

            // Check if in cone (horizontal only)
            const toEnemy = new THREE.Vector3(dx, 0, dz).normalize();
            const forward = new THREE.Vector3(
                Math.sin(this.rotation),
                0,
                Math.cos(this.rotation)
            );

            const dot = forward.dot(toEnemy);
            const angleToEnemy = Math.acos(Math.min(1, Math.max(-1, dot)));

            if (angleToEnemy <= ability.angle / 2) {
                enemy.takeDamage(ability.damage, this);
                // Damage number for each hit
                if (this.game && this.game.effects) {
                    this.game.effects.createDamageNumber(enemy.position, ability.damage);
                }
                hitCount++;
            }
        }

        return hitCount > 0;
    }

    // Ability: Bladestorm
    useBladestorm() {
        const ability = this.abilities.bladestorm;
        if (ability.cooldownRemaining > 0) return false;
        if (ability.isActive) return false;

        ability.isActive = true;
        ability.activeTime = 0;

        // Play power up animation
        if (this.useAnimatedCharacter) {
            this.character.playPowerUp();
        }

        // Visual effect - spinning blades around player
        if (this.game && this.game.effects) {
            const targetGroup = this.useAnimatedCharacter ? this.character.model : this.group;
            this.bladestormEffect = this.game.effects.createBladestormEffect(targetGroup);
        }

        return true;
    }

    endBladestorm() {
        const ability = this.abilities.bladestorm;
        ability.isActive = false;
        ability.activeTime = 0;
        ability.cooldownRemaining = ability.cooldown;

        // Remove bladestorm visual effect
        if (this.bladestormEffect) {
            this.bladestormEffect.life = 0;
            this.bladestormEffect = null;
        }

        // Throw disk projectile toward cursor/target
        if (this.game && this.game.effects) {
            const forward = new THREE.Vector3(
                Math.sin(this.rotation),
                0,
                Math.cos(this.rotation)
            );
            this.game.effects.createBladestormDiskEffect(this.position, forward);
        }
    }

    bladestormTick(enemies) {
        const ability = this.abilities.bladestorm;
        if (!ability.isActive) return;

        // Spin particles
        if (this.game && this.game.particles && Math.random() < 0.5) {
            this.game.particles.bladestormSpin(this.position);
        }

        // Track damage for periodic damage numbers
        if (!this.bladestormDamageAccum) this.bladestormDamageAccum = {};

        // Damage nearby enemies
        for (const enemy of enemies) {
            if (!enemy.isAlive) continue;

            const dx = enemy.position.x - this.position.x;
            const dz = enemy.position.z - this.position.z;
            const horizontalDist = Math.sqrt(dx * dx + dz * dz);
            if (horizontalDist <= 3) {
                const damage = ability.spinDamage * 0.1;
                enemy.takeDamage(damage, this);

                // Accumulate damage for this enemy
                const id = enemy.id || enemies.indexOf(enemy);
                if (!this.bladestormDamageAccum[id]) {
                    this.bladestormDamageAccum[id] = 0;
                }
                this.bladestormDamageAccum[id] += damage;

                // Show damage number every 0.5 worth of damage accumulated
                if (this.bladestormDamageAccum[id] >= 5) {
                    if (this.game && this.game.effects) {
                        this.game.effects.createDamageNumber(enemy.position, Math.round(this.bladestormDamageAccum[id]));
                    }
                    this.bladestormDamageAccum[id] = 0;
                }
            }
        }
    }

    // Ability: Parry
    useParry() {
        const ability = this.abilities.parry;
        if (ability.cooldownRemaining > 0) return false;
        if (ability.isActive) return false;

        ability.isActive = true;
        ability.activeTime = 0;
        ability.cooldownRemaining = ability.cooldown;

        // Play block animation
        if (this.useAnimatedCharacter) {
            this.character.playBlock();
        }

        // Visual parry stance effect
        if (this.game && this.game.effects) {
            this.game.effects.createParryEffect(this.position);
        }

        return true;
    }

    tryParry(attacker) {
        const ability = this.abilities.parry;
        if (!ability.isActive) return false;

        // Successful parry!
        const isPerfect = ability.activeTime <= ability.perfectWindow;
        const damage = isPerfect ? ability.perfectDamage : ability.riposteDamage;

        // Riposte visual effect
        if (this.game && this.game.effects && attacker) {
            this.game.effects.createRiposteEffect(this.position, attacker.position);
            this.game.effects.createDamageNumber(attacker.position, damage, false, isPerfect);
        }

        if (attacker && attacker.takeDamage) {
            attacker.takeDamage(damage, this);
            attacker.stun(isPerfect ? 1.0 : 0.5);
        }

        ability.isActive = false;
        return true;
    }

    // Ability: Charge
    useCharge() {
        const ability = this.abilities.charge;
        if (ability.cooldownRemaining > 0) return false;
        if (!this.targetEnemy || !this.targetEnemy.isAlive) return false;

        ability.cooldownRemaining = ability.cooldown;

        const startPos = this.position.clone();

        // Dash to target
        const dir = new THREE.Vector3().subVectors(this.targetEnemy.position, this.position);
        dir.y = 0;
        const dist = dir.length();

        if (dist > 1.5) {
            dir.normalize();
            this.position.add(dir.multiplyScalar(dist - 1));
            this.rotation = Math.atan2(dir.x, dir.z);
        }

        // Charge trail effect
        if (this.game && this.game.effects) {
            this.game.effects.createChargeEffect(startPos, this.position);
        }

        // Particle trail
        if (this.game && this.game.particles) {
            // Create trail along charge path
            const trailDir = new THREE.Vector3().subVectors(this.position, startPos).normalize();
            const steps = Math.ceil(dist / 1.5);
            for (let i = 0; i < steps; i++) {
                const pos = startPos.clone().addScaledVector(trailDir, i * 1.5);
                this.game.particles.chargeTrail(pos, trailDir);
            }
            // Impact at destination
            this.game.particles.bounceImpact(this.position);
            this.game.addScreenShake(0.6);
        }

        // Stun target
        this.targetEnemy.stun(ability.stunDuration);
        return true;
    }

    // Ability: Health Potion
    usePotion() {
        const ability = this.abilities.potion;
        if (ability.cooldownRemaining > 0) return false;

        ability.cooldownRemaining = ability.cooldown;
        this.health = Math.min(this.maxHealth, this.health + ability.healAmount);

        // Healing effect
        if (this.game && this.game.effects) {
            this.game.effects.createPotionEffect(this.position);
            this.game.effects.createDamageNumber(this.position, ability.healAmount, true);
        }

        // Heal particles
        if (this.game && this.game.particles) {
            this.game.particles.healEffect(this.position);
        }

        return true;
    }

    takeDamage(amount) {
        // Check parry
        if (this.abilities.parry.isActive) {
            // Parry is handled by tryParry, called by attacker
            return;
        }

        this.health -= amount;

        // Play impact animation
        if (this.useAnimatedCharacter) {
            this.character.playImpact();
        }

        // Hit particles
        if (this.game && this.game.particles) {
            this.game.particles.playerHit(this.position);
            this.game.addScreenShake(Math.min(amount / 20, 0.5));
        }

        if (this.health <= 0) {
            this.health = 0;
            this.die();
        }
    }

    die() {
        console.log('Player died!');

        // Play death animation
        if (this.useAnimatedCharacter) {
            this.character.playDeath();
        }

        // Reset for now
        setTimeout(() => {
            this.health = this.maxHealth;
            this.position.set(0, 0, 0);
            // Reset to idle after respawn
            if (this.useAnimatedCharacter) {
                this.character.playAnimation('idle', true);
            }
        }, 2000);
    }
}
