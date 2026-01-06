import * as THREE from 'three';
import { Player } from './player.js';
import { Mage } from './mage.js';
import { ThirdPersonCamera } from './camera.js';
import { InputManager } from './input.js';
import { Enemy, SlimeEnemy, GreaterSlimeEnemy, SlimeBoss, SkeletonEnemy } from './enemy.js';
import { EffectsManager } from './effects.js';
import { ParticleSystem } from './particles.js';
import { EnvironmentLoader } from './environment.js';

export class Game {
    constructor(canvas) {
        this.canvas = canvas;
        this.clock = new THREE.Clock();

        // Three.js core
        this.scene = new THREE.Scene();
        this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

        // Sky gradient - create a simple gradient background
        this.scene.background = new THREE.Color(0x88bbee);
        this.scene.fog = new THREE.FogExp2(0x88bbee, 0.008);

        // Game state
        this.gameState = 'menu'; // 'menu' or 'playing'
        this.gameMode = null; // 'mobbing' or 'boss'
        this.selectedClass = 'warrior'; // 'warrior' or 'mage'
        this.enemies = [];
        this.projectiles = [];
        this.particles = [];
        this.damageNumbers = [];
        this.groundHazards = [];

        // Effects manager
        this.effects = new EffectsManager(this.scene);

        // Setup menu handlers
        this.setupMenu();

        // Handle window resize
        window.addEventListener('resize', () => this.onResize());
    }

    setupMenu() {
        const menuBtns = document.querySelectorAll('.menu-btn');
        menuBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                const mode = btn.dataset.mode;
                this.startGame(mode);
            });
        });

        // Character selection buttons
        const classBtns = document.querySelectorAll('.class-btn');
        classBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                // Remove selected from all
                classBtns.forEach(b => b.classList.remove('selected'));
                // Add selected to clicked
                btn.classList.add('selected');
                this.selectedClass = btn.dataset.class;
            });
        });

        const returnBtn = document.getElementById('return-menu-btn');
        returnBtn.addEventListener('click', () => {
            this.returnToMenu();
        });
    }

    async startGame(mode) {
        this.gameMode = mode;
        this.gameState = 'loading';

        // Hide menu, show loading text, hide canvas during load
        const menu = document.getElementById('main-menu');
        menu.innerHTML = '<h1>Loading...</h1>';
        this.canvas.style.opacity = '0';

        // Clear previous game state
        this.clearScene();

        // Setup fresh game
        this.setupScene();
        this.setupLighting();
        this.setupPlayer();

        // Wait for character to load before continuing
        if (this.player && this.player.character) {
            // Wait for character loading to complete
            while (this.player.characterLoading) {
                await new Promise(resolve => setTimeout(resolve, 50));
            }
        }

        this.setupCamera();
        this.setupInput();
        this.spawnEnemies();

        // Create particle system
        this.particles = new ParticleSystem(this.scene);

        // Screen shake
        this.screenShake = { intensity: 0, decay: 0.9 };

        // Ambient particle timer
        this.ambientTimer = 0;

        // Now show UI and canvas
        this.gameState = 'playing';
        this.canvas.style.opacity = '1';
        menu.classList.add('hidden');
        menu.innerHTML = `
            <h1>TileGame 3D</h1>
            <div class="class-selection">
                <h3>Choose Class</h3>
                <div class="class-buttons">
                    <button class="class-btn selected" data-class="warrior">⚔️ Warrior</button>
                    <button class="class-btn" data-class="mage">🔮 Mage</button>
                </div>
            </div>
            <div class="menu-options">
                <button class="menu-btn" data-mode="mobbing">Mobbing</button>
                <button class="menu-btn" data-mode="boss">Slime Boss</button>
            </div>
        `;
        document.getElementById('ui').style.display = 'block';
        document.getElementById('return-menu-btn').style.display = 'block';

        // Update ability bar labels based on class
        this.updateAbilityLabels();

        // Re-attach menu handlers since we replaced innerHTML
        this.setupMenu();
    }

    updateAbilityLabels() {
        if (this.selectedClass === 'mage') {
            document.querySelector('#ability-q .name').textContent = 'Blizzard';
            document.querySelector('#ability-f .name').textContent = 'Flame Wave';
            document.querySelector('#ability-e .name').textContent = 'Burn Aura';
            document.querySelector('#ability-r .name').textContent = 'Backstep';
        } else {
            document.querySelector('#ability-q .name').textContent = 'Cleave';
            document.querySelector('#ability-f .name').textContent = 'Bladestorm';
            document.querySelector('#ability-e .name').textContent = 'Parry';
            document.querySelector('#ability-r .name').textContent = 'Charge';
        }
    }

    returnToMenu() {
        this.gameState = 'menu';
        this.gameMode = null;

        // Show menu, hide UI
        document.getElementById('main-menu').classList.remove('hidden');
        document.getElementById('ui').style.display = 'none';
        document.getElementById('return-menu-btn').style.display = 'none';
        document.getElementById('target-frame').style.display = 'none';

        // Clear the scene
        this.clearScene();
    }

    clearScene() {
        // Remove all objects from scene
        while (this.scene.children.length > 0) {
            const obj = this.scene.children[0];
            this.scene.remove(obj);
            if (obj.geometry) obj.geometry.dispose();
            if (obj.material) {
                if (Array.isArray(obj.material)) {
                    obj.material.forEach(m => m.dispose());
                } else {
                    obj.material.dispose();
                }
            }
        }

        this.enemies = [];
        this.projectiles = [];
        this.groundHazards = [];

        // Dispose environment
        if (this.environment) {
            this.environment.dispose();
            this.environment = null;
        }
    }

    setupScene() {
        // Ground plane with procedural grass-like texture
        const groundGeometry = new THREE.PlaneGeometry(200, 200, 100, 100);

        // Add some vertex displacement for natural look
        const positions = groundGeometry.attributes.position;
        for (let i = 0; i < positions.count; i++) {
            const x = positions.getX(i);
            const z = positions.getY(i);
            // Subtle wave pattern
            const height = Math.sin(x * 0.1) * Math.cos(z * 0.1) * 0.2;
            positions.setZ(i, height);
        }
        groundGeometry.computeVertexNormals();

        const groundMaterial = new THREE.MeshStandardMaterial({
            color: 0x4a9f4a,
            roughness: 0.85,
            metalness: 0.0,
            flatShading: false
        });
        this.ground = new THREE.Mesh(groundGeometry, groundMaterial);
        this.ground.rotation.x = -Math.PI / 2;
        this.ground.receiveShadow = true;
        this.scene.add(this.ground);

        // Subtle grid for arena feel
        const gridHelper = new THREE.GridHelper(200, 40, 0x3d7d3d, 0x3d7d3d);
        gridHelper.position.y = 0.02;
        gridHelper.material.opacity = 0.15;
        gridHelper.material.transparent = true;
        this.scene.add(gridHelper);

        // Add arena circle marker
        const arenaCircle = new THREE.RingGeometry(25, 25.3, 64);
        const arenaMaterial = new THREE.MeshBasicMaterial({
            color: 0x5588aa,
            transparent: true,
            opacity: 0.3,
            side: THREE.DoubleSide
        });
        const arena = new THREE.Mesh(arenaCircle, arenaMaterial);
        arena.rotation.x = -Math.PI / 2;
        arena.position.y = 0.03;
        this.scene.add(arena);

        // Add some decorative elements - use KayKit assets if available
        this.addScenery();
    }

    async addScenery() {
        // Try to load KayKit environment assets
        this.environment = new EnvironmentLoader(this.scene);
        try {
            await this.environment.loadAllModels();
            this.environment.createArenaEnvironment();
            console.log('KayKit environment loaded');
        } catch (error) {
            console.warn('Failed to load KayKit assets, using fallback scenery');
            this.addFallbackScenery();
        }
    }

    addFallbackScenery() {
        // Simple trees as cylinders with sphere tops
        const treePositions = [
            [-15, 10], [-20, -5], [25, 15], [30, -20], [-25, -25],
            [18, -12], [-10, 25], [35, 5], [-30, 15], [5, -30]
        ];

        for (const [x, z] of treePositions) {
            this.addTree(x, z);
        }

        // Rocks
        const rockPositions = [
            [-8, 5], [12, -8], [-5, -15], [20, 10], [-18, -10]
        ];

        for (const [x, z] of rockPositions) {
            this.addRock(x, z);
        }
    }

    addTree(x, z) {
        const trunkGeometry = new THREE.CylinderGeometry(0.3, 0.4, 3, 8);
        const trunkMaterial = new THREE.MeshStandardMaterial({ color: 0x8B4513 });
        const trunk = new THREE.Mesh(trunkGeometry, trunkMaterial);
        trunk.position.set(x, 1.5, z);
        trunk.castShadow = true;
        this.scene.add(trunk);

        const foliageGeometry = new THREE.SphereGeometry(2, 8, 6);
        const foliageMaterial = new THREE.MeshStandardMaterial({ color: 0x228B22 });
        const foliage = new THREE.Mesh(foliageGeometry, foliageMaterial);
        foliage.position.set(x, 4, z);
        foliage.castShadow = true;
        this.scene.add(foliage);
    }

    addRock(x, z) {
        const rockGeometry = new THREE.DodecahedronGeometry(0.8, 0);
        const rockMaterial = new THREE.MeshStandardMaterial({
            color: 0x666666,
            roughness: 0.9
        });
        const rock = new THREE.Mesh(rockGeometry, rockMaterial);
        rock.position.set(x, 0.4, z);
        rock.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, 0);
        rock.scale.set(1, 0.6, 1);
        rock.castShadow = true;
        this.scene.add(rock);
    }

    setupLighting() {
        // Ambient light - warmer tone
        const ambient = new THREE.AmbientLight(0xffeedd, 0.35);
        this.scene.add(ambient);

        // Main directional light (sun) - golden hour feel
        const sun = new THREE.DirectionalLight(0xfff4e5, 1.2);
        sun.position.set(50, 80, 30);
        sun.castShadow = true;
        sun.shadow.mapSize.width = 2048;
        sun.shadow.mapSize.height = 2048;
        sun.shadow.camera.near = 0.5;
        sun.shadow.camera.far = 250;
        sun.shadow.camera.left = -60;
        sun.shadow.camera.right = 60;
        sun.shadow.camera.top = 60;
        sun.shadow.camera.bottom = -60;
        sun.shadow.bias = -0.0001;
        sun.shadow.normalBias = 0.02;
        this.scene.add(sun);

        // Fill light from opposite side - cool blue tint
        const fillLight = new THREE.DirectionalLight(0x88aaff, 0.3);
        fillLight.position.set(-30, 40, -20);
        this.scene.add(fillLight);

        // Hemisphere light for sky/ground color blending
        const hemi = new THREE.HemisphereLight(0x88ccff, 0x446633, 0.4);
        this.scene.add(hemi);

        // Rim light for character highlighting
        const rimLight = new THREE.DirectionalLight(0xffffff, 0.2);
        rimLight.position.set(0, 20, -50);
        this.scene.add(rimLight);
    }

    setupPlayer() {
        // Create player based on selected class
        if (this.selectedClass === 'mage') {
            this.player = new Mage(this.scene, this, 'mage');
        } else {
            this.player = new Player(this.scene, this, 'warrior');
        }
        this.player.position.set(0, 0, 0);
    }

    setupCamera() {
        this.camera = new THREE.PerspectiveCamera(
            60,
            window.innerWidth / window.innerHeight,
            0.1,
            1000
        );
        this.cameraController = new ThirdPersonCamera(this.camera, this.player);
    }

    setupInput() {
        this.input = new InputManager(this.canvas, this);
    }

    spawnEnemies() {
        if (this.gameMode === 'boss') {
            // Spawn the Slime Boss
            const boss = new SlimeBoss(this.scene, this, 0, 15);
            boss.name = 'Slime Boss';
            this.enemies.push(boss);
        } else {
            // Mobbing mode - spawn slimes around the arena
            const slimePositions = [
                [8, 0, 5], [10, 0, -8], [-12, 0, 6], [-8, 0, -10],
            ];

            for (const [x, y, z] of slimePositions) {
                const slime = new SlimeEnemy(this.scene, x, z);
                this.enemies.push(slime);
            }

            // Spawn skeleton enemies with 3D models
            const skeletonTypes = ['warrior', 'mage', 'minion', 'rogue'];
            const skeletonPositions = [
                [15, 0, 12], [-15, 0, -15], [20, 0, 0], [-5, 0, 20]
            ];

            for (let i = 0; i < skeletonPositions.length; i++) {
                const [x, y, z] = skeletonPositions[i];
                const skeletonType = skeletonTypes[i % skeletonTypes.length];
                const skeleton = new SkeletonEnemy(this.scene, x, z, skeletonType);
                skeleton.name = `Skeleton ${skeletonType.charAt(0).toUpperCase() + skeletonType.slice(1)}`;
                this.enemies.push(skeleton);
            }

            // Spawn a Greater Slime
            const boss = new GreaterSlimeEnemy(this.scene, 0, 20);
            boss.name = 'Greater Slime';
            this.enemies.push(boss);
        }
    }

    targetClosestEnemy() {
        if (this.enemies.length === 0) return;

        const playerPos = this.player.position;
        let closest = null;
        let closestDist = Infinity;

        for (const enemy of this.enemies) {
            if (!enemy.isAlive) continue;
            if (this.player.targetEnemy === enemy) continue; // Skip current target

            const dist = playerPos.distanceTo(enemy.position);
            if (dist < closestDist) {
                closestDist = dist;
                closest = enemy;
            }
        }

        if (closest) {
            this.player.setTarget(closest);
        } else if (this.enemies.some(e => e.isAlive)) {
            // If we skipped current target and it's the only one, re-target it
            const aliveEnemy = this.enemies.find(e => e.isAlive);
            if (aliveEnemy) this.player.setTarget(aliveEnemy);
        }
    }

    clearTarget() {
        this.player.setTarget(null);
    }

    addProjectile(position, direction, damage, range, type, owner) {
        // Create visual mesh based on type
        let mesh;
        if (type === 'slash') {
            // Slash projectile - elongated glowing blade
            const geometry = new THREE.BoxGeometry(0.15, 0.6, 1.5);
            const material = new THREE.MeshBasicMaterial({
                color: 0xffaa44,
                transparent: true,
                opacity: 0.9
            });
            mesh = new THREE.Mesh(geometry, material);
            mesh.position.copy(position);
            mesh.rotation.y = Math.atan2(direction.x, direction.z);

            // Add glow trail
            const trailGeometry = new THREE.BoxGeometry(0.1, 0.4, 1.2);
            const trailMaterial = new THREE.MeshBasicMaterial({
                color: 0xffdd88,
                transparent: true,
                opacity: 0.6
            });
            const trail = new THREE.Mesh(trailGeometry, trailMaterial);
            trail.position.z = -0.3;
            mesh.add(trail);
        } else {
            // Default sphere projectile
            const geometry = new THREE.SphereGeometry(0.2, 8, 8);
            const material = new THREE.MeshBasicMaterial({ color: 0xff6600 });
            mesh = new THREE.Mesh(geometry, material);
            mesh.position.copy(position);
        }

        const projectile = {
            mesh: mesh,
            position: position.clone(),
            direction: direction.normalize(),
            speed: 18,
            damage: damage,
            range: range,
            traveled: 0,
            alive: true,
            owner: owner,
            update: function(dt) {
                const move = this.direction.clone().multiplyScalar(this.speed * dt);
                this.position.add(move);
                this.mesh.position.copy(this.position);
                this.traveled += this.speed * dt;
                if (this.traveled >= this.range) {
                    this.alive = false;
                }
            },
            checkHit: function(enemy) {
                const dist = this.position.distanceTo(enemy.position);
                return dist < 1.2;
            }
        };

        this.projectiles.push(projectile);
        this.scene.add(mesh);
    }

    addDamageNumber(position, damage, isHeal = false) {
        this.damageNumbers.push({
            position: position.clone(),
            damage,
            isHeal,
            life: 1.0,
            velocity: new THREE.Vector3(
                (Math.random() - 0.5) * 2,
                5,
                (Math.random() - 0.5) * 2
            )
        });
    }

    update(deltaTime) {
        // Skip updates if not playing
        if (this.gameState !== 'playing') return;

        // Update player
        this.player.update(deltaTime, this.input, this.cameraController);

        // Update camera
        this.cameraController.update(deltaTime, this.input);

        // Update enemies
        for (const enemy of this.enemies) {
            if (enemy.isAlive) {
                enemy.update(deltaTime, this.player, this.camera);
            }

            // Check for hit particles
            if (enemy.lastHitPosition && this.particles) {
                const isBoss = enemy.constructor.name === 'SlimeBoss';
                const isGreater = enemy.constructor.name === 'GreaterSlimeEnemy';

                if (isBoss || isGreater) {
                    this.particles.purpleSlimeHit(enemy.lastHitPosition, enemy.lastHitAmount / 20);
                } else {
                    this.particles.slimeHit(enemy.lastHitPosition, enemy.lastHitAmount / 15);
                }

                // Screen shake based on damage
                this.addScreenShake(Math.min(enemy.lastHitAmount / 30, 0.5));

                enemy.lastHitPosition = null;
                enemy.lastHitAmount = null;
            }

            // Check for death particles
            if (enemy.justDied && this.particles) {
                const isBoss = enemy.constructor.name === 'SlimeBoss';
                const isGreater = enemy.constructor.name === 'GreaterSlimeEnemy';

                if (isBoss) {
                    this.particles.deathExplosion(enemy.deathPosition, 0x8844aa, 3);
                    this.addScreenShake(2);
                } else if (isGreater) {
                    this.particles.deathExplosion(enemy.deathPosition, 0x8844aa, 1.5);
                    this.addScreenShake(1);
                } else {
                    this.particles.deathExplosion(enemy.deathPosition, 0x44dd44, 1);
                    this.addScreenShake(0.5);
                }

                enemy.justDied = false;
            }
        }

        // Update projectiles
        for (let i = this.projectiles.length - 1; i >= 0; i--) {
            const proj = this.projectiles[i];
            proj.update(deltaTime);

            // Check collision with enemies
            for (const enemy of this.enemies) {
                if (enemy.isAlive && proj.checkHit(enemy)) {
                    enemy.takeDamage(proj.damage, this.player);
                    this.effects.createDamageNumber(enemy.position, proj.damage);
                    proj.alive = false;
                }
            }

            if (!proj.alive) {
                this.scene.remove(proj.mesh);
                this.projectiles.splice(i, 1);
            }
        }

        // Update damage numbers
        for (let i = this.damageNumbers.length - 1; i >= 0; i--) {
            const dn = this.damageNumbers[i];
            dn.life -= deltaTime * 1.5;
            dn.velocity.y -= deltaTime * 10; // Gravity
            dn.position.add(dn.velocity.clone().multiplyScalar(deltaTime));

            if (dn.life <= 0) {
                this.damageNumbers.splice(i, 1);
            }
        }

        // Check player collision with enemies
        this.checkPlayerEnemyCollision();

        // Update effects
        this.effects.update(deltaTime);

        // Update particles
        if (this.particles) {
            this.particles.update(deltaTime);

            // Ambient particles
            this.ambientTimer += deltaTime;
            if (this.ambientTimer > 0.1) {
                this.ambientTimer = 0;
                this.particles.ambientParticles(this.player.position, 30);
            }

            // Fire pool effects
            for (const hazard of this.groundHazards) {
                if (hazard.type === 'fire' && Math.random() < 0.3) {
                    this.particles.firePoolEffect(hazard.position);
                } else if (hazard.type === 'poison' && Math.random() < 0.2) {
                    this.particles.poisonPoolEffect(hazard.position);
                }
            }
        }

        // Update screen shake
        if (this.screenShake && this.screenShake.intensity > 0) {
            this.screenShake.intensity *= this.screenShake.decay;
            if (this.screenShake.intensity < 0.01) {
                this.screenShake.intensity = 0;
            }
        }

        // Update ground hazards
        this.updateGroundHazards(deltaTime);

        // Update UI
        this.updateUI();
    }

    updateGroundHazards(deltaTime) {
        for (let i = this.groundHazards.length - 1; i >= 0; i--) {
            const hazard = this.groundHazards[i];

            // Update duration
            hazard.duration -= deltaTime;

            // Fade out as duration decreases
            if (hazard.mesh && hazard.mesh.material) {
                const baseOpacity = hazard.type === 'fire' ? 0.6 : 0.5;
                hazard.mesh.material.opacity = Math.min(baseOpacity, hazard.duration * 0.3);
            }

            // Check for player damage (tick every 0.5s)
            hazard.tickTimer += deltaTime;
            if (hazard.tickTimer >= 0.5) {
                hazard.tickTimer = 0;

                const dist = this.player.position.distanceTo(hazard.position);
                if (dist < hazard.radius) {
                    this.player.takeDamage(hazard.damage);
                    this.effects.createDamageNumber(this.player.position, hazard.damage, false);
                }
            }

            // Remove expired hazards
            if (hazard.duration <= 0) {
                if (hazard.mesh) {
                    this.scene.remove(hazard.mesh);
                    if (hazard.mesh.geometry) hazard.mesh.geometry.dispose();
                    if (hazard.mesh.material) hazard.mesh.material.dispose();
                }
                this.groundHazards.splice(i, 1);
            }
        }
    }

    checkPlayerEnemyCollision() {
        for (const enemy of this.enemies) {
            if (!enemy.isAlive) continue;

            // Skip boss - boss only uses telegraphed special attacks
            if (enemy instanceof SlimeBoss) continue;

            const dist = this.player.position.distanceTo(enemy.position);
            if (dist < 1.5) {
                enemy.tryAttack(this.player);
            }
        }
    }

    updateUI() {
        // Health bar
        const healthPercent = (this.player.health / this.player.maxHealth) * 100;
        document.getElementById('health-fill').style.width = `${healthPercent}%`;
        document.getElementById('health-text').textContent =
            `${Math.ceil(this.player.health)} / ${this.player.maxHealth}`;

        // Target frame
        const targetFrame = document.getElementById('target-frame');
        if (this.player.targetEnemy && this.player.targetEnemy.isAlive) {
            targetFrame.style.display = 'block';
            document.getElementById('target-name').textContent =
                this.player.targetEnemy.name || 'Slime';
            const targetHealthPercent =
                (this.player.targetEnemy.health / this.player.targetEnemy.maxHealth) * 100;
            document.getElementById('target-health-fill').style.width = `${targetHealthPercent}%`;
        } else {
            targetFrame.style.display = 'none';
        }

        // Ability cooldowns - different for each class
        if (this.selectedClass === 'mage') {
            this.updateAbilityCooldown('q', this.player.abilities.blizzard);
            this.updateAbilityCooldown('f', this.player.abilities.flameWave);
            this.updateAbilityCooldown('e', this.player.abilities.burnAura);
            this.updateAbilityCooldown('r', this.player.abilities.backstep);
            this.updateAbilityCooldown('1', this.player.abilities.potion);
        } else {
            this.updateAbilityCooldown('q', this.player.abilities.cleave);
            this.updateAbilityCooldown('f', this.player.abilities.bladestorm);
            this.updateAbilityCooldown('e', this.player.abilities.parry);
            this.updateAbilityCooldown('r', this.player.abilities.charge);
            this.updateAbilityCooldown('1', this.player.abilities.potion);
        }
    }

    updateAbilityCooldown(key, ability) {
        const element = document.getElementById(`ability-${key}`);
        if (!element || !ability) return;

        const overlay = element.querySelector('.cooldown-overlay');
        if (ability.cooldownRemaining > 0) {
            element.classList.add('on-cooldown');
            const percent = (ability.cooldownRemaining / ability.cooldown) * 100;
            overlay.style.height = `${percent}%`;
        } else {
            element.classList.remove('on-cooldown');
            overlay.style.height = '0%';
        }

        if (ability.isActive) {
            element.classList.add('active');
        } else {
            element.classList.remove('active');
        }

        if (ability.isCharging) {
            element.classList.add('charging');
        } else {
            element.classList.remove('charging');
        }
    }

    render() {
        // Skip render if in menu or no camera
        if (this.gameState === 'menu' || !this.camera) return;

        // Apply screen shake (temporary offset, then restore)
        let shakeX = 0, shakeY = 0;
        if (this.screenShake && this.screenShake.intensity > 0.01) {
            shakeX = (Math.random() - 0.5) * this.screenShake.intensity;
            shakeY = (Math.random() - 0.5) * this.screenShake.intensity;
            this.camera.position.x += shakeX;
            this.camera.position.y += shakeY;
        }

        this.renderer.render(this.scene, this.camera);

        // Restore camera position
        if (shakeX !== 0 || shakeY !== 0) {
            this.camera.position.x -= shakeX;
            this.camera.position.y -= shakeY;
        }
    }

    addScreenShake(intensity) {
        if (this.screenShake) {
            // Reduce intensity significantly
            this.screenShake.intensity = Math.max(this.screenShake.intensity, intensity * 0.15);
        }
    }

    onResize() {
        if (this.camera) {
            this.camera.aspect = window.innerWidth / window.innerHeight;
            this.camera.updateProjectionMatrix();
        }
        this.renderer.setSize(window.innerWidth, window.innerHeight);
    }

    start() {
        const gameLoop = () => {
            const deltaTime = Math.min(this.clock.getDelta(), 0.1);
            this.update(deltaTime);
            this.render();
            requestAnimationFrame(gameLoop);
        };
        gameLoop();
    }
}
