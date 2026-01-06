import * as THREE from 'three';
import { CharacterController } from './character.js';

export class Mage {
    constructor(scene, game) {
        this.scene = scene;
        this.game = game;
        this.position = new THREE.Vector3(0, 0, 0);
        this.velocity = new THREE.Vector3(0, 0, 0);
        this.rotation = 0;
        this.className = 'Mage';

        // Stats - Mage has less health but ranged attacks
        this.maxHealth = 80;
        this.health = this.maxHealth;
        this.moveSpeed = 7;
        this.jumpForce = 12;
        this.isGrounded = true;

        // Combat - Ranged
        this.targetEnemy = null;
        this.attackRange = 15; // Much longer range
        this.autoAttackCooldown = 0;
        this.autoAttackCooldownMax = 1.0; // Slower but ranged
        this.autoAttackDamage = 20;

        // Mage Abilities
        this.abilities = {
            blizzard: {
                cooldown: 8,
                cooldownRemaining: 0,
                damage: 10, // per tick
                slowAmount: 0.5, // 50% slow
                duration: 4,
                radius: 5,
                isActive: false
            },
            flameWave: {
                cooldown: 6,
                cooldownRemaining: 0,
                damage: 35,
                range: 8,
                angle: Math.PI * 0.6, // 108 degrees
                isActive: false
            },
            burnAura: {
                cooldown: 1, // Toggle cooldown
                cooldownRemaining: 0,
                damage: 5, // per tick
                radius: 4,
                manaCost: 2, // per second (future mana system)
                isActive: false,
                tickTimer: 0
            },
            backstep: {
                cooldown: 5,
                cooldownRemaining: 0,
                distance: 6,
                isActive: false
            },
            potion: {
                cooldown: 10,
                cooldownRemaining: 0,
                healAmount: 25,
                isActive: false
            }
        };

        // Projectiles for auto-attack
        this.projectiles = [];

        // Active ground effects (blizzard zones)
        this.groundEffects = [];

        // Character controller for animated model
        this.character = new CharacterController(scene);
        this.useAnimatedCharacter = false;
        this.characterLoading = false;

        // Visual representation (fallback)
        this.createMesh();

        // Try to load animated character
        this.loadCharacter();
    }

    async loadCharacter() {
        this.characterLoading = true;
        this.group.visible = false;

        try {
            const success = await this.character.load();
            if (success) {
                this.useAnimatedCharacter = true;
                console.log('Mage: Using animated character model');
            } else {
                this.group.visible = true;
            }
        } catch (error) {
            console.warn('Failed to load mage character, using fallback:', error);
            this.group.visible = true;
        }
        this.characterLoading = false;
    }

    createMesh() {
        // Simple mage fallback mesh - robed figure
        this.group = new THREE.Group();

        const robeMaterial = new THREE.MeshStandardMaterial({
            color: 0x4422aa,
            roughness: 0.7
        });
        const skinMaterial = new THREE.MeshStandardMaterial({
            color: 0xffddaa,
            roughness: 0.7
        });

        // Robe body
        const robeGeometry = new THREE.ConeGeometry(0.5, 1.5, 8);
        const robe = new THREE.Mesh(robeGeometry, robeMaterial);
        robe.position.y = 0.75;
        this.group.add(robe);

        // Head
        const headGeometry = new THREE.SphereGeometry(0.25, 16, 12);
        const head = new THREE.Mesh(headGeometry, skinMaterial);
        head.position.y = 1.7;
        this.group.add(head);

        // Wizard hat
        const hatGeometry = new THREE.ConeGeometry(0.3, 0.6, 8);
        const hatMaterial = new THREE.MeshStandardMaterial({ color: 0x2211aa });
        const hat = new THREE.Mesh(hatGeometry, hatMaterial);
        hat.position.y = 2.1;
        this.group.add(hat);

        // Staff
        const staffGeometry = new THREE.CylinderGeometry(0.03, 0.03, 1.8, 8);
        const staffMaterial = new THREE.MeshStandardMaterial({ color: 0x8B4513 });
        const staff = new THREE.Mesh(staffGeometry, staffMaterial);
        staff.position.set(0.4, 1, 0);
        staff.rotation.z = -0.2;
        this.group.add(staff);

        // Staff orb
        const orbGeometry = new THREE.SphereGeometry(0.12, 8, 6);
        const orbMaterial = new THREE.MeshStandardMaterial({
            color: 0x44aaff,
            emissive: 0x2266ff,
            emissiveIntensity: 0.5
        });
        const orb = new THREE.Mesh(orbGeometry, orbMaterial);
        orb.position.set(0.55, 1.9, 0);
        this.group.add(orb);

        this.scene.add(this.group);
    }

    setTarget(enemy) {
        if (this.targetEnemy && this.targetEnemy.setTargeted) {
            this.targetEnemy.setTargeted(false);
        }
        this.targetEnemy = enemy;
        if (enemy && enemy.setTargeted) {
            enemy.setTargeted(true);
        }
    }

    update(deltaTime, input, cameraController) {
        // Process movement
        const isMoving = this.handleMovement(deltaTime, input, cameraController, input.rightMouseDown);

        // Process abilities
        this.updateAbilities(deltaTime);

        // Update projectiles
        this.updateProjectiles(deltaTime);

        // Update ground effects
        this.updateGroundEffects(deltaTime);

        // Burn aura tick damage
        if (this.abilities.burnAura.isActive && this.game) {
            this.burnAuraTick(deltaTime);
        }

        // Auto-attack cooldown
        if (this.autoAttackCooldown > 0) {
            this.autoAttackCooldown -= deltaTime;
        }

        // Automatically attack target if in range
        if (this.targetEnemy && this.targetEnemy.isAlive && this.autoAttackCooldown <= 0) {
            const dist = this.position.distanceTo(this.targetEnemy.position);
            if (dist <= this.attackRange) {
                this.performAutoAttack();
            }
        }

        // Update visual position
        if (this.useAnimatedCharacter) {
            this.character.setPosition(this.position.x, this.position.y, this.position.z);
            this.character.setRotation(this.rotation);
            this.character.update(deltaTime, isMoving, true, this.isGrounded);
        } else {
            this.group.position.copy(this.position);
            this.group.rotation.y = this.rotation;
        }
    }

    handleMovement(deltaTime, input, cameraController, isMouseTurning = false) {
        const forwardBack = new THREE.Vector3();
        if (input.keys.w || input.keys.arrowup) forwardBack.z -= 1;
        if (input.keys.s || input.keys.arrowdown) forwardBack.z += 1;

        const strafe = new THREE.Vector3();
        if (input.keys.a || input.keys.arrowleft) strafe.x -= 1;
        if (input.keys.d || input.keys.arrowright) strafe.x += 1;

        const moveDir = new THREE.Vector3();
        const cameraYaw = -cameraController.yaw;
        const cos = Math.cos(cameraYaw);
        const sin = Math.sin(cameraYaw);

        if (forwardBack.length() > 0) {
            const rotatedZ = forwardBack.z * cos;
            const rotatedX = -forwardBack.z * sin;
            moveDir.x += rotatedX;
            moveDir.z += rotatedZ;
        }

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

            this.position.x += moveDir.x * this.moveSpeed * deltaTime;
            this.position.z += moveDir.z * this.moveSpeed * deltaTime;

            if (forwardBack.z < 0 && !isMouseTurning) {
                const forwardDir = new THREE.Vector3(-forwardBack.z * sin, 0, forwardBack.z * cos);
                if (forwardDir.length() > 0) {
                    this.rotation = Math.atan2(forwardDir.x, forwardDir.z);
                }
            }
        }

        // Jumping
        if (input.keys[' '] && this.isGrounded) {
            this.velocity.y = this.jumpForce;
            this.isGrounded = false;
            input.keys[' '] = false;

            if (this.useAnimatedCharacter) {
                this.character.playJump();
            }
        }

        // Gravity
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
        for (const key in this.abilities) {
            const ability = this.abilities[key];
            if (ability.cooldownRemaining > 0) {
                ability.cooldownRemaining -= deltaTime;
                if (ability.cooldownRemaining < 0) ability.cooldownRemaining = 0;
            }
        }
    }

    // Ranged auto-attack - fires magic bolt at target
    performAutoAttack() {
        if (this.autoAttackCooldown > 0) return false;
        if (!this.targetEnemy || !this.targetEnemy.isAlive) return false;

        const dist = this.position.distanceTo(this.targetEnemy.position);
        if (dist > this.attackRange) return false;

        this.autoAttackCooldown = this.autoAttackCooldownMax;

        // Face the target
        const dx = this.targetEnemy.position.x - this.position.x;
        const dz = this.targetEnemy.position.z - this.position.z;
        this.rotation = Math.atan2(dx, dz);

        // Play cast animation
        if (this.useAnimatedCharacter) {
            this.character.playAttack(1);
        }

        // Create magic bolt projectile
        this.createMagicBolt(this.targetEnemy);

        return true;
    }

    createMagicBolt(target) {
        const startPos = this.position.clone();
        startPos.y += 1.5;

        // Projectile visual
        const boltGeometry = new THREE.SphereGeometry(0.2, 8, 6);
        const boltMaterial = new THREE.MeshBasicMaterial({
            color: 0x44aaff,
            transparent: true,
            opacity: 0.9
        });
        const bolt = new THREE.Mesh(boltGeometry, boltMaterial);
        bolt.position.copy(startPos);
        this.scene.add(bolt);

        // Glow effect
        const glowGeometry = new THREE.SphereGeometry(0.35, 8, 6);
        const glowMaterial = new THREE.MeshBasicMaterial({
            color: 0x88ccff,
            transparent: true,
            opacity: 0.4
        });
        const glow = new THREE.Mesh(glowGeometry, glowMaterial);
        bolt.add(glow);

        this.projectiles.push({
            mesh: bolt,
            target: target,
            speed: 20,
            damage: this.autoAttackDamage,
            type: 'magicBolt'
        });

        // Cast particles
        if (this.game && this.game.particles) {
            this.game.particles.magicCast(startPos);
        }
    }

    updateProjectiles(deltaTime) {
        for (let i = this.projectiles.length - 1; i >= 0; i--) {
            const proj = this.projectiles[i];

            if (!proj.target || !proj.target.isAlive) {
                // Target died, remove projectile
                this.scene.remove(proj.mesh);
                proj.mesh.geometry.dispose();
                proj.mesh.material.dispose();
                this.projectiles.splice(i, 1);
                continue;
            }

            // Move toward target
            const targetPos = proj.target.position.clone();
            targetPos.y += 1;

            const dir = new THREE.Vector3().subVectors(targetPos, proj.mesh.position);
            const dist = dir.length();
            dir.normalize();

            proj.mesh.position.addScaledVector(dir, proj.speed * deltaTime);

            // Check hit
            if (dist < 0.5) {
                // Deal damage
                proj.target.takeDamage(proj.damage, this);

                // Damage number
                if (this.game && this.game.effects) {
                    this.game.effects.createDamageNumber(proj.target.position, proj.damage);
                }

                // Impact particles
                if (this.game && this.game.particles) {
                    this.game.particles.magicImpact(proj.mesh.position);
                }

                // Remove projectile
                this.scene.remove(proj.mesh);
                proj.mesh.geometry.dispose();
                proj.mesh.material.dispose();
                this.projectiles.splice(i, 1);
            }
        }
    }

    // Q - Blizzard: AoE slow zone at target location
    useBlizzard(targetPosition) {
        const ability = this.abilities.blizzard;
        if (ability.cooldownRemaining > 0) return false;

        ability.cooldownRemaining = ability.cooldown;

        // Play cast animation
        if (this.useAnimatedCharacter) {
            this.character.playAttack(2);
        }

        // Create blizzard zone
        this.createBlizzardZone(targetPosition);

        return true;
    }

    createBlizzardZone(position) {
        const ability = this.abilities.blizzard;

        // Visual - icy circle on ground
        const zoneGeometry = new THREE.CircleGeometry(ability.radius, 32);
        const zoneMaterial = new THREE.MeshBasicMaterial({
            color: 0x88ccff,
            transparent: true,
            opacity: 0.4,
            side: THREE.DoubleSide,
            depthWrite: false
        });
        const zone = new THREE.Mesh(zoneGeometry, zoneMaterial);
        zone.rotation.x = -Math.PI / 2;
        zone.position.copy(position);
        zone.position.y = 0.35;
        this.scene.add(zone);

        // Border ring
        const borderGeometry = new THREE.RingGeometry(ability.radius - 0.15, ability.radius, 32);
        const borderMaterial = new THREE.MeshBasicMaterial({
            color: 0xaaddff,
            transparent: true,
            opacity: 0.7,
            side: THREE.DoubleSide,
            depthWrite: false
        });
        const border = new THREE.Mesh(borderGeometry, borderMaterial);
        border.rotation.x = -Math.PI / 2;
        border.position.copy(position);
        border.position.y = 0.36;
        this.scene.add(border);

        this.groundEffects.push({
            type: 'blizzard',
            mesh: zone,
            border: border,
            position: position.clone(),
            radius: ability.radius,
            damage: ability.damage,
            slowAmount: ability.slowAmount,
            duration: ability.duration,
            tickTimer: 0
        });

        // Initial burst particles
        if (this.game && this.game.particles) {
            this.game.particles.blizzardBurst(position);
        }
    }

    updateGroundEffects(deltaTime) {
        for (let i = this.groundEffects.length - 1; i >= 0; i--) {
            const effect = this.groundEffects[i];
            effect.duration -= deltaTime;

            if (effect.duration <= 0) {
                // Remove effect
                this.scene.remove(effect.mesh);
                this.scene.remove(effect.border);
                effect.mesh.geometry.dispose();
                effect.mesh.material.dispose();
                effect.border.geometry.dispose();
                effect.border.material.dispose();
                this.groundEffects.splice(i, 1);
                continue;
            }

            // Tick damage and slow
            effect.tickTimer += deltaTime;
            if (effect.tickTimer >= 0.5) {
                effect.tickTimer = 0;

                // Apply to enemies in range
                if (this.game && this.game.enemies) {
                    for (const enemy of this.game.enemies) {
                        if (!enemy.isAlive) continue;

                        const dist = enemy.position.distanceTo(effect.position);
                        if (dist < effect.radius) {
                            // Damage
                            enemy.takeDamage(effect.damage, this);

                            if (this.game.effects) {
                                this.game.effects.createDamageNumber(enemy.position, effect.damage);
                            }

                            // Apply slow
                            if (!enemy.originalMoveSpeed) {
                                enemy.originalMoveSpeed = enemy.moveSpeed;
                            }
                            enemy.moveSpeed = enemy.originalMoveSpeed * effect.slowAmount;
                            enemy.slowTimer = 1.0; // Reset slow timer
                        }
                    }
                }

                // Spawn ice particles
                if (this.game && this.game.particles) {
                    this.game.particles.blizzardTick(effect.position);
                }
            }

            // Fade out near end
            if (effect.duration < 1) {
                effect.mesh.material.opacity = effect.duration * 0.4;
                effect.border.material.opacity = effect.duration * 0.7;
            }
        }
    }

    // W - Flame Wave: Cone fire attack
    useFlameWave(enemies) {
        const ability = this.abilities.flameWave;
        if (ability.cooldownRemaining > 0) return false;

        ability.cooldownRemaining = ability.cooldown;

        // Play cast animation
        if (this.useAnimatedCharacter) {
            this.character.playAttack(3);
        }

        // Visual effect
        if (this.game && this.game.effects) {
            this.game.effects.createFlameWaveEffect(this.position, this.rotation);
        }

        // Particle effect
        if (this.game && this.game.particles) {
            const forward = new THREE.Vector3(
                Math.sin(this.rotation),
                0,
                Math.cos(this.rotation)
            );
            this.game.particles.flameWave(this.position, forward, ability.range);
        }

        // Hit enemies in cone
        let hitCount = 0;
        for (const enemy of enemies) {
            if (!enemy.isAlive) continue;

            const dx = enemy.position.x - this.position.x;
            const dz = enemy.position.z - this.position.z;
            const dist = Math.sqrt(dx * dx + dz * dz);

            if (dist > ability.range) continue;

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

                if (this.game && this.game.effects) {
                    this.game.effects.createDamageNumber(enemy.position, ability.damage);
                }
                hitCount++;
            }
        }

        return hitCount > 0;
    }

    // E - Burn Aura: Toggle AoE damage around self
    toggleBurnAura() {
        const ability = this.abilities.burnAura;
        if (ability.cooldownRemaining > 0) return false;

        ability.isActive = !ability.isActive;
        ability.cooldownRemaining = ability.cooldown;

        if (ability.isActive) {
            // Create aura visual
            this.createBurnAuraVisual();
        } else {
            // Remove aura visual
            this.removeBurnAuraVisual();
        }

        return true;
    }

    createBurnAuraVisual() {
        if (this.burnAuraMesh) return;

        const auraGeometry = new THREE.RingGeometry(0.5, this.abilities.burnAura.radius, 32);
        const auraMaterial = new THREE.MeshBasicMaterial({
            color: 0xff4400,
            transparent: true,
            opacity: 0.3,
            side: THREE.DoubleSide,
            depthWrite: false
        });
        this.burnAuraMesh = new THREE.Mesh(auraGeometry, auraMaterial);
        this.burnAuraMesh.rotation.x = -Math.PI / 2;
        this.scene.add(this.burnAuraMesh);
    }

    removeBurnAuraVisual() {
        if (this.burnAuraMesh) {
            this.scene.remove(this.burnAuraMesh);
            this.burnAuraMesh.geometry.dispose();
            this.burnAuraMesh.material.dispose();
            this.burnAuraMesh = null;
        }
    }

    burnAuraTick(deltaTime) {
        const ability = this.abilities.burnAura;
        ability.tickTimer += deltaTime;

        // Update aura position
        if (this.burnAuraMesh) {
            this.burnAuraMesh.position.x = this.position.x;
            this.burnAuraMesh.position.y = 0.35;
            this.burnAuraMesh.position.z = this.position.z;

            // Pulse effect
            const pulse = Math.sin(ability.tickTimer * 5) * 0.1 + 0.3;
            this.burnAuraMesh.material.opacity = pulse;
        }

        // Fire particles
        if (this.game && this.game.particles && Math.random() < 0.3) {
            const angle = Math.random() * Math.PI * 2;
            const dist = Math.random() * ability.radius;
            const pos = new THREE.Vector3(
                this.position.x + Math.cos(angle) * dist,
                0.5,
                this.position.z + Math.sin(angle) * dist
            );
            this.game.particles.burnAuraFlame(pos);
        }

        // Damage tick
        if (ability.tickTimer >= 0.5) {
            ability.tickTimer = 0;

            if (this.game && this.game.enemies) {
                for (const enemy of this.game.enemies) {
                    if (!enemy.isAlive) continue;

                    const dist = this.position.distanceTo(enemy.position);
                    if (dist < ability.radius) {
                        enemy.takeDamage(ability.damage, this);

                        if (this.game && this.game.effects) {
                            this.game.effects.createDamageNumber(enemy.position, ability.damage);
                        }
                    }
                }
            }
        }
    }

    // R - Backstep: Dash backward
    useBackstep() {
        const ability = this.abilities.backstep;
        if (ability.cooldownRemaining > 0) return false;

        ability.cooldownRemaining = ability.cooldown;

        // Calculate backward direction
        const backDir = new THREE.Vector3(
            -Math.sin(this.rotation),
            0,
            -Math.cos(this.rotation)
        );

        const startPos = this.position.clone();

        // Move backward
        this.position.addScaledVector(backDir, ability.distance);

        // Keep in bounds
        const bounds = 95;
        this.position.x = Math.max(-bounds, Math.min(bounds, this.position.x));
        this.position.z = Math.max(-bounds, Math.min(bounds, this.position.z));

        // Play jump animation
        if (this.useAnimatedCharacter) {
            this.character.playJump();
        }

        // Trail effect
        if (this.game && this.game.particles) {
            this.game.particles.backstepTrail(startPos, this.position);
        }

        // Screen shake
        if (this.game) {
            this.game.addScreenShake(0.3);
        }

        return true;
    }

    // Health Potion
    usePotion() {
        const ability = this.abilities.potion;
        if (ability.cooldownRemaining > 0) return false;

        ability.cooldownRemaining = ability.cooldown;
        this.health = Math.min(this.maxHealth, this.health + ability.healAmount);

        if (this.game && this.game.effects) {
            this.game.effects.createPotionEffect(this.position);
            this.game.effects.createDamageNumber(this.position, ability.healAmount, true);
        }

        if (this.game && this.game.particles) {
            this.game.particles.healEffect(this.position);
        }

        return true;
    }

    takeDamage(amount) {
        this.health -= amount;

        if (this.useAnimatedCharacter) {
            this.character.playImpact();
        }

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
        console.log('Mage died!');

        if (this.useAnimatedCharacter) {
            this.character.playDeath();
        }

        // Cleanup burn aura
        this.abilities.burnAura.isActive = false;
        this.removeBurnAuraVisual();

        setTimeout(() => {
            this.health = this.maxHealth;
            this.position.set(0, 0, 0);
            if (this.useAnimatedCharacter) {
                this.character.playAnimation('idle', true);
            }
        }, 2000);
    }

    // Cleanup
    dispose() {
        // Remove projectiles
        for (const proj of this.projectiles) {
            this.scene.remove(proj.mesh);
            proj.mesh.geometry.dispose();
            proj.mesh.material.dispose();
        }
        this.projectiles = [];

        // Remove ground effects
        for (const effect of this.groundEffects) {
            this.scene.remove(effect.mesh);
            this.scene.remove(effect.border);
            effect.mesh.geometry.dispose();
            effect.mesh.material.dispose();
            effect.border.geometry.dispose();
            effect.border.material.dispose();
        }
        this.groundEffects = [];

        // Remove burn aura
        this.removeBurnAuraVisual();

        // Remove character
        if (this.character) {
            this.character.dispose();
        }

        // Remove fallback mesh
        if (this.group) {
            this.scene.remove(this.group);
        }
    }
}
