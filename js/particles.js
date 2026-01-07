import * as THREE from 'three';

// Sprite-based particle system with soft textures and additive blending
export class ParticleSystem {
    constructor(scene) {
        this.scene = scene;
        this.particles = [];
        this.maxParticles = 50; // Reduced for performance

        // Generate textures
        this.textures = {
            soft: this.createSoftCircleTexture(),
            spark: this.createSparkTexture(),
            smoke: this.createSmokeTexture(),
            star: this.createStarTexture()
        };

        // Pre-create sprite pool
        for (let i = 0; i < this.maxParticles; i++) {
            const spriteMaterial = new THREE.SpriteMaterial({
                map: this.textures.soft,
                transparent: true,
                blending: THREE.AdditiveBlending,
                depthWrite: false
            });
            const sprite = new THREE.Sprite(spriteMaterial);
            sprite.visible = false;
            this.scene.add(sprite);
            this.particles.push({
                sprite,
                active: false,
                life: 0,
                maxLife: 0,
                velocity: new THREE.Vector3(),
                gravity: 0,
                startScale: 1,
                endScale: 0.5,
                drag: 1,
                startColor: new THREE.Color(),
                endColor: new THREE.Color(),
                rotation: 0,
                rotationSpeed: 0,
                textureType: 'soft',
                blendMode: 'additive'
            });
        }

        this.poolIndex = 0;
    }

    createSoftCircleTexture() {
        const canvas = document.createElement('canvas');
        canvas.width = 64;
        canvas.height = 64;
        const ctx = canvas.getContext('2d');

        const gradient = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
        gradient.addColorStop(0, 'rgba(255, 255, 255, 1)');
        gradient.addColorStop(0.3, 'rgba(255, 255, 255, 0.8)');
        gradient.addColorStop(0.6, 'rgba(255, 255, 255, 0.3)');
        gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');

        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, 64, 64);

        const texture = new THREE.CanvasTexture(canvas);
        texture.needsUpdate = true;
        return texture;
    }

    createSparkTexture() {
        const canvas = document.createElement('canvas');
        canvas.width = 64;
        canvas.height = 64;
        const ctx = canvas.getContext('2d');

        // Bright center with sharp falloff
        const gradient = ctx.createRadialGradient(32, 32, 0, 32, 32, 24);
        gradient.addColorStop(0, 'rgba(255, 255, 255, 1)');
        gradient.addColorStop(0.1, 'rgba(255, 255, 255, 1)');
        gradient.addColorStop(0.3, 'rgba(255, 255, 255, 0.6)');
        gradient.addColorStop(0.5, 'rgba(255, 255, 255, 0.2)');
        gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');

        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, 64, 64);

        const texture = new THREE.CanvasTexture(canvas);
        texture.needsUpdate = true;
        return texture;
    }

    createSmokeTexture() {
        const canvas = document.createElement('canvas');
        canvas.width = 64;
        canvas.height = 64;
        const ctx = canvas.getContext('2d');

        // Softer, more diffuse
        const gradient = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
        gradient.addColorStop(0, 'rgba(255, 255, 255, 0.6)');
        gradient.addColorStop(0.4, 'rgba(255, 255, 255, 0.4)');
        gradient.addColorStop(0.7, 'rgba(255, 255, 255, 0.15)');
        gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');

        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, 64, 64);

        const texture = new THREE.CanvasTexture(canvas);
        texture.needsUpdate = true;
        return texture;
    }

    createStarTexture() {
        const canvas = document.createElement('canvas');
        canvas.width = 64;
        canvas.height = 64;
        const ctx = canvas.getContext('2d');

        // Star shape with glow
        ctx.fillStyle = 'rgba(0,0,0,0)';
        ctx.fillRect(0, 0, 64, 64);

        // Glow
        const gradient = ctx.createRadialGradient(32, 32, 0, 32, 32, 28);
        gradient.addColorStop(0, 'rgba(255, 255, 255, 1)');
        gradient.addColorStop(0.2, 'rgba(255, 255, 255, 0.5)');
        gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, 64, 64);

        // Draw 4-point star
        ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
        ctx.beginPath();
        ctx.moveTo(32, 4);
        ctx.lineTo(36, 28);
        ctx.lineTo(60, 32);
        ctx.lineTo(36, 36);
        ctx.lineTo(32, 60);
        ctx.lineTo(28, 36);
        ctx.lineTo(4, 32);
        ctx.lineTo(28, 28);
        ctx.closePath();
        ctx.fill();

        const texture = new THREE.CanvasTexture(canvas);
        texture.needsUpdate = true;
        return texture;
    }

    getParticle() {
        for (let i = 0; i < this.maxParticles; i++) {
            const idx = (this.poolIndex + i) % this.maxParticles;
            if (!this.particles[idx].active) {
                this.poolIndex = (idx + 1) % this.maxParticles;
                return this.particles[idx];
            }
        }
        // Recycle oldest
        this.poolIndex = (this.poolIndex + 1) % this.maxParticles;
        return this.particles[this.poolIndex];
    }

    spawn(position, options = {}) {
        const count = options.count || 8;
        const spread = options.spread || 0.5;
        const speed = options.speed || 5;
        const life = options.life || 0.8;
        const size = options.size || 0.4;
        const endSize = options.endSize !== undefined ? options.endSize : size * 0.1;
        const gravity = options.gravity !== undefined ? options.gravity : -15;
        const color = options.color || 0xffffff;
        const endColor = options.endColor !== undefined ? options.endColor : color;
        const upwardBias = options.upwardBias || 3;
        const drag = options.drag || 0.98;
        const texture = options.texture || 'soft';
        const blendMode = options.blendMode || 'additive';
        const rotationSpeed = options.rotationSpeed || 0;

        for (let i = 0; i < count; i++) {
            const p = this.getParticle();
            p.active = true;
            p.life = life * (0.6 + Math.random() * 0.8);
            p.maxLife = p.life;
            p.gravity = gravity;
            p.drag = drag;
            p.startScale = size * (0.6 + Math.random() * 0.8);
            p.endScale = endSize;
            p.textureType = texture;
            p.rotation = Math.random() * Math.PI * 2;
            p.rotationSpeed = rotationSpeed * (Math.random() - 0.5) * 2;

            // Set texture and blend mode
            p.sprite.material.map = this.textures[texture] || this.textures.soft;
            p.sprite.material.blending = blendMode === 'normal' ? THREE.NormalBlending : THREE.AdditiveBlending;
            p.sprite.material.needsUpdate = true;

            p.sprite.position.set(
                position.x + (Math.random() - 0.5) * spread,
                position.y + (Math.random() - 0.5) * spread * 0.5,
                position.z + (Math.random() - 0.5) * spread
            );

            const angle = Math.random() * Math.PI * 2;
            const upAngle = Math.random() * Math.PI * 0.5;
            p.velocity.set(
                Math.cos(angle) * Math.cos(upAngle) * speed * (0.3 + Math.random() * 0.7),
                Math.sin(upAngle) * speed * (0.3 + Math.random() * 0.7) + upwardBias,
                Math.sin(angle) * Math.cos(upAngle) * speed * (0.3 + Math.random() * 0.7)
            );

            // Color with variation
            const c = new THREE.Color(color);
            c.r = Math.max(0, Math.min(1, c.r + (Math.random() - 0.5) * 0.2));
            c.g = Math.max(0, Math.min(1, c.g + (Math.random() - 0.5) * 0.2));
            c.b = Math.max(0, Math.min(1, c.b + (Math.random() - 0.5) * 0.2));
            p.startColor.copy(c);
            p.endColor.set(endColor);
            p.sprite.material.color.copy(c);

            p.sprite.scale.setScalar(p.startScale);
            p.sprite.visible = true;
            p.sprite.material.opacity = 1;
        }
    }

    update(deltaTime) {
        for (const p of this.particles) {
            if (!p.active) continue;

            p.life -= deltaTime;
            if (p.life <= 0) {
                p.active = false;
                p.sprite.visible = false;
                continue;
            }

            // Physics
            p.velocity.y += p.gravity * deltaTime;
            p.velocity.multiplyScalar(Math.pow(p.drag, deltaTime * 60));
            p.sprite.position.addScaledVector(p.velocity, deltaTime);

            // Rotation
            p.sprite.material.rotation += p.rotationSpeed * deltaTime;

            // Interpolation factor
            const t = p.life / p.maxLife;

            // Scale interpolation
            const scale = p.startScale * t + p.endScale * (1 - t);
            p.sprite.scale.setScalar(scale);

            // Color interpolation
            p.sprite.material.color.lerpColors(p.endColor, p.startColor, t);

            // Opacity - fade out near end
            p.sprite.material.opacity = Math.min(1, t * 2.5) * Math.min(1, p.life * 4);
        }
    }

    // === Effect Presets ===

    slimeHit(position, intensity = 1) {
        // Bright green splatter
        this.spawn(position, {
            count: Math.floor(15 * intensity),
            spread: 0.4,
            speed: 7,
            life: 0.8,
            size: 0.5,
            endSize: 0.05,
            gravity: -12,
            upwardBias: 5,
            color: 0x66ff66,
            endColor: 0x22aa22,
            texture: 'soft'
        });
        // Bright sparks
        this.spawn(position, {
            count: Math.floor(8 * intensity),
            spread: 0.2,
            speed: 10,
            life: 0.4,
            size: 0.25,
            gravity: -8,
            upwardBias: 3,
            color: 0xaaffaa,
            texture: 'spark'
        });
    }

    purpleSlimeHit(position, intensity = 1) {
        this.spawn(position, {
            count: Math.floor(18 * intensity),
            spread: 0.5,
            speed: 8,
            life: 0.9,
            size: 0.6,
            endSize: 0.05,
            gravity: -10,
            upwardBias: 6,
            color: 0xcc66ff,
            endColor: 0x6622aa,
            texture: 'soft'
        });
        // Magic sparkles
        this.spawn(position, {
            count: Math.floor(10 * intensity),
            spread: 0.3,
            speed: 12,
            life: 0.5,
            size: 0.3,
            gravity: -5,
            upwardBias: 4,
            color: 0xffaaff,
            texture: 'star',
            rotationSpeed: 5
        });
    }

    fireExplosion(position, radius = 3) {
        // Orange/red fire core
        this.spawn(position, {
            count: 30,
            spread: radius * 0.3,
            speed: 10,
            life: 0.7,
            size: 0.8,
            endSize: 0.1,
            gravity: 5,
            upwardBias: 8,
            color: 0xff6600,
            endColor: 0xff2200,
            texture: 'soft'
        });
        // Yellow bright center
        this.spawn(position, {
            count: 15,
            spread: radius * 0.2,
            speed: 6,
            life: 0.5,
            size: 0.6,
            gravity: 4,
            upwardBias: 6,
            color: 0xffff44,
            endColor: 0xff8800,
            texture: 'soft'
        });
        // Hot sparks
        this.spawn(position, {
            count: 20,
            spread: radius * 0.2,
            speed: 15,
            life: 0.6,
            size: 0.2,
            gravity: -10,
            upwardBias: 10,
            color: 0xffffaa,
            texture: 'spark'
        });
        // Smoke
        this.spawn(position, {
            count: 10,
            spread: radius * 0.4,
            speed: 3,
            life: 1.2,
            size: 1.0,
            endSize: 0.3,
            gravity: 2,
            upwardBias: 4,
            drag: 0.95,
            color: 0x444444,
            endColor: 0x111111,
            texture: 'smoke',
            blendMode: 'normal'
        });
    }

    shockwave(position, color = 0x8855ff) {
        // Ring of particles expanding outward
        for (let i = 0; i < 32; i++) {
            const angle = (i / 32) * Math.PI * 2;
            const offset = {
                x: position.x + Math.cos(angle) * 0.5,
                y: position.y + 0.3,
                z: position.z + Math.sin(angle) * 0.5
            };
            this.spawn(offset, {
                count: 2,
                spread: 0.2,
                speed: 12,
                life: 0.6,
                size: 0.4,
                endSize: 0.1,
                gravity: 0,
                upwardBias: 0,
                drag: 0.9,
                color: color,
                endColor: 0xffffff,
                texture: 'soft'
            });
        }
        // Center flash
        this.spawn(position, {
            count: 8,
            spread: 0.3,
            speed: 2,
            life: 0.3,
            size: 0.8,
            gravity: 0,
            upwardBias: 2,
            color: 0xffffff,
            texture: 'soft'
        });
    }

    bounceImpact(position) {
        // Dust cloud
        this.spawn(position, {
            count: 25,
            spread: 1.2,
            speed: 6,
            life: 1.0,
            size: 0.7,
            endSize: 0.2,
            gravity: -3,
            upwardBias: 2,
            drag: 0.92,
            color: 0xaa9977,
            endColor: 0x665544,
            texture: 'smoke',
            blendMode: 'normal'
        });
        // Impact sparks
        this.spawn(position, {
            count: 15,
            spread: 0.5,
            speed: 14,
            life: 0.4,
            size: 0.3,
            gravity: -15,
            upwardBias: 6,
            color: 0xffffcc,
            texture: 'spark'
        });
        // Ground ring
        for (let i = 0; i < 16; i++) {
            const angle = (i / 16) * Math.PI * 2;
            const offset = {
                x: position.x + Math.cos(angle) * 0.3,
                y: position.y + 0.1,
                z: position.z + Math.sin(angle) * 0.3
            };
            this.spawn(offset, {
                count: 1,
                spread: 0.1,
                speed: 8,
                life: 0.5,
                size: 0.35,
                gravity: -2,
                upwardBias: 0,
                drag: 0.88,
                color: 0xddccaa,
                texture: 'soft'
            });
        }
    }

    playerHit(position) {
        // Blood/damage particles
        this.spawn({x: position.x, y: position.y + 1, z: position.z}, {
            count: 12,
            spread: 0.3,
            speed: 5,
            life: 0.6,
            size: 0.35,
            endSize: 0.05,
            gravity: -15,
            upwardBias: 3,
            color: 0xff4444,
            endColor: 0x880000,
            texture: 'soft'
        });
        // White flash
        this.spawn({x: position.x, y: position.y + 1, z: position.z}, {
            count: 5,
            spread: 0.5,
            speed: 8,
            life: 0.2,
            size: 0.5,
            gravity: 0,
            upwardBias: 0,
            color: 0xffffff,
            texture: 'soft'
        });
    }

    healEffect(position) {
        // Rising green particles
        this.spawn({x: position.x, y: position.y + 0.3, z: position.z}, {
            count: 20,
            spread: 0.6,
            speed: 2,
            life: 1.5,
            size: 0.4,
            endSize: 0.1,
            gravity: 3,
            upwardBias: 4,
            drag: 0.97,
            color: 0x44ff88,
            endColor: 0x88ffaa,
            texture: 'soft'
        });
        // Sparkles
        this.spawn({x: position.x, y: position.y + 0.5, z: position.z}, {
            count: 10,
            spread: 0.8,
            speed: 1,
            life: 1.2,
            size: 0.25,
            gravity: 2,
            upwardBias: 3,
            color: 0xaaffcc,
            texture: 'star',
            rotationSpeed: 3
        });
    }

    slimeDrip(position) {
        // Purple slime drip falling down
        this.spawn(position, {
            count: 2,
            spread: 0.1,
            speed: 0.5,
            life: 1.2,
            size: 0.3,
            endSize: 0.15,
            gravity: -8,
            upwardBias: -1,
            drag: 0.98,
            color: 0x9955cc,
            endColor: 0x662288,
            texture: 'soft'
        });
    }

    swingTrail(startPos, endPos, color = 0xffffaa) {
        const dir = new THREE.Vector3().subVectors(endPos, startPos);
        const dist = dir.length();
        dir.normalize();

        const steps = Math.max(5, Math.floor(dist * 3));
        for (let i = 0; i < steps; i++) {
            const t = i / steps;
            const pos = new THREE.Vector3().lerpVectors(startPos, endPos, t);
            this.spawn(pos, {
                count: 1,
                spread: 0.05,
                speed: 0.5,
                life: 0.3,
                size: 0.25 * (1 - t * 0.6),
                endSize: 0.02,
                gravity: -2,
                upwardBias: 0,
                color: color,
                texture: 'soft'
            });
        }
    }

    cleaveWave(position, direction, range = 5) {
        const dir = direction.clone().normalize();
        for (let d = 1; d < range; d += 0.8) {
            const pos = position.clone().addScaledVector(dir, d);
            pos.y = 0.5;
            setTimeout(() => {
                // Main wave
                this.spawn(pos, {
                    count: 8,
                    spread: d * 0.25,
                    speed: 4,
                    life: 0.5,
                    size: 0.45,
                    endSize: 0.05,
                    gravity: 0,
                    upwardBias: 3,
                    color: 0xff9944,
                    endColor: 0xff4400,
                    texture: 'soft'
                });
                // Sparks
                this.spawn(pos, {
                    count: 3,
                    spread: d * 0.2,
                    speed: 8,
                    life: 0.3,
                    size: 0.2,
                    gravity: -5,
                    upwardBias: 4,
                    color: 0xffffaa,
                    texture: 'spark'
                });
            }, d * 20);
        }
    }

    bladestormSpin(position) {
        for (let i = 0; i < 12; i++) {
            const angle = (i / 12) * Math.PI * 2 + Math.random() * 0.3;
            const radius = 1.8 + Math.random() * 0.5;
            const pos = {
                x: position.x + Math.cos(angle) * radius,
                y: position.y + 0.8 + Math.random() * 0.5,
                z: position.z + Math.sin(angle) * radius
            };
            this.spawn(pos, {
                count: 1,
                spread: 0.05,
                speed: 3,
                life: 0.35,
                size: 0.3,
                endSize: 0.05,
                gravity: 0,
                upwardBias: 0,
                drag: 0.85,
                color: 0x99aaff,
                endColor: 0x4466ff,
                texture: 'soft'
            });
        }
        // Central glow
        this.spawn(position, {
            count: 2,
            spread: 0.3,
            speed: 0.5,
            life: 0.2,
            size: 0.6,
            gravity: 0,
            upwardBias: 0,
            color: 0xaabbff,
            texture: 'soft'
        });
    }

    chargeTrail(position, direction) {
        this.spawn(position, {
            count: 5,
            spread: 0.25,
            speed: 1.5,
            life: 0.45,
            size: 0.4,
            endSize: 0.05,
            gravity: 0,
            upwardBias: 0.5,
            drag: 0.8,
            color: 0x66aaff,
            endColor: 0x2266ff,
            texture: 'soft'
        });
        // Sparks
        this.spawn(position, {
            count: 2,
            spread: 0.3,
            speed: 4,
            life: 0.25,
            size: 0.15,
            gravity: -3,
            upwardBias: 1,
            color: 0xaaddff,
            texture: 'spark'
        });
    }

    deathExplosion(position, color = 0x44dd44, intensity = 1) {
        // Main burst
        this.spawn(position, {
            count: Math.floor(35 * intensity),
            spread: 0.6,
            speed: 12,
            life: 1.1,
            size: 0.5,
            endSize: 0.05,
            gravity: -10,
            upwardBias: 7,
            color: color,
            endColor: new THREE.Color(color).multiplyScalar(0.4).getHex(),
            texture: 'soft'
        });
        // Bright flash
        this.spawn(position, {
            count: Math.floor(15 * intensity),
            spread: 0.3,
            speed: 16,
            life: 0.35,
            size: 0.35,
            gravity: -12,
            upwardBias: 5,
            color: 0xffffff,
            texture: 'spark'
        });
        // Stars
        this.spawn(position, {
            count: Math.floor(8 * intensity),
            spread: 0.4,
            speed: 8,
            life: 0.8,
            size: 0.4,
            gravity: -5,
            upwardBias: 4,
            color: 0xffffff,
            texture: 'star',
            rotationSpeed: 4
        });
    }

    ambientParticles(position, radius = 20) {
        if (Math.random() > 0.08) return;
        const pos = {
            x: position.x + (Math.random() - 0.5) * radius * 2,
            y: Math.random() * 3,
            z: position.z + (Math.random() - 0.5) * radius * 2
        };
        this.spawn(pos, {
            count: 1,
            spread: 0,
            speed: 0.2,
            life: 3,
            size: 0.12,
            endSize: 0.02,
            gravity: 0.2,
            upwardBias: 0,
            drag: 0.995,
            color: 0xffffee,
            texture: 'soft'
        });
    }

    firePoolEffect(position) {
        // Flames rising
        this.spawn(position, {
            count: 4,
            spread: 1.8,
            speed: 2,
            life: 0.7,
            size: 0.4,
            endSize: 0.1,
            gravity: 3,
            upwardBias: 3,
            color: 0xff5500,
            endColor: 0xff2200,
            texture: 'soft'
        });
        // Embers
        if (Math.random() > 0.5) {
            this.spawn(position, {
                count: 2,
                spread: 1.5,
                speed: 4,
                life: 0.8,
                size: 0.15,
                gravity: 2,
                upwardBias: 4,
                color: 0xffaa44,
                texture: 'spark'
            });
        }
    }

    poisonPoolEffect(position) {
        // Bubbles rising
        this.spawn(position, {
            count: 3,
            spread: 1.3,
            speed: 1.2,
            life: 0.9,
            size: 0.3,
            endSize: 0.05,
            gravity: 2,
            upwardBias: 2,
            color: 0x66ff44,
            endColor: 0x33aa22,
            texture: 'soft'
        });
    }

    // New effects for enhanced visuals

    magicMissile(position, direction) {
        this.spawn(position, {
            count: 3,
            spread: 0.1,
            speed: 1,
            life: 0.3,
            size: 0.35,
            endSize: 0.05,
            gravity: 0,
            upwardBias: 0,
            drag: 0.9,
            color: 0x66aaff,
            texture: 'soft'
        });
        this.spawn(position, {
            count: 1,
            spread: 0.05,
            speed: 0.5,
            life: 0.15,
            size: 0.2,
            gravity: 0,
            upwardBias: 0,
            color: 0xffffff,
            texture: 'spark'
        });
    }

    levelUp(position) {
        // Golden spiral
        for (let i = 0; i < 30; i++) {
            const angle = (i / 30) * Math.PI * 4;
            const height = (i / 30) * 3;
            const radius = 1 - (i / 30) * 0.5;
            setTimeout(() => {
                const pos = {
                    x: position.x + Math.cos(angle) * radius,
                    y: position.y + height,
                    z: position.z + Math.sin(angle) * radius
                };
                this.spawn(pos, {
                    count: 2,
                    spread: 0.1,
                    speed: 1,
                    life: 0.8,
                    size: 0.3,
                    gravity: 1,
                    upwardBias: 0,
                    color: 0xffdd44,
                    texture: 'star',
                    rotationSpeed: 3
                });
            }, i * 15);
        }
    }

    criticalHit(position) {
        // Big impact
        this.spawn(position, {
            count: 25,
            spread: 0.5,
            speed: 14,
            life: 0.7,
            size: 0.5,
            endSize: 0.05,
            gravity: -12,
            upwardBias: 6,
            color: 0xffaa00,
            endColor: 0xff4400,
            texture: 'soft'
        });
        // Stars
        this.spawn(position, {
            count: 8,
            spread: 0.3,
            speed: 10,
            life: 0.5,
            size: 0.4,
            gravity: -8,
            upwardBias: 5,
            color: 0xffff88,
            texture: 'star',
            rotationSpeed: 6
        });
    }

    // === Mage Ability Effects ===

    magicCast(position) {
        // Blue magic sparkles at cast point
        this.spawn(position, {
            count: 12,
            spread: 0.3,
            speed: 3,
            life: 0.4,
            size: 0.3,
            endSize: 0.05,
            gravity: 1,
            upwardBias: 2,
            color: 0x44aaff,
            endColor: 0x2266ff,
            texture: 'spark'
        });
        this.spawn(position, {
            count: 5,
            spread: 0.2,
            speed: 1,
            life: 0.3,
            size: 0.5,
            gravity: 0,
            color: 0x88ccff,
            texture: 'soft'
        });
    }

    magicImpact(position) {
        // Blue burst on hit
        this.spawn(position, {
            count: 15,
            spread: 0.2,
            speed: 6,
            life: 0.4,
            size: 0.35,
            endSize: 0.05,
            gravity: -5,
            upwardBias: 3,
            color: 0x66bbff,
            endColor: 0x2244ff,
            texture: 'soft'
        });
        // Sparks
        this.spawn(position, {
            count: 8,
            spread: 0.15,
            speed: 8,
            life: 0.3,
            size: 0.2,
            gravity: -8,
            upwardBias: 2,
            color: 0xaaddff,
            texture: 'spark'
        });
    }

    blizzardBurst(position) {
        // Initial ice burst
        this.spawn({x: position.x, y: position.y + 0.5, z: position.z}, {
            count: 30,
            spread: 3,
            speed: 4,
            life: 1.0,
            size: 0.4,
            endSize: 0.1,
            gravity: -2,
            upwardBias: 3,
            drag: 0.95,
            color: 0x88ddff,
            endColor: 0xaaeeff,
            texture: 'soft'
        });
        // Ice crystals
        this.spawn({x: position.x, y: position.y + 1, z: position.z}, {
            count: 15,
            spread: 2,
            speed: 2,
            life: 1.5,
            size: 0.25,
            gravity: -4,
            upwardBias: 0,
            color: 0xccffff,
            texture: 'star',
            rotationSpeed: 2
        });
    }

    blizzardTick(position) {
        // Ongoing ice particles
        const angle = Math.random() * Math.PI * 2;
        const dist = Math.random() * 4;
        const pos = {
            x: position.x + Math.cos(angle) * dist,
            y: position.y + 0.3,
            z: position.z + Math.sin(angle) * dist
        };
        this.spawn(pos, {
            count: 3,
            spread: 0.3,
            speed: 1.5,
            life: 0.8,
            size: 0.25,
            endSize: 0.05,
            gravity: -3,
            upwardBias: 2,
            color: 0x88ccff,
            endColor: 0xaaddff,
            texture: 'soft'
        });
    }

    flameWave(position, direction, range = 8) {
        const dir = direction.clone().normalize();
        // Expanding wave of fire
        for (let d = 1; d < range; d += 0.6) {
            const pos = position.clone().addScaledVector(dir, d);
            pos.y = 0.5;
            setTimeout(() => {
                // Fire particles
                this.spawn(pos, {
                    count: 10,
                    spread: d * 0.3,
                    speed: 5,
                    life: 0.6,
                    size: 0.5,
                    endSize: 0.1,
                    gravity: 2,
                    upwardBias: 4,
                    color: 0xff6600,
                    endColor: 0xff2200,
                    texture: 'soft'
                });
                // Embers
                this.spawn(pos, {
                    count: 4,
                    spread: d * 0.2,
                    speed: 8,
                    life: 0.8,
                    size: 0.15,
                    gravity: -6,
                    upwardBias: 5,
                    color: 0xffaa44,
                    texture: 'spark'
                });
            }, d * 30);
        }
    }

    burnAuraFlame(position) {
        // Small fire puff
        this.spawn(position, {
            count: 2,
            spread: 0.1,
            speed: 2,
            life: 0.5,
            size: 0.3,
            endSize: 0.05,
            gravity: 3,
            upwardBias: 3,
            color: 0xff5500,
            endColor: 0xff2200,
            texture: 'soft'
        });
    }

    backstepTrail(startPos, endPos) {
        const dir = new THREE.Vector3().subVectors(endPos, startPos);
        const dist = dir.length();
        dir.normalize();

        // Trail of magic dust
        const steps = Math.floor(dist * 2);
        for (let i = 0; i < steps; i++) {
            const t = i / steps;
            const pos = new THREE.Vector3().lerpVectors(startPos, endPos, t);
            pos.y = 0.5;
            this.spawn(pos, {
                count: 3,
                spread: 0.2,
                speed: 2,
                life: 0.4,
                size: 0.3,
                endSize: 0.05,
                gravity: 0,
                upwardBias: 1,
                color: 0x8866ff,
                endColor: 0x4422aa,
                texture: 'soft'
            });
        }
        // Burst at end
        this.spawn(endPos, {
            count: 10,
            spread: 0.3,
            speed: 4,
            life: 0.3,
            size: 0.25,
            gravity: -2,
            upwardBias: 2,
            color: 0xaa88ff,
            texture: 'spark'
        });
    }
}
