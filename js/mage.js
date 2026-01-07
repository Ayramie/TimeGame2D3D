import * as THREE from 'three';
import { PlayerBase } from './playerBase.js';

export class Mage extends PlayerBase {
    constructor(scene, game, characterClass = 'mage') {
        super(scene, game, characterClass);
        this.className = 'Mage';

        // Mage-specific stats
        this.maxHealth = 80;
        this.health = this.maxHealth;
        this.moveSpeed = 7;
        this.attackRange = 15;
        this.autoAttackCooldownMax = 1.0;
        this.autoAttackDamage = 20;

        // Mage Abilities
        this.abilities = {
            blizzard: {
                cooldown: 8,
                cooldownRemaining: 0,
                damage: 10,
                slowAmount: 0.5,
                duration: 4,
                radius: 5,
                isActive: false
            },
            flameWave: {
                cooldown: 6,
                cooldownRemaining: 0,
                damage: 35,
                range: 8,
                angle: Math.PI * 0.6,
                isActive: false
            },
            burnAura: {
                cooldown: 1,
                cooldownRemaining: 0,
                damage: 5,
                radius: 4,
                manaCost: 2,
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

        // Mage-specific systems
        this.projectiles = [];
        this.groundEffects = [];

        // Create fallback mesh and load animated character
        this.createMesh();
        this.loadCharacter();
    }

    createMesh() {
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

    update(deltaTime) {
        // Process movement
        const isMoving = this.handleMovement(deltaTime);

        // Process abilities
        this.updateAbilityCooldowns(deltaTime);

        // Update mage-specific systems
        this.updateProjectiles(deltaTime);
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

        // Update visuals
        this.updateVisuals(deltaTime, isMoving);
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

        const boltGeometry = new THREE.SphereGeometry(0.2, 8, 6);
        const boltMaterial = new THREE.MeshBasicMaterial({
            color: 0x44aaff,
            transparent: true,
            opacity: 0.9
        });
        const bolt = new THREE.Mesh(boltGeometry, boltMaterial);
        bolt.position.copy(startPos);
        this.scene.add(bolt);

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

        if (this.game && this.game.particles) {
            this.game.particles.magicCast(startPos);
        }
    }

    updateProjectiles(deltaTime) {
        for (let i = this.projectiles.length - 1; i >= 0; i--) {
            const proj = this.projectiles[i];

            if (!proj.target || !proj.target.isAlive) {
                this.scene.remove(proj.mesh);
                proj.mesh.geometry.dispose();
                proj.mesh.material.dispose();
                this.projectiles.splice(i, 1);
                continue;
            }

            const targetPos = proj.target.position.clone();
            targetPos.y += 1;

            const dir = new THREE.Vector3().subVectors(targetPos, proj.mesh.position);
            const dist = dir.length();
            dir.normalize();

            proj.mesh.position.addScaledVector(dir, proj.speed * deltaTime);

            if (dist < 0.5) {
                proj.target.takeDamage(proj.damage, this);

                if (this.game && this.game.effects) {
                    this.game.effects.createDamageNumber(proj.target.position, proj.damage);
                }

                if (this.game && this.game.particles) {
                    this.game.particles.magicImpact(proj.mesh.position);
                }

                this.scene.remove(proj.mesh);
                proj.mesh.geometry.dispose();
                proj.mesh.material.dispose();
                this.projectiles.splice(i, 1);
            }
        }
    }

    // ========== MAGE ABILITIES ==========

    useBlizzard(targetPosition) {
        const ability = this.abilities.blizzard;
        if (ability.cooldownRemaining > 0) return false;

        ability.cooldownRemaining = ability.cooldown;

        if (this.useAnimatedCharacter) {
            this.character.playAttack(2);
        }

        this.createBlizzardZone(targetPosition);
        return true;
    }

    createBlizzardZone(position) {
        const ability = this.abilities.blizzard;

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

        if (this.game && this.game.particles) {
            this.game.particles.blizzardBurst(position);
        }
    }

    updateGroundEffects(deltaTime) {
        for (let i = this.groundEffects.length - 1; i >= 0; i--) {
            const effect = this.groundEffects[i];
            effect.duration -= deltaTime;

            if (effect.duration <= 0) {
                this.scene.remove(effect.mesh);
                this.scene.remove(effect.border);
                effect.mesh.geometry.dispose();
                effect.mesh.material.dispose();
                effect.border.geometry.dispose();
                effect.border.material.dispose();
                this.groundEffects.splice(i, 1);
                continue;
            }

            effect.tickTimer += deltaTime;
            if (effect.tickTimer >= 0.5) {
                effect.tickTimer = 0;

                if (this.game && this.game.enemies) {
                    for (const enemy of this.game.enemies) {
                        if (!enemy.isAlive) continue;

                        const dist = enemy.position.distanceTo(effect.position);
                        if (dist < effect.radius) {
                            enemy.takeDamage(effect.damage, this);

                            if (this.game.effects) {
                                this.game.effects.createDamageNumber(enemy.position, effect.damage);
                            }

                            if (!enemy.originalMoveSpeed) {
                                enemy.originalMoveSpeed = enemy.moveSpeed;
                            }
                            enemy.moveSpeed = enemy.originalMoveSpeed * effect.slowAmount;
                            enemy.slowTimer = 1.0;
                        }
                    }
                }

                if (this.game && this.game.particles) {
                    this.game.particles.blizzardTick(effect.position);
                }
            }

            if (effect.duration < 1) {
                effect.mesh.material.opacity = effect.duration * 0.4;
                effect.border.material.opacity = effect.duration * 0.7;
            }
        }
    }

    useFlameWave(enemies) {
        const ability = this.abilities.flameWave;
        if (ability.cooldownRemaining > 0) return false;

        ability.cooldownRemaining = ability.cooldown;

        if (this.useAnimatedCharacter) {
            this.character.playAttack(3);
        }

        if (this.game && this.game.effects) {
            this.game.effects.createFlameWaveEffect(this.position, this.rotation);
        }

        if (this.game && this.game.particles) {
            const forward = new THREE.Vector3(
                Math.sin(this.rotation),
                0,
                Math.cos(this.rotation)
            );
            this.game.particles.flameWave(this.position, forward, ability.range);
        }

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

    toggleBurnAura() {
        const ability = this.abilities.burnAura;
        if (ability.cooldownRemaining > 0) return false;

        ability.isActive = !ability.isActive;
        ability.cooldownRemaining = ability.cooldown;

        if (ability.isActive) {
            this.createBurnAuraVisual();
        } else {
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

        if (this.burnAuraMesh) {
            this.burnAuraMesh.position.x = this.position.x;
            this.burnAuraMesh.position.y = 0.35;
            this.burnAuraMesh.position.z = this.position.z;

            const pulse = Math.sin(ability.tickTimer * 5) * 0.1 + 0.3;
            this.burnAuraMesh.material.opacity = pulse;
        }

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

    useBackstep() {
        const ability = this.abilities.backstep;
        if (ability.cooldownRemaining > 0) return false;

        ability.cooldownRemaining = ability.cooldown;

        const backDir = new THREE.Vector3(
            -Math.sin(this.rotation),
            0,
            -Math.cos(this.rotation)
        );

        const startPos = this.position.clone();

        this.position.addScaledVector(backDir, ability.distance);

        // Use dynamic bounds based on dungeon size
        let maxBound = 52;
        if (this.game && this.game.dungeon) {
            maxBound = (this.game.dungeon.width - 2) * this.game.dungeon.tileSize;
        }
        const minBound = 2;
        this.position.x = Math.max(minBound, Math.min(maxBound, this.position.x));
        this.position.z = Math.max(minBound, Math.min(maxBound, this.position.z));

        if (this.useAnimatedCharacter) {
            this.character.playJump();
        }

        if (this.game && this.game.particles) {
            this.game.particles.backstepTrail(startPos, this.position);
        }

        if (this.game) {
            this.game.addScreenShake(0.3);
        }

        return true;
    }

    // Override die to clean up burn aura
    die() {
        this.abilities.burnAura.isActive = false;
        this.removeBurnAuraVisual();
        super.die();
    }

    // Cleanup
    dispose() {
        for (const proj of this.projectiles) {
            this.scene.remove(proj.mesh);
            proj.mesh.geometry.dispose();
            proj.mesh.material.dispose();
        }
        this.projectiles = [];

        for (const effect of this.groundEffects) {
            this.scene.remove(effect.mesh);
            this.scene.remove(effect.border);
            effect.mesh.geometry.dispose();
            effect.mesh.material.dispose();
            effect.border.geometry.dispose();
            effect.border.material.dispose();
        }
        this.groundEffects = [];

        this.removeBurnAuraVisual();

        if (this.character) {
            this.character.dispose();
        }

        if (this.group) {
            this.scene.remove(this.group);
        }
    }
}
