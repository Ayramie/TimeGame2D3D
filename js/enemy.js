import * as THREE from 'three';

export class Enemy {
    constructor(scene, x, z) {
        this.scene = scene;
        this.position = new THREE.Vector3(x, 0, z);

        this.maxHealth = 100;
        this.health = this.maxHealth;
        this.isAlive = true;

        this.attackDamage = 5;
        this.attackCooldown = 0;
        this.attackCooldownMax = 2;
        this.attackRange = 1.5;

        this.moveSpeed = 3;
        this.aggroRange = 10;
        this.isAggro = false;

        this.stunTime = 0;

        this.createMesh();
        this.createHealthBar();
    }

    createMesh() {
        // Override in subclass
    }

    createHealthBar() {
        // Health bar background
        const bgGeometry = new THREE.PlaneGeometry(1.2, 0.15);
        const bgMaterial = new THREE.MeshBasicMaterial({
            color: 0x333333,
            side: THREE.DoubleSide
        });
        this.healthBarBg = new THREE.Mesh(bgGeometry, bgMaterial);

        // Health bar fill
        const fillGeometry = new THREE.PlaneGeometry(1.1, 0.1);
        const fillMaterial = new THREE.MeshBasicMaterial({
            color: 0xff4444,
            side: THREE.DoubleSide
        });
        this.healthBarFill = new THREE.Mesh(fillGeometry, fillMaterial);
        this.healthBarFill.position.z = 0.01;

        // Health bar group
        this.healthBarGroup = new THREE.Group();
        this.healthBarGroup.add(this.healthBarBg);
        this.healthBarGroup.add(this.healthBarFill);
        this.scene.add(this.healthBarGroup);

        // Target ring (hidden by default)
        const ringGeometry = new THREE.RingGeometry(1.2, 1.4, 32);
        const ringMaterial = new THREE.MeshBasicMaterial({
            color: 0xff4444,
            side: THREE.DoubleSide,
            transparent: true,
            opacity: 0.8
        });
        this.targetRing = new THREE.Mesh(ringGeometry, ringMaterial);
        this.targetRing.rotation.x = -Math.PI / 2; // Lay flat
        this.targetRing.position.y = 0.05;
        this.targetRing.visible = false;
        this.scene.add(this.targetRing);
    }

    setTargeted(isTargeted) {
        if (this.targetRing) {
            this.targetRing.visible = isTargeted;
        }
    }

    update(deltaTime, player, camera) {
        if (!this.isAlive) return;

        // Stun
        if (this.stunTime > 0) {
            this.stunTime -= deltaTime;
            return;
        }

        // Attack cooldown
        if (this.attackCooldown > 0) {
            this.attackCooldown -= deltaTime;
        }

        // Check aggro
        const distToPlayer = this.position.distanceTo(player.position);
        if (distToPlayer < this.aggroRange) {
            this.isAggro = true;
        }

        // Move toward player if aggro
        if (this.isAggro && distToPlayer > this.attackRange) {
            const dir = new THREE.Vector3()
                .subVectors(player.position, this.position)
                .normalize();
            dir.y = 0;

            this.position.add(dir.multiplyScalar(this.moveSpeed * deltaTime));

            // Face player
            if (this.mesh) {
                this.mesh.rotation.y = Math.atan2(dir.x, dir.z);
            }
        }

        // Update mesh position
        if (this.mesh) {
            this.mesh.position.copy(this.position);
        }

        // Update target ring position
        if (this.targetRing) {
            this.targetRing.position.x = this.position.x;
            this.targetRing.position.z = this.position.z;
        }

        // Update health bar to face camera
        this.updateHealthBar(camera);
    }

    updateHealthBar(camera) {
        if (!this.healthBarGroup) return;

        // Position above enemy
        this.healthBarGroup.position.copy(this.position);
        this.healthBarGroup.position.y = this.healthBarHeight || 2.5;

        // Face camera (proper billboard)
        if (camera) {
            this.healthBarGroup.lookAt(camera.position);
        }

        // Scale fill based on health
        const healthPercent = this.health / this.maxHealth;
        this.healthBarFill.scale.x = healthPercent;
        this.healthBarFill.position.x = (healthPercent - 1) * 0.55;
    }

    tryAttack(player) {
        if (this.attackCooldown > 0 || this.stunTime > 0) return false;

        // Check if player can parry
        if (player.tryParry && player.tryParry(this)) {
            this.attackCooldown = this.attackCooldownMax;
            return false;
        }

        player.takeDamage(this.attackDamage);
        this.attackCooldown = this.attackCooldownMax;
        return true;
    }

    takeDamage(amount, source) {
        this.health -= amount;
        this.isAggro = true;

        // Flash red
        if (this.mesh && this.mesh.material) {
            const originalColor = this.mesh.material.color.getHex();
            this.mesh.material.color.setHex(0xff0000);
            setTimeout(() => {
                if (this.mesh && this.mesh.material) {
                    this.mesh.material.color.setHex(originalColor);
                }
            }, 100);
        }

        // Emit hit particles (will be picked up by game)
        this.lastHitPosition = this.position.clone();
        this.lastHitPosition.y += 1;
        this.lastHitAmount = amount;

        if (this.health <= 0) {
            this.die();
        }
    }

    stun(duration) {
        this.stunTime = duration;
    }

    die() {
        this.isAlive = false;

        // Store death position for particles
        this.deathPosition = this.position.clone();
        this.deathPosition.y += 1;
        this.justDied = true;

        // Remove mesh
        if (this.mesh) {
            this.scene.remove(this.mesh);
        }

        // Remove health bar
        if (this.healthBarGroup) {
            this.scene.remove(this.healthBarGroup);
        }

        // Remove target ring
        if (this.targetRing) {
            this.scene.remove(this.targetRing);
        }
    }
}

export class SlimeEnemy extends Enemy {
    constructor(scene, x, z) {
        super(scene, x, z);

        this.name = 'Slime';
        this.maxHealth = 200;
        this.health = this.maxHealth;
        this.attackDamage = 8;
        this.moveSpeed = 2.5;

        // Slime-specific animation
        this.bounceTime = 0;
        this.bounceSpeed = 3;
    }

    createMesh() {
        // Slime body - squished sphere
        const bodyGeometry = new THREE.SphereGeometry(0.8, 16, 12);
        const bodyMaterial = new THREE.MeshStandardMaterial({
            color: 0x44dd44,
            roughness: 0.3,
            metalness: 0.1,
            transparent: true,
            opacity: 0.85
        });

        this.mesh = new THREE.Mesh(bodyGeometry, bodyMaterial);
        this.mesh.scale.y = 0.6;
        this.mesh.position.copy(this.position);
        this.mesh.position.y = 0.5;
        this.mesh.castShadow = true;

        // Eyes
        const eyeGeometry = new THREE.SphereGeometry(0.15, 8, 6);
        const eyeMaterial = new THREE.MeshStandardMaterial({ color: 0xffffff });
        const pupilGeometry = new THREE.SphereGeometry(0.08, 6, 4);
        const pupilMaterial = new THREE.MeshStandardMaterial({ color: 0x000000 });

        // Left eye
        const leftEye = new THREE.Mesh(eyeGeometry, eyeMaterial);
        leftEye.position.set(-0.25, 0.3, 0.6);
        this.mesh.add(leftEye);

        const leftPupil = new THREE.Mesh(pupilGeometry, pupilMaterial);
        leftPupil.position.set(0, 0, 0.1);
        leftEye.add(leftPupil);

        // Right eye
        const rightEye = new THREE.Mesh(eyeGeometry, eyeMaterial);
        rightEye.position.set(0.25, 0.3, 0.6);
        this.mesh.add(rightEye);

        const rightPupil = new THREE.Mesh(pupilGeometry, pupilMaterial);
        rightPupil.position.set(0, 0, 0.1);
        rightEye.add(rightPupil);

        this.scene.add(this.mesh);
        this.healthBarHeight = 1.8;
    }

    update(deltaTime, player, camera) {
        super.update(deltaTime, player, camera);

        if (!this.isAlive || !this.mesh) return;

        // Bouncing animation
        this.bounceTime += deltaTime * this.bounceSpeed;
        const bounce = Math.abs(Math.sin(this.bounceTime)) * 0.15;
        this.mesh.position.y = 0.5 + bounce;

        // Squash and stretch
        const squash = 1 - bounce * 0.3;
        this.mesh.scale.y = 0.6 * squash;
        this.mesh.scale.x = 1 + bounce * 0.2;
        this.mesh.scale.z = 1 + bounce * 0.2;
    }
}

export class GreaterSlimeEnemy extends Enemy {
    constructor(scene, x, z) {
        super(scene, x, z);

        this.maxHealth = 350;
        this.health = this.maxHealth;
        this.attackDamage = 15;
        this.moveSpeed = 2;
        this.aggroRange = 12;

        this.bounceTime = 0;
        this.bounceSpeed = 2;
    }

    createMesh() {
        // Larger purple slime
        const bodyGeometry = new THREE.SphereGeometry(1.2, 16, 12);
        const bodyMaterial = new THREE.MeshStandardMaterial({
            color: 0x8844aa,
            roughness: 0.3,
            metalness: 0.1,
            transparent: true,
            opacity: 0.85
        });

        this.mesh = new THREE.Mesh(bodyGeometry, bodyMaterial);
        this.mesh.scale.y = 0.6;
        this.mesh.position.copy(this.position);
        this.mesh.position.y = 0.7;
        this.mesh.castShadow = true;

        // Eyes
        const eyeGeometry = new THREE.SphereGeometry(0.2, 8, 6);
        const eyeMaterial = new THREE.MeshStandardMaterial({ color: 0xffff00 });
        const pupilGeometry = new THREE.SphereGeometry(0.1, 6, 4);
        const pupilMaterial = new THREE.MeshStandardMaterial({ color: 0x880000 });

        // Left eye
        const leftEye = new THREE.Mesh(eyeGeometry, eyeMaterial);
        leftEye.position.set(-0.35, 0.3, 0.9);
        this.mesh.add(leftEye);

        const leftPupil = new THREE.Mesh(pupilGeometry, pupilMaterial);
        leftPupil.position.set(0, 0, 0.12);
        leftEye.add(leftPupil);

        // Right eye
        const rightEye = new THREE.Mesh(eyeGeometry, eyeMaterial);
        rightEye.position.set(0.35, 0.3, 0.9);
        this.mesh.add(rightEye);

        const rightPupil = new THREE.Mesh(pupilGeometry, pupilMaterial);
        rightPupil.position.set(0, 0, 0.12);
        rightEye.add(rightPupil);

        this.scene.add(this.mesh);
        this.healthBarHeight = 2.5;
    }

    update(deltaTime, player, camera) {
        super.update(deltaTime, player, camera);

        if (!this.isAlive || !this.mesh) return;

        // Bouncing animation (slower, heavier)
        this.bounceTime += deltaTime * this.bounceSpeed;
        const bounce = Math.abs(Math.sin(this.bounceTime)) * 0.1;
        this.mesh.position.y = 0.7 + bounce;

        // Squash and stretch
        const squash = 1 - bounce * 0.2;
        this.mesh.scale.y = 0.6 * squash;
        this.mesh.scale.x = 1 + bounce * 0.15;
        this.mesh.scale.z = 1 + bounce * 0.15;
    }
}

// Attack type definitions
const AttackType = {
    WAVE: {
        name: 'Wave',
        damage: 20,
        telegraphDuration: 1.5,
        executeDuration: 0.3,
        cooldown: 3.0,
        range: 6
    },
    SLAM: {
        name: 'Slam',
        damage: 30,
        telegraphDuration: 2.0,
        executeDuration: 0.4,
        cooldown: 5.0,
        range: 8
    },
    SHOCKWAVE: {
        name: 'Shockwave',
        damage: 20,
        telegraphDuration: 1.8,
        executeDuration: 0.3,
        cooldown: 6.0,
        range: 4,
        stunDuration: 1.5
    },
    BOUNCE: {
        name: 'Bounce',
        damage: 25,
        telegraphDuration: 1.5,
        executeDuration: 1.2,
        cooldown: 8.0,
        range: 20
    }
};

export class SlimeBoss extends Enemy {
    constructor(scene, game, x, z) {
        super(scene, x, z);
        this.game = game;

        this.name = 'Slime Boss';
        this.maxHealth = 1600;
        this.health = this.maxHealth;
        this.attackDamage = 15;
        this.moveSpeed = 2;
        this.aggroRange = 30;

        // Boss is 2x2 in size conceptually
        this.bossSize = 2;

        // Phase system
        this.phase = 1;
        this.phaseTransitioning = false;
        this.phaseTransitionTimer = 0;
        this.spawnedAdds = false;

        // Attack system
        this.attackCooldowns = {
            WAVE: 0,
            SLAM: 0,
            SHOCKWAVE: 0,
            BOUNCE: 0
        };
        this.currentAttack = null;
        this.attackPhase = 'none'; // 'none', 'telegraph', 'execute'
        this.attackTimer = 0;
        this.attackHitPending = false;

        // Player proximity tracking (for shockwave)
        this.playerCloseTimer = 0;
        this.closeThreshold = 5;
        this.shockwaveChargeTime = 3.0;
        this.farThreshold = 10;

        // Bounce attack state
        this.bouncePositions = [];
        this.currentBounce = 0;
        this.bounceProgress = 0;
        this.bounceStartPos = new THREE.Vector3();
        this.bounceHits = [false, false, false];

        // Telegraph visuals
        this.telegraphMeshes = [];

        // Animation
        this.bounceTime = 0;
        this.bounceAnimSpeed = 1.5;

        // Target position for slam
        this.targetPosition = new THREE.Vector3();
    }

    createMesh() {
        // Main slime group
        this.mesh = new THREE.Group();
        this.mesh.position.copy(this.position);
        this.mesh.position.y = 1.2;

        // Large king slime body - higher poly for wobble effect
        const bodyGeometry = new THREE.SphereGeometry(1.8, 32, 24);
        // Store original positions for wobble
        this.originalPositions = bodyGeometry.attributes.position.array.slice();

        const bodyMaterial = new THREE.MeshPhysicalMaterial({
            color: 0x8844aa,
            roughness: 0.2,
            metalness: 0.0,
            transparent: true,
            opacity: 0.85,
            transmission: 0.3,
            thickness: 1.5,
            clearcoat: 0.8,
            clearcoatRoughness: 0.2,
            envMapIntensity: 0.5
        });

        this.bodyMesh = new THREE.Mesh(bodyGeometry, bodyMaterial);
        this.bodyMesh.scale.y = 0.65;
        this.bodyMesh.castShadow = true;
        this.mesh.add(this.bodyMesh);

        // Inner core glow
        const coreGeometry = new THREE.SphereGeometry(1.2, 16, 12);
        const coreMaterial = new THREE.MeshBasicMaterial({
            color: 0xdd66ff,
            transparent: true,
            opacity: 0.4
        });
        this.coreMesh = new THREE.Mesh(coreGeometry, coreMaterial);
        this.coreMesh.scale.y = 0.6;
        this.mesh.add(this.coreMesh);

        // Crown with gems
        const crownGroup = new THREE.Group();

        // Crown base ring
        const crownBaseGeometry = new THREE.TorusGeometry(0.5, 0.08, 8, 16);
        const crownMaterial = new THREE.MeshStandardMaterial({
            color: 0xffd700,
            roughness: 0.3,
            metalness: 0.8
        });
        const crownBase = new THREE.Mesh(crownBaseGeometry, crownMaterial);
        crownBase.rotation.x = Math.PI / 2;
        crownGroup.add(crownBase);

        // Crown spikes with gems
        for (let i = 0; i < 5; i++) {
            const angle = (i / 5) * Math.PI * 2;
            const spikeGeometry = new THREE.ConeGeometry(0.12, 0.5, 4);
            const spike = new THREE.Mesh(spikeGeometry, crownMaterial);
            spike.position.set(Math.cos(angle) * 0.45, 0.25, Math.sin(angle) * 0.45);
            crownGroup.add(spike);

            // Gem on each spike
            const gemGeometry = new THREE.OctahedronGeometry(0.08);
            const gemMaterial = new THREE.MeshStandardMaterial({
                color: i === 0 ? 0xff0044 : 0x44ffaa,
                roughness: 0.1,
                metalness: 0.3,
                emissive: i === 0 ? 0xff0022 : 0x22ff55,
                emissiveIntensity: 0.5
            });
            const gem = new THREE.Mesh(gemGeometry, gemMaterial);
            gem.position.set(Math.cos(angle) * 0.45, 0.55, Math.sin(angle) * 0.45);
            crownGroup.add(gem);
        }

        crownGroup.position.y = 1.1;
        this.crownGroup = crownGroup;
        this.mesh.add(crownGroup);

        // Eyes - larger and more menacing with glow
        const eyeGeometry = new THREE.SphereGeometry(0.35, 12, 8);
        const eyeMaterial = new THREE.MeshStandardMaterial({
            color: 0xffff44,
            emissive: 0xffff00,
            emissiveIntensity: 0.6
        });
        const pupilGeometry = new THREE.SphereGeometry(0.18, 8, 6);
        const pupilMaterial = new THREE.MeshStandardMaterial({
            color: 0x220000,
            emissive: 0xff0000,
            emissiveIntensity: 0.3
        });

        // Left eye
        this.leftEye = new THREE.Mesh(eyeGeometry, eyeMaterial);
        this.leftEye.position.set(-0.55, 0.5, 1.1);
        this.mesh.add(this.leftEye);

        this.leftPupil = new THREE.Mesh(pupilGeometry, pupilMaterial);
        this.leftPupil.position.set(0, 0, 0.22);
        this.leftEye.add(this.leftPupil);

        // Right eye
        this.rightEye = new THREE.Mesh(eyeGeometry, eyeMaterial);
        this.rightEye.position.set(0.55, 0.5, 1.1);
        this.mesh.add(this.rightEye);

        this.rightPupil = new THREE.Mesh(pupilGeometry, pupilMaterial);
        this.rightPupil.position.set(0, 0, 0.22);
        this.rightEye.add(this.rightPupil);

        // Angry eyebrows
        const browGeometry = new THREE.BoxGeometry(0.5, 0.08, 0.15);
        const browMaterial = new THREE.MeshStandardMaterial({ color: 0x442266 });

        const leftBrow = new THREE.Mesh(browGeometry, browMaterial);
        leftBrow.position.set(-0.55, 0.9, 1.15);
        leftBrow.rotation.z = 0.3;
        this.mesh.add(leftBrow);

        const rightBrow = new THREE.Mesh(browGeometry, browMaterial);
        rightBrow.position.set(0.55, 0.9, 1.15);
        rightBrow.rotation.z = -0.3;
        this.mesh.add(rightBrow);

        // Wobble animation state
        this.wobbleTime = 0;
        this.wobbleSpeed = 2.5;
        this.wobbleAmount = 0.08;

        // Drip timer
        this.dripTimer = 0;

        this.scene.add(this.mesh);
        this.healthBarHeight = 3.5;
    }

    update(deltaTime, player, camera) {
        if (!this.isAlive) return;

        // Don't do anything if game isn't playing yet
        if (this.game && this.game.gameState !== 'playing') return;

        // Update cooldowns
        for (const key in this.attackCooldowns) {
            if (this.attackCooldowns[key] > 0) {
                this.attackCooldowns[key] -= deltaTime;
            }
        }

        // Stun check
        if (this.stunTime > 0) {
            this.stunTime -= deltaTime;
            this.updateMeshPosition(deltaTime, player);
            this.updateHealthBar(camera);
            return;
        }

        // Phase transition at 50% HP
        if (this.phase === 1 && this.health <= this.maxHealth * 0.5 && !this.phaseTransitioning) {
            this.startPhaseTransition();
        }

        if (this.phaseTransitioning) {
            this.updatePhaseTransition(deltaTime);
            this.updateMeshPosition(deltaTime, player);
            this.updateHealthBar(camera);
            return;
        }

        // Track player proximity for shockwave
        const distToPlayer = this.position.distanceTo(player.position);
        if (distToPlayer <= this.closeThreshold) {
            this.playerCloseTimer += deltaTime;
        } else {
            this.playerCloseTimer = 0;
        }

        // Handle current attack
        if (this.attackPhase !== 'none') {
            this.updateAttack(deltaTime, player);
            this.updateMeshPosition(deltaTime, player);
            this.updateHealthBar(camera);
            return;
        }

        // Try to start an attack
        if (this.tryStartAttack(player, distToPlayer)) {
            this.updateMeshPosition(deltaTime, player);
            this.updateHealthBar(camera);
            return;
        }

        // Movement towards player (if not attacking)
        this.isAggro = true;
        if (distToPlayer > this.closeThreshold) {
            const dir = new THREE.Vector3()
                .subVectors(player.position, this.position)
                .normalize();
            dir.y = 0;
            this.position.add(dir.multiplyScalar(this.moveSpeed * deltaTime));

            // Face player
            if (this.mesh) {
                this.mesh.rotation.y = Math.atan2(dir.x, dir.z);
            }
        }

        this.updateMeshPosition(deltaTime, player);
        this.updateHealthBar(camera);

        // Update target ring
        if (this.targetRing) {
            this.targetRing.position.x = this.position.x;
            this.targetRing.position.z = this.position.z;
        }
    }

    updateMeshPosition(deltaTime, player) {
        if (!this.mesh) return;

        const dt = deltaTime || 0.016;

        // Bouncing animation
        this.bounceTime += dt * this.bounceAnimSpeed;
        const bounce = Math.abs(Math.sin(this.bounceTime)) * 0.15;

        this.mesh.position.x = this.position.x;
        this.mesh.position.z = this.position.z;
        this.mesh.position.y = 1.2 + bounce;

        // Wobble animation on body mesh
        if (this.bodyMesh && this.originalPositions) {
            this.wobbleTime += dt * this.wobbleSpeed;
            const positions = this.bodyMesh.geometry.attributes.position.array;

            for (let i = 0; i < positions.length; i += 3) {
                const ox = this.originalPositions[i];
                const oy = this.originalPositions[i + 1];
                const oz = this.originalPositions[i + 2];

                // Create organic wobble based on position and time
                const wobbleX = Math.sin(this.wobbleTime + oy * 3) * this.wobbleAmount;
                const wobbleZ = Math.cos(this.wobbleTime * 1.3 + oy * 2) * this.wobbleAmount;
                const wobbleY = Math.sin(this.wobbleTime * 0.8 + ox * 2) * this.wobbleAmount * 0.5;

                positions[i] = ox + wobbleX;
                positions[i + 1] = oy + wobbleY;
                positions[i + 2] = oz + wobbleZ;
            }
            this.bodyMesh.geometry.attributes.position.needsUpdate = true;
        }

        // Squash and stretch on body
        const squash = 1 - bounce * 0.2;
        if (this.bodyMesh) {
            this.bodyMesh.scale.y = 0.65 * squash;
            this.bodyMesh.scale.x = 1 + bounce * 0.1;
            this.bodyMesh.scale.z = 1 + bounce * 0.1;
        }
        if (this.coreMesh) {
            this.coreMesh.scale.y = 0.6 * squash;
            this.coreMesh.scale.x = 1 + bounce * 0.08;
            this.coreMesh.scale.z = 1 + bounce * 0.08;

            // Pulse the core glow
            const pulse = Math.sin(this.wobbleTime * 2) * 0.1 + 0.4;
            this.coreMesh.material.opacity = pulse;
        }

        // Crown wobble
        if (this.crownGroup) {
            this.crownGroup.rotation.y += dt * 0.3;
            this.crownGroup.position.y = 1.1 + Math.sin(this.wobbleTime * 1.5) * 0.05;
        }

        // Eyes track player
        if (player && this.leftEye && this.rightEye) {
            const toPlayer = new THREE.Vector3().subVectors(player.position, this.mesh.position);
            toPlayer.normalize();

            // Clamp eye movement
            const maxLook = 0.25;
            const lookX = Math.max(-maxLook, Math.min(maxLook, toPlayer.x * 0.3));
            const lookY = Math.max(-maxLook, Math.min(maxLook, (toPlayer.y - 0.5) * 0.2));

            if (this.leftPupil) {
                this.leftPupil.position.x = lookX;
                this.leftPupil.position.y = lookY;
            }
            if (this.rightPupil) {
                this.rightPupil.position.x = lookX;
                this.rightPupil.position.y = lookY;
            }
        }

        // Phase 2: color shift and increased intensity
        if (this.phase === 2 && this.bodyMesh) {
            const phaseColor = new THREE.Color(0xaa2266);
            this.bodyMesh.material.color.lerp(phaseColor, dt * 0.5);
            this.bodyMesh.material.emissive = new THREE.Color(0x440022);
            this.bodyMesh.material.emissiveIntensity = 0.2;

            // Faster wobble in phase 2
            this.wobbleSpeed = 4;
            this.wobbleAmount = 0.12;
        }

        // Drip particles
        if (this.game && this.game.particles) {
            this.dripTimer += dt;
            if (this.dripTimer > 0.3) {
                this.dripTimer = 0;
                // Random drip from body
                const angle = Math.random() * Math.PI * 2;
                const dripPos = new THREE.Vector3(
                    this.position.x + Math.cos(angle) * 1.5,
                    this.position.y + 0.5 + Math.random() * 0.5,
                    this.position.z + Math.sin(angle) * 1.5
                );
                this.game.particles.slimeDrip(dripPos);
            }
        }
    }

    tryStartAttack(player, distToPlayer) {
        // Priority 1: BOUNCE if player is far
        if (distToPlayer >= this.farThreshold && this.attackCooldowns.BOUNCE <= 0) {
            this.startAttack('BOUNCE', player);
            return true;
        }

        // Priority 2: SHOCKWAVE if player has been close too long
        if (this.playerCloseTimer >= this.shockwaveChargeTime && this.attackCooldowns.SHOCKWAVE <= 0) {
            this.playerCloseTimer = 0;
            this.startAttack('SHOCKWAVE', player);
            return true;
        }

        // Priority 3: SLAM (medium range)
        if (distToPlayer <= AttackType.SLAM.range && this.attackCooldowns.SLAM <= 0) {
            this.startAttack('SLAM', player);
            return true;
        }

        // Priority 4: WAVE (close range)
        if (distToPlayer <= AttackType.WAVE.range && this.attackCooldowns.WAVE <= 0) {
            this.startAttack('WAVE', player);
            return true;
        }

        return false;
    }

    startAttack(attackName, player) {
        const attack = AttackType[attackName];
        this.currentAttack = attackName;
        this.attackPhase = 'telegraph';
        this.attackTimer = attack.telegraphDuration;
        this.attackCooldowns[attackName] = attack.cooldown;

        // Store target position for slam
        this.targetPosition.copy(player.position);

        // Create telegraph visuals
        this.createTelegraph(attackName, player);

        // Initialize bounce
        if (attackName === 'BOUNCE') {
            this.bounceStartPos.copy(this.position);
            this.currentBounce = 0;
            this.bounceProgress = 0;
            this.bounceHits = [false, false, false];
            this.calculateBouncePositions(player);
        }
    }

    createTelegraph(attackName, player) {
        this.clearTelegraphs();

        // Red warning indicator material - render on top of ground
        const telegraphMaterial = new THREE.MeshBasicMaterial({
            color: 0xff2222,
            transparent: true,
            opacity: 0.25,
            side: THREE.DoubleSide,
            depthWrite: false,
            depthTest: true,
            polygonOffset: true,
            polygonOffsetFactor: -4,
            polygonOffsetUnits: -4
        });

        // Red edge/border material
        const borderMaterial = new THREE.MeshBasicMaterial({
            color: 0xff0000,
            transparent: true,
            opacity: 0.6,
            side: THREE.DoubleSide,
            depthWrite: false,
            depthTest: true,
            polygonOffset: true,
            polygonOffsetFactor: -5,
            polygonOffsetUnits: -5
        });

        // Store direction to player for wave attack
        const dirToPlayer = new THREE.Vector3().subVectors(player.position, this.position);
        dirToPlayer.y = 0;
        this.attackDirection = Math.atan2(dirToPlayer.x, dirToPlayer.z);

        switch (attackName) {
            case 'WAVE': {
                // Simple flat circle on ground (no angled pie for now)
                const radius = 6;

                const circleGeometry = new THREE.CircleGeometry(radius, 32);
                const circle = new THREE.Mesh(circleGeometry, telegraphMaterial);
                circle.rotation.x = -Math.PI / 2;
                circle.position.copy(this.position);
                circle.position.y = 0.3;

                this.scene.add(circle);
                this.telegraphMeshes.push(circle);

                // Add border ring
                const ringGeometry = new THREE.RingGeometry(radius - 0.15, radius, 32);
                const ring = new THREE.Mesh(ringGeometry, borderMaterial);
                ring.rotation.x = -Math.PI / 2;
                ring.position.copy(this.position);
                ring.position.y = 0.35;

                this.scene.add(ring);
                this.telegraphMeshes.push(ring);
                break;
            }

            case 'SLAM': {
                // Filled circle at player position
                const circleGeometry = new THREE.CircleGeometry(4, 32);
                const circle = new THREE.Mesh(circleGeometry, telegraphMaterial);
                circle.rotation.x = -Math.PI / 2;
                circle.position.copy(player.position);
                circle.position.y = 0.3;

                this.scene.add(circle);
                this.telegraphMeshes.push(circle);

                // Border ring
                const ringGeometry = new THREE.RingGeometry(3.85, 4, 32);
                const ring = new THREE.Mesh(ringGeometry, borderMaterial);
                ring.rotation.x = -Math.PI / 2;
                ring.position.copy(player.position);
                ring.position.y = 0.35;

                this.scene.add(ring);
                this.telegraphMeshes.push(ring);
                break;
            }

            case 'SHOCKWAVE': {
                // Ring around boss (donut shape - safe in center)
                const ringGeometry = new THREE.RingGeometry(2, 6, 32);
                const ring = new THREE.Mesh(ringGeometry, telegraphMaterial);
                ring.rotation.x = -Math.PI / 2;
                ring.position.copy(this.position);
                ring.position.y = 0.3;

                this.scene.add(ring);
                this.telegraphMeshes.push(ring);

                // Outer border
                const outerBorder = new THREE.RingGeometry(5.85, 6, 32);
                const outer = new THREE.Mesh(outerBorder, borderMaterial);
                outer.rotation.x = -Math.PI / 2;
                outer.position.copy(this.position);
                outer.position.y = 0.35;

                this.scene.add(outer);
                this.telegraphMeshes.push(outer);

                // Inner border
                const innerBorder = new THREE.RingGeometry(2, 2.15, 32);
                const inner = new THREE.Mesh(innerBorder, borderMaterial);
                inner.rotation.x = -Math.PI / 2;
                inner.position.copy(this.position);
                inner.position.y = 0.35;

                this.scene.add(inner);
                this.telegraphMeshes.push(inner);
                break;
            }

            case 'BOUNCE': {
                // Will create telegraph for each bounce position
                break;
            }
        }
    }

    calculateBouncePositions(player) {
        this.bouncePositions = [];
        const dir = new THREE.Vector3().subVectors(player.position, this.position).normalize();
        dir.y = 0;

        const bounceDistance = 6;
        for (let i = 1; i <= 3; i++) {
            const pos = this.position.clone().add(dir.clone().multiplyScalar(bounceDistance * i));
            this.bouncePositions.push(pos);
        }

        // Purple warning indicator
        const telegraphMaterial = new THREE.MeshBasicMaterial({
            color: 0x9944ff,
            transparent: true,
            opacity: 0.25,
            side: THREE.DoubleSide,
            depthWrite: false,
            depthTest: true,
            polygonOffset: true,
            polygonOffsetFactor: -4,
            polygonOffsetUnits: -4
        });

        const borderMaterial = new THREE.MeshBasicMaterial({
            color: 0xaa55ff,
            transparent: true,
            opacity: 0.6,
            side: THREE.DoubleSide,
            depthWrite: false,
            depthTest: true,
            polygonOffset: true,
            polygonOffsetFactor: -5,
            polygonOffsetUnits: -5
        });

        for (let i = 0; i < this.bouncePositions.length; i++) {
            const pos = this.bouncePositions[i];

            // Filled circle
            const circleGeometry = new THREE.CircleGeometry(3, 24);
            const circle = new THREE.Mesh(circleGeometry, telegraphMaterial);
            circle.rotation.x = -Math.PI / 2;
            circle.position.copy(pos);
            circle.position.y = 0.3;

            this.scene.add(circle);
            this.telegraphMeshes.push(circle);

            // Border ring
            const ringGeometry = new THREE.RingGeometry(2.85, 3, 24);
            const ring = new THREE.Mesh(ringGeometry, borderMaterial);
            ring.rotation.x = -Math.PI / 2;
            ring.position.copy(pos);
            ring.position.y = 0.35;

            this.scene.add(ring);
            this.telegraphMeshes.push(ring);
        }
    }

    createSpellEffect(attackName) {
        // Visual effect when attack actually fires
        const effectMeshes = [];

        switch (attackName) {
            case 'WAVE': {
                // Orange/yellow wave expanding outward - flat circle
                const effectMaterial = new THREE.MeshBasicMaterial({
                    color: 0xffaa33,
                    transparent: true,
                    opacity: 0.8,
                    side: THREE.DoubleSide
                });

                const waveGeometry = new THREE.CircleGeometry(1, 32);
                const wave = new THREE.Mesh(waveGeometry, effectMaterial);
                wave.rotation.x = -Math.PI / 2;
                wave.position.copy(this.position);
                wave.position.y = 0.4;

                this.scene.add(wave);
                effectMeshes.push({ mesh: wave, type: 'expand', maxScale: 6, speed: 20 });
                break;
            }

            case 'SLAM': {
                // Fiery explosion ring
                const effectMaterial = new THREE.MeshBasicMaterial({
                    color: 0xff4400,
                    transparent: true,
                    opacity: 0.9,
                    side: THREE.DoubleSide
                });

                const ringGeometry = new THREE.RingGeometry(0.5, 1.5, 32);
                const ring = new THREE.Mesh(ringGeometry, effectMaterial);
                ring.rotation.x = -Math.PI / 2;
                ring.position.copy(this.targetPosition);
                ring.position.y = 0.2;

                this.scene.add(ring);
                effectMeshes.push({ mesh: ring, type: 'expand', maxScale: 4, speed: 15 });
                break;
            }

            case 'SHOCKWAVE': {
                // Purple shockwave ring expanding
                const effectMaterial = new THREE.MeshBasicMaterial({
                    color: 0xaa66ff,
                    transparent: true,
                    opacity: 0.8,
                    side: THREE.DoubleSide
                });

                const ringGeometry = new THREE.RingGeometry(1.8, 2.2, 32);
                const ring = new THREE.Mesh(ringGeometry, effectMaterial);
                ring.rotation.x = -Math.PI / 2;
                ring.position.copy(this.position);
                ring.position.y = 0.2;

                this.scene.add(ring);
                effectMeshes.push({ mesh: ring, type: 'expand', maxScale: 3, speed: 12 });
                break;
            }
        }

        // Animate and remove effects
        const startTime = Date.now();
        const animateEffects = () => {
            const elapsed = (Date.now() - startTime) / 1000;
            let allDone = true;

            for (const effect of effectMeshes) {
                if (effect.type === 'expand') {
                    const progress = Math.min(1, elapsed * effect.speed / effect.maxScale);
                    const scale = 1 + progress * (effect.maxScale - 1);
                    effect.mesh.scale.set(scale, scale, 1);
                    effect.mesh.material.opacity = 0.8 * (1 - progress);

                    if (progress < 1) allDone = false;
                }
            }

            if (!allDone) {
                requestAnimationFrame(animateEffects);
            } else {
                // Cleanup
                for (const effect of effectMeshes) {
                    this.scene.remove(effect.mesh);
                    effect.mesh.geometry.dispose();
                    effect.mesh.material.dispose();
                }
            }
        };
        animateEffects();
    }

    clearTelegraphs() {
        for (const mesh of this.telegraphMeshes) {
            this.scene.remove(mesh);
            if (mesh.geometry) mesh.geometry.dispose();
            if (mesh.material) mesh.material.dispose();
        }
        this.telegraphMeshes = [];
    }

    updateAttack(deltaTime, player) {
        this.attackTimer -= deltaTime;

        if (this.attackPhase === 'telegraph') {
            // Update telegraph opacity based on remaining time
            const attack = AttackType[this.currentAttack];
            const progress = 1 - (this.attackTimer / attack.telegraphDuration);

            for (const mesh of this.telegraphMeshes) {
                mesh.material.opacity = 0.2 + progress * 0.4;
            }

            if (this.attackTimer <= 0) {
                this.attackPhase = 'execute';
                this.attackTimer = AttackType[this.currentAttack].executeDuration;
                this.attackHitPending = true;

                if (this.currentAttack === 'BOUNCE') {
                    this.currentBounce = 0;
                    this.bounceProgress = 0;
                    this.bounceStartPos.copy(this.position);
                }
            }
        } else if (this.attackPhase === 'execute') {
            this.executeAttack(deltaTime, player);

            if (this.attackTimer <= 0) {
                this.finishAttack(player);
            }
        }
    }

    executeAttack(deltaTime, player) {
        const attack = AttackType[this.currentAttack];

        if (this.currentAttack === 'BOUNCE') {
            // Animate bouncing towards targets
            const totalDuration = attack.executeDuration;
            const bounceDuration = totalDuration / 3;
            const elapsed = totalDuration - this.attackTimer;

            const newBounce = Math.min(2, Math.floor(elapsed / bounceDuration));

            // Check if we landed on a new bounce
            if (newBounce > this.currentBounce) {
                // Deal damage at landing
                this.checkBounceDamage(player, this.currentBounce);

                // Spawn poison at landing
                if (this.game) {
                    this.spawnPoisonPool(this.bouncePositions[this.currentBounce]);
                }

                this.bounceStartPos.copy(this.bouncePositions[this.currentBounce]);
                this.currentBounce = newBounce;
            }

            // Interpolate position
            const bounceElapsed = elapsed - (this.currentBounce * bounceDuration);
            this.bounceProgress = Math.min(1, bounceElapsed / bounceDuration);

            const targetPos = this.bouncePositions[this.currentBounce];
            if (targetPos) {
                // Arc trajectory
                const t = this.bounceProgress;
                const arcHeight = 4 * t * (1 - t) * 5; // Parabolic arc, max height 5

                this.position.x = this.bounceStartPos.x + (targetPos.x - this.bounceStartPos.x) * t;
                this.position.z = this.bounceStartPos.z + (targetPos.z - this.bounceStartPos.z) * t;

                if (this.mesh) {
                    this.mesh.position.y = 1.2 + arcHeight;
                }
            }
        } else if (this.attackHitPending) {
            // Deal damage for non-bounce attacks
            this.attackHitPending = false;
            this.dealAttackDamage(player);
        }
    }

    checkBounceDamage(player, bounceIndex) {
        if (this.bounceHits[bounceIndex]) return;

        const landPos = this.bouncePositions[bounceIndex];

        // Bounce impact particles always
        if (this.game && this.game.particles) {
            this.game.particles.bounceImpact(landPos);
            this.game.addScreenShake(0.8);
        }

        const dist = player.position.distanceTo(landPos);

        if (dist < 4) {
            this.bounceHits[bounceIndex] = true;

            // Check parry
            if (player.tryParry && player.tryParry(this)) {
                return;
            }

            player.takeDamage(AttackType.BOUNCE.damage);

            // Player hit particles
            if (this.game && this.game.particles) {
                this.game.particles.playerHit(player.position);
            }

            // Show damage number (red for damage to player)
            if (this.game && this.game.effects) {
                this.game.effects.createDamageNumber(player.position, AttackType.BOUNCE.damage, false);
            }
        }
    }

    dealAttackDamage(player) {
        const attack = AttackType[this.currentAttack];
        let hit = false;

        // Create spell effect
        this.createSpellEffect(this.currentAttack);

        switch (this.currentAttack) {
            case 'WAVE': {
                // Circle AoE attack around boss
                const dist = player.position.distanceTo(this.position);

                if (dist < 6) {
                    hit = true;
                }

                // Wave particle effect
                if (this.game && this.game.particles) {
                    const attackDir = new THREE.Vector3(
                        Math.sin(this.attackDirection),
                        0,
                        Math.cos(this.attackDirection)
                    );
                    this.game.particles.cleaveWave(this.position, attackDir, 6);
                }
                break;
            }

            case 'SLAM': {
                // AoE at stored target position
                const dist = player.position.distanceTo(this.targetPosition);
                if (dist < 4) {
                    hit = true;
                }

                // Fire explosion effect
                if (this.game && this.game.particles) {
                    this.game.particles.fireExplosion(this.targetPosition, 4);
                    this.game.addScreenShake(1.5);
                }

                // Spawn fire hazard
                if (this.game) {
                    this.spawnFirePool(this.targetPosition);
                }
                break;
            }

            case 'SHOCKWAVE': {
                // Ring around boss
                const dist = player.position.distanceTo(this.position);
                if (dist >= 2 && dist < 6) {
                    hit = true;

                    // Stun player
                    if (player.applyStun) {
                        player.applyStun(attack.stunDuration);
                    }
                }

                // Shockwave particle effect
                if (this.game && this.game.particles) {
                    this.game.particles.shockwave(this.position, 0x8844ff);
                    this.game.addScreenShake(1.2);
                }
                break;
            }
        }

        if (hit) {
            // Check parry
            if (player.tryParry && player.tryParry(this)) {
                return;
            }

            player.takeDamage(attack.damage);

            // Player hit particles
            if (this.game && this.game.particles) {
                this.game.particles.playerHit(player.position);
            }

            // Show damage number on player (red for damage)
            if (this.game && this.game.effects) {
                this.game.effects.createDamageNumber(player.position, attack.damage, false);
            }
        }
    }

    finishAttack(player) {
        // Final bounce damage check
        if (this.currentAttack === 'BOUNCE' && this.bouncePositions.length > 0) {
            this.checkBounceDamage(player, 2);

            // Spawn final poison
            if (this.game) {
                this.spawnPoisonPool(this.bouncePositions[2]);
            }

            // Snap to final position
            const finalPos = this.bouncePositions[2];
            this.position.x = finalPos.x;
            this.position.z = finalPos.z;
        }

        this.clearTelegraphs();
        this.attackPhase = 'none';
        this.currentAttack = null;
        this.bouncePositions = [];
    }

    spawnFirePool(position) {
        // Create fire ground hazard
        const fireGeometry = new THREE.CircleGeometry(3, 32);
        const fireMaterial = new THREE.MeshBasicMaterial({
            color: 0xff4400,
            transparent: true,
            opacity: 0.6,
            side: THREE.DoubleSide,
            depthWrite: false,
            polygonOffset: true,
            polygonOffsetFactor: -1,
            polygonOffsetUnits: -1
        });
        const fire = new THREE.Mesh(fireGeometry, fireMaterial);
        fire.rotation.x = -Math.PI / 2;
        fire.position.copy(position);
        fire.position.y = 0.25;

        this.scene.add(fire);

        const hazard = {
            mesh: fire,
            position: position.clone(),
            radius: 3,
            damage: 8,
            duration: 5,
            type: 'fire',
            tickTimer: 0
        };

        if (this.game) {
            this.game.groundHazards.push(hazard);
        }
    }

    spawnPoisonPool(position) {
        // Create poison ground hazard
        const poisonGeometry = new THREE.CircleGeometry(2.5, 32);
        const poisonMaterial = new THREE.MeshBasicMaterial({
            color: 0x44aa44,
            transparent: true,
            opacity: 0.5,
            side: THREE.DoubleSide,
            depthWrite: false,
            polygonOffset: true,
            polygonOffsetFactor: -1,
            polygonOffsetUnits: -1
        });
        const poison = new THREE.Mesh(poisonGeometry, poisonMaterial);
        poison.rotation.x = -Math.PI / 2;
        poison.position.copy(position);
        poison.position.y = 0.25;

        this.scene.add(poison);

        const hazard = {
            mesh: poison,
            position: position.clone(),
            radius: 2.5,
            damage: 6,
            duration: 6,
            type: 'poison',
            tickTimer: 0
        };

        if (this.game) {
            this.game.groundHazards.push(hazard);
        }
    }

    startPhaseTransition() {
        this.phaseTransitioning = true;
        this.phaseTransitionTimer = 2.0;
        this.clearTelegraphs();
        this.attackPhase = 'none';
        this.currentAttack = null;
    }

    updatePhaseTransition(deltaTime) {
        this.phaseTransitionTimer -= deltaTime;

        // Boss pulses during transition
        if (this.mesh) {
            const pulse = Math.sin(this.phaseTransitionTimer * 10) * 0.2 + 1;
            this.mesh.scale.set(pulse, 0.65 * pulse, pulse);
        }

        if (this.phaseTransitionTimer <= 0) {
            this.phaseTransitioning = false;
            this.phase = 2;

            // Spawn adds
            if (!this.spawnedAdds && this.game) {
                this.spawnedAdds = true;
                this.spawnPhase2Adds();
            }
        }
    }

    spawnPhase2Adds() {
        // Spawn 4 slimes around the boss
        const spawnOffsets = [
            { x: -8, z: 0 },
            { x: 8, z: 0 },
            { x: 0, z: -8 },
            { x: 0, z: 8 }
        ];

        for (const offset of spawnOffsets) {
            const slime = new SlimeEnemy(this.scene, this.position.x + offset.x, this.position.z + offset.z);
            slime.isAggro = true;
            this.game.enemies.push(slime);
        }
    }

    takeDamage(amount, source) {
        // Invulnerable during phase transition
        if (this.phaseTransitioning) return;

        super.takeDamage(amount, source);
    }

    // Boss doesn't have melee auto-attack, only special attacks
    tryAttack(player) {
        return false;
    }
}
