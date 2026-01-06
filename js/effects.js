import * as THREE from 'three';

export class EffectsManager {
    constructor(scene) {
        this.scene = scene;
        this.effects = [];
    }

    update(deltaTime) {
        for (let i = this.effects.length - 1; i >= 0; i--) {
            const effect = this.effects[i];
            effect.life -= deltaTime;

            if (effect.update) {
                effect.update(deltaTime, effect);
            }

            if (effect.life <= 0) {
                if (effect.mesh) {
                    this.scene.remove(effect.mesh);
                    if (effect.mesh.geometry) effect.mesh.geometry.dispose();
                    if (effect.mesh.material) effect.mesh.material.dispose();
                }
                if (effect.group) {
                    effect.group.traverse((child) => {
                        if (child.geometry) child.geometry.dispose();
                        if (child.material) child.material.dispose();
                    });
                    this.scene.remove(effect.group);
                }
                this.effects.splice(i, 1);
            }
        }
    }

    // Sword swing arc effect - clear horizontal slash arc (90 degree, range 3)
    createSwingEffect(position, rotation, color = 0xffffff) {
        const group = new THREE.Group();

        // Create wide arc using TorusGeometry (90 degree arc)
        // Arc is in front of character (+Z direction in local space)
        const arcGeometry = new THREE.TorusGeometry(2.5, 0.1, 8, 32, Math.PI * 0.5);
        const arcMaterial = new THREE.MeshBasicMaterial({
            color: 0xffffaa,
            transparent: true,
            opacity: 1.0
        });
        const arc = new THREE.Mesh(arcGeometry, arcMaterial);
        arc.rotation.x = -Math.PI / 2; // Lay horizontal, facing forward
        arc.rotation.z = Math.PI * 0.75; // Center the arc in front (+Z)
        arc.position.y = 1.2;
        group.add(arc);

        // Inner brighter arc
        const innerArcGeometry = new THREE.TorusGeometry(2, 0.15, 8, 32, Math.PI * 0.45);
        const innerArcMaterial = new THREE.MeshBasicMaterial({
            color: 0xffffff,
            transparent: true,
            opacity: 1.0
        });
        const innerArc = new THREE.Mesh(innerArcGeometry, innerArcMaterial);
        innerArc.rotation.x = -Math.PI / 2;
        innerArc.rotation.z = Math.PI * 0.775;
        innerArc.position.y = 1.2;
        group.add(innerArc);

        // Trailing particles across the wider arc - in front
        for (let i = 0; i < 7; i++) {
            const sparkGeometry = new THREE.SphereGeometry(0.1, 6, 6);
            const sparkMaterial = new THREE.MeshBasicMaterial({
                color: 0xffff88,
                transparent: true,
                opacity: 0.9
            });
            const spark = new THREE.Mesh(sparkGeometry, sparkMaterial);
            // Spread particles in arc in front (+Z direction)
            const angle = -Math.PI * 0.25 + (i / 6) * Math.PI * 0.5;
            spark.position.x = Math.sin(angle) * 2.5;
            spark.position.z = Math.abs(Math.cos(angle)) * 2.5 + 0.5; // Always positive Z (in front)
            spark.position.y = 1.2;
            group.add(spark);
        }

        group.position.copy(position);
        group.rotation.y = rotation; // Match player facing direction

        this.scene.add(group);

        this.effects.push({
            group: group,
            life: 0.25,
            update: (dt, eff) => {
                const progress = (0.25 - eff.life) / 0.25;
                // Sweep the arc
                const sweepAngle = progress * Math.PI * 0.3;
                group.children[0].rotation.z = Math.PI * 0.75 - sweepAngle;
                group.children[1].rotation.z = Math.PI * 0.775 - sweepAngle;

                // Fade and scale
                group.children.forEach((child) => {
                    child.material.opacity = eff.life * 4;
                    child.scale.setScalar(1 + progress * 0.2);
                });
            }
        });
    }

    // Cleave cone effect - ground shockwave expanding forward (126 degree, range 5.5)
    createCleaveEffect(position, rotation) {
        const group = new THREE.Group();

        // Ground cone shockwave (126 degree arc expanding outward, centered forward)
        const coneAngle = Math.PI * 0.7; // 126 degrees
        const coneArcGeometry = new THREE.RingGeometry(0.5, 1.2, 32, 1, -coneAngle / 2, coneAngle);
        const coneArcMaterial = new THREE.MeshBasicMaterial({
            color: 0xff6600,
            transparent: true,
            opacity: 0.9,
            side: THREE.DoubleSide
        });
        const coneArc = new THREE.Mesh(coneArcGeometry, coneArcMaterial);
        coneArc.rotation.x = -Math.PI / 2; // Flat on ground
        coneArc.rotation.z = -Math.PI / 2; // Point forward
        coneArc.position.y = 0.15;
        group.add(coneArc);

        // Second expanding ring
        const ring2Geometry = new THREE.RingGeometry(0.3, 1, 32, 1, -coneAngle / 2, coneAngle);
        const ring2Material = new THREE.MeshBasicMaterial({
            color: 0xffaa44,
            transparent: true,
            opacity: 0.8,
            side: THREE.DoubleSide
        });
        const ring2 = new THREE.Mesh(ring2Geometry, ring2Material);
        ring2.rotation.x = -Math.PI / 2;
        ring2.rotation.z = -Math.PI / 2;
        ring2.position.y = 0.2;
        group.add(ring2);

        // Particles shooting forward in wider spread
        for (let i = 0; i < 12; i++) {
            const particleGeometry = new THREE.SphereGeometry(0.18, 6, 6);
            const particleMaterial = new THREE.MeshBasicMaterial({
                color: 0xff8800,
                transparent: true,
                opacity: 0.9
            });
            const particle = new THREE.Mesh(particleGeometry, particleMaterial);
            const spreadAngle = -coneAngle / 2 + (i / 11) * coneAngle;
            particle.position.x = Math.sin(spreadAngle) * 1.5;
            particle.position.z = -Math.cos(spreadAngle) * 1.5; // Negative Z for forward
            particle.position.y = 0.8 + Math.random() * 0.4;
            particle.userData.angle = spreadAngle;
            group.add(particle);
        }

        group.position.copy(position);
        group.rotation.y = rotation; // Match player facing direction

        this.scene.add(group);

        this.effects.push({
            group: group,
            life: 0.45,
            update: (dt, eff) => {
                const progress = (0.45 - eff.life) / 0.45;

                // Ground rings expand forward - larger scale for range 5.5
                const groundScale = 1 + progress * 5;
                group.children[0].scale.set(groundScale, groundScale, 1);
                group.children[0].material.opacity = eff.life * 2.2;

                group.children[1].scale.set(groundScale * 0.8, groundScale * 0.8, 1);
                group.children[1].material.opacity = eff.life * 2;

                // Particles shoot forward in cone pattern
                for (let i = 2; i < group.children.length; i++) {
                    const p = group.children[i];
                    const dist = 1.5 + progress * 5;
                    p.position.x = Math.sin(p.userData.angle) * dist;
                    p.position.z = -Math.cos(p.userData.angle) * dist; // Negative Z for forward
                    p.material.opacity = eff.life * 2.2;
                    p.scale.setScalar(1 - progress * 0.3);
                }
            }
        });
    }

    // Parry shield effect - defensive stance around player
    createParryEffect(position, rotation = 0) {
        const shieldGeometry = new THREE.CircleGeometry(1.5, 24);
        const shieldMaterial = new THREE.MeshBasicMaterial({
            color: 0x4488ff,
            transparent: true,
            opacity: 0.5,
            side: THREE.DoubleSide
        });
        const shield = new THREE.Mesh(shieldGeometry, shieldMaterial);

        // Add inner glow ring
        const ringGeometry = new THREE.RingGeometry(1.2, 1.5, 32);
        const ringMaterial = new THREE.MeshBasicMaterial({
            color: 0x88ccff,
            transparent: true,
            opacity: 0.9,
            side: THREE.DoubleSide
        });
        const ring = new THREE.Mesh(ringGeometry, ringMaterial);
        shield.add(ring);

        // Position around player (horizontal circle)
        shield.position.copy(position);
        shield.position.y += 1;
        shield.rotation.x = -Math.PI / 2; // Lay flat like a defensive aura

        this.scene.add(shield);

        this.effects.push({
            mesh: shield,
            life: 0.4,
            startPos: position.clone(),
            update: (dt, eff) => {
                eff.mesh.material.opacity = eff.life * 1.5;
                ring.material.opacity = eff.life * 2;
                // Pulse effect
                const pulse = 1 + Math.sin(eff.life * 30) * 0.1;
                eff.mesh.scale.set(pulse, pulse, pulse);
            }
        });
    }

    // Successful parry riposte effect
    createRiposteEffect(position, targetPosition) {
        const group = new THREE.Group();

        // Flash at player
        const flashGeometry = new THREE.SphereGeometry(1.5, 8, 8);
        const flashMaterial = new THREE.MeshBasicMaterial({
            color: 0xffff44,
            transparent: true,
            opacity: 0.8
        });
        const flash = new THREE.Mesh(flashGeometry, flashMaterial);
        flash.position.copy(position);
        flash.position.y += 1;
        group.add(flash);

        // Slash toward target
        const dir = new THREE.Vector3().subVectors(targetPosition, position).normalize();
        const slashGeometry = new THREE.BoxGeometry(0.1, 0.3, 2);
        const slashMaterial = new THREE.MeshBasicMaterial({
            color: 0xffff88,
            transparent: true,
            opacity: 0.9
        });
        const slash = new THREE.Mesh(slashGeometry, slashMaterial);
        slash.position.copy(position);
        slash.position.y += 1;
        slash.lookAt(targetPosition);
        group.add(slash);

        this.scene.add(group);

        this.effects.push({
            group: group,
            life: 0.3,
            update: (dt, eff) => {
                flash.material.opacity = eff.life * 2.5;
                flash.scale.multiplyScalar(1 + dt * 5);
                slash.material.opacity = eff.life * 3;
                slash.scale.z = 1 + (0.3 - eff.life) * 5;
            }
        });
    }

    // Charge dash trail effect
    createChargeEffect(startPosition, endPosition) {
        const group = new THREE.Group();

        // Trail particles
        const dir = new THREE.Vector3().subVectors(endPosition, startPosition);
        const distance = dir.length();
        dir.normalize();

        for (let i = 0; i < 10; i++) {
            const t = i / 10;
            const particleGeometry = new THREE.SphereGeometry(0.3 - t * 0.2, 6, 6);
            const particleMaterial = new THREE.MeshBasicMaterial({
                color: 0x44aaff,
                transparent: true,
                opacity: 0.8 - t * 0.5
            });
            const particle = new THREE.Mesh(particleGeometry, particleMaterial);
            particle.position.copy(startPosition);
            particle.position.addScaledVector(dir, distance * t);
            particle.position.y += 1;
            group.add(particle);
        }

        // Impact ring at end
        const ringGeometry = new THREE.RingGeometry(0.5, 1.5, 16);
        const ringMaterial = new THREE.MeshBasicMaterial({
            color: 0x88ddff,
            transparent: true,
            opacity: 0.9,
            side: THREE.DoubleSide
        });
        const ring = new THREE.Mesh(ringGeometry, ringMaterial);
        ring.position.copy(endPosition);
        ring.position.y += 0.1;
        ring.rotation.x = -Math.PI / 2;
        group.add(ring);

        this.scene.add(group);

        this.effects.push({
            group: group,
            life: 0.5,
            update: (dt, eff) => {
                group.children.forEach((child, i) => {
                    child.material.opacity *= 0.95;
                    if (i === group.children.length - 1) {
                        // Ring expands
                        child.scale.multiplyScalar(1 + dt * 4);
                    }
                });
            }
        });
    }

    // Bladestorm spinning blades effect
    createBladestormEffect(playerGroup) {
        const group = new THREE.Group();

        // Spinning blades
        for (let i = 0; i < 4; i++) {
            const bladeGeometry = new THREE.BoxGeometry(0.1, 0.4, 1.5);
            const bladeMaterial = new THREE.MeshBasicMaterial({
                color: 0xaaaaff,
                transparent: true,
                opacity: 0.8
            });
            const blade = new THREE.Mesh(bladeGeometry, bladeMaterial);
            blade.position.y = 1;
            const angle = (i / 4) * Math.PI * 2;
            blade.position.x = Math.cos(angle) * 1.5;
            blade.position.z = Math.sin(angle) * 1.5;
            blade.rotation.y = angle;
            group.add(blade);
        }

        // Central vortex
        const vortexGeometry = new THREE.CylinderGeometry(0.8, 1.2, 2, 16, 1, true);
        const vortexMaterial = new THREE.MeshBasicMaterial({
            color: 0x6666ff,
            transparent: true,
            opacity: 0.3,
            side: THREE.DoubleSide
        });
        const vortex = new THREE.Mesh(vortexGeometry, vortexMaterial);
        vortex.position.y = 1;
        group.add(vortex);

        this.scene.add(group);

        const effect = {
            group: group,
            life: 3,
            playerGroup: playerGroup,
            spinAngle: 0,
            update: (dt, eff) => {
                // Follow player
                eff.group.position.copy(eff.playerGroup.position);

                // Spin
                eff.spinAngle += dt * 15;
                eff.group.rotation.y = eff.spinAngle;

                // Pulse opacity
                const pulse = 0.5 + Math.sin(eff.spinAngle * 2) * 0.3;
                vortex.material.opacity = pulse * 0.3;
            }
        };

        this.effects.push(effect);
        return effect;
    }

    // End bladestorm - throw disk
    createBladestormDiskEffect(position, direction) {
        const diskGeometry = new THREE.CylinderGeometry(0.8, 0.8, 0.1, 16);
        const diskMaterial = new THREE.MeshBasicMaterial({
            color: 0x88aaff,
            transparent: true,
            opacity: 0.9
        });
        const disk = new THREE.Mesh(diskGeometry, diskMaterial);
        disk.position.copy(position);
        disk.position.y += 1;
        disk.rotation.x = Math.PI / 2;

        this.scene.add(disk);

        this.effects.push({
            mesh: disk,
            life: 1.5,
            velocity: direction.clone().multiplyScalar(20),
            spinSpeed: 25,
            update: (dt, eff) => {
                eff.mesh.position.addScaledVector(eff.velocity, dt);
                eff.mesh.rotation.z += eff.spinSpeed * dt;
                eff.mesh.material.opacity = Math.min(eff.life, 1);
            }
        });
    }

    // Health potion effect
    createPotionEffect(position) {
        const group = new THREE.Group();

        // Rising particles
        for (let i = 0; i < 12; i++) {
            const particleGeometry = new THREE.SphereGeometry(0.15, 6, 6);
            const particleMaterial = new THREE.MeshBasicMaterial({
                color: 0x44ff44,
                transparent: true,
                opacity: 0.8
            });
            const particle = new THREE.Mesh(particleGeometry, particleMaterial);
            const angle = (i / 12) * Math.PI * 2;
            particle.position.x = Math.cos(angle) * 0.5;
            particle.position.z = Math.sin(angle) * 0.5;
            particle.position.y = Math.random() * 0.5;
            particle.userData.angle = angle;
            particle.userData.speed = 2 + Math.random();
            group.add(particle);
        }

        // Heal aura ring
        const auraGeometry = new THREE.RingGeometry(0.8, 1.2, 32);
        const auraMaterial = new THREE.MeshBasicMaterial({
            color: 0x88ff88,
            transparent: true,
            opacity: 0.6,
            side: THREE.DoubleSide
        });
        const aura = new THREE.Mesh(auraGeometry, auraMaterial);
        aura.rotation.x = -Math.PI / 2;
        aura.position.y = 0.1;
        group.add(aura);

        group.position.copy(position);

        this.scene.add(group);

        this.effects.push({
            group: group,
            life: 1,
            update: (dt, eff) => {
                group.children.forEach((child, i) => {
                    if (i < 12) {
                        // Particles rise and spiral
                        child.position.y += child.userData.speed * dt;
                        const angle = child.userData.angle + eff.life * 3;
                        child.position.x = Math.cos(angle) * (0.5 + (1 - eff.life) * 0.5);
                        child.position.z = Math.sin(angle) * (0.5 + (1 - eff.life) * 0.5);
                        child.material.opacity = eff.life * 0.8;
                    } else {
                        // Aura expands and fades
                        child.scale.set(1 + (1 - eff.life) * 2, 1 + (1 - eff.life) * 2, 1);
                        child.material.opacity = eff.life * 0.6;
                    }
                });
            }
        });
    }

    // Damage number floating text (using sprite)
    createDamageNumber(position, damage, isHeal = false, isCrit = false) {
        const canvas = document.createElement('canvas');
        canvas.width = 256;
        canvas.height = 128;
        const ctx = canvas.getContext('2d');

        // Style based on type
        let color = '#ff4444';
        let fontSize = 64;
        if (isHeal) {
            color = '#44ff44';
        } else if (isCrit || damage > 40) {
            color = '#ffff44';
            fontSize = 72;
        }

        ctx.font = `bold ${fontSize}px Arial`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        // Outline/shadow for visibility
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 6;
        ctx.strokeText(Math.round(damage), 128, 64);

        // Main text
        ctx.fillStyle = color;
        ctx.fillText(Math.round(damage), 128, 64);

        const texture = new THREE.CanvasTexture(canvas);
        const spriteMaterial = new THREE.SpriteMaterial({
            map: texture,
            transparent: true,
            depthTest: false // Always render on top
        });
        const sprite = new THREE.Sprite(spriteMaterial);
        // Clone position with slight random offset so numbers don't stack
        const offsetX = (Math.random() - 0.5) * 1;
        const offsetZ = (Math.random() - 0.5) * 0.5;
        sprite.position.set(position.x + offsetX, position.y + 2.5, position.z + offsetZ);
        sprite.scale.set(3, 1.5, 1);

        this.scene.add(sprite);

        this.effects.push({
            mesh: sprite,
            life: 1.2,
            velocityY: 3,
            update: (dt, eff) => {
                eff.mesh.position.y += eff.velocityY * dt;
                eff.velocityY -= dt * 5; // Gravity
                eff.mesh.material.opacity = Math.min(eff.life, 1);
                // Scale up then down
                const scale = eff.life > 1 ? 1 + (1.2 - eff.life) * 3 : eff.life;
                eff.mesh.scale.set(2 * scale, 1 * scale, 1);
            }
        });
    }
}
