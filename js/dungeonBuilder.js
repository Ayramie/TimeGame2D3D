import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

// Tile types for dungeon generation
export const DungeonTile = {
    EMPTY: 0,
    FLOOR: 1,
    WALL: 2,
    DOOR: 3,
    SPAWN: 4,
    CHEST: 5
};

export class DungeonBuilder {
    constructor(scene) {
        this.scene = scene;
        this.loader = new GLTFLoader();
        this.models = {};
        this.instances = [];
        this.lights = [];

        // Dungeon settings
        this.tileSize = 2; // Each tile is 2x2 units
        this.width = 30;
        this.height = 30;
        this.tiles = [];

        // Room settings
        this.minRoomSize = 4;
        this.maxRoomSize = 8;
        this.numRooms = 6;
        this.rooms = [];
    }

    async loadModels() {
        const modelList = [
            { name: 'wall', path: 'assets/dungeon/wall.gltf' },
            { name: 'wallCorner', path: 'assets/dungeon/wall_corner.gltf' },
            { name: 'wallDoorway', path: 'assets/dungeon/wall_doorway.gltf' },
            { name: 'floorTile', path: 'assets/dungeon/floor_tile_large.gltf' },
            { name: 'floorDirt', path: 'assets/dungeon/floor_dirt_large.gltf' },
            { name: 'torch', path: 'assets/dungeon/torch_lit.gltf' },
            { name: 'pillar', path: 'assets/dungeon/pillar.gltf' },
            { name: 'chest', path: 'assets/dungeon/chest.gltf' },
            { name: 'barrel', path: 'assets/dungeon/barrel_large.gltf' },
        ];

        const promises = modelList.map(m => this.loadModel(m.name, m.path));
        await Promise.all(promises);
        console.log('Dungeon models loaded:', Object.keys(this.models));
    }

    loadModel(name, path) {
        return new Promise((resolve) => {
            this.loader.load(
                path,
                (gltf) => {
                    this.models[name] = gltf.scene;
                    resolve(gltf.scene);
                },
                undefined,
                (error) => {
                    console.warn(`Failed to load ${name}:`, error);
                    resolve(null);
                }
            );
        });
    }

    generate() {
        // Initialize empty map
        this.tiles = [];
        for (let y = 0; y < this.height; y++) {
            this.tiles[y] = [];
            for (let x = 0; x < this.width; x++) {
                this.tiles[y][x] = DungeonTile.EMPTY;
            }
        }

        // Generate rooms
        this.rooms = [];
        for (let i = 0; i < this.numRooms; i++) {
            this.tryPlaceRoom();
        }

        // Connect rooms with corridors
        for (let i = 1; i < this.rooms.length; i++) {
            this.connectRooms(this.rooms[i - 1], this.rooms[i]);
        }

        // Add walls around floors
        this.generateWalls();

        // Add special tiles
        this.addSpecialTiles();

        return this.tiles;
    }

    tryPlaceRoom() {
        for (let attempt = 0; attempt < 50; attempt++) {
            const width = this.minRoomSize + Math.floor(Math.random() * (this.maxRoomSize - this.minRoomSize));
            const height = this.minRoomSize + Math.floor(Math.random() * (this.maxRoomSize - this.minRoomSize));
            const x = 2 + Math.floor(Math.random() * (this.width - width - 4));
            const y = 2 + Math.floor(Math.random() * (this.height - height - 4));

            if (this.canPlaceRoom(x, y, width, height)) {
                this.placeRoom(x, y, width, height);
                this.rooms.push({ x, y, width, height, centerX: x + width / 2, centerY: y + height / 2 });
                return true;
            }
        }
        return false;
    }

    canPlaceRoom(x, y, width, height) {
        // Check if area is clear with 1-tile buffer
        for (let py = y - 1; py < y + height + 1; py++) {
            for (let px = x - 1; px < x + width + 1; px++) {
                if (px < 0 || px >= this.width || py < 0 || py >= this.height) {
                    return false;
                }
                if (this.tiles[py][px] !== DungeonTile.EMPTY) {
                    return false;
                }
            }
        }
        return true;
    }

    placeRoom(x, y, width, height) {
        for (let py = y; py < y + height; py++) {
            for (let px = x; px < x + width; px++) {
                this.tiles[py][px] = DungeonTile.FLOOR;
            }
        }
    }

    connectRooms(roomA, roomB) {
        let x = Math.floor(roomA.centerX);
        let y = Math.floor(roomA.centerY);
        const targetX = Math.floor(roomB.centerX);
        const targetY = Math.floor(roomB.centerY);

        // L-shaped corridor
        while (x !== targetX) {
            if (this.tiles[y][x] === DungeonTile.EMPTY) {
                this.tiles[y][x] = DungeonTile.FLOOR;
            }
            x += x < targetX ? 1 : -1;
        }
        while (y !== targetY) {
            if (this.tiles[y][x] === DungeonTile.EMPTY) {
                this.tiles[y][x] = DungeonTile.FLOOR;
            }
            y += y < targetY ? 1 : -1;
        }
    }

    generateWalls() {
        for (let y = 0; y < this.height; y++) {
            for (let x = 0; x < this.width; x++) {
                if (this.tiles[y][x] === DungeonTile.FLOOR) {
                    // Check all 8 neighbors
                    for (let dy = -1; dy <= 1; dy++) {
                        for (let dx = -1; dx <= 1; dx++) {
                            if (dx === 0 && dy === 0) continue;
                            const nx = x + dx;
                            const ny = y + dy;
                            if (nx >= 0 && nx < this.width && ny >= 0 && ny < this.height) {
                                if (this.tiles[ny][nx] === DungeonTile.EMPTY) {
                                    this.tiles[ny][nx] = DungeonTile.WALL;
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    addSpecialTiles() {
        // Mark first room as spawn
        if (this.rooms.length > 0) {
            const spawn = this.rooms[0];
            const sx = Math.floor(spawn.centerX);
            const sy = Math.floor(spawn.centerY);
            this.tiles[sy][sx] = DungeonTile.SPAWN;
        }

        // Add chests to some rooms
        for (let i = 1; i < this.rooms.length; i++) {
            if (Math.random() < 0.5) {
                const room = this.rooms[i];
                const cx = room.x + 1 + Math.floor(Math.random() * (room.width - 2));
                const cy = room.y + 1 + Math.floor(Math.random() * (room.height - 2));
                if (this.tiles[cy][cx] === DungeonTile.FLOOR) {
                    this.tiles[cy][cx] = DungeonTile.CHEST;
                }
            }
        }
    }

    build() {
        // Clear previous instances
        this.dispose();

        // Create ground plane
        this.createGroundPlane();

        // Place tiles
        for (let y = 0; y < this.height; y++) {
            for (let x = 0; x < this.width; x++) {
                const tile = this.tiles[y][x];
                const worldX = x * this.tileSize;
                const worldZ = y * this.tileSize;

                switch (tile) {
                    case DungeonTile.FLOOR:
                    case DungeonTile.SPAWN:
                        this.placeFloor(worldX, worldZ);
                        break;
                    case DungeonTile.WALL:
                        this.placeWall(x, y, worldX, worldZ);
                        break;
                    case DungeonTile.CHEST:
                        this.placeFloor(worldX, worldZ);
                        this.placeModel('chest', worldX, 0, worldZ, Math.random() * Math.PI * 2, 1.5);
                        break;
                }
            }
        }

        // Add torches in rooms
        for (const room of this.rooms) {
            this.addRoomDecoration(room);
        }
    }

    createGroundPlane() {
        // Dark void under the dungeon
        const geometry = new THREE.PlaneGeometry(this.width * this.tileSize, this.height * this.tileSize);
        const material = new THREE.MeshStandardMaterial({
            color: 0x111111,
            roughness: 1
        });
        const ground = new THREE.Mesh(geometry, material);
        ground.rotation.x = -Math.PI / 2;
        ground.position.set(
            (this.width * this.tileSize) / 2 - this.tileSize / 2,
            -0.1,
            (this.height * this.tileSize) / 2 - this.tileSize / 2
        );
        ground.receiveShadow = true;
        this.scene.add(ground);
        this.instances.push(ground);
    }

    placeFloor(x, z) {
        const model = this.models.floorTile || this.models.floorDirt;
        if (!model) {
            // Fallback: simple plane
            const geometry = new THREE.PlaneGeometry(this.tileSize, this.tileSize);
            const material = new THREE.MeshStandardMaterial({
                color: 0x4a4a4a,
                roughness: 0.9
            });
            const floor = new THREE.Mesh(geometry, material);
            floor.rotation.x = -Math.PI / 2;
            floor.position.set(x, 0.01, z);
            floor.receiveShadow = true;
            this.scene.add(floor);
            this.instances.push(floor);
            return;
        }

        const instance = model.clone();
        instance.position.set(x, 0, z);
        instance.scale.setScalar(this.tileSize / 2);
        instance.traverse(child => {
            if (child.isMesh) {
                child.castShadow = true;
                child.receiveShadow = true;
            }
        });
        this.scene.add(instance);
        this.instances.push(instance);
    }

    placeWall(tileX, tileY, worldX, worldZ) {
        // Check if this wall is next to a floor (visible wall)
        const hasFloorNeighbor = this.hasAdjacentFloor(tileX, tileY);
        if (!hasFloorNeighbor) return;

        const model = this.models.wall;
        if (!model) {
            // Fallback: simple box
            const geometry = new THREE.BoxGeometry(this.tileSize, this.tileSize * 1.5, this.tileSize);
            const material = new THREE.MeshStandardMaterial({
                color: 0x666666,
                roughness: 0.8
            });
            const wall = new THREE.Mesh(geometry, material);
            wall.position.set(worldX, this.tileSize * 0.75, worldZ);
            wall.castShadow = true;
            wall.receiveShadow = true;
            this.scene.add(wall);
            this.instances.push(wall);
            return;
        }

        // Determine wall rotation based on adjacent floors
        const rotation = this.getWallRotation(tileX, tileY);

        const instance = model.clone();
        instance.position.set(worldX, 0, worldZ);
        instance.rotation.y = rotation;
        instance.scale.setScalar(this.tileSize / 2);
        instance.traverse(child => {
            if (child.isMesh) {
                child.castShadow = true;
                child.receiveShadow = true;
            }
        });
        this.scene.add(instance);
        this.instances.push(instance);
    }

    hasAdjacentFloor(x, y) {
        const directions = [[0, -1], [0, 1], [-1, 0], [1, 0]];
        for (const [dx, dy] of directions) {
            const nx = x + dx;
            const ny = y + dy;
            if (nx >= 0 && nx < this.width && ny >= 0 && ny < this.height) {
                const tile = this.tiles[ny][nx];
                if (tile === DungeonTile.FLOOR || tile === DungeonTile.SPAWN || tile === DungeonTile.CHEST) {
                    return true;
                }
            }
        }
        return false;
    }

    getWallRotation(x, y) {
        // Check which side has floor
        const north = y > 0 && this.isFloorTile(this.tiles[y - 1][x]);
        const south = y < this.height - 1 && this.isFloorTile(this.tiles[y + 1][x]);
        const west = x > 0 && this.isFloorTile(this.tiles[y][x - 1]);
        const east = x < this.width - 1 && this.isFloorTile(this.tiles[y][x + 1]);

        if (south) return 0;
        if (north) return Math.PI;
        if (east) return -Math.PI / 2;
        if (west) return Math.PI / 2;
        return 0;
    }

    isFloorTile(tile) {
        return tile === DungeonTile.FLOOR || tile === DungeonTile.SPAWN || tile === DungeonTile.CHEST;
    }

    addRoomDecoration(room) {
        // Add torches at corners
        const torchPositions = [
            { x: room.x + 1, y: room.y + 1 },
            { x: room.x + room.width - 2, y: room.y + 1 },
            { x: room.x + 1, y: room.y + room.height - 2 },
            { x: room.x + room.width - 2, y: room.y + room.height - 2 },
        ];

        for (const pos of torchPositions) {
            if (Math.random() < 0.6) {
                const worldX = pos.x * this.tileSize;
                const worldZ = pos.y * this.tileSize;
                this.placeModel('torch', worldX, 0, worldZ, Math.random() * Math.PI * 2, 1.5);

                // Add point light
                const light = new THREE.PointLight(0xff6622, 1.5, 8);
                light.position.set(worldX, 2, worldZ);
                light.castShadow = false; // Performance
                this.scene.add(light);
                this.lights.push(light);
            }
        }

        // Add pillars in larger rooms
        if (room.width >= 6 && room.height >= 6 && Math.random() < 0.5) {
            const cx = (room.x + room.width / 2) * this.tileSize;
            const cz = (room.y + room.height / 2) * this.tileSize;
            this.placeModel('pillar', cx - this.tileSize, 0, cz - this.tileSize, 0, 1.5);
            this.placeModel('pillar', cx + this.tileSize, 0, cz - this.tileSize, 0, 1.5);
            this.placeModel('pillar', cx - this.tileSize, 0, cz + this.tileSize, 0, 1.5);
            this.placeModel('pillar', cx + this.tileSize, 0, cz + this.tileSize, 0, 1.5);
        }

        // Add barrels
        if (Math.random() < 0.4) {
            const bx = (room.x + 1 + Math.random() * (room.width - 2)) * this.tileSize;
            const bz = (room.y + 1 + Math.random() * (room.height - 2)) * this.tileSize;
            this.placeModel('barrel', bx, 0, bz, Math.random() * Math.PI * 2, 1.5);
        }
    }

    placeModel(name, x, y, z, rotation = 0, scale = 1) {
        const model = this.models[name];
        if (!model) return null;

        const instance = model.clone();
        instance.position.set(x, y, z);
        instance.rotation.y = rotation;
        instance.scale.setScalar(scale);
        instance.traverse(child => {
            if (child.isMesh) {
                child.castShadow = true;
                child.receiveShadow = true;
            }
        });
        this.scene.add(instance);
        this.instances.push(instance);
        return instance;
    }

    // Get spawn position in world coordinates
    getSpawnPosition() {
        if (this.rooms.length > 0) {
            const spawn = this.rooms[0];
            return {
                x: spawn.centerX * this.tileSize,
                z: spawn.centerY * this.tileSize
            };
        }
        return { x: this.width * this.tileSize / 2, z: this.height * this.tileSize / 2 };
    }

    // Get enemy spawn positions (in rooms other than spawn)
    getEnemySpawnPositions(count) {
        const positions = [];
        for (let i = 1; i < this.rooms.length && positions.length < count; i++) {
            const room = this.rooms[i];
            // Add multiple enemies per room
            const enemiesInRoom = Math.min(2, count - positions.length);
            for (let j = 0; j < enemiesInRoom; j++) {
                const x = (room.x + 1 + Math.random() * (room.width - 2)) * this.tileSize;
                const z = (room.y + 1 + Math.random() * (room.height - 2)) * this.tileSize;
                positions.push({ x, z, room: i });
            }
        }
        return positions;
    }

    // Check if a world position is walkable
    isWalkable(worldX, worldZ) {
        const tileX = Math.floor(worldX / this.tileSize + 0.5);
        const tileY = Math.floor(worldZ / this.tileSize + 0.5);

        if (tileX < 0 || tileX >= this.width || tileY < 0 || tileY >= this.height) {
            return false;
        }

        const tile = this.tiles[tileY][tileX];
        return tile === DungeonTile.FLOOR || tile === DungeonTile.SPAWN || tile === DungeonTile.CHEST;
    }

    // Convert world to tile coordinates
    worldToTile(worldX, worldZ) {
        return {
            x: Math.floor(worldX / this.tileSize + 0.5),
            y: Math.floor(worldZ / this.tileSize + 0.5)
        };
    }

    // Convert tile to world coordinates
    tileToWorld(tileX, tileY) {
        return {
            x: tileX * this.tileSize,
            z: tileY * this.tileSize
        };
    }

    dispose() {
        for (const instance of this.instances) {
            this.scene.remove(instance);
            instance.traverse(child => {
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

        for (const light of this.lights) {
            this.scene.remove(light);
        }
        this.lights = [];
    }
}
